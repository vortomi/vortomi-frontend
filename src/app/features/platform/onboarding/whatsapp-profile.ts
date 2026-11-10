import { Component, computed, input, signal } from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { WHATSAPP_VERTICAL } from '../../../shared/api/labels';
import type { WhatsAppVertical } from '../../../shared/api/models';
import { imageFileError, readAsDataUrl } from '../../../shared/files/image';
import { FieldError } from '../../../shared/ui/field-error';
import { FileDrop } from '../../../shared/ui/file-drop';
import { Icon } from '../../../shared/ui/icon';
import { type MenuOption, SelectMenu } from '../../../shared/ui/select-menu';
import { PROFILE_ABOUT_MAX } from './onboarding.rules';
import type { WhatsAppProfile } from './onboarding.state';

// WhatsApp shows the photo in a circle; JPG or PNG only.
const PHOTO_TYPES = ['image/png', 'image/jpeg'];
const PHOTO_MAX_BYTES = 5_000_000;

/** Profile of the number: what customers see when they open the business on WhatsApp. */
@Component({
  selector: 'app-whatsapp-profile',
  imports: [FormField, FieldError, FileDrop, Icon, SelectMenu],
  template: `
    @let f = profile();
    <div class="profile">
      <div class="photo">
        <span class="circle">
          @if (f.photoDataUrl().value(); as photo) {
            <img [src]="photo" alt="Foto de perfil" />
          } @else {
            <app-icon name="image" />
          }
        </span>
        <app-file-drop accept="image/png,image/jpeg" [compact]="true" [disabled]="locked()"
          [label]="f.photoDataUrl().value() ? 'Cambiar foto' : 'Subir logo'" (picked)="pickPhoto($event)" />
        @if (photoError(); as error) { <p class="field-error" role="alert">{{ error }}</p> }
        <p class="field-hint">Cuadrado, JPG o PNG. Se ve en círculo.</p>
      </div>
      <div class="fields">
        <div class="field">
          <label for="about">Frase corta del negocio</label>
          <input id="about" class="input" placeholder="Repuestos para tu carro, con despacho en Caracas" [formField]="f.about" />
          <p class="field-hint">Sale bajo el nombre en su perfil. {{ aboutLeft() }} caracteres disponibles.</p>
          <app-field-error [state]="f.about()" />
        </div>
        <div class="g2">
          <div class="field">
            <span class="label">Categoría</span>
            <app-select-menu label="Categoría" placeholder="Elige una" [searchable]="true" [options]="verticals" [disabled]="locked()"
              [value]="f.vertical().value() || null" (picked)="setVertical($event)" />
            <app-field-error [state]="f.vertical()" />
          </div>
          <div class="field">
            <label for="profile-email">Correo de contacto <span class="opt">opcional</span></label>
            <input id="profile-email" class="input" type="email" [formField]="f.email" />
            <app-field-error [state]="f.email()" />
          </div>
          <div class="field">
            <label for="profile-website">Sitio web o Instagram <span class="opt">opcional</span></label>
            <input id="profile-website" class="input" type="url" placeholder="https://" [formField]="f.website" />
            <app-field-error [state]="f.website()" />
          </div>
          <div class="field">
            <label for="profile-address">Dirección <span class="opt">opcional</span></label>
            <input id="profile-address" class="input" [formField]="f.address" />
            <app-field-error [state]="f.address()" />
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .profile { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 16px; }
    .photo { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
    .circle { width: 96px; height: 96px; border-radius: 50%; background: var(--color-surface-hover); display: flex; align-items: center;
      justify-content: center; overflow: hidden; color: var(--color-text-faint); --icon-size: 28px; }
    .circle img { width: 100%; height: 100%; object-fit: cover; }
    .fields { display: flex; flex-direction: column; gap: 12px; }
    .g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    @media (max-width: 760px) { .profile, .g2 { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class WhatsAppProfileFields {
  readonly profile = input.required<FieldTree<WhatsAppProfile>>();
  /** Once the number is connected the profile has been sent; changes go through the company's settings. */
  readonly locked = input(false);

  protected readonly verticals: MenuOption[] = (Object.entries(WHATSAPP_VERTICAL) as [WhatsAppVertical, string][]).map(([value, label]) => ({ value, label }));
  protected readonly photoError = signal<string | null>(null);
  protected readonly aboutLeft = computed(() => PROFILE_ABOUT_MAX - this.profile().about().value().length);

  protected setVertical(value: string): void {
    this.profile().vertical().value.set(value as WhatsAppVertical);
    this.profile().vertical().markAsTouched();
  }

  protected async pickPhoto(file: File): Promise<void> {
    const error = PHOTO_TYPES.includes(file.type) ? imageFileError(file, PHOTO_MAX_BYTES) : 'Usa una imagen JPG o PNG.';
    this.photoError.set(error);
    if (!error) this.profile().photoDataUrl().value.set(await readAsDataUrl(file));
  }
}
