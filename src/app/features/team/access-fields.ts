import { Component, input, output } from '@angular/core';
import type { TenantRole } from '../../shared/api/models';
import { type OptionCard, OptionCards } from '../../shared/ui/option-cards';
import type { MemberAccess } from './team-remote';

const ROLE_OPTIONS: OptionCard[] = [
  { value: 'agent', label: 'Agente', icon: 'chat', hint: 'Solo ve y responde las conversaciones que le asignes' },
  { value: 'admin', label: 'Administración', icon: 'shield', hint: 'Ve todo y maneja el equipo' },
];

/**
 * What a person can do in the company: their role. Shared by «Invitar persona» and «Acceso de …».
 * An agent only sees the conversations an admin assigns them, from the inbox.
 */
@Component({
  selector: 'app-access-fields',
  imports: [OptionCards],
  template: `
    <div class="block">
      <span class="label">Rol</span>
      <app-option-cards label="Rol" [options]="roles" [value]="access().role" (picked)="setRole($event)" />
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .block { display: flex; flex-direction: column; gap: 8px; }
    .label { font-size: 13px; font-weight: 600; color: var(--color-text-2); }
  `,
})
export class AccessFields {
  protected readonly roles = ROLE_OPTIONS;

  readonly access = input.required<MemberAccess>();
  readonly changed = output<MemberAccess>();

  protected patch(change: Partial<MemberAccess>): void {
    this.changed.emit({ ...this.access(), ...change });
  }

  protected setRole(value: string): void {
    this.patch({ role: value as TenantRole });
  }
}
