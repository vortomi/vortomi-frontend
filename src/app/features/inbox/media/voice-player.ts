import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import type { Message } from '../../../shared/api/models';
import { Icon } from '../../../shared/ui/icon';
import { MediaLoader } from './media-loader';

const SPEEDS = [1, 1.5, 2] as const;
const BARS = 32;

/** «0:24», «1:05». */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/**
 * A voice note as WhatsApp shows it: play, a bar that fills as it plays, its length and the speed
 * (1×, 1,5×, 2×). The file is only fetched when someone presses play.
 */
@Component({
  selector: 'app-voice-player',
  imports: [Icon],
  template: `
    <button type="button" class="play" [attr.aria-label]="playing() ? 'Pausar' : 'Escuchar'" [attr.aria-busy]="loading()" [disabled]="loading()" (click)="toggle()">
      <app-icon [name]="playing() ? 'pause' : 'play'" [stroke]="2.4" />
    </button>
    <span class="wave" aria-hidden="true">
      @for (height of bars(); track $index) {
        <i [style.height.px]="height" [class.done]="$index < played()"></i>
      }
    </span>
    <button type="button" class="speed" [attr.aria-label]="'Velocidad ' + speedText()" (click)="nextSpeed()">{{ speedText() }}</button>
    <span class="len">{{ failed() ? 'No se pudo cargar' : lengthText() }}</span>
    <audio #audio preload="none" (timeupdate)="onTime()" (loadedmetadata)="onTime()" (ended)="playing.set(false)" (pause)="playing.set(false)" (play)="playing.set(true)"></audio>
  `,
  styles: `
    :host { display: grid; grid-template-columns: auto 1fr auto; grid-template-rows: auto auto; column-gap: 10px; align-items: center; width: 280px; max-width: 100%; padding: 4px 2px 0; }
    .play { grid-row: span 2; width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--color-primary); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; --icon-size: 16px; }
    .play:disabled { opacity: 0.6; cursor: progress; }
    .wave { display: flex; align-items: center; gap: 2px; height: 28px; overflow: hidden; }
    .wave i { display: block; width: 3px; border-radius: 2px; background: var(--color-text-faint); }
    .wave i.done { background: var(--color-primary); }
    .speed { border: 0; border-radius: 99px; padding: 2px 8px; font-size: 11px; font-weight: 700; color: var(--color-text-muted); background: var(--color-surface-hover); cursor: pointer; }
    .len { grid-column: 2; font-size: 11.5px; color: var(--color-bubble-meta); }
  `,
})
export class VoicePlayer {
  private readonly loader = inject(MediaLoader);
  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');

  readonly message = input.required<Message>();

  protected readonly playing = signal(false);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  private readonly speed = signal<(typeof SPEEDS)[number]>(1);
  private readonly position = signal(0);
  private readonly length = signal<number | null>(null);

  /** Bar heights drawn from the message id: the same note always looks the same. */
  protected readonly bars = computed(() => {
    let seed = [...this.message().id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
    return Array.from({ length: BARS }, () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return 6 + (seed % 22);
    });
  });
  protected readonly played = computed(() => {
    const length = this.length();
    return length ? Math.round((this.position() / length) * BARS) : 0;
  });
  protected readonly speedText = computed(() => `${String(this.speed()).replace('.', ',')}×`);
  protected readonly lengthText = computed(() => {
    const length = this.length();
    if (length === null) return 'Nota de voz';
    return this.playing() || this.position() > 0 ? clock(this.position()) : clock(length);
  });

  protected async toggle(): Promise<void> {
    const audio = this.audio().nativeElement;
    if (this.playing()) {
      audio.pause();
      return;
    }
    if (!audio.src) {
      this.loading.set(true);
      this.failed.set(false);
      try {
        audio.src = await this.loader.url(this.message());
      } catch {
        this.failed.set(true);
        return;
      } finally {
        this.loading.set(false);
      }
    }
    audio.playbackRate = this.speed();
    await audio.play().catch(() => this.failed.set(true));
  }

  protected nextSpeed(): void {
    const next = SPEEDS[(SPEEDS.indexOf(this.speed()) + 1) % SPEEDS.length]!;
    this.speed.set(next);
    this.audio().nativeElement.playbackRate = next;
  }

  protected onTime(): void {
    const audio = this.audio().nativeElement;
    if (Number.isFinite(audio.duration)) this.length.set(audio.duration);
    this.position.set(audio.currentTime);
  }
}
