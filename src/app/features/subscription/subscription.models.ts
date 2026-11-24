import type { Id } from '../../shared/api/models';
import type { PlanDiscounts } from '../../shared/api/subscriptions';

export type { Day } from '../../shared/api/subscriptions';

export const PERIODS = [1, 3, 6, 12] as const;
export type Period = (typeof PERIODS)[number];

/** A plan as the company sees it (GET /tenants/:id/plans): only the active ones. */
export interface CompanyPlan {
  id: Id;
  name: string;
  description: string;
  /** Base price per month, integer cents. */
  priceCents: number;
  discounts: PlanDiscounts;
  benefits: string[];
}
