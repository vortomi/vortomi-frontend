import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { BusinessTypes } from '../../core/business-types';
import { TENANT_PLAN, TIMEZONES } from '../../shared/api/labels';
import type { Tenant, TenantPlan } from '../../shared/api/models';
import { Dialog } from '../../shared/ui/dialog';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { type MenuOption, SelectMenu } from '../../shared/ui/select-menu';
import { PROFILE_ADDRESS_MAX, normalizeTaxId } from './onboarding/onboarding.rules';
import { PlatformData } from './platform.data';
import type { TenantFields } from './platform-remote';

const fieldsOf = (tenant: Tenant): TenantFields => ({
  name: tenant.name,
  businessType: tenant.businessType ?? '',
  businessTypeOther: tenant.businessTypeOther,
  city: tenant.city,
  timezone: tenant.timezone,
  plan: tenant.plan,
  legalName: tenant.legalName,
  taxId: tenant.taxId,
  fiscalAddress: tenant.fiscalAddress,
});

/**
 * «Editar datos» of a company in the console: the same data and rules as step 1 of the sign-up
 * (name, type, city, time zone, plan and fiscal data). Its admins and numbers are not touched here.
 */
@Component({
  selector: 'app-tenant-edit-dialog',
  imports: [Dialog, FormField, FieldError, Icon, SelectMenu],
  template: `
    <app-dialog [open]="open()" title="Editar datos de la empresa" [locked]="saving()" (closed)="closed.emit()">
      <form id="tenant-edit" class="form" (submit)="save($event)" novalidate>
        @if (error(); as message) {
          <div class="form-alert" role="alert"><app-icon name="alert" />{{ message }}</div>
        }
        <div class="g2">
          <div class="field">
            <label for="te-name">Nombre comercial</label>
            <input id="te-name" class="input" [formField]="edit.name" />
            <app-field-error [state]="edit.name()" />
          </div>
          <div class="field">
            <label for="te-city">Ciudad</label>
            <input id="te-city" class="input" [formField]="edit.city" />
            <app-field-error [state]="edit.city()" />
          </div>
          <div class="field">
            <span class="label">Rubro</span>
            <app-select-menu label="Rubro" placeholder="Elige uno" [searchable]="true" [options]="businessTypes.options()"
              [value]="edit.businessType().value() || null" (picked)="setBusinessType($event)" />
            <app-field-error [state]="edit.businessType()" />
            @if (edit.businessType().value() === 'other') {
              <input class="input" aria-label="A qué se dedica" placeholder="¿A qué se dedica? Ej.: óptica" [formField]="edit.businessTypeOther" />
              <app-field-error [state]="edit.businessTypeOther()" />
            }
          </div>
          <div class="field">
            <span class="label">Zona horaria</span>
            <app-select-menu label="Zona horaria" [searchable]="true" [options]="timezoneOptions" [value]="edit.timezone().value()" (picked)="edit.timezone().value.set($event)" />
          </div>
          <div class="field">
            <span class="label">Plan</span>
            <app-select-menu label="Plan" [options]="planOptions" [value]="edit.plan().value()" (picked)="setPlan($event)" />
          </div>
          <div class="field">
            <label for="te-legal">Razón social</label>
            <input id="te-legal" class="input" [formField]="edit.legalName" />
            <app-field-error [state]="edit.legalName()" />
          </div>
          <div class="field">
            <label for="te-tax">RIF</label>
            <input id="te-tax" class="input mono" placeholder="J-41234567-8" autocomplete="off" [formField]="edit.taxId" />
            <app-field-error [state]="edit.taxId()" />
          </div>
          <div class="field">
            <label for="te-address">Dirección fiscal</label>
            <input id="te-address" class="input" [formField]="edit.fiscalAddress" />
            <app-field-error [state]="edit.fiscalAddress()" />
          </div>
        </div>
        <p class="field-hint">Los datos fiscales deben coincidir con los que la empresa usa para verificar su negocio en Meta.</p>
      </form>
      <ng-container dialog-actions>
        <button type="button" class="btn" [disabled]="saving()" (click)="closed.emit()">Cancelar</button>
        <button type="submit" form="tenant-edit" class="btn btn--primary" [disabled]="saving()" [attr.aria-busy]="saving()"><span>Guardar cambios</span></button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    :host { --dialog-width: 720px; }
    .form { display: flex; flex-direction: column; gap: 14px; }
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; }
    @media (max-width: 640px) { .g2 { grid-template-columns: 1fr; } }
    .mono { font-family: var(--font-mono); }
  `,
})
export class TenantEditDialog {
  private readonly data = inject(PlatformData);
  protected readonly businessTypes = inject(BusinessTypes);

  readonly tenant = input.required<Tenant>();
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly timezoneOptions: MenuOption[] = TIMEZONES.map(([value, label]) => ({ value, label }));
  protected readonly planOptions: MenuOption[] = (Object.entries(TENANT_PLAN) as [TenantPlan, { text: string; detail: string }][]).map(
    ([value, plan]) => ({ value, label: `${plan.text} · ${plan.detail}` }),
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly model = signal<TenantFields>({
    name: '', businessType: '', businessTypeOther: '', city: '', timezone: 'America/Caracas', plan: 'basic' as TenantPlan,
    legalName: '', taxId: '', fiscalAddress: '',
  });
  protected readonly edit = form(this.model, (path) => {
    required(path.name, { message: 'Escribe el nombre comercial.' });
    maxLength(path.name, 80, { message: 'Máximo 80 caracteres.' });
    required(path.businessType, { message: 'Elige el rubro.' });
    maxLength(path.businessTypeOther, 60, { message: 'Máximo 60 caracteres.' });
    validate(path.businessTypeOther, ({ value, valueOf }) =>
      valueOf(path.businessType) === 'other' && value().trim().length < 3 ? { kind: 'other', message: 'Escribe a qué se dedica.' } : undefined,
    );
    required(path.city, { message: 'Escribe la ciudad.' });
    required(path.legalName, { message: 'Escribe la razón social, como aparece en el RIF.' });
    required(path.taxId, { message: 'Escribe el RIF.' });
    validate(path.taxId, ({ value }) => (value() && !normalizeTaxId(value()) ? { kind: 'taxId', message: 'Debe verse así: J-41234567-8.' } : undefined));
    required(path.fiscalAddress, { message: 'Escribe la dirección fiscal.' });
    maxLength(path.fiscalAddress, PROFILE_ADDRESS_MAX, { message: `Máximo ${PROFILE_ADDRESS_MAX} caracteres.` });
  });

  constructor() {
    // Each time it opens, it starts from what the company has now.
    effect(() => {
      if (!this.open()) return;
      const fields = fieldsOf(this.tenant());
      untracked(() => {
        this.model.set(fields);
        this.error.set(null);
      });
    });
  }

  protected setBusinessType(code: string): void {
    this.edit.businessType().value.set(code);
    this.edit.businessType().markAsTouched();
  }

  protected setPlan(plan: string): void {
    this.edit.plan().value.set(plan as TenantPlan);
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await submit(this.edit, async () => {
        const model = this.model();
        const fields = { ...model, taxId: normalizeTaxId(model.taxId) ?? model.taxId, businessTypeOther: model.businessType === 'other' ? model.businessTypeOther : '' };
        const failure = await this.data.updateTenant(this.tenant().id, fields);
        if (failure) this.error.set(failure);
        else this.saved.emit();
        return undefined;
      });
    } finally {
      this.saving.set(false);
    }
  }
}
