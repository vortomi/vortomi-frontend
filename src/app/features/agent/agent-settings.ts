import { Component, computed, inject, signal } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { AgentSchedule, AgentSettings, AgentTone } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { OptionCards } from '../../shared/ui/option-cards';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { type AgentSettingsInput, AgentRemote } from './agent-remote';
import { SCHEDULE_OPTIONS, TONE_OPTIONS } from './agent.models';

const MAX_INFO = 4000;

/**
 * «Ajustes → Agente»: the sales agent answers the company's customers by itself while it is on.
 * Admins choose its name, tone, when it answers and what it may tell about the business; prices
 * and stock it takes only from the inventory. Server only: the prototype has no model.
 */
@Component({
  selector: 'app-agent-settings',
  imports: [Icon, OptionCards],
  template: `
    @if (!remote) {
      <section class="card box"><p class="lead">El agente necesita el servidor: en el prototipo no hay un modelo que responda.</p></section>
    } @else if (draft(); as d) {
      <section class="card box head">
        <span class="badge" [class.on]="d.enabled"><app-icon name="sparkles" /></span>
        <div class="grow">
          <h2>{{ d.enabled ? 'Agente encendido' : 'Agente apagado' }}</h2>
          <p class="lead">{{ d.enabled ? 'Responde solo a tus clientes, sin que intervenga nadie del equipo.' : 'Nadie responde automáticamente: tu equipo atiende todo.' }}</p>
        </div>
        <button type="button" role="switch" class="switch" [class.on]="d.enabled" [attr.aria-checked]="d.enabled" aria-label="Encender el agente"
          (click)="patch({ enabled: !d.enabled })"><span class="knob"></span></button>
      </section>

      <div class="stats">
        <div class="stat"><span>Respuestas este mes</span><b>{{ saved()!.usage.replies }} <small>de {{ saved()!.usage.cap }}</small></b></div>
        <div class="stat"><span>Modelo</span>
          @if (saved()!.modelReady) { <b class="ok">Conectado</b> } @else { <b class="warn">Sin configurar</b> }
        </div>
      </div>
      @if (!saved()!.modelReady) {
        <p class="note warn">La plataforma todavía no tiene un modelo configurado: aunque lo enciendas, el agente no responderá.</p>
      }

      <section class="card box">
        <div class="field">
          <label for="agent-name">Nombre con el que se presenta</label>
          <input id="agent-name" class="input name" maxlength="40" [value]="d.assistantName" (input)="patch({ assistantName: value($event) })" />
          <p class="field-hint">Saluda con «¡Hola! Qué gusto saludarte, te comunicas con {{ companyName() }}». Este nombre lo dice solo si el cliente pregunta con quién habla.</p>
        </div>
        <div class="field">
          <span class="label">Tono</span>
          <app-option-cards label="Tono" [options]="tones" [value]="d.tone" (picked)="setTone($event)" />
        </div>
        <div class="field">
          <span class="label">Cuándo responde</span>
          <app-option-cards label="Cuándo responde" [options]="schedules" [value]="d.schedule" (picked)="setSchedule($event)" />
        </div>
        <div class="field">
          <label for="agent-info">Lo que puede contarle a tus clientes</label>
          <textarea id="agent-info" class="input" rows="5" [attr.maxlength]="maxInfo" [value]="d.businessInfo" (input)="patch({ businessInfo: value($event) })"
            placeholder="Estamos en Av. Bolívar, Valencia. Aceptamos Pago Móvil, Zelle y efectivo. Envíos por MRW a todo el país."></textarea>
          <p class="field-hint">Dirección, formas de pago, envíos, garantías. Los precios y las existencias los toma solo de tu catálogo. {{ d.businessInfo.length }}/{{ maxInfo }}</p>
        </div>
        <p class="note"><app-icon name="shield" />Cuando el cliente quiere comprar, arma el pedido completo (productos, delivery o retiro, dirección, nombre y forma de pago), se lo confirma con el cliente y lo pasa a tu equipo en «Pedidos». Nunca da descuentos ni confirma pagos. Si el cliente pide una persona o el agente no sabe la respuesta, también pasa la conversación a tu equipo.</p>
        <div class="actions">
          @if (dirty()) { <button type="button" class="btn" [disabled]="saving()" (click)="reset()">Descartar</button> }
          <button type="button" class="btn btn--primary" [disabled]="saving() || !dirty()" [attr.aria-busy]="saving()" (click)="save()">
            @if (saving()) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="check" /> }
            Guardar
          </button>
        </div>
      </section>
    } @else {
      <section class="card box"><p class="lead">Cargando…</p></section>
    }
  `,
  styleUrls: ['../../shared/ui/section.scss'],
  styles: `
    .head { flex-direction: row; align-items: center; gap: 14px; }
    .grow { flex: 1; min-width: 0; }
    .lead { color: var(--color-text-muted); font-size: 13px; margin-top: 2px; }
    .badge { width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      background: var(--color-surface-muted); color: var(--color-text-muted); --icon-size: 22px; }
    .badge.on { background: var(--color-primary); color: #fff; }
    .switch { width: 44px; height: 24px; flex-shrink: 0; border: 0; border-radius: 999px; background: var(--color-border-strong); position: relative; cursor: pointer;
      transition: background 0.15s; }
    .switch.on { background: var(--color-primary); }
    .switch:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
    .switch.on .knob { transform: translateX(20px); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .stat { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
    .stat span { font-size: 12.5px; color: var(--color-text-muted); }
    .stat b { font-size: 18px; font-weight: 600; }
    .stat small { font-size: 12.5px; font-weight: 400; color: var(--color-text-muted); }
    .ok { color: var(--color-success); }
    .warn { color: var(--color-warning); }
    .name { max-width: 280px; }
    .label { font-size: 13px; font-weight: 600; color: var(--color-text-2); }
    .note { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; padding: 10px 12px; border-radius: 10px; background: var(--color-surface-muted);
      color: var(--color-text-2); --icon-size: 16px; }
    .note.warn { margin: -4px 0 16px; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; }
  `,
})
export class AgentSettingsPage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(AgentRemote) : null;
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);

  protected readonly tones = TONE_OPTIONS;
  protected readonly schedules = SCHEDULE_OPTIONS;
  protected readonly maxInfo = MAX_INFO;

  protected readonly saved = signal<AgentSettings | null>(null);
  protected readonly draft = signal<AgentSettingsInput | null>(null);
  protected readonly saving = signal(false);
  protected readonly companyName = computed(() => this.session.tenant()?.name ?? 'tu empresa');
  protected readonly dirty = computed(() => {
    const saved = this.saved();
    const draft = this.draft();
    return !!saved && !!draft && (Object.keys(draft) as (keyof AgentSettingsInput)[]).some((key) => draft[key] !== saved[key]);
  });

  constructor() {
    inject(UnsavedChanges).track(this.dirty);
    void this.load();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected patch(change: Partial<AgentSettingsInput>): void {
    this.draft.update((d) => (d ? { ...d, ...change } : d));
  }

  protected setTone(value: string): void {
    this.patch({ tone: value as AgentTone });
  }

  protected setSchedule(value: string): void {
    this.patch({ schedule: value as AgentSchedule });
  }

  protected reset(): void {
    const saved = this.saved();
    if (saved) this.draft.set(pick(saved));
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    const tenantId = this.session.tenant()?.id;
    if (!draft || !tenantId || !this.remote || this.saving()) return;
    if (!draft.assistantName.trim()) return this.toaster.show('Escribe el nombre con el que se presenta.', 'info');
    this.saving.set(true);
    try {
      const saved = await this.remote.save(tenantId, { ...draft, assistantName: draft.assistantName.trim(), businessInfo: draft.businessInfo.trim() });
      this.saved.set(saved);
      this.draft.set(pick(saved));
      this.toaster.show(saved.enabled ? 'Agente guardado: ya responde a tus clientes' : 'Agente guardado: está apagado');
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    try {
      const saved = await this.remote.get(tenantId);
      this.saved.set(saved);
      this.draft.set(pick(saved));
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    }
  }
}

const pick = ({ enabled, assistantName, tone, schedule, businessInfo }: AgentSettings): AgentSettingsInput => ({ enabled, assistantName, tone, schedule, businessInfo });
