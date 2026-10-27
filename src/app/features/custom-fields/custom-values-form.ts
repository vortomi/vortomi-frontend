import { Component, computed, input, output, signal } from '@angular/core';
import type { CustomField, CustomValue, CustomValues, Id } from '../../shared/api/models';
import { isAnswered } from './custom-field-rules';

/** Lists this short show as buttons; longer ones as a selector. */
const BUTTONS_UP_TO = 4;
/** A long multi-choice list shows this many until «Ver todas». */
const CHIPS_SHOWN = 12;

/**
 * The company's fields of a product or customer, ready to fill: lists are picked, never typed.
 * Required fields and those already answered show first; the rest wait behind «Más datos».
 */
@Component({
  selector: 'app-custom-values-form',
  template: `
    @for (field of shown(); track field.id) {
      @let value = values()[field.id];
      <div class="cf">
        <span class="label">{{ field.label }} @if (field.required) { <span class="req" aria-label="obligatorio">*</span> }</span>
        @switch (field.kind) {
          @case ('text') {
            <input class="input" [attr.aria-label]="field.label" maxlength="200" [value]="value ?? ''" (input)="set(field.id, text($event))" />
          }
          @case ('number') {
            <input class="input num" inputmode="decimal" [attr.aria-label]="field.label" [value]="value ?? ''" (change)="setNumber(field.id, $event)" />
          }
          @case ('date') {
            <input class="input date" type="date" [attr.aria-label]="field.label" [value]="value ?? ''" (change)="set(field.id, text($event))" />
          }
          @case ('boolean') {
            <div class="seg" role="radiogroup" [attr.aria-label]="field.label">
              <button type="button" role="radio" [class.on]="value === true" [attr.aria-checked]="value === true" (click)="toggle(field, true)">Sí</button>
              <button type="button" role="radio" [class.on]="value === false" [attr.aria-checked]="value === false" (click)="toggle(field, false)">No</button>
            </div>
          }
          @case ('choice') {
            @if (field.options.length <= buttonsUpTo) {
              <div class="seg" role="radiogroup" [attr.aria-label]="field.label">
                @for (o of field.options; track o.id) {
                  <button type="button" role="radio" [class.on]="value === o.id" [attr.aria-checked]="value === o.id" (click)="toggle(field, o.id)">{{ o.value }}</button>
                }
              </div>
            } @else {
              <select class="input" [attr.aria-label]="field.label" (change)="set(field.id, text($event))">
                <option value="" [selected]="!value">Elige…</option>
                @for (o of field.options; track o.id) { <option [value]="o.id" [selected]="value === o.id">{{ o.value }}</option> }
              </select>
            }
          }
          @case ('multi_choice') {
            <div class="chips">
              @for (o of chipsOf(field); track o.id) {
                <button type="button" class="chip" [class.on]="picked(value, o.id)" [attr.aria-pressed]="picked(value, o.id)" (click)="togglePick(field.id, o.id)">
                  {{ o.value }}
                </button>
              }
              @if (field.options.length > chipsShown && !expanded().has(field.id)) {
                <button type="button" class="link" (click)="expand(field.id)">Ver todas ({{ field.options.length }})</button>
              }
            </div>
          }
        }
      </div>
    } @empty {
      @if (!hidden().length) { <p class="field-hint">Tu empresa todavía no definió datos para esto.</p> }
    }
    @if (hidden().length) {
      <button type="button" class="link more" (click)="showAll.set(!showAll())">
        {{ showAll() ? 'Ocultar los opcionales' : 'Más datos (' + hidden().length + (hidden().length === 1 ? ' opcional)' : ' opcionales)') }}
      </button>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .cf { display: flex; flex-direction: column; gap: 5px; }
    .label { font-size: 12.5px; font-weight: 600; color: #3b4555; }
    .req { color: var(--color-danger); }
    .num { max-width: 200px; } .date { max-width: 200px; }
    .seg { display: inline-flex; align-self: flex-start; flex-wrap: wrap; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); overflow: hidden; }
    .seg button { border: 0; border-right: 1px solid var(--color-border-strong); background: var(--color-surface); padding: 7px 14px; font: inherit; font-size: 13px; cursor: pointer; }
    .seg button:last-child { border-right: 0; }
    .seg button.on { background: #1a237e; color: #fff; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .chip { border: 1px solid var(--color-border-strong); background: var(--color-surface); border-radius: var(--radius-pill); padding: 5px 12px; font: inherit; font-size: 13px; cursor: pointer; }
    .chip.on { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary-strong); }
    .more { align-self: flex-start; font-size: 13px; }
  `,
})
export class CustomValuesForm {
  readonly fields = input.required<CustomField[]>();
  readonly values = input.required<CustomValues>();
  readonly changed = output<CustomValues>();

  protected readonly buttonsUpTo = BUTTONS_UP_TO;
  protected readonly chipsShown = CHIPS_SHOWN;
  protected readonly showAll = signal(false);
  protected readonly expanded = signal(new Set<Id>());
  /** Fields touched here stay in sight even when emptied again, so nothing jumps away mid-edit. */
  private readonly touched = signal(new Set<Id>());

  /** Required, already answered or touched: always in sight. */
  private readonly first = computed(() => this.fields().filter((f) => f.required || isAnswered(this.values()[f.id]) || this.touched().has(f.id)));
  protected readonly hidden = computed(() => this.fields().filter((f) => !this.first().includes(f)));
  protected readonly shown = computed(() => (this.showAll() ? this.fields() : this.first()));

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected set(fieldId: Id, value: CustomValue | undefined): void {
    this.touched.update((set) => (set.has(fieldId) ? set : new Set(set).add(fieldId)));
    const next = { ...this.values() };
    if (value === undefined || value === '') delete next[fieldId];
    else next[fieldId] = value;
    this.changed.emit(next);
  }

  /** "12,5" or "1.200" as typed; something that is not a number clears the answer. */
  protected setNumber(fieldId: Id, event: Event): void {
    const raw = this.text(event).trim().replace(/\./g, '').replace(',', '.');
    const value = raw === '' ? undefined : Number(raw);
    this.set(fieldId, value === undefined || Number.isNaN(value) ? undefined : value);
  }

  /** Pressing the chosen button again clears it, unless the field is required. */
  protected toggle(field: CustomField, value: CustomValue): void {
    this.set(field.id, this.values()[field.id] === value && !field.required ? undefined : value);
  }

  protected picked(value: CustomValue | undefined, optionId: Id): boolean {
    return Array.isArray(value) && value.includes(optionId);
  }

  protected togglePick(fieldId: Id, optionId: Id): void {
    const current = this.values()[fieldId];
    const list = Array.isArray(current) ? current : [];
    this.set(fieldId, list.includes(optionId) ? list.filter((id) => id !== optionId) : [...list, optionId]);
  }

  /** The picked ones first, then the rest, up to «Ver todas». */
  protected chipsOf(field: CustomField) {
    if (field.options.length <= CHIPS_SHOWN || this.expanded().has(field.id)) return field.options;
    const value = this.values()[field.id];
    const picked = field.options.filter((o) => this.picked(value, o.id));
    return [...picked, ...field.options.filter((o) => !picked.includes(o)).slice(0, Math.max(0, CHIPS_SHOWN - picked.length))];
  }

  protected expand(fieldId: Id): void {
    this.expanded.update((set) => new Set(set).add(fieldId));
  }
}
