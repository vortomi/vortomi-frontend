import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { Id } from '../../shared/api/models';
import { Toaster } from '../../shared/ui/toaster';
import { SetupRemote } from './setup-remote';
import type { PlanPart, SetupAnswers, SetupPlan, SetupStatus } from './setup.models';

/**
 * The active company's welcome (block C): whether it was done, the plan for some answers, and
 * applying or skipping it. 'mock': the sample companies already have their business type, so
 * the welcome only opens on demand and prepares nothing (there is no server to create it).
 */
@Injectable({ providedIn: 'root' })
export class SetupData {
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly remote = inject(API_CONFIG).mode === 'api' ? inject(SetupRemote) : null;

  /** Null until read for the active company. */
  readonly status = signal<SetupStatus | null>(null);
  /** An admin of a company that never did nor skipped it: the panel opens the welcome. */
  readonly needsWelcome = computed(() => this.session.isTenantAdmin() && this.status() !== null && !this.status()!.completedAt);

  constructor() {
    effect(() => {
      const tenant = this.session.tenant();
      untracked(() => {
        this.status.set(null);
        if (!tenant) return;
        if (!this.remote) {
          this.status.set({ businessType: tenant.businessType, businessTypeOther: tenant.businessTypeOther, sells: null, sellMethod: null, completedAt: tenant.businessType ? tenant.createdAt : null });
          return;
        }
        void this.load(tenant.id);
      });
    });
  }

  async plan(answers: SetupAnswers): Promise<SetupPlan | null> {
    if (!this.remote) return { workMode: answers.sells === 'none' ? 'support_only' : null, saleDefaults: null, categories: [], productFields: [], contactFields: [], variantTypes: [], tags: [] };
    try {
      return await this.remote.plan(this.tenantId(), answers);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return null;
    }
  }

  apply(answers: SetupAnswers, include: PlanPart[]): Promise<boolean> {
    return this.write((remote, tenantId) => remote.apply(tenantId, answers, include), { ...answers, completedAt: new Date().toISOString() });
  }

  skip(): Promise<boolean> {
    const current = this.status();
    return this.write((remote, tenantId) => remote.skip(tenantId), {
      businessType: current?.businessType ?? null,
      businessTypeOther: current?.businessTypeOther ?? '',
      sells: current?.sells ?? null,
      sellMethod: current?.sellMethod ?? null,
      completedAt: current?.completedAt ?? new Date().toISOString(),
    });
  }

  private async load(tenantId: Id): Promise<void> {
    try {
      const status = await this.remote!.status(tenantId);
      if (this.session.tenant()?.id === tenantId) this.status.set(status);
    } catch {
      // Without it the welcome simply does not open; Ajustes still offers it.
    }
  }

  private async write(send: (remote: SetupRemote, tenantId: Id) => Promise<SetupStatus>, local: SetupStatus): Promise<boolean> {
    try {
      this.status.set(this.remote ? await send(this.remote, this.tenantId()) : local);
      return true;
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      return false;
    }
  }

  private tenantId(): Id {
    return this.session.tenant()?.id ?? '';
  }
}
