import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API_CONFIG } from '../../core/api/api-config';
import { toApiFailure } from '../../core/api/api-error';
import { Session } from '../../core/session';
import type { PaymentField, PaymentFieldKind, PaymentMethodType, PaymentProofRule } from '../../shared/api/models';
import { Icon } from '../../shared/ui/icon';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { Switch } from '../../shared/ui/switch';
import { Toaster } from '../../shared/ui/toaster';
import { UnsavedChanges } from '../../shared/ui/unsaved-changes';
import { ExchangeRatesRemote } from '../exchange-rates/exchange-rates-remote';
import { rateInUse } from '../exchange-rates/rate-format';
import { FieldValueInput } from './field-value-input';
import { MethodPreview } from './method-preview';
import { MethodTypeSelect } from './method-type-select';
import type { MessageMethod } from './payment-message';
import { MAX_FIELDS, RECEIPT_OPTIONS, REFERENCE_OPTIONS, isCash, takesNoProof, typeInfo } from './payment-methods.models';
import { type PaymentMethodInput, PaymentMethodsRemote } from './payment-methods-remote';
import { FORMAT_HINT, hasValidFormat } from './venezuelan-formats';

/** A datum being edited; the placeholder comes from the type's suggestion. */
type DraftField = PaymentField & { placeholder?: string };

interface Draft {
  type: PaymentMethodType | null;
  name: string;
  fields: DraftField[];
  instructions: string;
  referenceRule: PaymentProofRule;
  receiptRule: PaymentProofRule;
  isActive: boolean;
}

const EMPTY: Draft = { type: null, name: '', fields: [], instructions: '', referenceRule: 'required', receiptRule: 'required', isActive: true };

/** The Venezuelan data the bolívar types can add, besides free text. */
const VES_KINDS: { kind: PaymentFieldKind; label: string; button: string }[] = [
  { kind: 'bank', label: 'Banco', button: 'Banco' },
  { kind: 'document', label: 'DNI', button: 'Documento' },
  { kind: 'phone', label: 'Teléfono', button: 'Teléfono' },
];

/** Phone and document keep their code or letter while empty: "0414-" is still nothing typed. */
const isBlank = (field: PaymentField) => !field.value.trim() || ((field.kind === 'phone' || field.kind === 'document') && field.value.endsWith('-'));

const toMenu = (options: { value: string; label: string }[]): MenuOption[] => options.map((o) => ({ value: o.value, label: o.label }));

/**
 * «Nuevo método de pago» / «Editar método»: the type (which sets the currency and proposes the data),
 * the data the customer gets, the instructions, whether a reference and a receipt are asked for, and a
 * preview of the exact WhatsApp message. Admins only.
 */
@Component({
  selector: 'app-payment-method-form-page',
  imports: [FieldValueInput, Icon, MethodPreview, MethodTypeSelect, RouterLink, SelectMenu, Switch],
  template: `
    <header class="page-top">
      <nav class="crumbs"><a routerLink="/payment-methods">Métodos de pago</a> / <span>{{ isNew() ? 'Nuevo' : original()?.name ?? '…' }}</span></nav>
    </header>
    <div class="page-body">
      @if (missing()) {
        <p class="empty">Ese método ya no existe. <a routerLink="/payment-methods">Volver a la lista</a></p>
      } @else if (!ready()) {
        <p class="empty">Cargando…</p>
      } @else {
        @let d = draft();
        <h1>{{ isNew() ? 'Nuevo método de pago' : 'Editar método · ' + original()?.name }}</h1>
        <p class="intro">
          {{ isNew()
            ? 'Elige el tipo: te proponemos los datos que se suelen pedir. Cambia las etiquetas, agrega o quita los que quieras.'
            : 'Los cambios se usan en los próximos pedidos. Los pedidos ya hechos conservan el mensaje que se envió.' }}
        </p>
        <div class="layout">
          <div class="form">
            <section class="card box">
              <h2>Tipo de método</h2>
              <p class="lead">Define la moneda en que paga el cliente y los datos que te proponemos.</p>
              <app-method-type-select [value]="d.type" (picked)="chooseType($event)" />
              @if (!d.type) { <p class="lead">Al elegir el tipo aparece su formulario: nombre, datos para pagar, instrucciones y vista previa.</p> }
            </section>

            @if (d.type) {
              <section class="card box">
                <h2>Datos que recibirá el cliente</h2>
                <p class="lead">Se envían en este orden; arrastra para cambiarlo.</p>
                <div class="field">
                  <label for="method-name">Nombre que ve el cliente</label>
                  <input id="method-name" class="input" maxlength="120" [value]="d.name" (input)="patch({ name: text($event) })" />
                  <p class="field-hint">Si tienes cuentas en varios bancos, crea un método por banco.</p>
                </div>

                @if (d.fields.length) {
                  <div class="rows">
                    <div class="row legend"><span></span><span>Etiqueta</span><span>Valor</span><span></span></div>
                    @for (field of d.fields; track $index; let i = $index) {
                      <div class="row" [class.dragging]="dragging() === i" draggable="true" (dragstart)="dragStart(i, $event)" (dragover)="dragOver(i, $event)"
                        (drop)="dragEnd($event)" (dragend)="dragEnd()">
                        <span class="handle" title="Arrastra para ordenar" aria-hidden="true">⋮⋮</span>
                        <input class="input" maxlength="40" placeholder="Etiqueta" [attr.aria-label]="'Etiqueta del dato ' + (i + 1)" [value]="field.label"
                          (input)="setField(i, { label: text($event) })" />
                        <app-field-value-input [kind]="field.kind" [value]="field.value" [label]="field.label || 'Dato ' + (i + 1)" [placeholder]="field.placeholder"
                          (changed)="setField(i, { value: $event })" />
                        <button type="button" class="icon-btn" [attr.aria-label]="'Quitar ' + (field.label || 'el dato ' + (i + 1))" (click)="removeField(i)"><app-icon name="x" /></button>
                      </div>
                    }
                  </div>
                }
                @if (d.fields.length < maxFields) {
                  <div class="adds">
                    @if (paysInBolivares()) {
                      @for (k of vesKinds; track k.kind) {
                        <button type="button" class="btn" (click)="addField(k.kind, k.label)"><app-icon name="plus" />{{ k.button }}</button>
                      }
                    }
                    <button type="button" class="btn" (click)="addField('text', '')"><app-icon name="plus" />{{ paysInBolivares() ? 'Otro dato' : 'Agregar dato' }}</button>
                  </div>
                }
                <p class="ok">El <b>monto a pagar</b> se agrega solo al final, en la moneda del método. No hace falta escribirlo.</p>

                <div class="field">
                  <label for="method-instructions">Instrucciones · {{ noProof() ? 'obligatorias' : 'opcional' }}</label>
                  <textarea id="method-instructions" class="input" rows="3" maxlength="2000" [placeholder]="instructionsPlaceholder()" [value]="d.instructions"
                    (input)="patch({ instructions: text($event) })"></textarea>
                </div>

                @if (noProof()) {
                  <p class="lead">
                    {{ d.type === 'arrange'
                      ? 'No se pide referencia ni comprobante: un asesor acuerda con el cliente cómo y cuándo pagar.'
                      : 'En efectivo no se pide referencia ni comprobante: el pedido pasa directo a revisión de un asesor.' }}
                  </p>
                } @else {
                  <div class="rules">
                    <div class="field">
                      <span class="label">Referencia del pago</span>
                      <app-select-menu label="Referencia del pago" [options]="referenceOptions" [value]="d.referenceRule" (picked)="patch({ referenceRule: asRule($event) })" />
                    </div>
                    <div class="field">
                      <span class="label">Comprobante</span>
                      <app-select-menu label="Comprobante" [options]="receiptOptions" [value]="d.receiptRule" (picked)="patch({ receiptRule: asRule($event) })" />
                    </div>
                  </div>
                  <p class="field-hint">Con comprobante, el cliente envía el capture por el chat y queda guardado en su pedido para que un asesor lo revise.</p>
                }
              </section>
            }

            @if (error(); as message) { <p class="field-error" role="alert">{{ message }}</p> }
            <footer class="card box bar">
              <label class="visible">
                <app-switch [checked]="d.isActive" label="Visible para los clientes" (toggled)="patch({ isActive: $event })" />
                {{ d.isActive ? 'Visible para los clientes' : 'Oculto' }}
              </label>
              <span class="spacer"></span>
              <a class="btn" routerLink="/payment-methods">Cancelar</a>
              <button type="button" class="btn btn--primary" [disabled]="saving() || !d.type" [attr.aria-busy]="saving()" (click)="save()">
                @if (saving()) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="check" /> }
                {{ isNew() ? 'Crear método' : 'Guardar cambios' }}
              </button>
            </footer>
          </div>

          @if (previewMethod(); as method) {
            <aside class="card box preview"><app-method-preview [method]="method" [bsPerUsd]="bsPerUsd()" /></aside>
          }
        </div>
      }
    </div>
  `,
  styleUrls: ['../../shared/ui/section.scss'],
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .crumbs { font-size: 13.5px; color: var(--color-text-muted); }
    .crumbs span { color: var(--color-text); font-weight: 500; }
    h1 { font-size: 20px; font-weight: 600; }
    .intro { color: var(--color-text-muted); font-size: 13.5px; margin: 4px 0 16px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
    @media (max-width: 1000px) { .layout { grid-template-columns: minmax(0, 1fr); } }
    .preview { position: sticky; top: 0; }
    .lead { color: var(--color-text-muted); font-size: 13px; margin: 0; }
    .label { font-size: 13px; font-weight: 600; color: var(--color-text-2); }
    .rows { gap: 8px; }
    .row { display: grid; grid-template-columns: 18px 170px minmax(0, 1fr) 32px; gap: 8px; align-items: center; padding: 0; border: 0; flex-wrap: nowrap; }
    .row.dragging { opacity: 0.4; }
    .legend span { font-size: 12px; color: var(--color-text-muted); }
    .handle { color: var(--color-text-faint); letter-spacing: -2px; cursor: grab; }
    .icon-btn:hover { color: var(--color-danger); border-color: currentColor; }
    .adds { display: flex; gap: 8px; flex-wrap: wrap; }
    .ok { font-size: 12.5px; color: #166534; background: #e3f6ea; border-radius: 8px; padding: 8px 12px; margin: 0; }
    .rules { display: grid; grid-template-columns: repeat(2, minmax(0, 220px)); gap: 14px; }
    .bar { flex-direction: row; align-items: center; gap: 10px; flex-wrap: wrap; }
    .visible { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-2); }
    .spacer { flex: 1; }
    .empty { color: var(--color-text-muted); font-size: 14px; }
  `,
})
export class PaymentMethodFormPage {
  protected readonly remote = inject(API_CONFIG).mode === 'api' ? inject(PaymentMethodsRemote) : null;
  private readonly rates = inject(ExchangeRatesRemote);
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);
  private readonly router = inject(Router);
  private readonly methodId = inject(ActivatedRoute).snapshot.paramMap.get('methodId');

  protected readonly maxFields = MAX_FIELDS;
  protected readonly vesKinds = VES_KINDS;
  protected readonly referenceOptions = toMenu(REFERENCE_OPTIONS);
  protected readonly receiptOptions = toMenu(RECEIPT_OPTIONS);
  protected readonly isNew = signal(this.methodId === null);
  protected readonly original = signal<PaymentMethodInput | null>(null);
  protected readonly draft = signal<Draft>(EMPTY);
  protected readonly ready = signal(false);
  protected readonly missing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly bsPerUsd = signal<string | null>(null);
  protected readonly dragging = signal<number | null>(null);
  /** What the form started from: leaving with anything else asks first. */
  private readonly baseline = signal(JSON.stringify(EMPTY));

  protected readonly noProof = computed(() => {
    const type = this.draft().type;
    return type !== null && takesNoProof(type);
  });
  protected readonly paysInBolivares = computed(() => {
    const type = this.draft().type;
    return type !== null && typeInfo(type).group === 'ves';
  });
  protected readonly instructionsPlaceholder = computed(() => {
    const type = this.draft().type;
    if (type === 'arrange') return 'Ej.: te escribimos en horario laboral para acordar cómo pagar.';
    if (type && isCash(type)) return 'Ej.: al retirar en la tienda o al recibir el delivery.';
    return 'Ej.: paga el monto exacto y envíanos el capture.';
  });
  protected readonly previewMethod = computed((): MessageMethod | null => {
    const d = this.draft();
    if (!d.type) return null;
    const info = typeInfo(d.type);
    return { ...d, type: d.type, name: d.name.trim() || info.label, currency: info.group === 'ves' ? 'VES' : d.type === 'cash_eur' ? 'EUR' : 'USD' };
  });
  private readonly dirty = computed(() => JSON.stringify(this.draft()) !== this.baseline());

  constructor() {
    inject(UnsavedChanges).track(this.dirty);
    void this.load();
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected asRule(value: string): PaymentProofRule {
    return value as PaymentProofRule;
  }

  protected patch(change: Partial<Draft>): void {
    this.draft.update((d) => ({ ...d, ...change }));
    this.error.set(null);
  }

  /**
   * A new method gets the type's suggested data while nothing was typed yet, and its name while the
   * name is empty or still the previous type's. Cash and agreed payments take no proof.
   */
  protected chooseType(type: PaymentMethodType): void {
    const d = this.draft();
    const info = typeInfo(type);
    const previousLabel = d.type ? typeInfo(d.type).label : '';
    const untouched = d.fields.every((f) => isBlank(f));
    const change: Partial<Draft> = { type };
    if (!d.name.trim() || d.name === previousLabel) change.name = info.label;
    if (this.isNew() && untouched) change.fields = info.fields.map((f) => ({ kind: f.kind, label: f.label, value: '', copyable: true, placeholder: f.placeholder }));
    if (takesNoProof(type)) Object.assign(change, { referenceRule: 'none', receiptRule: 'none' });
    else if (d.receiptRule === 'none' && d.referenceRule === 'none') Object.assign(change, { referenceRule: 'required', receiptRule: 'required' });
    this.patch(change);
  }

  protected setField(index: number, change: Partial<DraftField>): void {
    this.patch({ fields: this.draft().fields.map((f, i) => (i === index ? { ...f, ...change } : f)) });
  }

  protected addField(kind: PaymentFieldKind, label: string): void {
    this.patch({ fields: [...this.draft().fields, { kind, label, value: '', copyable: true }] });
  }

  protected removeField(index: number): void {
    this.patch({ fields: this.draft().fields.filter((_, i) => i !== index) });
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
    const fields = [...this.draft().fields];
    const [moved] = fields.splice(from, 1);
    fields.splice(index, 0, moved!);
    this.patch({ fields });
    this.dragging.set(index);
  }

  protected dragEnd(event?: DragEvent): void {
    event?.preventDefault();
    this.dragging.set(null);
  }

  protected async save(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    const d = this.draft();
    if (!this.remote || !tenantId || !d.type) return;
    const problem = this.problem(d);
    if (problem) return this.error.set(problem);
    const input: PaymentMethodInput = {
      type: d.type,
      name: d.name.trim(),
      fields: d.fields.map(({ kind, label, value }) => ({ kind, label: label.trim(), value: value.trim(), copyable: true })),
      instructions: d.instructions.trim(),
      referenceRule: d.referenceRule,
      receiptRule: d.receiptRule,
      isActive: d.isActive,
    };
    this.saving.set(true);
    try {
      const saved = this.methodId ? await this.remote.update(tenantId, this.methodId, input) : await this.remote.create(tenantId, input);
      this.baseline.set(JSON.stringify(this.draft()));
      this.toaster.show(`${saved.name} guardado.`);
      await this.router.navigate(['/payment-methods'], { queryParams: { saved: saved.id } });
    } catch (error) {
      this.error.set(toApiFailure(error).message);
    } finally {
      this.saving.set(false);
    }
  }

  /** What to fix before saving, in plain words; null when it is ready. */
  private problem(d: Draft): string | null {
    if (d.name.trim().length < 2) return 'Escribe el nombre que verá el cliente.';
    if (d.fields.some((f) => !f.label.trim() || isBlank(f))) return 'Completa la etiqueta y el valor de cada dato, o quita los que no uses.';
    const wrong = d.fields.find((f) => !hasValidFormat(f.kind, f.value.trim()));
    if (wrong) return `Revisa «${wrong.label}»: ${FORMAT_HINT[wrong.kind]}.`;
    if (d.type && takesNoProof(d.type) && !d.instructions.trim() && !d.fields.length) return 'Escribe las instrucciones del pago.';
    return null;
  }

  private async load(): Promise<void> {
    const tenantId = this.session.tenant()?.id;
    if (!this.remote || !tenantId) return;
    void this.rates
      .get(tenantId)
      .then((book) => this.bsPerUsd.set(rateInUse(book)))
      .catch(() => undefined);
    try {
      if (this.methodId) {
        const method = (await this.remote.list(tenantId)).find((m) => m.id === this.methodId);
        if (!method) return this.missing.set(true);
        const { type, name, fields, instructions, referenceRule, receiptRule, isActive } = method;
        const draft: Draft = { type, name, fields, instructions, referenceRule, receiptRule, isActive };
        this.original.set(draft as PaymentMethodInput);
        this.draft.set(draft);
        this.baseline.set(JSON.stringify(draft));
      }
    } catch (error) {
      this.toaster.show(toApiFailure(error).message, 'info');
    } finally {
      this.ready.set(true);
    }
  }
}
