import { Component, computed, input, output, signal } from '@angular/core';
import type { CustomField, Id } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import type { FieldFilter } from './custom-field-rules';

/**
 * «Filtrar por dato»: pick one of the company's fields and the answer to look for. Lists and
 * yes/no are picked; text, numbers and dates are typed and matched inside the answer.
 */
@Component({
  selector: 'app-field-filter-picker',
  imports: [Icon],
  template: `
    @if (!open()) {
      <button type="button" class="btn" (click)="open.set(true)"><app-icon name="filter" />Filtrar por dato</button>
    } @else {
      <div class="picker">
        <select class="select" aria-label="Dato" (change)="pickField($event)">
          <option value="" [selected]="!fieldId()">Elige un dato…</option>
          @for (f of fields(); track f.id) { <option [value]="f.id" [selected]="f.id === fieldId()">{{ f.label }}</option> }
        </select>
        @if (field(); as f) {
          @if (f.kind === 'boolean') {
            <select class="select" aria-label="Respuesta" (change)="value.set(text($event))">
              <option value="">Elige…</option><option value="true">Sí</option><option value="false">No</option>
            </select>
          } @else if (f.kind === 'choice' || f.kind === 'multi_choice') {
            <select class="select" aria-label="Respuesta" (change)="value.set(text($event))">
              <option value="">Elige…</option>
              @for (o of f.options; track o.id) { <option [value]="o.id">{{ o.value }}</option> }
            </select>
          } @else {
            <input class="input" aria-label="Contiene" [placeholder]="f.kind === 'date' ? 'Ej.: 03/1990' : 'Contiene…'" (input)="value.set(text($event))" (keydown.enter)="apply()" />
          }
        }
        <button type="button" class="btn btn--primary" [disabled]="!fieldId() || !value().trim()" (click)="apply()">Aplicar</button>
        <button type="button" class="link" (click)="close()">Cancelar</button>
      </div>
    }
  `,
  styles: `
    .picker { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .input { width: 180px; }
  `,
})
export class FieldFilterPicker {
  readonly fields = input.required<CustomField[]>();
  readonly added = output<FieldFilter>();

  protected readonly open = signal(false);
  protected readonly fieldId = signal<Id>('');
  protected readonly value = signal('');
  protected readonly field = computed(() => this.fields().find((f) => f.id === this.fieldId()) ?? null);

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected pickField(event: Event): void {
    this.fieldId.set(this.text(event));
    this.value.set('');
  }

  protected apply(): void {
    if (!this.fieldId() || !this.value().trim()) return;
    this.added.emit({ fieldId: this.fieldId(), value: this.value().trim() });
    this.close();
  }

  protected close(): void {
    this.open.set(false);
    this.fieldId.set('');
    this.value.set('');
  }
}
