import { Component, computed, input, output, signal } from '@angular/core';
import type { PaymentMethodType } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { MethodBadge } from './method-badge';
import { PAYMENT_TYPES, TYPE_GROUPS, typeInfo } from './payment-methods.models';

/**
 * «Tipo de método»: a closed list grouped by the currency the customer pays in. It opens in the
 * page (not over it) and closes once a type is picked. Keyboard: arrows, Home/End, Enter, Escape.
 */
@Component({
  selector: 'app-method-type-select',
  imports: [Icon, MethodBadge],
  template: `
    <button type="button" class="trigger" [class.open]="open()" role="combobox" aria-haspopup="listbox" [attr.aria-expanded]="open()" aria-controls="method-types"
      aria-label="Tipo de método" (click)="open.set(!open())" (keydown)="onKey($event)">
      @if (chosen(); as c) {
        <app-method-badge [type]="c.type" />
        <span class="text"><b>{{ c.label }}</b><small>{{ c.paysIn }}</small></span>
      } @else {
        <span class="text placeholder">Elige el tipo de método…</span>
      }
      <app-icon name="down" class="chev" />
    </button>
    @if (open()) {
      <div id="method-types" class="list" role="listbox" aria-label="Tipos de método">
        @for (group of groups; track group.id) {
          <div role="group" [attr.aria-label]="group.label">
            <span class="group">{{ group.label }}</span>
            @for (option of byGroup()[group.id]; track option.type) {
              <button type="button" role="option" class="option" [class.active]="active() === option.type" [class.on]="value() === option.type"
                [attr.aria-selected]="value() === option.type" (click)="pick(option.type)" (mouseenter)="active.set(option.type)">
                <app-method-badge [type]="option.type" />
                <span class="text"><b>{{ option.label }}@if (option.isNew) { <span class="new">Nuevo</span> }</b><small>{{ option.paysIn }}</small></span>
                @if (value() === option.type) { <app-icon name="check" class="tick" /> }
              </button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 8px; --badge-size: 32px; }
    .trigger { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 8px 12px; text-align: left; font: inherit;
      background: var(--color-surface); border: 1px solid var(--color-border-strong); border-radius: 10px; cursor: pointer; }
    .trigger.open, .trigger:focus-visible { outline: 0; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 14px; }
    .text small { font-size: 12.5px; color: var(--color-text-muted); }
    .placeholder { color: var(--color-text-faint); }
    .chev { --icon-size: 16px; color: var(--color-text-muted); }
    .list { border: 1px solid var(--color-border-strong); border-radius: 12px; padding: 6px; max-height: 320px; overflow-y: auto; }
    .group { display: block; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); padding: 8px 8px 4px; }
    .option { display: flex; align-items: center; gap: 12px; width: 100%; padding: 7px 8px; border: 0; border-radius: 8px; background: none; text-align: left; font: inherit; cursor: pointer; }
    .option.active { background: var(--color-surface-muted); }
    .option.on b { color: var(--color-primary-strong); }
    .new { font-size: 10.5px; font-weight: 600; color: var(--color-on-primary); background: var(--color-primary); border-radius: 999px; padding: 1px 7px; margin-left: 6px; vertical-align: 1px; }
    .tick { --icon-size: 16px; color: var(--color-primary); }
  `,
})
export class MethodTypeSelect {
  readonly value = input<PaymentMethodType | null>(null);
  readonly picked = output<PaymentMethodType>();

  protected readonly groups = TYPE_GROUPS;
  protected readonly open = signal(false);
  protected readonly active = signal<PaymentMethodType | null>(null);
  protected readonly chosen = computed(() => {
    const value = this.value();
    return value ? typeInfo(value) : null;
  });
  protected readonly byGroup = computed(() => Object.fromEntries(TYPE_GROUPS.map((g) => [g.id, PAYMENT_TYPES.filter((t) => t.group === g.id)])));
  /** The options in the order they show, for the keyboard. */
  private readonly ordered = TYPE_GROUPS.flatMap((g) => PAYMENT_TYPES.filter((t) => t.group === g.id).map((t) => t.type));

  protected pick(type: PaymentMethodType): void {
    this.picked.emit(type);
    this.open.set(false);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') return this.open.set(false);
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (!this.open()) {
      this.open.set(true);
      this.active.set(this.value() ?? this.ordered[0]!);
      return;
    }
    const current = this.ordered.indexOf(this.active() ?? this.ordered[0]!);
    if (event.key === 'Enter' || event.key === ' ') return this.pick(this.ordered[current]!);
    const last = this.ordered.length - 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : Math.min(last, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)));
    this.active.set(this.ordered[next]!);
  }
}
