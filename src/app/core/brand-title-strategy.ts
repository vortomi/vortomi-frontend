import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { BRAND } from './brand';

/** Route titles name the page only; the product name is appended here, once. */
@Injectable({ providedIn: 'root' })
export class BrandTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} · ${BRAND.name}` : BRAND.name);
  }
}
