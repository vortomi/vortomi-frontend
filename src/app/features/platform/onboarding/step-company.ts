import { Component, inject, signal } from '@angular/core';
import { FormField, email, form, maxLength, pattern, required, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { INDUSTRIES, TENANT_PLAN, TIMEZONES } from '../../../shared/api/labels';
import type { TenantPlan } from '../../../shared/api/models';
import { FieldError } from '../../../shared/ui/field-error';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { Toaster } from '../../../shared/ui/toaster';
import { PROFILE_ADDRESS_MAX, WEBSITE, normalizeTaxId } from './onboarding.rules';
import { type CompanyDraft, OnboardingState } from './onboarding.state';

/** Step 1 (mockup web-9). */
@Component({
  selector: 'app-step-company',
  imports: [FormField, FieldError, Icon, Pill],
  templateUrl: './step-company.html',
  styleUrl: './steps.scss',
  styles: `
    .plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .plan { border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); padding: 10px 12px; text-align: left;
      background: var(--color-surface); cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
    .plan b { font-size: 13.5px; } .plan span { font-size: 12px; color: var(--color-text-muted); }
    .plan.on { border-color: var(--color-primary); background: var(--color-primary-softer); box-shadow: 0 0 0 1px var(--color-primary); }
    .flow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; --icon-size: 14px; color: var(--color-text-faint); }
  `,
})
export class StepCompany {
  protected readonly state = inject(OnboardingState);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly industries = INDUSTRIES;
  protected readonly timezones = TIMEZONES;
  protected readonly plans = Object.entries(TENANT_PLAN) as [TenantPlan, (typeof TENANT_PLAN)[TenantPlan]][];

  private readonly model = signal<CompanyDraft>({ ...this.state.company() });
  protected readonly companyForm = form(this.model, (path) => {
    required(path.name, { message: 'Escribe el nombre comercial.' });
    required(path.industry, { message: 'Elige el rubro.' });
    required(path.city, { message: 'Escribe la ciudad.' });
    required(path.legalName, { message: 'Escribe la razón social, como aparece en el RIF.' });
    required(path.taxId, { message: 'Escribe el RIF.' });
    validate(path.taxId, ({ value }) =>
      value() && !normalizeTaxId(value()) ? { kind: 'taxId', message: 'Debe verse así: J-41234567-8.' } : undefined,
    );
    required(path.fiscalAddress, { message: 'Escribe la dirección fiscal.' });
    // Meta caps the profile address at 256 characters.
    maxLength(path.fiscalAddress, PROFILE_ADDRESS_MAX, { message: `Máximo ${PROFILE_ADDRESS_MAX} caracteres.` });
    pattern(path.website, WEBSITE, { message: 'Empieza con https:// (por ejemplo https://instagram.com/tu_negocio).' });
    required(path.adminName, { message: 'Escribe el nombre de quien administra.' });
    required(path.adminEmail, { message: 'Escribe su correo.' });
    email(path.adminEmail, { message: 'Ese correo no parece válido.' });
  });

  protected setPlan(plan: TenantPlan): void {
    this.companyForm.plan().value.set(plan);
  }

  /** Stores the RIF in one shape, whatever way it was typed. */
  private draft(): CompanyDraft {
    const model = this.model();
    return { ...model, taxId: normalizeTaxId(model.taxId) ?? model.taxId };
  }

  protected async next(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.companyForm, async () => {
      if (await this.state.saveCompany(this.draft())) this.state.goTo(1);
      return undefined;
    });
  }

  protected async saveDraft(): Promise<void> {
    await submit(this.companyForm, async () => {
      if (!(await this.state.saveCompany(this.draft()))) return undefined;
      this.toaster.show('Borrador guardado. Puedes seguir desde la lista de empresas.');
      await this.router.navigateByUrl('/platform/tenants');
      return undefined;
    });
  }
}
