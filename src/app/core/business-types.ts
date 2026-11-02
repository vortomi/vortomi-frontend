import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { BusinessType } from '../shared/api/models';
import { iconOr } from '../shared/ui/icon';
import { ApiClient } from './api/api-client';
import { API_CONFIG } from './api/api-config';
import { Session } from './session';

/**
 * The platform's starting list (vortomi-backend drizzle/0033), for the prototype. With a
 * server the list comes from it, including the types our team added from «Otro».
 */
export const BUILTIN_BUSINESS_TYPES: BusinessType[] = [
  { code: 'auto_parts', label: 'Repuestos y autopartes', icon: 'car' },
  { code: 'hardware', label: 'Ferretería y construcción', icon: 'hammer' },
  { code: 'apparel', label: 'Ropa y calzado', icon: 'shirt' },
  { code: 'food', label: 'Alimentos', icon: 'bread' },
  { code: 'pharmacy', label: 'Farmacia', icon: 'pill' },
  { code: 'furniture', label: 'Muebles y hogar', icon: 'sofa' },
  { code: 'electronics', label: 'Electrónica y tecnología', icon: 'laptop' },
  { code: 'beauty', label: 'Belleza y cuidado personal', icon: 'sparkles' },
  { code: 'health', label: 'Salud', icon: 'stethoscope' },
  { code: 'technical_services', label: 'Servicios técnicos y talleres', icon: 'wrench' },
  { code: 'other', label: 'Otro', icon: 'dots' },
];

/** The closed list of business types (block C): what the welcome and the console offer. */
@Injectable({ providedIn: 'root' })
export class BusinessTypes {
  private readonly api = inject(ApiClient);
  private readonly session = inject(Session);
  private readonly remote = inject(API_CONFIG).mode === 'api';

  readonly list = signal<BusinessType[]>(this.remote ? [] : BUILTIN_BUSINESS_TYPES);
  readonly byCode = computed(() => new Map(this.list().map((t) => [t.code, t])));
  /** As option cards and menu entries: with one of our icons, a generic one when unknown. */
  readonly options = computed(() => this.list().map((t) => ({ value: t.code, label: t.label, icon: iconOr(t.icon, 'tag') })));

  constructor() {
    if (!this.remote) return;
    effect(() => {
      if (this.session.user()) untracked(() => void this.load());
    });
  }

  /** "Repuestos y autopartes", or what the company wrote under «Otro». */
  labelOf(code: string | null, other = ''): string {
    if (!code) return '';
    if (code === 'other' && other.trim()) return other.trim();
    return this.byCode().get(code)?.label ?? code;
  }

  async reload(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      this.list.set((await this.api.get<{ items: BusinessType[] }>('business-types')).items);
    } catch {
      // Not critical: the screens that need it show the code until the next load.
    }
  }
}
