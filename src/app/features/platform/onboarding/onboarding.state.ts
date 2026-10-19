import { Injectable, computed, inject, signal } from '@angular/core';
import { Clock } from '../../../core/clock';
import { Directory } from '../../../core/directory';
import { Session } from '../../../core/session';
import { INDUSTRY_VERTICAL } from '../../../shared/api/labels';
import type { Id, TenantPlan, WhatsAppVertical } from '../../../shared/api/models';
import { newId } from '../../../shared/api/mock-db';
import type { IconName } from '../../../shared/ui/icon';
import { PlatformData } from '../platform.data';
import { type WabaAccount, type WabaLookup, type WabaNumber, classifyWabaLookup, connectionChecks, slugify } from './onboarding.rules';

export interface CompanyDraft {
  name: string;
  industry: string;
  city: string;
  timezone: string;
  plan: TenantPlan;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  /** Optional; also offered for the WhatsApp profile. */
  website: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
}

/** What customers see when they open the business on WhatsApp. Sent to Meta for the number. */
export interface WhatsAppProfile {
  about: string;
  vertical: WhatsAppVertical | '';
  email: string;
  website: string;
  address: string;
  photoDataUrl: string | null;
}

export interface ChannelChoice {
  wabaId: string;
  number: WabaNumber;
  account: WabaAccount;
  label: string;
  profile: WhatsAppProfile;
}

export type CheckStatus = 'pending' | 'running' | 'ok' | 'warn';

export interface ConnectionCheck {
  title: string;
  detail: string;
  status: CheckStatus;
}

export interface TestEvent {
  icon: IconName;
  title: string;
  detail: string;
  key: boolean;
}

export const emptyCompany = (): CompanyDraft => ({
  name: '',
  industry: '',
  city: '',
  timezone: 'America/Caracas',
  plan: 'basic',
  legalName: '',
  taxId: '',
  fiscalAddress: '',
  website: '',
  adminName: '',
  adminEmail: '',
  adminPhone: '',
});

/** Profile prefilled from step 1, so nobody types the same thing twice. */
export const profileFrom = (company: CompanyDraft): WhatsAppProfile => ({
  about: '',
  vertical: INDUSTRY_VERTICAL[company.industry] ?? '',
  email: company.adminEmail.trim(),
  website: company.website.trim(),
  address: company.fiscalAddress.trim(),
  photoDataUrl: null,
});

const CHANNEL_COLORS = ['#3b4fd8', '#c2410c', '#0f766e', '#7c3aed'];
const INVITATION_TTL_MS = 72 * 3_600_000;
// Simulated latency so the steps read like the real thing.
const META_LATENCY_MS = 900;
const STEP_MS = 420;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * State of the 4-step manual sign-up. Each step persists right away (draft → awaiting_channel →
 * active), so the work survives leaving the screen, as the design requires.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingState {
  private readonly directory = inject(Directory);
  private readonly platform = inject(PlatformData);
  private readonly clock = inject(Clock);
  private readonly session = inject(Session);

  /** Admin contact typed in step 1, kept per draft until the invitation is created. */
  private readonly drafts = new Map<Id, CompanyDraft>();

  readonly step = signal(0);
  readonly tenantId = signal<Id | null>(null);
  readonly company = signal<CompanyDraft>(emptyCompany());
  readonly channel = signal<ChannelChoice | null>(null);
  readonly checks = signal<ConnectionCheck[]>([]);
  readonly connected = signal(false);
  readonly testEvents = signal<TestEvent[]>([]);
  readonly testStatus = signal<'idle' | 'running' | 'passed'>('idle');
  readonly invitationToken = signal<string | null>(null);

  readonly tenant = computed(() => this.directory.tenantById().get(this.tenantId() ?? '') ?? null);

  start(): void {
    this.tenantId.set(null);
    this.company.set(emptyCompany());
    this.resetFrom(0);
  }

  /** Reopens a company left half way, at the step its status points to. */
  resume(tenantId: Id): void {
    const tenant = this.directory.tenantById().get(tenantId);
    if (!tenant || (tenant.status !== 'draft' && tenant.status !== 'awaiting_channel')) return this.start();
    this.tenantId.set(tenantId);
    this.company.set(
      this.drafts.get(tenantId) ?? {
        ...emptyCompany(),
        name: tenant.name,
        industry: tenant.industry,
        city: tenant.city,
        timezone: tenant.timezone,
        plan: tenant.plan,
        legalName: tenant.legalName,
        taxId: tenant.taxId,
        fiscalAddress: tenant.fiscalAddress,
      },
    );
    if (tenant.status === 'draft') return this.resetFrom(1);
    const channel = this.directory.channels().find((c) => c.tenantId === tenantId);
    this.resetFrom(2);
    if (channel) {
      this.channel.set({
        wabaId: channel.wabaId,
        number: { phoneNumberId: channel.phoneNumberId, displayNumber: channel.displayNumber, verifiedName: tenant.name, nameStatus: 'approved', takenBy: null },
        account: { businessVerified: false, hasPaymentMethod: false },
        label: channel.label,
        profile: profileFrom(this.company()),
      });
      this.connected.set(true);
    }
  }

  saveCompany(draft: CompanyDraft): void {
    const id = this.tenantId();
    const fields = {
      name: draft.name.trim(),
      industry: draft.industry,
      city: draft.city.trim(),
      timezone: draft.timezone,
      plan: draft.plan,
      legalName: draft.legalName.trim(),
      taxId: draft.taxId,
      fiscalAddress: draft.fiscalAddress.trim(),
    };
    if (id) {
      this.directory.updateTenant(id, { ...fields, slug: slugify(fields.name) });
    } else {
      const tenantId = newId('ten');
      this.directory.addTenant({ id: tenantId, ...fields, slug: slugify(fields.name), status: 'draft', currency: 'USD', createdAt: this.now() });
      this.platform.audit(tenantId, 'tenant.created', `Alta manual con plan ${draft.plan}`);
      this.tenantId.set(tenantId);
    }
    this.company.set(draft);
    this.drafts.set(this.tenantId()!, draft);
  }

  async lookupWaba(wabaId: string): Promise<WabaLookup> {
    await wait(META_LATENCY_MS);
    const names = new Map(this.directory.tenants().map((t) => [t.id, t.name]));
    return classifyWabaLookup(wabaId, this.directory.channels(), names, this.company().name);
  }

  /** Runs the automatic checks of step 2 and, if they pass, stores the number for this company. */
  async connect(choice: ChannelChoice): Promise<void> {
    const tenantId = this.tenantId();
    if (!tenantId || choice.number.takenBy) return;
    this.channel.set(choice);
    this.connected.set(false);
    const results = connectionChecks(choice.account, choice.number);
    const plan: ConnectionCheck[] = results.map(({ title, detail }) => ({ title, detail, status: 'pending' }));
    this.checks.set(plan);
    for (let i = 0; i < plan.length; i++) {
      this.setCheck(i, 'running');
      await wait(STEP_MS);
      this.setCheck(i, results[i]!.outcome);
    }
    const color = CHANNEL_COLORS[this.directory.channels().filter((c) => c.tenantId === tenantId).length % CHANNEL_COLORS.length]!;
    this.directory.addChannel({
      id: newId('ch'),
      tenantId,
      label: choice.label.trim(),
      displayNumber: choice.number.displayNumber,
      phoneNumberId: choice.number.phoneNumberId,
      wabaId: choice.wabaId.replace(/\D/g, ''),
      status: 'connected',
      qualityRating: 'high',
      messagingTier: 250,
      coexistence: false,
      color,
      accessExpiresAt: new Date(this.clock.now().getTime() + 60 * 86_400_000).toISOString(),
    });
    this.directory.updateTenant(tenantId, { status: 'awaiting_channel' });
    this.platform.audit(tenantId, 'channel.connected', `Número ${choice.number.displayNumber} (${choice.label.trim()})`);
    this.connected.set(true);
  }

  /** Step 3: the customer writes first, so the reply fits in the free tier (no template needed). */
  async runTest(): Promise<void> {
    const channel = this.channel();
    if (!channel) return;
    const company = this.company().name;
    const events: TestEvent[] = [
      { icon: 'phone', title: `${this.company().adminName.split(' ')[0] || 'El cliente'} escribe al número de la empresa`, detail: 'Desde un teléfono de prueba', key: false },
      { icon: 'server', title: 'Meta avisó a nuestro servidor', detail: 'Al mismo punto de entrada que usan todas las empresas', key: false },
      { icon: 'shield', title: `El aviso traía el número ${channel.number.displayNumber}`, detail: 'Es lo único que indica de quién es el mensaje', key: true },
      { icon: 'building', title: `Identificado como ${company}`, detail: 'Ese número solo pertenece a esta empresa', key: true },
      { icon: 'inbox', title: 'Guardado en su bandeja, y en ninguna otra', detail: 'Ninguna otra empresa recibió nada', key: false },
      { icon: 'send', title: 'Respuesta enviada, entregada y leída', detail: 'Dentro de la ventana de 24 h que abrió su mensaje', key: false },
    ];
    this.testEvents.set([]);
    this.testStatus.set('running');
    for (const event of events) {
      await wait(STEP_MS + 120);
      this.testEvents.update((list) => [...list, event]);
    }
    this.testStatus.set('passed');
  }

  /** Step 4: the company goes live and the admin gets a single-use, 72 h invitation. */
  activate(): void {
    const tenantId = this.tenantId();
    const draft = this.company();
    if (!tenantId) return;
    const now = this.clock.now();
    const email = draft.adminEmail.trim().toLowerCase();
    const user = this.directory.findUserByEmail(email);
    const userId = user?.id ?? newId('usr');
    if (!user) this.directory.addUser({ id: userId, name: draft.adminName.trim(), email, platformRole: null });

    const channelIds = this.directory.channels().filter((c) => c.tenantId === tenantId).map((c) => c.id);
    this.directory.upsertMembership({ tenantId, userId, role: 'admin', status: 'invited', channelAccountIds: channelIds, canSeeOthers: true });

    const token = `demo-${newId('tok').slice(4)}`;
    this.directory.addInvitation({
      id: newId('inv'),
      tenantId,
      email,
      name: draft.adminName.trim(),
      role: 'admin',
      invitedByUserId: this.session.user()?.id ?? 'system',
      demoToken: token,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
      acceptedAt: null,
      createdAt: now.toISOString(),
    });
    // The test round trip: the customer's message plus one free service reply per connected number.
    for (const channelAccountId of channelIds) {
      this.directory.addUsage({ tenantId, channelAccountId, month: '2026-10', totalMessages: 2, serviceMessages: 1, utilityMessages: 0, marketingMessages: 0, freeEntryMessages: 0 });
    }
    this.directory.updateTenant(tenantId, { status: 'active' });
    this.platform.audit(tenantId, 'tenant.activated', 'Prueba de ida y vuelta superada');
    this.platform.audit(tenantId, 'invitation.sent', `Invitación a ${email}`);
    this.drafts.delete(tenantId);
    this.invitationToken.set(token);
  }

  goTo(step: number): void {
    this.step.set(step);
  }

  private resetFrom(step: number): void {
    this.step.set(step);
    this.channel.set(null);
    this.checks.set([]);
    this.connected.set(false);
    this.testEvents.set([]);
    this.testStatus.set('idle');
    this.invitationToken.set(null);
  }

  private setCheck(index: number, status: CheckStatus): void {
    this.checks.update((list) => list.map((c, i) => (i === index ? { ...c, status } : c)));
  }

  private now(): string {
    return this.clock.now().toISOString();
  }
}
