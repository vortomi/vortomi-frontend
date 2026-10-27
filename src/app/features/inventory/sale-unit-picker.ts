import { Component, computed, input, output, signal } from '@angular/core';
import type { SaleUnit } from '../../shared/api/models';
import { SALE_UNIT, SALE_UNIT_GROUPS, formatNumber, formatQuantity, minChoices, stepChoices, takesDecimals } from './sale-units';

export interface SaleSettings {
  saleUnit: SaleUnit;
  minQuantity: number;
  quantityStep: number;
}

/** What most products use: shown first; the rest wait behind «Otra unidad». */
const COMMON: SaleUnit[] = ['unit', 'kg', 'm', 'l'];

/** What a unit starts with when chosen: one at a time, or half a kilo/metre at a time. */
function defaultsFor(saleUnit: SaleUnit): SaleSettings {
  return takesDecimals(saleUnit) ? { saleUnit, minQuantity: 0.5, quantityStep: 0.5 } : { saleUnit, minQuantity: 1, quantityStep: 1 };
}

/**
 * «Se vende por», kept simple: the four usual units as buttons, every other one behind «Otra
 * unidad», and the minimum and step already set, behind «Cambiar» for whoever needs them.
 */
@Component({
  selector: 'app-sale-unit-picker',
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
          <label for="sale-min">Lo mínimo que se vende</label>
          <select id="sale-min" class="input" (change)="setMin($event)">
            @for (n of mins(); track n) { <option [value]="n" [selected]="n === current.minQuantity">{{ quantity(n) }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="sale-step">De cuánto en cuánto</label>
          <select id="sale-step" class="input" (change)="setStep($event)">
            @for (n of steps(); track n) { <option [value]="n" [selected]="n === current.quantityStep">{{ number(n) }} en {{ number(n) }}</option> }
          </select>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .groups { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--color-surface-muted); }
    .group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .title { width: 62px; font-size: 12px; color: var(--color-text-muted); }
    .chips { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); overflow: hidden; }
    .chips button { border: 0; border-right: 1px solid var(--color-border-strong); background: var(--color-surface); padding: 8px 16px;
      font: inherit; font-size: 13px; font-weight: 600; color: var(--color-text); cursor: pointer; }
    .chips button:last-child { border-right: 0; }
    .chips button:hover { background: var(--color-primary-softer); }
    .chips button.on { background: #1a237e; color: #fff; }
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

  protected quantity(n: number): string {
    return formatQuantity(n, this.value().saleUnit);
  }

  protected pick(saleUnit: SaleUnit): void {
    if (saleUnit !== this.value().saleUnit) this.changed.emit(defaultsFor(saleUnit));
  }

  protected setMin(event: Event): void {
    this.changed.emit({ ...this.value(), minQuantity: Number((event.target as HTMLSelectElement).value) });
  }

  /** A new step keeps the minimum when it still fits, or takes the smallest one that does. */
  protected setStep(event: Event): void {
    const quantityStep = Number((event.target as HTMLSelectElement).value);
    const fitting = minChoices(this.value().saleUnit, quantityStep);
    const minQuantity = fitting.includes(this.value().minQuantity) ? this.value().minQuantity : fitting[0]!;
    this.changed.emit({ ...this.value(), quantityStep, minQuantity });
  }
}
