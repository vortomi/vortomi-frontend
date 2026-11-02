import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import type { AgentSettings, Id } from '../../shared/api/models';

export type AgentSettingsInput = Pick<AgentSettings, 'enabled' | 'assistantName' | 'tone' | 'schedule' | 'businessInfo'>;

/** «Ajustes → Agente» against vortomi-backend ('api' mode). Admins only; every answer is the whole card. */
@Injectable({ providedIn: 'root' })
export class AgentRemote {
  private readonly api = inject(ApiClient);

  get(tenantId: Id): Promise<AgentSettings> {
    return this.api.get<AgentSettings>(this.api.company(tenantId, 'agent'));
  }

  save(tenantId: Id, input: AgentSettingsInput): Promise<AgentSettings> {
    return this.api.put<AgentSettings>(this.api.company(tenantId, 'agent'), input);
  }
}
