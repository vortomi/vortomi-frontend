import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiCustomField, ApiList } from '../../shared/api/contract';
import { toCustomField } from '../../shared/api/mappers';
import type { CustomField, CustomFieldEntity, CustomFieldKind, Id } from '../../shared/api/models';

export interface NewField {
  entity: CustomFieldEntity;
  label: string;
  kind: CustomFieldKind;
  required: boolean;
  options: string[];
  categoryIds: Id[];
}

export interface FieldChanges {
  label: string;
  required: boolean;
  /** Kept options carry their id (renamed, answers kept); new ones only a value. */
  options: { id?: Id; value: string }[];
  categoryIds: Id[];
}

/** The company's fields against vortomi-backend ('api' mode). Only admins change them; the server enforces it. */
@Injectable({ providedIn: 'root' })
export class CustomFieldsRemote {
  private readonly api = inject(ApiClient);

  async list(tenantId: Id, entity: CustomFieldEntity): Promise<CustomField[]> {
    const list = await this.api.get<ApiList<ApiCustomField>>(this.api.company(tenantId, 'custom-fields'), { entity });
    return list.items.map((row) => toCustomField(tenantId, row));
  }

  async create(tenantId: Id, field: NewField): Promise<CustomField> {
    return toCustomField(tenantId, await this.api.post<ApiCustomField>(this.api.company(tenantId, 'custom-fields'), field));
  }

  async update(tenantId: Id, fieldId: Id, changes: FieldChanges): Promise<CustomField> {
    return toCustomField(tenantId, await this.api.put<ApiCustomField>(this.item(tenantId, fieldId), changes));
  }

  remove(tenantId: Id, fieldId: Id): Promise<void> {
    return this.api.delete(this.item(tenantId, fieldId));
  }

  /** Notes typed on contacts before the fields existed, grouped by name. */
  async notes(tenantId: Id): Promise<{ label: string; count: number }[]> {
    return (await this.api.get<ApiList<{ label: string; count: number }>>(this.api.company(tenantId, 'custom-fields/notes'))).items;
  }

  async organizeNotes(tenantId: Id, label: string): Promise<{ field: CustomField; moved: number }> {
    const result = await this.api.post<{ field: ApiCustomField; moved: number }>(this.api.company(tenantId, 'custom-fields/notes/organize'), { label });
    return { field: toCustomField(tenantId, result.field), moved: result.moved };
  }

  private item(tenantId: Id, fieldId: Id): string {
    return this.api.company(tenantId, `custom-fields/${encodeURIComponent(fieldId)}`);
  }
}
