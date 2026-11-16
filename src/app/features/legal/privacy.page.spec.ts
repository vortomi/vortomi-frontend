import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { LEGAL_ENTITY } from './legal-entity';
import { PrivacyPage } from './privacy.page';

describe('PrivacyPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PrivacyPage], providers: [provideRouter([])] });
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(PrivacyPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('names the legal entity and how to reach it', () => {
    const page = render();
    expect(page.textContent).toContain(LEGAL_ENTITY.name);
    expect(page.textContent).toContain(LEGAL_ENTITY.taxId);
    expect(page.querySelector(`a[href^="mailto:${LEGAL_ENTITY.email}"]`)).not.toBeNull();
  });

  it('has the data deletion section that Meta links to', () => {
    const section = render().querySelector('#data-deletion');
    expect(section).not.toBeNull();
    expect(section?.querySelector('a[href*="subject="]')).not.toBeNull();
  });

  it('is reachable without a session', () => {
    const route = routes.find((r) => r.path === 'privacy');
    expect(route).toBeDefined();
    expect(route?.canActivate).toBeUndefined();
  });
});
