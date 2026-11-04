import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { Session } from '../../core/session';
import { Workspace } from '../../core/workspace';
import type { Id } from '../../shared/api/models';
import { InboxData } from '../inbox/inbox.data';
import { OrdersRemote } from './orders-remote';

/**
 * How many orders wait for someone to check their payment, for the «Pedidos» entry of the menu.
 * Read again each time the inbox reads the server: on every change notice (a new order or a
 * status change is one) and now and then, so it needs no live line of its own.
 */
@Injectable({ providedIn: 'root' })
export class OrdersQueue {
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(OrdersRemote) : null;
  private readonly session = inject(Session);
  private readonly workspace = inject(Workspace);
  private readonly inbox = inject(InboxData);

  readonly toReview = signal(0);

  constructor() {
    effect(() => {
      const tenantId = this.session.tenant()?.id;
      const sells = this.workspace.sells();
      this.inbox.synced();
      untracked(() => (this.remote && tenantId && sells ? void this.load(tenantId) : this.toReview.set(0)));
    });
  }

  private async load(tenantId: Id): Promise<void> {
    try {
      const waiting = await this.remote!.list(tenantId, { status: 'payment_review' });
      // The company may have changed while it was asked.
      if (this.session.tenant()?.id === tenantId) this.toReview.set(waiting.length);
    } catch {
      // Secondary: the count stays as it was until the next read.
    }
  }
}
