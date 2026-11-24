import { Injectable, signal } from '@angular/core';

/**
 * The companies the server answered «company_unpaid» for (documentations/18): suspended for not
 * paying, with every screen but Suscripción closed. Anyone of the company learns it here, agents
 * included (they cannot read the subscription); reading it again after a payment clears it.
 */
@Injectable({ providedIn: 'root' })
export class CompanyLock {
  private readonly unpaid = signal<ReadonlySet<string>>(new Set());

  isUnpaid(tenantId: string): boolean {
    return this.unpaid().has(tenantId);
  }

  markUnpaid(tenantId: string): void {
    if (!this.unpaid().has(tenantId)) this.unpaid.update((ids) => new Set(ids).add(tenantId));
  }

  clear(tenantId: string): void {
    if (!this.unpaid().has(tenantId)) return;
    this.unpaid.update((ids) => {
      const next = new Set(ids);
      next.delete(tenantId);
      return next;
    });
  }
}
