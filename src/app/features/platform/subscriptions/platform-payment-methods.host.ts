import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../core/api/api-client';
import { API_CONFIG } from '../../../core/api/api-config';
import type { Id, PaymentMethod } from '../../../shared/api/models';
import type { PaymentMethodInput } from '../../payment-methods/payment-methods-remote';
import { type PaymentMethodTexts, type PaymentMethodsHost } from '../../payment-methods/payment-methods.host';
import { typeInfo } from '../../payment-methods/payment-methods.models';

const TEXTS: PaymentMethodTexts = {
  listIntro: 'Dónde las empresas pagan su mensualidad a Vortomi.',
  listNote:
    'Las empresas ven los métodos <b>visibles</b> para pagar su mensualidad, en este orden; arrastra una tarjeta para cambiarlo. ' +
    'Un método se oculta en lugar de borrarse. La moneda la define el tipo.',
  visible: 'Visible para las empresas',
  shown: (name) => `Las empresas ya ven ${name}.`,
  reordered: 'Orden guardado. Las empresas ven los métodos en este orden.',
  editIntro: 'Los cambios se ven desde ya en el panel de las empresas.',
  typeLead: 'Define la moneda en que paga la empresa y los datos que te proponemos.',
  dataTitle: 'Datos que verá la empresa',
  dataLead: 'Se muestran en este orden; arrastra para cambiarlo.',
  nameLabel: 'Nombre que ve la empresa',
  nameMissing: 'Escribe el nombre que verá la empresa.',
  amountNote: null,
  noProofArrange: 'No se pide referencia ni comprobante: alguien de Vortomi acuerda con la empresa cómo y cuándo pagar.',
  noProofCash: 'En efectivo no se pide referencia ni comprobante.',
  receiptHint: 'Con comprobante, la empresa adjunta el capture al reportar su pago.',
};

/** The currency follows the type, as the server says it. */
const currencyOf = (type: PaymentMethod['type']): PaymentMethod['currency'] =>
  typeInfo(type).group === 'ves' ? 'VES' : type === 'cash_eur' ? 'EUR' : 'USD';

/**
 * Console → Suscripciones → Métodos de pago: Vortomi's own methods, where companies pay their
 * monthly fee (/platform/payment-methods). In the preview without a server ('mock' mode, never
 * deployed) they are kept in memory, so the screens can be seen.
 */
@Injectable()
export class PlatformPaymentMethodsHost implements PaymentMethodsHost {
  private readonly api = inject(ApiClient);
  private readonly live = inject(API_CONFIG).mode === 'api';
  private sample: PaymentMethod[] = [];

  readonly available = true;
  readonly listLink = '/platform/subscriptions';
  readonly listQuery = { tab: 'methods' };
  readonly formBase = '/platform/subscriptions/payment-methods';
  readonly preview = false;
  readonly texts = TEXTS;

  async list(): Promise<PaymentMethod[]> {
    if (!this.live) return [...this.sample];
    return (await this.api.get<{ items: PaymentMethod[] }>('platform/payment-methods')).items;
  }

  async create(input: PaymentMethodInput): Promise<PaymentMethod> {
    if (this.live) return this.api.post('platform/payment-methods', input);
    const method: PaymentMethod = { ...input, id: crypto.randomUUID(), currency: currencyOf(input.type), sortOrder: this.sample.length };
    this.sample = [...this.sample, method];
    return method;
  }

  async update(id: Id, input: PaymentMethodInput): Promise<PaymentMethod> {
    if (this.live) return this.api.put(`platform/payment-methods/${encodeURIComponent(id)}`, input);
    const current = this.sample.find((m) => m.id === id);
    if (!current) throw new Error('Ese método ya no existe.');
    const method: PaymentMethod = { ...current, ...input, currency: currencyOf(input.type) };
    this.sample = this.sample.map((m) => (m.id === id ? method : m));
    return method;
  }

  async reorder(ids: Id[]): Promise<PaymentMethod[]> {
    if (this.live) return (await this.api.put<{ items: PaymentMethod[] }>('platform/payment-methods/order', { ids })).items;
    this.sample = ids.map((id, sortOrder) => ({ ...this.sample.find((m) => m.id === id)!, sortOrder }));
    return [...this.sample];
  }

  /** No WhatsApp preview here, so no rate. */
  async bsPerUsd(): Promise<string | null> {
    return null;
  }
}
