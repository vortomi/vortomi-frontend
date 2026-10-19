import { Component, computed, effect, input, output, signal } from '@angular/core';
import type { Id, MessageTemplate, QuickReply, Tone } from '../../../shared/api/models';
import { Icon } from '../../../shared/ui/icon';
import { Pill } from '../../../shared/ui/pill';

export type ComposerMode = 'reply' | 'note' | 'template' | 'product';

/** A sellable variant, already formatted by the chat panel. */
export interface ProductOption {
  variantId: Id;
  title: string;
  detail: string;
  price: string;
  statusText: string;
  tone: Tone;
  sendable: boolean;
  /** Text the customer receives. */
  message: string;
}

const CATEGORY_LABEL: Record<MessageTemplate['category'], string> = {
  utility: 'Utilidad',
  marketing: 'Marketing',
  authentication: 'Autenticación',
};

/** Reply, internal note or template. Typing "/" opens the company's quick replies. */
@Component({
  selector: 'app-message-composer',
  imports: [Icon, Pill],
  templateUrl: './message-composer.html',
  styleUrl: './message-composer.scss',
})
export class MessageComposer {
  readonly conversationId = input.required<Id>();
  readonly windowOpen = input.required<boolean>();
  readonly quickReplies = input.required<QuickReply[]>();
  readonly templates = input.required<MessageTemplate[]>();
  readonly products = input<ProductOption[]>([]);

  readonly reply = output<string>();
  readonly note = output<string>();
  readonly template = output<MessageTemplate>();
  readonly product = output<ProductOption>();

  protected readonly productQuery = signal('');
  protected readonly productMatches = computed(() => {
    const needle = this.productQuery().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
    return this.products()
      .filter((p) => !needle || `${p.title} ${p.detail}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().includes(needle))
      .slice(0, 8);
  });

  protected readonly mode = signal<ComposerMode>('reply');
  protected readonly text = signal('');
  protected readonly categoryLabel = CATEGORY_LABEL;

  protected readonly approvedTemplates = computed(() => this.templates().filter((t) => t.status === 'approved'));

  /** Quick replies matching what follows the "/", only while the text is a single shortcut. */
  protected readonly suggestions = computed(() => {
    const match = /^\/(\S*)$/.exec(this.text());
    if (!match || this.mode() === 'template') return [];
    const query = (match[1] ?? '').toLowerCase();
    return this.quickReplies().filter((r) => r.shortcut.startsWith(query));
  });

  protected readonly canSend = computed(
    () => this.text().trim().length > 0 && (this.mode() === 'note' || this.windowOpen()),
  );

  constructor() {
    // A different conversation starts with an empty box in reply mode.
    effect(() => {
      this.conversationId();
      this.text.set('');
      this.mode.set('reply');
    });
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return;
    keyboard.preventDefault();
    const first = this.suggestions()[0];
    if (first) this.pick(first);
    else this.submit();
  }

  protected pick(reply: QuickReply): void {
    this.text.set(reply.body);
  }

  protected submit(): void {
    const body = this.text().trim();
    if (!this.canSend()) return;
    if (this.mode() === 'note') this.note.emit(body);
    else this.reply.emit(body);
    this.text.set('');
  }

  protected sendTemplate(template: MessageTemplate): void {
    this.template.emit(template);
    this.mode.set('reply');
  }

  protected onProductQuery(event: Event): void {
    this.productQuery.set((event.target as HTMLInputElement).value);
  }

  protected sendProduct(option: ProductOption): void {
    this.product.emit(option);
    this.productQuery.set('');
    this.mode.set('reply');
  }
}
