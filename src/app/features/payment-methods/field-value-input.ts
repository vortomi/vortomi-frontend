import { Component, computed, input, output } from '@angular/core';
import type { PaymentFieldKind } from '../../shared/api/models';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import {
  BANKS,
  DOCUMENT_TYPES,
  type DocumentType,
  PHONE_PREFIXES,
  bankValue,
  documentPlaceholder,
  joinDocument,
  joinPhone,
  splitDocument,
  splitPhone,
} from './venezuelan-formats';

const BANK_OPTIONS: MenuOption[] = BANKS.map((b) => ({ value: bankValue(b), label: bankValue(b) }));
const PREFIX_OPTIONS: MenuOption[] = PHONE_PREFIXES.map((p) => ({ value: p, label: p }));
const DOCUMENT_OPTIONS: MenuOption[] = DOCUMENT_TYPES.map((d) => ({ value: d.value, label: d.label }));

/**
 * The value of one payment datum, edited by its kind: a bank from the list, a mobile number with its
 * code, a RIF or cédula with its letter, or free text. It always emits the stored form ("0414-1234567").
 */
@Component({
  selector: 'app-field-value-input',
  imports: [SelectMenu],
  template: `
    @switch (kind()) {
      @case ('bank') {
        <app-select-menu [label]="label()" placeholder="Elige el banco" [searchable]="true" [options]="banks" [value]="value() || null" (picked)="changed.emit($event)" />
      }
      @case ('phone') {
        <div class="pair">
          <app-select-menu class="short" [label]="label() + ': código'" [options]="prefixes" [value]="phone().prefix" (picked)="changed.emit(joinPhone($event, phone().number))" />
          <input class="input" inputmode="numeric" maxlength="7" placeholder="1234567" [attr.aria-label]="label() + ': número'" [value]="phone().number"
            (input)="changed.emit(joinPhone(phone().prefix, text($event)))" />
        </div>
      }
      @case ('document') {
        <div class="pair">
          <app-select-menu class="short" [label]="label() + ': tipo'" [options]="documentTypes" [value]="document().type" (picked)="changed.emit(joinDocument(asType($event), document().number))" />
          <input class="input" [attr.inputmode]="document().type === 'P' ? 'text' : 'numeric'" maxlength="16" [placeholder]="placeholderFor(document().type)"
            [attr.aria-label]="label() + ': número'" [value]="document().number" (input)="changed.emit(joinDocument(document().type, text($event)))" />
        </div>
      }
      @default {
        <input class="input" maxlength="200" [placeholder]="placeholder() || 'Valor'" [attr.aria-label]="label()" [value]="value()" (input)="changed.emit(text($event))" />
      }
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .pair { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 8px; }
  `,
})
export class FieldValueInput {
  readonly kind = input.required<PaymentFieldKind>();
  readonly value = input('');
  /** Names the boxes for screen readers ("Teléfono: número"). */
  readonly label = input('Valor');
  readonly placeholder = input<string | undefined>(undefined);
  readonly changed = output<string>();

  protected readonly banks = BANK_OPTIONS;
  protected readonly prefixes = PREFIX_OPTIONS;
  protected readonly documentTypes = DOCUMENT_OPTIONS;
  protected readonly phone = computed(() => splitPhone(this.value()));
  protected readonly document = computed(() => splitDocument(this.value()));
  protected readonly joinPhone = joinPhone;
  protected readonly joinDocument = joinDocument;
  protected readonly placeholderFor = documentPlaceholder;

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected asType(value: string): DocumentType {
    return value as DocumentType;
  }
}
