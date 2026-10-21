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

  private contact(tenantId: Id, contactId: Id, action: string): string {
    return this.api.company(tenantId, `contacts/${encodeURIComponent(contactId)}/${action}`);
  }
}
