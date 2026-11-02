import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { DeliverySettings, Id } from '../../shared/api/models';

export type DeliveryInput = Omit<DeliverySettings, 'configured'>;

/** «Ajustes → Delivery» against vortomi-backend ('api' mode). Every answer is the whole card. */
@Injectable({ providedIn: 'root' })
export class DeliveryRemote {
  private readonly api = inject(ApiClient);

  get(tenantId: Id): Promise<DeliverySettings> {
    return this.api.get<DeliverySettings>(this.api.company(tenantId, 'delivery'));
  }

  save(tenantId: Id, input: DeliveryInput): Promise<DeliverySettings> {
    return this.api.put<DeliverySettings>(this.api.company(tenantId, 'delivery'), input);
  }
}
