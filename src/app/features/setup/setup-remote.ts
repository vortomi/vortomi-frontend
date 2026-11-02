import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { Id } from '../../shared/api/models';
import type { PlanPart, SetupAnswers, SetupPlan, SetupStatus } from './setup.models';

/** The welcome against vortomi-backend ('api' mode): answers, the plan they make, applying it or skipping. */
@Injectable({ providedIn: 'root' })
export class SetupRemote {
  private readonly api = inject(ApiClient);

  status(tenantId: Id): Promise<SetupStatus> {
    return this.api.get(this.api.company(tenantId, 'setup'));
  }

  plan(tenantId: Id, answers: SetupAnswers): Promise<SetupPlan> {
    return this.api.post(this.api.company(tenantId, 'setup/plan'), answers);
  }

  async apply(tenantId: Id, answers: SetupAnswers, include: PlanPart[]): Promise<SetupStatus> {
    return (await this.api.post<{ status: SetupStatus }>(this.api.company(tenantId, 'setup/apply'), { ...answers, include })).status;
  }

  skip(tenantId: Id): Promise<SetupStatus> {
    return this.api.post(this.api.company(tenantId, 'setup/skip'));
  }
}
