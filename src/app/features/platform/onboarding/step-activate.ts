import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TENANT_PLAN, WHATSAPP_VERTICAL } from '../../../shared/api/labels';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';
import { UNVERIFIED_MESSAGING_LIMIT } from './onboarding.rules';
import { OnboardingState } from './onboarding.state';
import { BRAND } from '../../../core/brand';

/** Step 4 (mockup web-12): review, activate and send the admin invitation. */
@Component({
  selector: 'app-step-activate',
  imports: [RouterLink, Icon, Pill],
  templateUrl: './step-activate.html',
  styleUrl: './steps.scss',
  styles: `
    table { width: 100%; border-collapse: collapse; }
    td { padding: 9px 0; border-top: 1px solid var(--color-border-soft); font-size: 13px; vertical-align: top; }
    tr:first-child td { border-top: 0; }
    td:first-child { color: var(--color-text-muted); width: 190px; }
    .x { display: block; font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
    .after-text { margin-left: 6px; }
    .profile-line { display: flex; gap: 10px; align-items: flex-start; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .mail { border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); overflow: hidden; }
    .mail .hd { background: var(--color-surface-muted); border-bottom: 1px solid #e6e9ee; padding: 11px 16px; font-size: 12.3px;
      color: var(--color-text-muted); line-height: 1.6; }
    .mail .hd b { color: var(--color-text); }
    .mail .bd { padding: 18px 20px; font-size: 13px; line-height: 1.55; }
    .mail h3 { font-size: 17px; margin: 0 0 8px; }
    .cta { display: inline-block; background: var(--color-primary); color: #fff; font-weight: 600; border-radius: 8px; padding: 10px 18px; margin: 12px 0; }
    .fine { font-size: 11.5px; color: var(--color-text-faint); border-top: 1px solid var(--color-border-soft); padding-top: 10px; margin-top: 4px; }
    .tag { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--color-text-faint); font-weight: 600; margin-bottom: 8px; }
    .done { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 40px 20px; }
    .done .big { width: 56px; height: 56px; border-radius: 50%; background: var(--color-success); color: #fff; display: flex;
      align-items: center; justify-content: center; --icon-size: 28px; }
    .done h2 { font-size: 20px; } .done p { color: var(--color-text-muted); max-width: 520px; }
    .done .actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  `,
})
export class StepActivate {
  protected readonly brand = BRAND;
  protected readonly state = inject(OnboardingState);
  protected readonly planLabel = computed(() => TENANT_PLAN[this.state.company().plan]);
  protected readonly firstName = computed(() => this.state.company().adminName.split(' ')[0] ?? '');
  protected readonly unverifiedLimit = UNVERIFIED_MESSAGING_LIMIT;
  /** "Automotriz · https://..." under the profile sentence. */
  protected readonly profileDetail = computed(() => {
    const profile = this.state.channel()?.profile;
    if (!profile) return '';
    return [profile.vertical ? WHATSAPP_VERTICAL[profile.vertical] : '', profile.website].filter(Boolean).join(' · ');
  });
}
