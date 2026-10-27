import { Component, ElementRef, afterRenderEffect, computed, inject, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '../../../core/clock';
import { Session } from '../../../core/session';
import { Workspace } from '../../../core/workspace';
import type { Message, MessageTemplate } from '../../../shared/api/models';
import { calendarDay, formatDayLabel, formatTime } from '../../../shared/format/date-time';
import { Avatar } from '../../../shared/ui/avatar';
import { Icon } from '../../../shared/ui/icon';
import { InboxData, type TimelineEntry } from '../inbox.data';
import type { InboxItem } from '../inbox.filters';
import { formatRemaining, getServiceWindow } from '../service-window';
import { MessageBubble } from './message-bubble';
import { MessageComposer, type ProductOption } from './message-composer';
import { STOCK_STATUS } from '../../../shared/api/labels';
import { formatUsdCents, formatVes } from '../../../shared/format/money';
import { ExchangeRates } from '../../exchange-rates/exchange-rates.data';
import { InventoryData } from '../../inventory/inventory.data';
import { toBolivares, variantStatus } from '../../inventory/inventory.rules';
import { perUnit } from '../../inventory/sale-units';

interface DayGroup {
  day: string;
  label: string;
  entries: TimelineEntry[];
}

@Component({
  selector: 'app-chat-panel',
  imports: [RouterLink, Avatar, Icon, MessageBubble, MessageComposer],
  templateUrl: './chat-panel.html',
  styleUrl: './chat-panel.scss',
})
export class ChatPanel {
  private readonly data = inject(InboxData);
  private readonly inventory = inject(InventoryData);
  private readonly clock = inject(Clock);
  private readonly session = inject(Session);
  protected readonly workspace = inject(Workspace);
  private readonly rates = inject(ExchangeRates);

  readonly item = input.required<InboxItem>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly conversation = computed(() => this.item().conversation);
  protected readonly contact = computed(() => this.item().contact);
  protected readonly channel = computed(() => this.workspace.channelById().get(this.conversation().channelAccountId));
  protected readonly attendants = computed(() => this.workspace.attendantsOf(this.conversation().channelAccountId));
  protected readonly timezone = this.session.timezone;

  protected readonly window = computed(() =>
    getServiceWindow(this.conversation().serviceWindowExpiresAt, this.clock.now()),
  );
  protected readonly remaining = computed(() => formatRemaining(this.window().remainingMs));

  /** Active products ready to send as a card; out-of-stock ones are listed but cannot be sent. */
  protected readonly productOptions = computed<ProductOption[]>(() => {
    if (!this.workspace.sells()) return [];
    const rate = this.rates.current();
    return this.inventory.items().flatMap(({ product, variants }) =>
      !product.active
        ? []
        : variants.map((variant) => {
            const status = variantStatus(product, variant);
            const label = STOCK_STATUS[status];
            // "$4,50 el kilo (≈ 3.992,86 Bs)": the price is per the product's unit.
            const per = perUnit(product.saleUnit);
            const usd = per ? `${formatUsdCents(variant.priceCents)} ${per}` : formatUsdCents(variant.priceCents);
            const price = rate ? `${usd} (≈ ${formatVes(toBolivares(variant.priceCents, rate))})` : usd;
            return {
              variantId: variant.id,
              title: product.name,
              detail: `${variant.name} · ${variant.sku}`,
              price,
              statusText: label.text,
              tone: label.tone,
              sendable: status === 'available' || status === 'low',
              message: `${product.name} — ${variant.name}\n${price}\n${label.text}`,
            };
          }),
    );
  });

  protected readonly groups = computed<DayGroup[]>(() => {
    const now = this.clock.now();
    const zone = this.timezone();
    const groups: DayGroup[] = [];
    for (const entry of this.data.timeline(this.conversation().id)) {
      const day = calendarDay(entry.at, zone);
      const last = groups[groups.length - 1];
      if (last?.day === day) last.entries.push(entry);
      else groups.push({ day, label: formatDayLabel(entry.at, now, zone), entries: [entry] });
    }
    return groups;
  });

  constructor() {
    // Keep the latest message in view when the conversation or its content changes.
    afterRenderEffect(() => {
      this.groups();
      const element = this.scroller()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }

  protected userName(id: string | null): string {
    return (id && this.workspace.userById().get(id)?.name) || '';
  }

  protected firstName(id: string | null): string {
    return this.userName(id).split(' ')[0] ?? '';
  }

  protected authorOf(message: Message): string {
    if (message.type === 'template') {
      const name = this.workspace.templates().find((t) => t.id === message.templateId)?.name;
      return name ? `Plantilla · ${name}` : 'Plantilla';
    }
    return this.firstName(message.authorUserId);
  }

  protected time(iso: string): string {
    return formatTime(iso, this.timezone());
  }

  protected entryId(entry: TimelineEntry): string {
    return entry.kind === 'message' ? entry.message.id : entry.note.id;
  }

  protected onAssign(event: Event): void {
    this.data.assign(this.conversation().id, (event.target as HTMLSelectElement).value || null);
  }

  protected toggleResolved(): void {
    this.data.toggleResolved(this.conversation().id);
  }

  protected onReply(body: string): void {
    this.data.sendText(this.conversation().id, body);
  }

  protected onNote(body: string): void {
    this.data.addNote(this.conversation().id, body);
  }

  protected onProduct(option: ProductOption): void {
    this.data.sendProduct(this.conversation().id, option.message, option.variantId);
  }

  protected onTemplate(template: MessageTemplate): void {
    this.data.sendTemplate(this.conversation().id, template);
  }
}
