import type { Id } from '../../../shared/api/models';

/** The periods a plan sets a discount for. A company may pay any number of months: each is a «from» tier. */
export const PLAN_PERIODS = ['1', '3', '6', '12'] as const;
export type PlanPeriod = (typeof PLAN_PERIODS)[number];
export type PlanDiscounts = Record<PlanPeriod, number>;

export const PERIOD_LABEL: Record<PlanPeriod, string> = { '1': '1 mes', '3': '3 meses', '6': '6 meses', '12': '12 meses' };

export const MAX_BENEFITS = 12;
export const MAX_DISCOUNT = 90;

/** What the editor sends (being active is the card's switch, apart). */
export interface PlanInput {
  name: string;
  description: string;
  /** Base price per month, integer cents. */
  priceCents: number;
  discounts: PlanDiscounts;
  benefits: string[];
}

/** A plan of Vortomi (console → Suscripciones → Planes, mockup web-34). */
export interface Plan extends PlanInput {
  id: Id;
  /** Suspended when false: hidden, nobody new chooses it; the companies on it keep it. */
  isActive: boolean;
  /** Companies on it: a plan with any is never deleted, only suspended. */
  companies: number;
}
