import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../core/api/api-client';
import { API_CONFIG } from '../../../core/api/api-config';
import type { Id } from '../../../shared/api/models';
import type { Plan, PlanInput } from './plan.models';

/** The preview's plans ('mock' mode, never deployed): enough to see the screens without a server. */
const PREVIEW_PLANS: Plan[] = [
  {
    id: 'plan-basic',
    name: 'Básico',
    description: 'Para negocios que empiezan con un solo número.',
    priceCents: 3900,
    discounts: { '1': 0, '3': 5, '6': 10, '12': 15 },
    benefits: ['1 número · 2 usuarios', 'Agente de ventas con IA', 'Inventario y pedidos'],
    isActive: true,
    companies: 0,
  },
  {
    id: 'plan-team',
    name: 'Equipo',
    description: 'Para equipos que atienden varios números.',
    priceCents: 7900,
    discounts: { '1': 0, '3': 5, '6': 10, '12': 20 },
    benefits: ['3 números · 5 usuarios', 'Agente de ventas con IA', 'Reportes del equipo'],
    isActive: true,
    companies: 0,
  },
];

/**
 * Vortomi's plans against /platform/plans (mockup web-34). In the preview without a server they
 * live in memory, starting from PREVIEW_PLANS.
 */
@Injectable({ providedIn: 'root' })
export class PlatformPlans {
  private readonly api = inject(ApiClient);
  private readonly live = inject(API_CONFIG).mode === 'api';
  private preview = PREVIEW_PLANS.map((p) => ({ ...p, benefits: [...p.benefits] }));

  async list(): Promise<Plan[]> {
    if (!this.live) return this.preview.map((p) => ({ ...p }));
    return (await this.api.get<{ items: Plan[] }>('platform/plans')).items;
  }

  async create(input: PlanInput, isActive: boolean): Promise<Plan> {
    if (this.live) return this.api.post('platform/plans', { ...input, isActive });
    this.assertFreeName(input.name);
    const plan: Plan = { ...input, id: crypto.randomUUID(), isActive, companies: 0 };
    this.preview = [...this.preview, plan];
    return plan;
  }

  async update(id: Id, input: PlanInput): Promise<Plan> {
    if (this.live) return this.api.put(`platform/plans/${encodeURIComponent(id)}`, input);
    this.assertFreeName(input.name, id);
    return this.change(id, (p) => ({ ...p, ...input }));
  }

  async setActive(id: Id, isActive: boolean): Promise<Plan> {
    if (this.live) return this.api.put(`platform/plans/${encodeURIComponent(id)}/active`, { isActive });
    return this.change(id, (p) => ({ ...p, isActive }));
  }

  async remove(id: Id): Promise<void> {
    if (this.live) return this.api.delete(`platform/plans/${encodeURIComponent(id)}`);
    this.preview = this.preview.filter((p) => p.id !== id);
  }

  private change(id: Id, apply: (plan: Plan) => Plan): Plan {
    const current = this.preview.find((p) => p.id === id);
    if (!current) throw new Error('Ese plan ya no existe.');
    const next = apply(current);
    this.preview = this.preview.map((p) => (p.id === id ? next : p));
    return next;
  }

  private assertFreeName(name: string, except?: Id): void {
    if (this.preview.some((p) => p.id !== except && p.name.trim().toLowerCase() === name.trim().toLowerCase())) throw new Error('Ya existe un plan con ese nombre. Usa otro.');
  }
}
