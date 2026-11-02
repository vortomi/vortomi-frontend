import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { PaymentMethod } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { Switch } from '../../shared/ui/switch';
import { Toaster } from '../../shared/ui/toaster';
import { MethodBadge } from './method-badge';
import { CURRENCY_BADGE, typeInfo } from './payment-methods.models';
import { PaymentMethodsRemote, toInput } from './payment-methods-remote';

/** How many data a card shows before "+ N datos". */
const SHOWN_FIELDS = 3;
/** How long the card just saved stays highlighted. */
const HIGHLIGHT_MS = 2500;

/**
 * «Métodos de pago»: what customers see to pay their order, in the order the agent offers them.
 * A card opens the editor; dragging it reorders; its switch shows or hides it. Admins only.
 */
@Component({
  selector: 'app-payment-methods-page',
  imports: [Icon, MethodBadge, RouterLink, Switch],
  template: `
    <header class="page-top">
      <h1>Métodos de pago</h1>
      <span class="sub">Lo que el cliente recibe para pagar su pedido. Abre una tarjeta para editarla; arrástrala para cambiar el orden.</span>
      <span class="spacer"></span>
      <a class="btn btn--primary" routerLink="/payment-methods/new"><app-icon name="plus" />Agregar método</a>
    </header>
    <div class="page-body">
      @if (!remote) {
        <p class="empty">Los métodos de pago se configuran con el servidor.</p>
      } @else {
        <p class="note">
          Un método se <b>oculta</b> en lugar de borrarse: los pedidos ya hechos con él lo siguen mostrando. La moneda la define el tipo.
          El agente solo ofrece los métodos visibles y, al confirmar el pedido, le envía al cliente los datos del que eligió.
        </p>
        @if (failed()) {
          <p class="empty">No pudimos cargar los métodos de pago. <button type="button" class="link" (click)="load()">Reintentar</button></p>
        } @else if (!loaded()) {
          <p class="empty">Cargando…</p>
        } @else {
          <div class="grid">
            @for (method of methods(); track method.id; let i = $index) {
              <article class="card method" [class.hidden]="!method.isActive" [class.saved]="highlighted() === method.id" [class.dragging]="dragging() === i"
                draggable="true" (dragstart)="dragStart(i, $event)" (dragover)="dragOver(i, $event)" (drop)="drop($event)" (dragend)="drop()">
                <div class="top">
                  <span class="handle" title="Arrastra para ordenar" aria-hidden="true">⋮⋮</span>
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
                    <app-switch [checked]="method.isActive" [label]="'Visible para los clientes: ' + method.name" [disabled]="busy()" (toggled)="setVisible(method, $event)" />
                    {{ method.isActive ? 'Visible para los clientes' : 'Oculto' }}
                  </label>
                  <a class="btn" [routerLink]="['/payment-methods', method.id]"><app-icon name="edit" />Editar</a>
                </footer>
              </article>
            }
            <a class="card add" routerLink="/payment-methods/new">
              <span class="plus"><app-icon name="plus" /></span>
              <b>Agregar método</b>
              <span>Pago móvil, transferencia, Zelle o efectivo</span>
            </a>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .note { font-size: 13px; color: var(--color-text-2); background: var(--color-primary-softer); border: 1px solid var(--color-primary-soft); border-radius: 10px;
      padding: 10px 14px; margin-bottom: 16px; line-height: 1.5; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
    .method { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; cursor: grab; transition: box-shadow 0.2s, opacity 0.2s; }
    .method.hidden { opacity: 0.7; }
    .method.dragging { opacity: 0.4; }
    .method.saved { box-shadow: 0 0 0 3px var(--color-success); }
    .top { display: flex; align-items: center; gap: 10px; }
    .handle { color: var(--color-text-faint); letter-spacing: -2px; font-size: 14px; }
    .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .name { font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .type { font-size: 12.5px; color: var(--color-text-muted); }
    .currency { font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--color-surface-muted); color: var(--color-text-2); }
    dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; margin: 0; font-size: 13px; }
    dt { color: var(--color-text-muted); }
    dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono, monospace); font-size: 12.5px; }
    .more { font-size: 12.5px; color: var(--color-text-muted); }
    footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--color-border-soft); padding-top: 10px; margin-top: auto; }
    .visible { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-2); }
    .add { border-style: dashed; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px; min-height: 180px;
      color: var(--color-text-muted); text-decoration: none; font-size: 13px; text-align: center; }
    .add b { color: var(--color-text); font-size: 14px; }
    .add:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .plus { width: 38px; height: 38px; border-radius: 50%; background: var(--color-surface-muted); display: flex; align-items: center; justify-content: center; --icon-size: 18px; }
    .empty { color: var(--color-text-muted); font-size: 14px; }
  `,
})
export class PaymentMethodsPage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(PaymentMethodsRemote) : null;
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly shownFields = SHOWN_FIELDS;
  protected readonly currency = CURRENCY_BADGE;
  protected readonly methods = signal<PaymentMethod[]>([]);
  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
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
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    this.failed.set(false);
    try {
      this.methods.set(await this.remote.list(tenantId));
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  protected async setVisible(method: PaymentMethod, isActive: boolean): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    this.busy.set(true);
    try {
      const saved = await this.remote.update(tenantId, method.id, { ...toInput(method), isActive });
      this.methods.update((list) => list.map((m) => (m.id === saved.id ? saved : m)));
      this.toaster.show(isActive ? `${method.name} ya se ofrece a los clientes.` : `${method.name} quedó oculto.`);
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.busy.set(false);
    }
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
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId || this.idsKey() === this.orderBeforeDrag) return;
    try {
      this.methods.set(await this.remote.reorder(tenantId, this.methods().map((m) => m.id)));
      this.toaster.show('Orden guardado. El agente ofrece los métodos en este orden.');
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
      await this.load();
    }
  }

  private idsKey(): string {
    return this.methods().map((m) => m.id).join(',');
  }

  /** Back from the editor with ?saved=<id>: that card shines for a moment. */
  private highlightSaved(): void {
    const saved = this.route.snapshot.queryParamMap.get('saved');
    if (!saved) return;
    this.highlighted.set(saved);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    setTimeout(() => this.highlighted.set(null), HIGHLIGHT_MS);
  }
}
