import { Component, computed, input, output, signal } from '@angular/core';
import type { SaleUnit } from '../../shared/api/models';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { SALE_UNIT, SALE_UNIT_GROUPS, formatNumber, formatQuantity, minChoices, stepChoices, takesDecimals } from './sale-units';

export interface SaleSettings {
  saleUnit: SaleUnit;
  minQuantity: number;
  quantityStep: number;
}

/** What most products use: shown first; the rest wait behind «Otra unidad». */
const COMMON: SaleUnit[] = ['unit', 'kg', 'm', 'l'];

/** What a unit starts with when chosen: one at a time, or half a kilo/metre at a time. */
export function defaultsFor(saleUnit: SaleUnit): SaleSettings {
  return takesDecimals(saleUnit) ? { saleUnit, minQuantity: 0.5, quantityStep: 0.5 } : { saleUnit, minQuantity: 1, quantityStep: 1 };
}

/**
 * «Se vende por», kept simple: the four usual units as buttons, every other one behind «Otra
 * unidad», and the minimum and step already set, behind «Cambiar» for whoever needs them.
 */
@Component({
  selector: 'app-sale-unit-picker',
  imports: [SelectMenu],
  template: `
    @let current = value();
    <div class="chips" role="radiogroup" aria-label="Se vende por">
      @for (unit of shortList(); track unit) {
        <button type="button" role="radio" [class.on]="unit === current.saleUnit" [attr.aria-checked]="unit === current.saleUnit" (click)="pick(unit)">
          {{ text[unit].label }}
        </button>
      }
    </div>
    <button type="button" class="link more" (click)="showAll.set(!showAll())">{{ showAll() ? 'Ver menos' : 'Otra unidad (caja, docena, par, hora…)' }}</button>
    @if (showAll()) {
      <div class="groups">
        @for (group of groups; track group.title) {
          <div class="group">
            <span class="title">{{ group.title }}</span>
            <div class="chips">
              @for (unit of group.units; track unit) {
                <button type="button" [class.on]="unit === current.saleUnit" [attr.aria-pressed]="unit === current.saleUnit" (click)="pick(unit)">
                  {{ text[unit].label }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    }
    <p class="field-hint">
      Precio por {{ text[current.saleUnit].label.toLowerCase() }}.
      @if (decimals()) {
        Se vende desde {{ quantity(current.minQuantity) }}, de {{ number(current.quantityStep) }} en {{ number(current.quantityStep) }}.
        <button type="button" class="link" (click)="showAmounts.set(!showAmounts())">{{ showAmounts() ? 'Listo' : 'Cambiar' }}</button>
      } @else {
        Se vende entero, sin fracciones.
      }
    </p>
    @if (decimals() && showAmounts()) {
      <div class="amounts">
        <div class="field">
          <span class="label">Lo mínimo que se vende</span>
          <app-select-menu label="Lo mínimo que se vende" [options]="minOptions()" [value]="'' + current.minQuantity" (picked)="setMin($event)" />
        </div>
        <div class="field">
          <span class="label">De cuánto en cuánto</span>
          <app-select-menu label="De cuánto en cuánto" [options]="stepOptions()" [value]="'' + current.quantityStep" (picked)="setStep($event)" />
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .groups { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--color-surface-muted); }
    .group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .title { width: 62px; font-size: 12px; color: var(--color-text-muted); }
    .chips { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; border-radius: var(--radius-md); background: var(--color-surface-hover); }
    .chips button { border: 0; border-radius: 7px; background: none; height: 32px; padding: 0 14px;
      font: inherit; font-size: 13px; font-weight: 500; color: var(--color-text-muted); cursor: pointer; }
    .chips button:hover { color: var(--color-text); }
    .chips button.on { background: var(--color-surface); color: var(--color-text); box-shadow: var(--shadow-sm); }
    :host-context(.dark) .chips button.on { background: var(--color-border-strong); }
    .label { font-size: 14px; font-weight: 500; color: var(--color-text); }
    .more { font-size: 12.5px; }
    .field-hint .link { font-size: inherit; }
    .amounts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; width: 100%; max-width: 520px; }
    @media (max-width: 760px) { .title { width: 100%; } .amounts { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class SaleUnitPicker {
  readonly value = input.required<SaleSettings>();
  readonly changed = output<SaleSettings>();

  protected readonly groups = SALE_UNIT_GROUPS;
  protected readonly text = SALE_UNIT;
  protected readonly number = formatNumber;
  protected readonly showAll = signal(false);
  protected readonly showAmounts = signal(false);
  /** The usual four, plus the chosen one when it is not among them. */
  protected readonly shortList = computed(() => (COMMON.includes(this.value().saleUnit) ? COMMON : [...COMMON, this.value().saleUnit]));
  protected readonly decimals = computed(() => takesDecimals(this.value().saleUnit));
  protected readonly steps = computed(() => stepChoices(this.value().saleUnit));
  protected readonly mins = computed(() => minChoices(this.value().saleUnit, this.value().quantityStep));
  protected readonly minOptions = computed<MenuOption[]>(() => this.mins().map((n) => ({ value: String(n), label: this.quantity(n) })));
  protected readonly stepOptions = computed<MenuOption[]>(() => this.steps().map((n) => ({ value: String(n), label: `${formatNumber(n)} en ${formatNumber(n)}` })));

  protected quantity(n: number): string {
    return formatQuantity(n, this.value().saleUnit);
  }

  protected pick(saleUnit: SaleUnit): void {
    if (saleUnit !== this.value().saleUnit) this.changed.emit(defaultsFor(saleUnit));
  }

  protected setMin(picked: string): void {
    this.changed.emit({ ...this.value(), minQuantity: Number(picked) });
  }

  /** A new step keeps the minimum when it still fits, or takes the smallest one that does. */
  protected setStep(picked: string): void {
    const quantityStep = Number(picked);
    const fitting = minChoices(this.value().saleUnit, quantityStep);
    const minQuantity = fitting.includes(this.value().minQuantity) ? this.value().minQuantity : fitting[0]!;
    this.changed.emit({ ...this.value(), quantityStep, minQuantity });
  }
}
