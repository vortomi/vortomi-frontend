import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toApiFailure } from '../../../core/api/api-error';
import type { Day, ExemptionReason, ExemptionView } from '../../../shared/api/subscriptions';
import { formatUsdCents } from '../../../shared/format/money';
import { DatePicker } from '../../../shared/ui/date-picker';
import { Dialog } from '../../../shared/ui/dialog';
import { Icon } from '../../../shared/ui/icon';
import { type MenuOption, SelectMenu } from '../../../shared/ui/select-menu';
import { EXEMPTION_REASONS, addDays, dayText } from './billing.rules';
import { PlatformSubscriptions } from './platform-subscriptions';

const REASON_OPTIONS: MenuOption[] = EXEMPTION_REASONS.map((r) => ({ value: r.value, label: r.label }));

/**
 * «Exonerar del pago» (mockup web-49, frames 2 and 3): a reason from the list, until when (no end,
 * or a last exempt day) and a note, needed for «Otro». It says what will happen before it is done.
 * With `current`, it changes the exemption that covers today instead.
 */
@Component({
  selector: 'app-exempt-company-dialog',
  imports: [DatePicker, Dialog, Icon, SelectMenu],
  template: `
    <app-dialog [open]="open()" [title]="(current() ? 'Cambiar la exoneración de ' : 'Exonerar del pago a ') + tenantName()" [locked]="busy()" (closed)="closed.emit()">
      <p class="lead">No pagará mensualidad ni se suspenderá mientras dure.</p>
      <div class="field">
        <label>Motivo</label>
        <app-select-menu label="Motivo" placeholder="Elige el motivo" [options]="reasons" [value]="reason()" (picked)="reason.set(asReason($event))" />
      </div>
      <div class="field">
        <label>¿Hasta cuándo?</label>
        <div class="segmented until" role="radiogroup" aria-label="¿Hasta cuándo?">
          <button type="button" role="radio" [class.on]="!withEnd()" [attr.aria-checked]="!withEnd()" (click)="withEnd.set(false)">Sin fecha de fin</button>
          <button type="button" role="radio" [class.on]="withEnd()" [attr.aria-checked]="withEnd()" (click)="withEnd.set(true)">Hasta una fecha</button>
        </div>
      </div>
      @if (withEnd()) {
        <div class="field">
          <label>Último día exonerado</label>
          <app-date-picker label="Último día exonerado" [typeable]="true" [value]="endsOn()" [min]="today()" [todayIso]="today()" [invalid]="endPast()" (picked)="endsOn.set($event)" />
          @if (endPast()) { <span class="err">Elige hoy o un día después.</span> }
        </div>
      }
      <div class="field">
        <label for="exempt-note">Nota @if (reason() !== 'other') { <em>(opcional)</em> }</label>
        <textarea id="exempt-note" class="input" rows="2" maxlength="300" placeholder="Para qué es, o qué se acordó."
          [value]="note()" (input)="note.set(value($event))"></textarea>
      </div>
      <ul class="steps">
        @for (step of steps(); track $index) { <li><app-icon name="check" /><span>{{ step }}</span></li> }
      </ul>
      @if (error(); as message) { <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div> }
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="busy()" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="busy() || !ready()" [attr.aria-busy]="busy()" (click)="save()">{{ current() ? 'Guardar cambios' : 'Exonerar' }}</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    :host { --dialog-width: 480px; }
    .lead { font-size: 13px; color: var(--color-text-muted); margin-top: -4px; }
    label em { font-style: normal; font-weight: 400; color: var(--color-text-muted); }
    .until { display: flex; }
    .until button { flex: 1; justify-content: center; }
    textarea { resize: vertical; min-height: 56px; }
    .err { font-size: 12.5px; color: var(--color-danger-text); }
    .steps { list-style: none; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--radius-md);
      background: var(--color-surface-hover); font-size: 13px; color: var(--color-text-2); --icon-size: 15px; }
    .steps li { display: flex; gap: 8px; align-items: flex-start; line-height: 1.4; }
    .steps app-icon { flex: none; margin-top: 2px; color: var(--color-success); }
  `,
})
export class ExemptCompanyDialog {
  readonly open = input(false);
  readonly tenantId = input.required<string>();
  readonly tenantName = input.required<string>();
  /** What the company owes now: forgiven when exempted. */
  readonly owedCents = input(0);
  readonly today = input.required<Day>();
  /** The exemption to change; null to grant a new one. */
  readonly current = input<ExemptionView | null>(null);
  readonly closed = output<void>();
  readonly saved = output<ExemptionView>();

  private readonly subscriptions = inject(PlatformSubscriptions);
  protected readonly reasons = REASON_OPTIONS;
  protected readonly reason = signal<ExemptionReason | null>(null);
  protected readonly withEnd = signal(false);
  protected readonly endsOn = signal<Day | null>(null);
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly endPast = computed(() => this.withEnd() && this.endsOn() !== null && this.endsOn()! < this.today());
  protected readonly ready = computed(() => {
    if (!this.reason()) return false;
    if (this.reason() === 'other' && !this.note().trim()) return false;
    return !this.withEnd() || (this.endsOn() !== null && !this.endPast());
  });

  /** What will happen, in the dialog itself (mockup web-49). */
  protected readonly steps = computed(() => {
    const end = this.withEnd() ? this.endsOn() : null;
    const steps = [end ? `No paga hasta el ${dayText(end, true)}.` : 'No se le crean cobros y no se suspende.'];
    if (!this.current() && this.owedCents() > 0) steps.push(`Se le perdonan los ${formatUsdCents(this.owedCents())} que debe.`);
    if (end) {
      steps.push('7 días antes verá el aviso para elegir y pagar su plan.');
      steps.push(`Desde el ${dayText(addDays(end, 1), true)} vuelve a las reglas de siempre.`);
    } else {
      steps.push('En su panel verá «Exonerada del pago», sin avisos de cobro.');
    }
    return steps;
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        const current = this.current();
        this.reason.set(current?.reason ?? null);
        this.withEnd.set(current?.endsOn != null);
        this.endsOn.set(current?.endsOn ?? null);
        this.note.set(current?.note ?? '');
        this.error.set(null);
      });
    });
  }

  protected asReason(value: string): ExemptionReason {
    return value as ExemptionReason;
  }

  protected value(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected async save(): Promise<void> {
    const reason = this.reason();
    if (!reason || !this.ready()) return;
    const input = { reason, note: this.note().trim() || null, endsOn: this.withEnd() ? this.endsOn() : null };
    this.busy.set(true);
    this.error.set(null);
    try {
      const tenantId = this.tenantId();
      this.saved.emit(this.current() ? await this.subscriptions.changeExemption(tenantId, input) : await this.subscriptions.exempt(tenantId, input));
    } catch (error) {
      this.error.set(toApiFailure(error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
