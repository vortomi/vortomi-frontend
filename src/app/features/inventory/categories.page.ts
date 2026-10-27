import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Id, ProductCategory } from '../../shared/api/models';
import { Confirm } from '../../shared/ui/confirm';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { Toaster } from '../../shared/ui/toaster';
import { CategoriesData } from './categories.data';
import { InventoryData } from './inventory.data';

interface CategoryForm {
  id: Id | null;
  name: string;
}

/** Inventory → Categorías: the list products pick from. Admins only (route guard). */
@Component({
  selector: 'app-categories-page',
  imports: [RouterLink, Dialog, Icon],
  template: `
    <header class="page-top">
      <a class="back" routerLink="/inventory" aria-label="Volver al inventario"><app-icon name="back" /></a>
      <h1>Categorías</h1>
      <span class="sub">{{ categories.list().length }} categorías de productos</span>
    </header>
    <div class="page-body">
      <section class="card box">
        <div class="section-head">
          <div>
            <h2>Categorías de productos</h2>
            <p class="field-hint">Cada producto se ubica en una. Sirven para ordenar y filtrar el inventario.</p>
          </div>
          <button type="button" class="btn btn--primary" (click)="openNew()"><app-icon name="plus" />Nueva categoría</button>
        </div>
        <div class="rows">
          @for (category of categories.list(); track category.id) {
            <div class="row">
              <span class="name">{{ category.name }}</span>
              <span class="count">{{ usage(category.id) }} productos</span>
              <span class="row-actions">
                <button type="button" class="link" (click)="openEdit(category)">Editar</button>
                <button type="button" class="link danger" (click)="remove(category)">Borrar</button>
              </span>
            </div>
          } @empty {
            <p class="empty">Todavía no hay categorías. Crea la primera con «Nueva categoría».</p>
          }
        </div>
      </section>
    </div>

    <app-dialog [open]="!!form()" [title]="form()?.id ? 'Editar categoría' : 'Nueva categoría'" (closed)="close()">
      @if (form(); as f) {
        <div class="field">
          <label for="category-name">Nombre</label>
          <input id="category-name" class="input" maxlength="60" placeholder="Frenos" [value]="f.name" (input)="setName($event)" />
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
export class CategoriesPage {
  protected readonly categories = inject(CategoriesData);
  private readonly inventory = inject(InventoryData);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);

  protected readonly form = signal<CategoryForm | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected usage(id: Id): number {
    return this.inventory.productCountByCategory().get(id) ?? 0;
  }

  protected openNew(): void {
    this.open({ id: null, name: '' });
  }

  protected openEdit(category: ProductCategory): void {
    this.open({ id: category.id, name: category.name });
  }

  protected setName(event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.form.update((f) => (f ? { ...f, name } : f));
    this.error.set(null);
  }

  protected close(): void {
    if (!this.saving()) this.form.set(null);
  }

  protected async save(): Promise<void> {
    const f = this.form();
    if (!f || this.saving()) return;
    const name = f.name.trim();
    if (!name) return this.error.set('Escribe un nombre.');
    if (this.categories.nameTaken(name, f.id)) return this.error.set('Ya existe una categoría con ese nombre.');
    this.saving.set(true);
    const ok = f.id ? await this.categories.rename(f.id, name) : await this.categories.create(name);
    this.saving.set(false);
    if (!ok) return;
    this.form.set(null);
    this.toaster.show(f.id ? `Categoría «${name}» guardada` : `Categoría «${name}» creada`);
  }

  protected async remove(category: ProductCategory): Promise<void> {
    const count = this.usage(category.id);
    if (count) return this.toaster.show(`«${category.name}» tiene ${count} productos. Cámbialos de categoría antes de borrarla.`, 'info');
    const yes = await this.confirm.ask({
      title: `¿Borrar «${category.name}»?`,
      message: 'Ningún producto la usa. No se puede deshacer.',
      confirmLabel: 'Borrar categoría',
      danger: true,
    });
    if (yes && (await this.categories.remove(category.id))) this.toaster.show(`Categoría «${category.name}» borrada`);
  }

  private open(form: CategoryForm): void {
    this.error.set(null);
    this.form.set(form);
  }
}
