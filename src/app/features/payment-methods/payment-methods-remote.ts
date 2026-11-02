import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { Id, PaymentMethod } from '../../shared/api/models';

/** What the editor sends: everything but the id, the currency (it follows the type) and the place. */
export type PaymentMethodInput = Omit<PaymentMethod, 'id' | 'currency' | 'sortOrder'>;

/** «Métodos de pago» against vortomi-backend ('api' mode). Admins change them; the server checks it. */
@Injectable({ providedIn: 'root' })
export class PaymentMethodsRemote {
  private readonly api = inject(ApiClient);

  async list(tenantId: Id): Promise<PaymentMethod[]> {
    return (await this.api.get<{ items: PaymentMethod[] }>(this.api.company(tenantId, 'payment-methods'))).items;
  }

  create(tenantId: Id, input: PaymentMethodInput): Promise<PaymentMethod> {
    return this.api.post(this.api.company(tenantId, 'payment-methods'), input);
  }

  update(tenantId: Id, id: Id, input: PaymentMethodInput): Promise<PaymentMethod> {
    return this.api.put(this.api.company(tenantId, `payment-methods/${id}`), input);
  }

  /** The order customers see them in: every method, once. */
  async reorder(tenantId: Id, ids: Id[]): Promise<PaymentMethod[]> {
    return (await this.api.put<{ items: PaymentMethod[] }>(this.api.company(tenantId, 'payment-methods/order'), { ids })).items;
  }
}

/** A method as the editor sends it. */
export const toInput = ({ type, name, fields, instructions, referenceRule, receiptRule, isActive }: PaymentMethod | PaymentMethodInput): PaymentMethodInput => ({
  type,
  name,
  fields,
  instructions,
  referenceRule,
  receiptRule,
  isActive,
});
