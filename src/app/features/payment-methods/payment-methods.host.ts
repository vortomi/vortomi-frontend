import { Injectable, InjectionToken, inject } from '@angular/core';
import { API_CONFIG } from '../../core/api/api-config';
import { Session } from '../../core/session';
import type { Id, PaymentMethod } from '../../shared/api/models';
import { ExchangeRatesRemote } from '../exchange-rates/exchange-rates-remote';
import { rateInUse } from '../exchange-rates/rate-format';
import { type PaymentMethodInput, PaymentMethodsRemote } from './payment-methods-remote';

/** The words that change with who pays: a company's customers, or the companies paying Vortomi. */
export interface PaymentMethodTexts {
  /** Under the list's title. */
  listIntro: string;
  /** The note above the cards (fixed text of ours, may hold <b>). */
  listNote: string;
  /** The switch: «Visible para los clientes». */
  visible: string;
  shown: (name: string) => string;
  reordered: string;
  /** The editor, when it edits an existing method. */
  editIntro: string;
  typeLead: string;
  dataTitle: string;
  dataLead: string;
  nameLabel: string;
  nameMissing: string;
  /** Said under the data when it applies (may hold <b>); null leaves it out. */
  amountNote: string | null;
  noProofArrange: string;
  noProofCash: string;
  receiptHint: string;
}

/**
 * Where «Métodos de pago» reads and saves, and how it speaks. The panel gives a company's own methods
 * (how its customers pay it); the console gives Vortomi's (how companies pay their monthly fee). The
 * list and the editor are the same screens for both: each route provides its host.
 */
export interface PaymentMethodsHost {
  /** False in the preview without a server: the screens say the methods need it. */
  readonly available: boolean;
  /** Where the list is, so the editor goes back to it. */
  readonly listLink: string;
  readonly listQuery: Record<string, string>;
  /** «…/new» and «…/<id>» open the editor. */
  readonly formBase: string;
  /** The WhatsApp message preview beside the editor: only for a company's customers. */
  readonly preview: boolean;
  readonly texts: PaymentMethodTexts;
  list(): Promise<PaymentMethod[]>;
  create(input: PaymentMethodInput): Promise<PaymentMethod>;
  update(id: Id, input: PaymentMethodInput): Promise<PaymentMethod>;
  reorder(ids: Id[]): Promise<PaymentMethod[]>;
  /** Bolívars per dollar for the preview, or null. */
  bsPerUsd(): Promise<string | null>;
}

export const PAYMENT_METHODS_HOST = new InjectionToken<PaymentMethodsHost>('PaymentMethodsHost');

export const COMPANY_TEXTS: PaymentMethodTexts = {
  listIntro: 'Lo que el cliente recibe para pagar su pedido. Abre una tarjeta para editarla; arrástrala para cambiar el orden.',
  listNote:
    'Un método se <b>oculta</b> en lugar de borrarse: los pedidos ya hechos con él lo siguen mostrando. La moneda la define el tipo. ' +
    'El agente solo ofrece los métodos visibles y, al confirmar el pedido, le envía al cliente los datos del que eligió.',
  visible: 'Visible para los clientes',
  shown: (name) => `${name} ya se ofrece a los clientes.`,
  reordered: 'Orden guardado. El agente ofrece los métodos en este orden.',
  editIntro: 'Los cambios se usan en los próximos pedidos. Los pedidos ya hechos conservan el mensaje que se envió.',
  typeLead: 'Define la moneda en que paga el cliente y los datos que te proponemos.',
  dataTitle: 'Datos que recibirá el cliente',
  dataLead: 'Se envían en este orden; arrastra para cambiarlo.',
  nameLabel: 'Nombre que ve el cliente',
  nameMissing: 'Escribe el nombre que verá el cliente.',
  amountNote: 'El <b>monto a pagar</b> se agrega solo al final, en la moneda del método. No hace falta escribirlo.',
  noProofArrange: 'No se pide referencia ni comprobante: un asesor acuerda con el cliente cómo y cuándo pagar.',
  noProofCash: 'En efectivo no se pide referencia ni comprobante: el pedido pasa directo a revisión de un asesor.',
  receiptHint: 'Con comprobante, el cliente envía el capture por el chat y queda guardado en su pedido para que un asesor lo revise.',
};

/** The panel: the signed-in company's methods (Ajustes → Métodos de pago). */
@Injectable()
export class CompanyPaymentMethodsHost implements PaymentMethodsHost {
  private readonly remote = inject(PaymentMethodsRemote);
  private readonly rates = inject(ExchangeRatesRemote);
  private readonly session = inject(Session);

  readonly available = inject(API_CONFIG).mode === 'api';
  readonly listLink = '/payment-methods';
  readonly listQuery = {};
  readonly formBase = '/payment-methods';
  readonly preview = true;
  readonly texts = COMPANY_TEXTS;

  list(): Promise<PaymentMethod[]> {
    return this.remote.list(this.tenantId());
  }

  create(input: PaymentMethodInput): Promise<PaymentMethod> {
    return this.remote.create(this.tenantId(), input);
  }

  update(id: Id, input: PaymentMethodInput): Promise<PaymentMethod> {
    return this.remote.update(this.tenantId(), id, input);
  }

  reorder(ids: Id[]): Promise<PaymentMethod[]> {
    return this.remote.reorder(this.tenantId(), ids);
  }

  async bsPerUsd(): Promise<string | null> {
    return rateInUse(await this.rates.get(this.tenantId()));
  }

  private tenantId(): Id {
    const id = this.session.tenant()?.id;
    if (!id) throw new Error('No company selected');
    return id;
  }
}
