import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../../core/brand';
import { ThemeToggle } from '../../shared/ui/theme-toggle';
import { LEGAL_ENTITY, PRIVACY_UPDATED_ON } from './legal-entity';

/**
 * Public privacy policy (no session needed). Meta's App Review links to it, and the
 * "#data-deletion" section is the app's data deletion instructions URL.
 */
@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink, ThemeToggle],
  templateUrl: './privacy.page.html',
  styleUrl: './privacy.page.scss',
})
export class PrivacyPage {
  protected readonly brand = BRAND;
  protected readonly company = LEGAL_ENTITY;
  protected readonly updatedOn = PRIVACY_UPDATED_ON;
  protected readonly deletionSubject = `Eliminar datos - ${BRAND.name}`;
}
