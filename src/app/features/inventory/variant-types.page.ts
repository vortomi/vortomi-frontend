import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Id, VariantOption, VariantType } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { InventoryData } from './inventory.data';
import { VariantTypesData } from './variant-types.data';

/** One dialog for both: a type (Marca) or one of its values (Bosch). */
type VariantForm = { kind: 'type'; id: Id | null; text: string } | { kind: 'value'; typeId: Id; option: VariantOption | null; text: string };

/** Inventory → Variantes: the types a product's variants pick values from. Admins only (route guard). */
@Component({
  selector: 'app-variant-types-page',
  imports: [RouterLink, Dialog, Icon],
  template: `
    <header class="page-top">
      <a class="back" routerLink="/inventory" aria-label="Volver al inventario"><app-icon name="back" /></a>
      <h1>Variantes</h1>
      <span class="sub">Qué distingue a las variantes de un producto: marca, talla, presentación…</span>
      <span class="spacer"></span>
      <button type="button" class="btn btn--primary" (click)="openType(null)"><app-icon name="plus" />Nuevo tipo</button>
    </header>
    <div class="page-body">
      @for (entry of types.list(); track entry.type.id) {
        <section class="card box">
          <div class="section-head">
            <div>
              <h2>{{ entry.type.name }}</h2>
              <p class="field-hint">{{ entry.options.length }} valores · {{ productsUsing(entry.type.id) }} productos lo usan</p>
            </div>
            <span class="row-actions">
              <button type="button" class="link" (click)="openType(entry.type)">Editar</button>
              <button type="button" class="link danger" (click)="removeType(entry.type, entry.options.length)">Borrar</button>
            </span>
          </div>
          <div class="rows">
            @for (option of entry.options; track option.id) {
              <div class="row">
                <span class="name">{{ option.value }}</span>
                <span class="count">{{ variantsUsing(option.id) }} variantes</span>
                <span class="row-actions">
                  <button type="button" class="link" (click)="openValue(entry.type.id, option)">Editar</button>
                  <button type="button" class="link danger" (click)="removeValue(option)">Borrar</button>
                </span>
              </div>
            } @empty {
              <p class="empty">Sin valores todavía.</p>
            }
          </div>
          <div><button type="button" class="btn" (click)="openValue(entry.type.id, null)"><app-icon name="plus" />Agregar valor</button></div>
        </section>
      } @empty {
        <section class="card box">
          <p class="empty">
            Todavía no hay tipos. Crea uno con «Nuevo tipo», por ejemplo <b>Marca</b>, y agrégale sus valores: Bosch, Brembo…
          </p>
        </section>
      }
    </div>

    <app-dialog [open]="!!form()" [title]="dialogTitle()" (closed)="close()">
      @if (form(); as f) {
        <div class="field">
          <label for="variant-text">{{ f.kind === 'type' ? 'Nombre del tipo' : 'Valor' }}</label>
          <input id="variant-text" class="input" [attr.maxlength]="f.kind === 'type' ? 40 : 60" [placeholder]="f.kind === 'type' ? 'Marca' : 'Bosch'"
            [value]="f.text" (input)="setText($event)" />
          @if (f.kind === 'value' && f.option) {
            <p class="field-hint">Las variantes que lo usan cambian de nombre con él.</p>
          }
        </div>
        @if (error(); as message) { <p class="field-error" role="alert">{{ message }}</p> }
      }
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="saving()" (click)="close()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="saving()" [attr.aria-busy]="saving()" (click)="save()">
          @if (saving()) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="check" /> }
          Guardar
        </button>
      </ng-container>
    </app-dialog>
  `,
  styleUrl: '../../shared/ui/section.scss',
  styles: `
    :host { max-width: none; }
    .back { display: inline-flex; color: var(--color-text-muted); --icon-size: 20px; }
  `,
})
export class VariantTypesPage {
  protected readonly types = inject(VariantTypesData);
  private readonly inventory = inject(InventoryData);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly form = signal<VariantForm | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly dialogTitle = computed(() => {
    const f = this.form();
    if (!f) return '';
    if (f.kind === 'type') return f.id ? 'Editar tipo' : 'Nuevo tipo';
    return `${f.option ? 'Editar valor' : 'Nuevo valor'} de ${this.types.typeById().get(f.typeId)?.type.name ?? ''}`;
  });

  protected productsUsing(typeId: Id): number {
    return this.inventory.products().filter((p) => p.variantTypeIds.includes(typeId)).length;
  }

  protected variantsUsing(optionId: Id): number {
    return this.inventory.variants().filter((v) => v.optionIds.includes(optionId)).length;
  }

  protected openType(type: VariantType | null): void {
    this.open({ kind: 'type', id: type?.id ?? null, text: type?.name ?? '' });
  }

  protected openValue(typeId: Id, option: VariantOption | null): void {
    this.open({ kind: 'value', typeId, option, text: option?.value ?? '' });
  }

  protected setText(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.form.update((f) => (f ? { ...f, text } : f));
    this.error.set(null);
  }

  protected close(): void {
    if (!this.saving()) this.form.set(null);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    if (!f || this.saving()) return;
    const text = f.text.trim();
    if (!text) return this.error.set('Escribe un nombre.');
    const taken = f.kind === 'type' ? this.types.typeNameTaken(text, f.id) : this.types.valueTaken(f.typeId, text, f.option?.id ?? null);
    if (taken) return this.error.set(f.kind === 'type' ? 'Ya existe un tipo con ese nombre.' : 'Ese valor ya existe en este tipo.');
    this.saving.set(true);
    const ok = await this.write(f, text);
    this.saving.set(false);
    if (!ok) return;
    this.form.set(null);
    this.toaster.show(`«${text}» guardado`);
  }

  protected async removeType(type: VariantType, values: number): Promise<void> {
    const products = this.productsUsing(type.id);
    if (products) return this.toaster.show(`«${type.name}» lo usan ${products} productos. Cámbiales el tipo antes de borrarlo.`, 'info');
    const yes = await this.confirm.ask({
      title: `¿Borrar «${type.name}»?`,
      message: values ? `Se borran también sus ${values} valores. No se puede deshacer.` : 'No se puede deshacer.',
      confirmLabel: 'Borrar tipo',
      danger: true,
    });
    if (yes && (await this.types.removeType(type.id))) this.toaster.show(`«${type.name}» borrado`);
  }

  protected async removeValue(option: VariantOption): Promise<void> {
    const used = this.variantsUsing(option.id);
    if (used) return this.toaster.show(`«${option.value}» lo usan ${used} variantes. No se puede borrar mientras tanto.`, 'info');
    const yes = await this.confirm.ask({
      title: `¿Borrar «${option.value}»?`,
      message: 'Ninguna variante lo usa. No se puede deshacer.',
      confirmLabel: 'Borrar valor',
      danger: true,
    });
    if (yes && (await this.types.removeValue(option.id))) this.toaster.show(`«${option.value}» borrado`);
  }

  private write(f: VariantForm, text: string): Promise<boolean> {
    if (f.kind === 'type') return f.id ? this.types.renameType(f.id, text) : this.types.createType(text);
    return f.option ? this.types.renameValue(f.option, text) : this.types.addValue(f.typeId, text);
  }

  private open(form: VariantForm): void {
    this.error.set(null);
    this.form.set(form);
  }
}
