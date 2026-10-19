import { Injectable, signal } from '@angular/core';
import { EMPTY_FILTERS, type InboxFilters } from './inbox.filters';

/**
 * Toolbar state of the inbox. Lives outside the page because /inbox and /inbox/:id are
 * different routes: opening a chat recreates the page and the filters must survive it.
 */
@Injectable({ providedIn: 'root' })
export class InboxViewState {
  readonly filters = signal<InboxFilters>(EMPTY_FILTERS);
}
