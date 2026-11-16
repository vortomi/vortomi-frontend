import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Vortomi's isotipo (the designer's file, public/brand/isotipo.svg): the chat bubble with the V.
 * Decorative (the name sits next to it). The size comes from the host (width and height).
 */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img src="brand/isotipo.svg" alt="" />`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      width: 34px;
      height: 34px;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `,
})
export class BrandMark {}
