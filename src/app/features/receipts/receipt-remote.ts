import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { Id, ReceiptSettings } from '../../shared/api/models';

export type ReceiptSettingsInput = Omit<ReceiptSettings, 'hasLogo' | 'nextCode' | 'business'>;

/** A picture the person picked, as the server takes it (PNG or JPEG in base64). */
export interface PictureUpload {
  mimeType: 'image/png' | 'image/jpeg';
  data: string;
}

/** «Ajustes → Recibo» and each order's sale receipt against vortomi-backend ('api' mode). */
@Injectable({ providedIn: 'root' })
export class ReceiptRemote {
  private readonly api = inject(ApiClient);

  get(tenantId: Id): Promise<ReceiptSettings> {
    return this.api.get<ReceiptSettings>(this.api.company(tenantId, 'receipt-settings'));
  }

  save(tenantId: Id, input: ReceiptSettingsInput): Promise<ReceiptSettings> {
    return this.api.put<ReceiptSettings>(this.api.company(tenantId, 'receipt-settings'), input);
  }

  setLogo(tenantId: Id, logo: PictureUpload): Promise<ReceiptSettings> {
    return this.api.put<ReceiptSettings>(this.api.company(tenantId, 'receipt-settings/logo'), logo);
  }

  clearLogo(tenantId: Id): Promise<ReceiptSettings> {
    return this.api.delete<ReceiptSettings>(this.api.company(tenantId, 'receipt-settings/logo'));
  }

  /** How the receipt looks now, with a sample sale (a PNG, fetched with the session). */
  preview(tenantId: Id): Promise<Blob> {
    return this.api.blob(this.api.company(tenantId, 'receipt-settings/preview'));
  }

  /** The receipt an order got. */
  file(tenantId: Id, orderId: Id): Promise<Blob> {
    return this.api.blob(this.api.company(tenantId, `orders/${orderId}/sale-receipt`));
  }

  /** «Lo subo yo»: the team's own picture, kept with the order and sent to the customer. */
  uploadOwn(tenantId: Id, orderId: Id, picture: PictureUpload): Promise<void> {
    return this.api.post(this.api.company(tenantId, `orders/${orderId}/sale-receipt`), picture);
  }
}

/** Reads a picked file for upload; null when it is not a PNG/JPEG or is larger than `maxBytes`. */
export async function readPicture(file: File, maxBytes: number): Promise<PictureUpload | null> {
  if ((file.type !== 'image/png' && file.type !== 'image/jpeg') || file.size > maxBytes) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mimeType: file.type, data: btoa(binary) };
}
