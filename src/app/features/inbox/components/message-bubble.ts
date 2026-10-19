import { Component, computed, input } from '@angular/core';
import type { Message } from '../../../shared/api/models';
import { formatTime } from '../../../shared/format/date-time';
import { Icon } from '../../../shared/ui/icon';

const STATUS_MARK: Record<string, { mark: string; label: string }> = {
  pending: { mark: '🕓', label: 'Enviando' },
  sent: { mark: '✓', label: 'Enviado' },
  delivered: { mark: '✓✓', label: 'Entregado' },
  read: { mark: '✓✓', label: 'Leído' },
  failed: { mark: '!', label: 'No se entregó' },
};

@Component({
  selector: 'app-message-bubble',
  imports: [Icon],
  template: `
    @let msg = message();
    @if (msg.direction === 'outbound' && author()) {
      <span class="author">{{ author() }}</span>
    }
    @if (msg.type === 'product') {
      <span class="product"><app-icon name="tag" /><span>{{ msg.body }}</span></span>
    } @else if (msg.type === 'image') {
      <span class="media"><app-icon name="image" />Foto</span>
    } @else {
      <p>{{ msg.body }}</p>
    }
    <small>
      {{ time() }}
      @if (status(); as s) {
        <span class="status" [class]="msg.status" [attr.title]="s.label" [attr.aria-label]="s.label">{{ s.mark }}</span>
      }
    </small>
  `,
  host: {
    '[class]': 'message().direction',
    '[class.template]': "message().type === 'template'",
    '[class.product-msg]': "message().type === 'product'",
  },
  styleUrl: './message-bubble.scss',
})
export class MessageBubble {
  readonly message = input.required<Message>();
  /** Agent name, or the template label for template messages. */
  readonly author = input<string>('');
  readonly timezone = input.required<string>();

  protected readonly time = computed(() => formatTime(this.message().createdAt, this.timezone()));
  protected readonly status = computed(() => {
    const status = this.message().status;
    return status ? STATUS_MARK[status] : undefined;
  });
}
