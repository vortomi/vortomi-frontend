import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toApiFailure } from '../../../core/api/api-error';
import { parsePriceCents } from '../../../shared/format/money';
import { Confirm } from '../../../shared/ui/confirm';
import { Icon } from '../../../shared/ui/icon';
import { NumericInput } from '../../../shared/ui/numeric-input';
import { Skeleton } from '../../../shared/ui/skeleton';
import { Switch } from '../../../shared/ui/switch';
import { Toaster } from '../../../shared/ui/toaster';
import { UnsavedChanges } from '../../../shared/ui/unsaved-changes';
import { MAX_BENEFITS, MAX_DISCOUNT, PERIOD_LABEL, PLAN_PERIODS, type Plan } from './plan.models';
import { EMPTY_DRAFT, type PlanDraft, changesOf, changesWhatTheyPay, companiesText, draftOf, readDraft } from './plan.rules';
import { PlanCard } from './plan-card';
import { PlatformPlans } from './platform-plans';

/** Where the editor goes back to: the Planes tab of Suscripciones. */
const LIST = '/platform/subscriptions';
const LIST_QUERY = { tab: 'plans' };

/**
 * «Nuevo plan» / «Editar plan» (mockup web-34, steps 2 to 4): name, description, base price per
 * month, a discount for 1, 3, 6 and 12 months, and the benefits, with the card as it will look.
 * Editing a plan companies have asks first, listing what changes.
 */
@Component({
  selector: 'app-plan-form-page',
  imports: [Icon, NumericInput, PlanCard, RouterLink, Skeleton, Switch],
  template: `
    <header class="page-top">
      <nav class="crumbs" aria-label="Ruta"><a [routerLink]="list" [queryParams]="listQuery">Planes</a><app-icon name="chev-right" /><span>{{ isNew() ? 'Nuevo' : original()?.name ?? '…' }}</span></nav>
    </header>
    <div class="page-body">
      @if (missing()) {
        <div class="card"><p class="empty-state"><app-icon name="dollar" />Ese plan ya no existe.<a class="link" [routerLink]="list" [queryParams]="listQuery">Volver a los planes</a></p></div>
      } @else if (loadError(); as error) {
        <div class="form-alert" role="alert">
          <app-icon name="alert" /><span class="grow">{{ error }}</span>
          <button type="button" class="btn btn--sm" (click)="retry()"><span>Reintentar</span></button>
        </div>
      } @else if (!ready()) {
        <div class="layout"><section class="card box"><app-skeleton kind="form" [rows]="5" /></section></div>
      } @else {
        @let d = draft();
        <h1>{{ isNew() ? 'Nuevo plan' : 'Editar plan · ' + original()?.name }}</h1>
        <p class="intro">{{ isNew() ? 'Un precio base por mes, el descuento por pagar varios meses y lo que incluye.' : 'Puedes cambiar todo: nombre, descripción, precio, descuentos y beneficios.' }}</p>
        @if (original()?.companies; as companies) {
          <p class="form-alert info"><app-icon name="info" />
            <span><b>{{ companiesText(companies) }}</b> {{ companies === 1 ? 'tiene' : 'tienen' }} este plan. Nombre, descripción y beneficios nuevos se ven desde ya. Un precio o descuento nuevo se les aplica desde su <b>próxima factura</b>.</span>
          </p>
        }
        <div class="layout">
          <section class="card box">
            <h2>Datos del plan</h2>
            <div class="field">
              <label for="plan-name">Nombre</label>
              <input id="plan-name" class="input" maxlength="60" [value]="d.name" (input)="patch({ name: text($event) })" />
            </div>
            <div class="field">
              <label for="plan-description">Descripción <span class="opt">opcional</span></label>
              <textarea id="plan-description" class="input" rows="2" maxlength="500" placeholder="Ej.: para negocios que empiezan con un solo número." [value]="d.description"
                (input)="patch({ description: text($event) })"></textarea>
            </div>
            <div class="field">
              <label for="plan-price">Precio base por mes (dólares)</label>
              <input id="plan-price" class="input price" appNumeric="money" inputmode="decimal" autocomplete="off" placeholder="0,00" [value]="d.price" (input)="patch({ price: text($event) })" />
            </div>
            <div class="field">
              <span class="label">Descuento según los meses que pague</span>
              <div class="discounts">
                @for (period of periods; track period) {
                  <label class="discount">
                    <span>{{ periodLabel[period] }}</span>
                    <span class="pct"><input class="input" appNumeric="quantity" [decimals]="0" inputmode="numeric" maxlength="2" placeholder="0" [attr.aria-label]="'Descuento de ' + periodLabel[period]"
                      [value]="d.discounts[period]" (input)="setDiscount(period, text($event))" /><i>%</i></span>
                  </label>
                }
              </div>
              <p class="field-hint">Del 0 al {{ maxDiscount }} %. Cada tramo vale desde esa cantidad de meses: si paga 4 meses, recibe el de 3.</p>
            </div>
            <div class="field">
              <span class="label">Beneficios <span class="opt">{{ d.benefits.length }} de {{ maxBenefits }}</span></span>
              @if (d.benefits.length) {
                <ul class="benefits">
                  @for (benefit of d.benefits; track $index; let i = $index) {
                    <li [class.dragging]="dragging() === i" draggable="true" (dragstart)="dragStart(i, $event)" (dragover)="dragOver(i, $event)" (drop)="dragEnd($event)" (dragend)="dragEnd()">
                      <span class="handle" aria-hidden="true">⋮⋮</span>
                      <input class="input" maxlength="120" [attr.aria-label]="'Beneficio ' + (i + 1)" [value]="benefit" (input)="setBenefit(i, text($event))" />
                      <button type="button" class="icon-btn danger" [attr.aria-label]="'Quitar ' + benefit" (click)="removeBenefit(i)"><app-icon name="x" /></button>
                    </li>
                  }
                </ul>
              }
              @if (d.benefits.length < maxBenefits) {
                <div class="add">
                  <span aria-hidden="true"></span>
                  <input class="input" maxlength="120" placeholder="Ej.: Soporte prioritario" aria-label="Nuevo beneficio" [value]="newBenefit()"
                    (input)="newBenefit.set(text($event))" (keydown.enter)="addBenefit($event)" />
                  <button type="button" class="btn btn--primary plus" aria-label="Agregar beneficio" [disabled]="!newBenefit().trim()" (click)="addBenefit()"><app-icon name="plus" /></button>
                </div>
              }
            </div>

            @if (error(); as message) { <p class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</p> }
            <footer class="bar">
              @if (isNew()) {
                <label class="visible">
                  <app-switch [checked]="d.isActive" label="Activo al crearlo" (toggled)="patch({ isActive: $event })" />
                  {{ d.isActive ? 'Activo al crearlo' : 'Se crea suspendido' }}
                </label>
              }
              <span class="spacer"></span>
              <a class="btn btn--ghost" [routerLink]="list" [queryParams]="listQuery"><span>Cancelar</span></a>
              <button type="button" class="btn btn--primary" [disabled]="saving()" [attr.aria-busy]="saving()" (click)="save()">
                <app-icon name="check" /><span>{{ isNew() ? 'Crear plan' : 'Guardar cambios' }}</span>
              </button>
            </footer>
          </section>

          <aside class="card box sample">
            <h2>Así se verá la tarjeta</h2>
            <app-plan-card [name]="d.name.trim()" [priceCents]="previewPrice()" [description]="d.description.trim()" [benefits]="previewBenefits()" [suspended]="!d.isActive" />
          </aside>
        </div>
      }
    </div>
  `,
  styleUrls: ['../../../shared/ui/section.scss'],
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .crumbs { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--color-text-muted); --icon-size: 14px; }
    .crumbs a:hover { color: var(--color-primary-text); }
    .crumbs span { color: var(--color-text); font-weight: 500; }
    h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .intro { color: var(--color-text-muted); font-size: 14px; margin: 4px 0 16px; }
    .page-body > .form-alert { margin-bottom: 16px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
    @media (max-width: 1000px) { .layout { grid-template-columns: minmax(0, 1fr); } }
    .sample { position: sticky; top: 0; }
    .opt { font-weight: 400; color: var(--color-text-muted); }
    .price { max-width: 220px; }
    .discounts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    @media (max-width: 640px) { .discounts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .discount { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md);
      font-size: 13px; font-weight: 600; color: var(--color-text); }
    .pct { display: flex; align-items: center; gap: 6px; }
    .pct .input { text-align: right; }
    .pct i { font-style: normal; font-weight: 500; color: var(--color-text-muted); }
    .benefits { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    /* The benefits and the row that adds one share the same columns: handle, field, button. */
    .benefits li, .add { display: grid; grid-template-columns: 18px minmax(0, 1fr) 42px; gap: 8px; align-items: center; }
    .benefits .icon-btn { justify-self: center; }
    .plus { width: 42px; height: 42px; padding: 0; justify-content: center; }
    .benefits li.dragging { opacity: 0.4; }
    .handle { color: var(--color-text-faint); letter-spacing: -2px; cursor: grab; }
    .bar { display: flex; flex-direction: row; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 6px; }
    .visible { display: inline-flex; align-items: center; gap: 10px; font-size: 14px; color: var(--color-text-2); }
    .spacer { flex: 1; }
    .form-alert { align-items: center; }
    .grow { flex: 1; }
  `,
})
export class PlanFormPage {
  private readonly remote = inject(PlatformPlans);
  private readonly confirm = inject(Confirm);
  private readonly toaster = inject(Toaster);
  private readonly router = inject(Router);
  private readonly planId = inject(ActivatedRoute).snapshot.paramMap.get('planId');

  protected readonly list = LIST;
  protected readonly listQuery = LIST_QUERY;
  protected readonly periods = PLAN_PERIODS;
  protected readonly periodLabel = PERIOD_LABEL;
  protected readonly maxBenefits = MAX_BENEFITS;
  protected readonly maxDiscount = MAX_DISCOUNT;
  protected readonly companiesText = companiesText;

  protected readonly isNew = signal(this.planId === null);
  protected readonly original = signal<Plan | null>(null);
  protected readonly draft = signal<PlanDraft>(EMPTY_DRAFT);
  protected readonly newBenefit = signal('');
  protected readonly ready = signal(false);
  protected readonly missing = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dragging = signal<number | null>(null);
  /** The other plans' names: two plans never share one. */
  private readonly takenNames = signal<string[]>([]);
  /** What the form started from: leaving with anything else asks first. */
  private readonly baseline = signal(JSON.stringify(EMPTY_DRAFT));
  private readonly dirty = computed(() => JSON.stringify(this.draft()) !== this.baseline() || !!this.newBenefit().trim());

  protected readonly previewPrice = computed(() => parsePriceCents(this.draft().price));
  protected readonly previewBenefits = computed(() => this.draft().benefits.map((b) => b.trim()).filter(Boolean));

  constructor() {
    inject(UnsavedChanges).track(this.dirty);
    void this.load();
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected patch(change: Partial<PlanDraft>): void {
    this.draft.update((d) => ({ ...d, ...change }));
    this.error.set(null);
  }

  protected setDiscount(period: string, value: string): void {
    this.patch({ discounts: { ...this.draft().discounts, [period]: value } });
  }

  protected setBenefit(index: number, value: string): void {
    this.patch({ benefits: this.draft().benefits.map((b, i) => (i === index ? value : b)) });
  }

  protected addBenefit(event?: Event): void {
    event?.preventDefault();
    const benefit = this.newBenefit().trim();
    if (!benefit || this.draft().benefits.length >= MAX_BENEFITS) return;
    this.patch({ benefits: [...this.draft().benefits, benefit] });
    this.newBenefit.set('');
  }

  protected removeBenefit(index: number): void {
    this.patch({ benefits: this.draft().benefits.filter((_, i) => i !== index) });
  }

  protected dragStart(index: number, event: DragEvent): void {
    this.dragging.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
  }

  protected dragOver(index: number, event: DragEvent): void {
    const from = this.dragging();
    if (from === null) return;
    event.preventDefault();
    if (from === index) return;
    const benefits = [...this.draft().benefits];
    const [moved] = benefits.splice(from, 1);
    benefits.splice(index, 0, moved!);
    this.patch({ benefits });
    this.dragging.set(index);
  }

  protected dragEnd(event?: DragEvent): void {
    event?.preventDefault();
    this.dragging.set(null);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    // A benefit typed but not added yet is added: nobody expects it to be dropped.
    if (this.newBenefit().trim()) this.addBenefit();
    const read = readDraft(this.draft(), parsePriceCents, this.takenNames());
    if ('problem' in read) return this.error.set(read.problem);
    const original = this.original();
    if (original?.companies) {
      const changes = changesOf(original, read.input);
      if (changes.length) {
        const pays = changesWhatTheyPay(original, read.input)
          ? ' El precio y los descuentos nuevos se les aplican desde su próxima factura; lo que ya pagaron no cambia.'
          : '';
        const yes = await this.confirm.ask({
          title: `¿Guardar los cambios del plan ${original.name}?`,
          message: `${companiesText(original.companies)} ${original.companies === 1 ? 'tiene' : 'tienen'} este plan. Cambia: ${changes.join(' · ')}.${pays}`,
          confirmLabel: 'Sí, guardar',
          cancelLabel: 'Seguir editando',
        });
        if (!yes) return;
      }
    }
    this.saving.set(true);
    try {
      const saved = this.planId ? await this.remote.update(this.planId, read.input) : await this.remote.create(read.input, this.draft().isActive);
      this.baseline.set(JSON.stringify(this.draft()));
      this.toaster.show(`${saved.name} guardado.`);
      await this.router.navigate([LIST], { queryParams: { ...LIST_QUERY, saved: saved.id } });
    } catch (error) {
      this.error.set(toApiFailure(error).message);
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      const plans = await this.remote.list();
      this.takenNames.set(plans.filter((p) => p.id !== this.planId).map((p) => p.name));
      if (this.planId) {
        const plan = plans.find((p) => p.id === this.planId);
        if (!plan) return this.missing.set(true);
        const draft = draftOf(plan);
        this.original.set(plan);
        this.draft.set(draft);
        this.baseline.set(JSON.stringify(draft));
      }
    } catch (error) {
      // Without the list a new plan can still be written: the server checks the name.
      if (this.planId) this.loadError.set(toApiFailure(error).message);
    } finally {
      this.ready.set(true);
    }
  }

  protected retry(): void {
    this.loadError.set(null);
    this.ready.set(false);
    void this.load();
  }
}
