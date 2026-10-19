import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { BRAND } from './brand';
import { BrandTitleStrategy } from './brand-title-strategy';

@Component({ template: '' })
class Blank {}

describe('BrandTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'inbox', title: 'Bandeja', component: Blank },
          { path: 'untitled', component: Blank },
        ]),
        { provide: TitleStrategy, useClass: BrandTitleStrategy },
      ],
    });
  });

  it('appends the product name to the page title', async () => {
    await TestBed.inject(Router).navigateByUrl('/inbox');
    expect(TestBed.inject(Title).getTitle()).toBe(`Bandeja · ${BRAND.name}`);
  });

  it('falls back to the product name alone', async () => {
    await TestBed.inject(Router).navigateByUrl('/untitled');
    expect(TestBed.inject(Title).getTitle()).toBe(BRAND.name);
  });
});
