import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toApiFailure } from '../../core/api/api-error';
import type { PaymentMethod } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { Skeleton } from '../../shared/ui/skeleton';
import { Switch } from '../../shared/ui/switch';
import { Toaster } from '../../shared/ui/toaster';
import { MethodBadge } from './method-badge';
import { PAYMENT_METHODS_HOST } from './payment-methods.host';
import { CURRENCY_BADGE, typeInfo } from './payment-methods.models';
import { toInput } from './payment-methods-remote';

/** How many data a card shows before "+ N datos". */
const SHOWN_FIELDS = 3;
/** How long the card just saved stays highlighted. */
const HIGHLIGHT_MS = 2500;

/**
 * The cards of «Métodos de pago», from the route's host (a company's or Vortomi's): a card opens the
 * editor; dragging it reorders; its switch shows or hides it. Used by the panel's page and the
 * console's Suscripciones tab.
 */
@Component({
  selector: 'app-payment-method-list',
  imports: [Icon, MethodBadge, RouterLink, Skeleton, Switch],
  template: `
    @if (!host.available) {
      <div class="card"><p class="empty-state"><app-icon name="dollar" />Los métodos de pago se configuran con el servidor.</p></div>
    } @else {
      <p class="form-alert info note"><app-icon name="info" /><span [innerHTML]="host.texts.listNote"></span></p>
      @if (failed()) {
        <div class="form-alert" role="alert">
          <app-icon name="alert" /><span class="grow">No pudimos cargar los métodos de pago.</span>
          <button type="button" class="btn btn--sm" [attr.aria-busy]="retrying()" (click)="retry()"><span>Reintentar</span></button>
        </div>
      } @else if (!loaded()) {
        <app-skeleton kind="cards" [rows]="3" />
      } @else {
        <div class="grid" [class.saving]="reordering()" [attr.aria-busy]="reordering()">
          @for (method of methods(); track method.id; let i = $index) {
            <article class="card method" [class.hidden]="!method.isActive" [class.saved]="highlighted() === method.id" [class.dragging]="dragging() === i"
              draggable="true" (dragstart)="dragStart(i, $event)" (dragover)="dragOver(i, $event)" (drop)="drop($event)" (dragend)="drop()">
              <div class="top">
                <span class="handle" aria-hidden="true">⋮⋮</span>
                <app-method-badge [type]="method.type" />
                <div class="grow">
                  <b class="name">{{ method.name }}</b>
                  <span class="type">{{ label(method) }}</span>
                </div>
                <span class="currency">{{ currency[method.currency] }}</span>
              </div>
              @if (method.fields.length) {
                <dl>
                  @for (field of method.fields.slice(0, shownFields); track $index) {
                    <dt>{{ field.label }}</dt><dd>{{ field.value }}</dd>
                  }
                </dl>
                @if (method.fields.length > shownFields) { <span class="more">+ {{ method.fields.length - shownFields }} datos</span> }
              } @else {
                <dl><dt>Instrucciones</dt><dd>{{ method.instructions || '—' }}</dd></dl>
              }
              <footer>
                <label class="visible">
                  <app-switch [checked]="method.isActive" [label]="host.texts.visible + ': ' + method.name" [busy]="busy() === method.id" [disabled]="!!busy() && busy() !== method.id" (toggled)="setVisible(method, $event)" />
                  {{ method.isActive ? host.texts.visible : 'Oculto' }}
                </label>
                <a class="btn btn--sm" [routerLink]="[host.formBase, method.id]"><app-icon name="edit" /><span>Editar</span></a>
              </footer>
            </article>
          }
          <a class="card add" [routerLink]="[host.formBase, 'new']">
            <span class="plus"><app-icon name="plus" /></span>
            <b>Agregar método</b>
            <span>Pago móvil, transferencia, Zelle o efectivo</span>
          </a>
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .note { margin-bottom: 18px; }
    .form-alert { align-items: center; }
    .grow { flex: 1; }
    .grid.saving { opacity: 0.6; pointer-events: none; transition: opacity 0.15s; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .method { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; cursor: grab; transition: box-shadow 0.2s, opacity 0.2s; }
    .method.hidden { opacity: 0.7; }
    .method.dragging { opacity: 0.4; }
    .method.saved { box-shadow: 0 0 0 3px var(--color-success); }
    .method:hover { box-shadow: var(--shadow); }
    .top { display: flex; align-items: center; gap: 10px; }
    .handle { color: var(--color-text-faint); letter-spacing: -2px; font-size: 14px; }
    .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .name { font-size: 15px; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .type { font-size: 12.5px; color: var(--color-text-muted); }
    .currency { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: var(--color-surface-hover); color: var(--color-text-2); }
    dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; margin: 0; font-size: 13px; }
    dt { color: var(--color-text-muted); }
    dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono, monospace); font-size: 12.5px; }
    .more { font-size: 12.5px; color: var(--color-text-muted); }
    footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--color-border-soft); padding-top: 10px; margin-top: auto; }
    .visible { display: inline-flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--color-text-2); }
    .add { border-style: dashed; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px; min-height: 180px;
      color: var(--color-text-muted); text-decoration: none; font-size: 13px; text-align: center; }
    .add b { color: var(--color-text); font-size: 14px; }
    .add:hover { border-color: var(--color-primary); color: var(--color-primary-text); background: var(--color-primary-softer); }
    .plus { width: 40px; height: 40px; border-radius: 50%; background: var(--color-surface-hover); display: flex; align-items: center; justify-content: center; --icon-size: 18px; }
  `,
})
export class PaymentMethodList {
  protected readonly host = inject(PAYMENT_METHODS_HOST);
  private readonly toaster = inject(Toaster);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly shownFields = SHOWN_FIELDS;
  protected readonly currency = CURRENCY_BADGE;
  protected readonly methods = signal<PaymentMethod[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  /** The method whose visibility is being saved: its switch waits, the others stay still. */
  protected readonly busy = signal<string | null>(null);
  /** A new order of the cards is being saved. */
  protected readonly reordering = signal(false);
  protected readonly retrying = signal(false);
  protected readonly dragging = signal<number | null>(null);
  protected readonly highlighted = signal<string | null>(null);
  /** The order before the drag started: saved only if it changed. */
  private orderBeforeDrag = '';

  constructor() {
    void this.load();
    this.highlightSaved();
  }

  protected label(method: PaymentMethod): string {
    return typeInfo(method.type).label;
  }

  protected async load(): Promise<void> {
    if (!this.host.available) return;
    this.failed.set(false);
    try {
      this.methods.set(await this.host.list());
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  protected async setVisible(method: PaymentMethod, isActive: boolean): Promise<void> {
    if (this.busy()) return;
    this.busy.set(method.id);
    try {
      const saved = await this.host.update(method.id, { ...toInput(method), isActive });
      this.methods.update((list) => list.map((m) => (m.id === saved.id ? saved : m)));
      this.toaster.show(isActive ? this.host.texts.shown(method.name) : `${method.name} quedó oculto.`);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.busy.set(null);
    }
  }

  protected async retry(): Promise<void> {
    this.retrying.set(true);
    await this.load();
    this.retrying.set(false);
  }

  protected dragStart(index: number, event: DragEvent): void {
    this.dragging.set(index);
    this.orderBeforeDrag = this.idsKey();
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /** The list reorders while dragging over it, so the person sees where the card lands. */
  protected dragOver(index: number, event: DragEvent): void {
    const from = this.dragging();
    if (from === null) return;
    event.preventDefault();
    if (from === index) return;
    this.methods.update((list) => {
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved!);
      return next;
    });
    this.dragging.set(index);
  }

  protected async drop(event?: DragEvent): Promise<void> {
    event?.preventDefault();
    if (this.dragging() === null) return;
    this.dragging.set(null);
    if (this.idsKey() === this.orderBeforeDrag) return;
    this.reordering.set(true);
    try {
      this.methods.set(await this.host.reorder(this.methods().map((m) => m.id)));
      this.toaster.show(this.host.texts.reordered);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      await this.load();
    } finally {
      this.reordering.set(false);
    }
  }

  private idsKey(): string {
    return this.methods().map((m) => m.id).join(',');
  }

  /** Back from the editor with ?saved=<id>: that card shines for a moment. The other query stays (the console's tab). */
  private highlightSaved(): void {
    const saved = this.route.snapshot.queryParamMap.get('saved');
    if (!saved) return;
    this.highlighted.set(saved);
    void this.router.navigate([], { queryParams: { saved: null }, queryParamsHandling: 'merge', replaceUrl: true });
    setTimeout(() => this.highlighted.set(null), HIGHLIGHT_MS);
  }
}
