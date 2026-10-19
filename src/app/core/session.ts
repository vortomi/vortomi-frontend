import { Injectable, computed, inject } from '@angular/core';
import type { Id } from '../shared/api/models';
import { Auth } from './auth';
import { Directory } from './directory';

/** Who is signed in, which company they are working on and what they may do there. */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly directory = inject(Directory);
  private readonly auth = inject(Auth);

  readonly ready = this.directory.ready;
  readonly users = this.directory.users;
  readonly memberships = this.directory.memberships;
  readonly activeTenantId = this.auth.activeTenantId;

  readonly user = computed(() => this.directory.userById().get(this.auth.userId() ?? '') ?? null);
  readonly isSuperAdmin = computed(() => this.user()?.platformRole === 'super_admin');

  /** Every company the person belongs to, including suspended ones (shown but not enterable). */
  readonly myTenants = computed(() => {
    const userId = this.user()?.id;
    const ids = new Set(
      this.memberships()
        .filter((m) => m.userId === userId && m.status === 'active')
        .map((m) => m.tenantId),
    );
    return this.directory.tenants().filter((t) => ids.has(t.id));
  });

  readonly enterableTenantIds = computed(() =>
    this.myTenants()
      .filter((t) => t.status === 'active')
      .map((t) => t.id),
  );

  readonly tenant = computed(() => {
    const id = this.activeTenantId();
    return id && this.enterableTenantIds().includes(id) ? (this.directory.tenantById().get(id) ?? null) : null;
  });

  readonly membership = computed(() => {
    const userId = this.user()?.id;
    const tenantId = this.tenant()?.id;
    return this.memberships().find((m) => m.userId === userId && m.tenantId === tenantId) ?? null;
  });

  readonly isTenantAdmin = computed(() => this.membership()?.role === 'admin');
  readonly timezone = computed(() => this.tenant()?.timezone ?? 'America/Caracas');

  switchTenant(tenantId: Id): boolean {
    if (!this.enterableTenantIds().includes(tenantId)) return false;
    this.auth.selectTenant(tenantId);
    return true;
  }
}
