import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { ApiContact, Page } from '../../shared/api/contract';
import { toContact } from '../../shared/api/mappers';
import type { Contact, Id } from '../../shared/api/models';

const CONTACTS_PAGE = 100;

/** Contacts against vortomi-backend ('api' mode). The server limits them to the numbers each person attends. */
@Injectable({ providedIn: 'root' })
export class ContactsRemote {
  private readonly api = inject(ApiClient);

  async list(tenantId: Id): Promise<Contact[]> {
    const page = await this.api.get<Page<ApiContact>>(this.api.company(tenantId, 'contacts'), { limit: CONTACTS_PAGE });
    return page.items.map((row) => toContact(tenantId, row));
  }

  setOpportunity(tenantId: Id, contactId: Id, stageId: Id | null, quoteCents: number | null): Promise<unknown> {
    return this.api.put(this.contact(tenantId, contactId, 'opportunity'), { stageId, quoteCents });
  }

  setTags(tenantId: Id, contactId: Id, tagIds: Id[]): Promise<unknown> {
    return this.api.put(this.contact(tenantId, contactId, 'tags'), { tagIds });
  }

  rename(tenantId: Id, contactId: Id, name: string | null): Promise<unknown> {
    return this.api.put(this.contact(tenantId, contactId, 'name'), { name });
  }

  async create(tenantId: Id, contact: { channelAccountId: Id; waId: string; name: string | null; stageId: Id | null; tagIds: Id[] }): Promise<Contact> {
    return toContact(tenantId, await this.api.post<ApiContact>(this.api.company(tenantId, 'contacts'), contact));
  }

  /** All rows in one request; the server saves all of them or none. */
  import(tenantId: Id, channelAccountId: Id, rows: { waId: string; name: string | null; tagIds: Id[] }[]): Promise<{ created: number; updated: number }> {
    return this.api.post(this.api.company(tenantId, 'contacts/import'), { channelAccountId, rows });
  }

  private contact(tenantId: Id, contactId: Id, action: string): string {
    return this.api.company(tenantId, `contacts/${encodeURIComponent(contactId)}/${action}`);
  }
}
