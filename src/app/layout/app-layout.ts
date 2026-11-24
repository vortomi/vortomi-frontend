import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CompanyLock } from '../core/company-lock';
import { Session } from '../core/session';
import { Workspace } from '../core/workspace';
import { InboxData } from '../features/inbox/inbox.data';
import { InventoryData } from '../features/inventory/inventory.data';
import { OrdersQueue } from '../features/orders/orders-queue';
import { SetupData } from '../features/setup/setup.data';
import { SubscriptionBanner } from '../features/subscription/subscription-banner';
import { SubscriptionData } from '../features/subscription/subscription.data';
import { SubscriptionLock } from '../features/subscription/subscription-lock';
import { Icon } from '../shared/ui/icon';
import { type NavBadge, type NavItem, TENANT_NAV, WARNING_BADGES } from './nav';
import { ChannelBanner } from './channel-banner';
import { TenantSwitcher } from './tenant-switcher';
import { UsageMeter } from './usage-meter';
import { UserMenu } from './user-menu';
import { ThemeToggle } from '../shared/ui/theme-toggle';
import { BRAND } from '../core/brand';
import { BrandMark } from '../shared/ui/brand-mark';

/** Frame of the company panel (app.<domain>): sidebar on desktop, bottom bar on phones. */
@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ChannelBanner, SubscriptionBanner, SubscriptionLock, TenantSwitcher, UsageMeter, UserMenu, ThemeToggle, BrandMark],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
})
export class AppLayout {
  protected readonly brand = BRAND;
  private readonly workspace = inject(Workspace);
  private readonly inbox = inject(InboxData);
  private readonly session = inject(Session);
  private readonly inventory = inject(InventoryData);
  private readonly orders = inject(OrdersQueue);
  private readonly setup = inject(SetupData);
  private readonly subscription = inject(SubscriptionData);
  private readonly router = inject(Router);
  private readonly lock = inject(CompanyLock);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly admin = this.session.isTenantAdmin;
  /** Suspended for not paying (documentations/18): every entry but Suscripción shows a lock. */
  protected readonly locked = computed(() => {
    const tenantId = this.session.tenant()?.id;
    return this.subscription.locked() || (!!tenantId && this.lock.isUnpaid(tenantId));
  });
  /** Suscripción stays open: it is where the company pays. */
  protected readonly lockedHere = computed(() => this.locked() && !this.isOpenWhileLocked(this.url()));

  constructor() {
    // A company's admin who never did nor skipped the welcome gets it before the panel.
    effect(() => {
      if (this.setup.needsWelcome()) untracked(() => void this.router.navigateByUrl('/welcome'));
    });
  }

  /** Agents do not see admin-only entries, nor anyone sales entries in support-only mode (routes are guarded too). */
  private readonly visible = (item: NavItem) =>
    (!item.adminOnly || this.session.isTenantAdmin()) && (!item.salesOnly || this.workspace.sells());
  protected readonly groups = computed(() =>
    TENANT_NAV.map((g) => ({ ...g, items: g.items.filter(this.visible) })).filter((g) => g.items.length),
  );
  protected readonly mobileItems = computed(() => TENANT_NAV.flatMap((g) => g.items).filter((i) => i.mobile && this.visible(i)));

  /** A count, or a short text («6 d»); 0 or null shows nothing. */
  private readonly badges = computed<Record<NavBadge, number | string | null>>(() => ({
    unread: this.inbox.unreadTotal(),
    ordersToReview: this.orders.toReview(),
    rejectedTemplates: this.workspace.templates().filter((t) => t.status === 'rejected').length,
    outOfStock: this.inventory.items().filter((i) => i.status === 'out').length,
    subscription: this.subscription.badge(),
  }));

  protected isOpenWhileLocked(path: string): boolean {
    return path === '/subscription' || path.startsWith('/subscription?') || path.startsWith('/subscription/');
  }

  protected warns(kind: NavBadge | undefined): boolean {
    return !!kind && WARNING_BADGES.includes(kind);
  }

  protected badge(kind: NavBadge | undefined): number | string | null {
    return kind ? this.badges()[kind] : null;
  }
}
