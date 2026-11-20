import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/** Space between the trigger and the panel, and the least space kept from the window's edges. */
const GAP = 6;
const MARGIN = 8;
/** A panel is never squeezed below this, even on a very short window. */
const MIN_HEIGHT = 140;

/**
 * Puts a dropdown or calendar panel over everything, next to its trigger: `position: fixed` from
 * the trigger's place on screen, so no scrolling box (a dialog's body, a table card) can cut it.
 * It opens downwards, or upwards when there is no room below, never past the window's edges, and
 * follows the trigger while anything scrolls or the window resizes.
 *
 * Use it on the panel, a direct child of the component that holds the trigger:
 * `<div class="panel" appFloatingPanel>` (as wide as the trigger) or `appFloatingPanel="auto"`
 * (its own width, like the calendar).
 */
@Directive({ selector: '[appFloatingPanel]' })
export class FloatingPanel {
  private readonly panel = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** 'stretch': as wide as the trigger. 'auto': the panel's own width. */
  readonly appFloatingPanel = input<'stretch' | 'auto' | ''>('stretch');

  private frame = 0;

  constructor() {
    // Placed before the first paint, so it never flashes in the old spot.
    afterNextRender(() => this.place());
    const follow = () => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.place());
    };
    // Capture: scroll does not bubble, but any scrolling box (dialog body, list, page) reaches here.
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    // The panel changes size while it is open (a search narrows the list, another month has more weeks).
    // (Not in the test environment, which has no ResizeObserver.)
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(follow);
    resized?.observe(this.panel);
    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.frame);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
      resized?.disconnect();
    });
  }

  private place(): void {
    const anchor = this.panel.parentElement;
    if (!anchor) return;
    const style = this.panel.style;
    const trigger = anchor.getBoundingClientRect();
    const viewWidth = document.documentElement.clientWidth;
    const viewHeight = window.innerHeight;

    style.position = 'fixed';
    style.right = 'auto';
    style.bottom = 'auto';
    style.margin = '0';
    if (this.appFloatingPanel() !== 'auto') style.width = `${trigger.width}px`;
    style.maxHeight = '';
    style.overflowY = '';

    const below = viewHeight - trigger.bottom - GAP - MARGIN;
    const above = trigger.top - GAP - MARGIN;
    const natural = this.panel.offsetHeight;
    // Down when it fits there, or when below is still the roomier side.
    const down = natural <= below || below >= above;
    const room = Math.max(down ? below : above, MIN_HEIGHT);
    if (natural > room) {
      style.maxHeight = `${room}px`;
      style.overflowY = 'auto';
    }
    const height = Math.min(natural, room);
    const width = this.panel.offsetWidth;
    const top = down ? trigger.bottom + GAP : trigger.top - GAP - height;
    const left = Math.min(Math.max(MARGIN, trigger.left), Math.max(MARGIN, viewWidth - width - MARGIN));
    style.top = `${top}px`;
    style.left = `${left}px`;

    // An ancestor with a transform makes `fixed` count from that ancestor, not the window:
    // measure where it really landed and correct by the difference.
    const landed = this.panel.getBoundingClientRect();
    if (Math.abs(landed.top - top) > 0.5) style.top = `${2 * top - landed.top}px`;
    if (Math.abs(landed.left - left) > 0.5) style.left = `${2 * left - landed.left}px`;
  }
}
