import { Injectable, inject } from '@angular/core';
import { CompanyData } from '../../core/company-data';
import { Session } from '../../core/session';
import type { MessageTemplate } from '../../shared/api/models';
import { newId } from '../../shared/api/mock-db';
import { Toaster } from '../../shared/ui/toaster';
import { type TemplateDraft, simulateReview } from './templates.rules';

/** Simulated time Meta takes to review; in reality minutes to a day. */
const REVIEW_MS = 3500;

@Injectable({ providedIn: 'root' })
export class TemplatesActions {
  private readonly company = inject(CompanyData);
  private readonly session = inject(Session);
  private readonly toaster = inject(Toaster);

  /** Sends the template to review: it starts as "pending" and Meta answers later. */
  submit(draft: TemplateDraft): MessageTemplate {
    const template: MessageTemplate = {
      id: newId('tpl'),
      tenantId: this.session.tenant()?.id ?? '',
      name: draft.name,
      category: draft.category,
      language: draft.language,
      status: 'pending',
      rejectionReason: null,
      body: draft.body.trim(),
    };
    this.company.templates.upsert(template);
    setTimeout(() => {
      const review = simulateReview(draft);
      this.company.templates.patch(template.id, {
        status: review.status,
        rejectionReason: review.status === 'rejected' ? review.reason : null,
      });
      this.toaster.show(
        review.status === 'approved' ? `Meta aprobó «${template.name}»` : `Meta rechazó «${template.name}»`,
        review.status === 'approved' ? 'success' : 'info',
      );
    }, REVIEW_MS);
    return template;
  }
}
