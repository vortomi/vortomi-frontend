import { Component, computed, input, output, signal } from '@angular/core';
import type { CustomField, Id } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import type { FieldFilter } from './custom-field-rules';

/**
 * «Filtrar por dato»: pick one of the company's fields and the answer to look for. Lists and
 * yes/no are picked; text, numbers and dates are typed and matched inside the answer.
 */
@Component({
  selector: 'app-field-filter-picker',
  imports: [Icon, SelectMenu],
  template: `
    @if (!open()) {
      <button type="button" class="btn" (click)="open.set(true)"><app-icon name="filter" /><span>Filtrar por dato</span></button>
    } @else {
      <div class="picker">
        <app-select-menu class="pick" label="Dato" placeholder="Elige un dato…" [options]="fieldOptions()" [value]="fieldId() || null"
          [searchable]="fieldOptions().length > 7" (picked)="pickField($event)" />
        @if (field(); as f) {
          @if (f.kind === 'boolean') {
            <app-select-menu class="pick" label="Respuesta" placeholder="Elige…" [options]="yesNo" [value]="value() || null" (picked)="value.set($event)" />
          } @else if (f.kind === 'choice' || f.kind === 'multi_choice') {
            <app-select-menu class="pick" label="Respuesta" placeholder="Elige…" [options]="answerOptions(f)" [value]="value() || null"
              [searchable]="f.options.length > 7" (picked)="value.set($event)" />
          } @else {
            <input class="input" aria-label="Contiene" [placeholder]="f.kind === 'date' ? 'Ej.: 03/1990' : 'Contiene…'" (input)="value.set(text($event))" (keydown.enter)="apply()" />
          }
        }
        <button type="button" class="btn btn--primary" [disabled]="!fieldId() || !value().trim()" (click)="apply()"><span>Aplicar</span></button>
        <button type="button" class="link" (click)="close()">Cancelar</button>
      </div>
    }
  `,
  styles: `
    .picker { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .input { width: 180px; }
    .pick { width: 200px; }
  `,
})
export class FieldFilterPicker {
  readonly fields = input.required<CustomField[]>();
  readonly added = output<FieldFilter>();

  protected readonly open = signal(false);
  protected readonly fieldId = signal<Id>('');
  protected readonly value = signal('');
  protected readonly field = computed(() => this.fields().find((f) => f.id === this.fieldId()) ?? null);

  protected readonly yesNo: MenuOption[] = [
    { value: 'true', label: 'Sí' },
    { value: 'false', label: 'No' },
  ];
  protected readonly fieldOptions = computed<MenuOption[]>(() => this.fields().map((f) => ({ value: f.id, label: f.label })));

  protected answerOptions(field: CustomField): MenuOption[] {
    return field.options.map((o) => ({ value: o.id, label: o.value }));
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected pickField(id: string): void {
    this.fieldId.set(id);
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
