import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { fileSizeText, fileTypeLabel } from '../../../shared/api/chat-media';
import type { ChatMedia, Message } from '../../../shared/api/models';
import { Icon, type IconName } from '../../../shared/ui/icon';
import { MediaLoader } from './media-loader';
import { MediaViewer } from './media-viewer';
import { VoicePlayer } from './voice-player';

const NOUN: Record<ChatMedia['kind'], string> = { image: 'Foto', audio: 'Nota de voz', sticker: 'Sticker', document: 'Documento', video: 'Video' };
const ICON: Record<ChatMedia['kind'], IconName> = { image: 'image', audio: 'phone', sticker: 'image', document: 'file', video: 'film' };

/**
 * The file of a message (mockup web-24): the photo small (it opens large), the voice note's
 * player, the document's card, the sticker; or, when it cannot be shown, why, and «open it on the
 * phone». The text of the message, if any, is shown below by the bubble as its caption.
 */
@Component({
  selector: 'app-chat-media',
  imports: [Icon, VoicePlayer, MediaViewer],
  template: `
    @let media = message().media!;
    @switch (media.state) {
      @case ('ready') {
        @switch (media.kind) {
          @case ('image') {
            <button type="button" class="photo" aria-label="Ver la foto en grande" (click)="viewing.set(true)">
              @if (thumb(); as src) {
                <img [src]="src" alt="Foto enviada en la conversación" />
                <span class="zoom">Ver grande</span>
              } @else {
                <span class="skel">{{ failed() ? 'No se pudo cargar la foto' : 'Cargando foto…' }}</span>
              }
            </button>
          }
          @case ('sticker') {
            @if (thumb(); as src) {
              <img class="sticker" [src]="src" alt="Sticker" />
            } @else {
              <span class="skel small">{{ failed() ? 'Sticker' : 'Cargando…' }}</span>
            }
          }
          @case ('audio') {
            <app-voice-player [message]="message()" />
          }
          @case ('document') {
            <div class="doc">
              <span class="ext">{{ typeLabel() }}</span>
              <span class="text"><b>{{ media.fileName ?? 'Documento' }}</b><small>{{ typeLabel() }}{{ media.sizeBytes ? ' · ' + size() : '' }}</small></span>
              <button type="button" class="open" [attr.aria-busy]="opening()" [disabled]="opening()" (click)="openDocument()">{{ failed() ? 'Reintentar' : 'Abrir' }}</button>
            </div>
          }
        }
      }
      @case ('loading') {
        <span class="skel" [class.small]="media.kind !== 'image'">Cargando {{ noun().toLowerCase() }}…</span>
      }
      @default {
        <div class="gone">
          <app-icon [name]="icon()" />
          <span><b>{{ title() }}</b>{{ reason() }}</span>
        </div>
      }
    }
    @if (viewing()) {
      <app-media-viewer [message]="message()" [sender]="sender()" [when]="when()" (closed)="viewing.set(false)" />
    }
  `,
  styleUrl: './chat-media.scss',
})
export class ChatMediaBox {
  private readonly loader = inject(MediaLoader);

  readonly message = input.required<Message>();
  /** For the large photo's header: who sent it and when. */
  readonly sender = input('');
  readonly when = input('');

  protected readonly thumb = signal<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly opening = signal(false);
  protected readonly viewing = signal(false);

  private readonly media = computed(() => this.message().media!);
  protected readonly noun = computed(() => NOUN[this.media().kind]);
  protected readonly icon = computed(() => ICON[this.media().kind]);
  protected readonly typeLabel = computed(() => fileTypeLabel(this.media().fileName));
  protected readonly size = computed(() => fileSizeText(this.media().sizeBytes));
  protected readonly title = computed(() => {
    const media = this.media();
    return media.state === 'too_large' && media.fileName ? `${media.fileName}${media.sizeBytes ? ' · ' + this.size() : ''}` : this.noun();
  });
  protected readonly reason = computed(() => {
    switch (this.media().state) {
      case 'not_kept':
        return 'Vortomi no guarda videos. Ábrelo en el teléfono.';
      case 'too_large':
        return 'Es muy pesado para guardarlo en Vortomi (máximo 5 MB). Ábrelo en el teléfono.';
      case 'waiting':
        return 'Todavía no está en Vortomi. Ábrelo en el teléfono.';
      default:
        return 'WhatsApp ya no lo tiene disponible. Meta guarda los archivos solo 7 días.';
    }
  });

  constructor() {
    // Photos and stickers load their small copy as soon as they are on screen.
    effect(() => {
      const message = this.message();
      const media = message.media;
      if (media?.state !== 'ready' || (media.kind !== 'image' && media.kind !== 'sticker')) return;
      this.loader.url(message, media.kind === 'image' ? 'thumb' : 'full').then(
        (url) => this.thumb.set(url),
        () => this.failed.set(true),
      );
    });
  }

  /** A PDF opens in another tab; any other document is saved, never opened by the browser. */
  protected async openDocument(): Promise<void> {
    this.opening.set(true);
    this.failed.set(false);
    try {
      const blob = await this.loader.blob(this.message());
      const url = URL.createObjectURL(blob);
      if (blob.type === 'application/pdf') {
        window.open(url, '_blank', 'noopener');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = this.media().fileName ?? `documento-${this.message().id}`;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      this.failed.set(true);
    } finally {
      this.opening.set(false);
    }
  }
}
