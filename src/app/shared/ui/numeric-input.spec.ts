import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CodeInput, cleanCode } from './code-input';
import { NumericInput, clean } from './numeric-input';

@Component({
  imports: [NumericInput, CodeInput],
  template: `
    <input id="price" appNumeric="money" [value]="price()" (input)="price.set(value($event))" />
    <input id="qty" appNumeric="quantity" [decimals]="0" [value]="qty()" (input)="qty.set(value($event))" />
    <input id="code" appCode [value]="code()" (input)="code.set(value($event))" />
  `,
})
class Host {
  readonly price = signal('');
  readonly qty = signal('');
  readonly code = signal('');
  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const field = (id: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`#${id}`)!;
  /** Types `text` at the end of the field, as the browser would announce it. Resolves to whether it was refused. */
  const type = (id: string, text: string) => {
    const input = field(id);
    input.setSelectionRange(input.value.length, input.value.length);
    const event = new InputEvent('beforeinput', { data: text, inputType: 'insertText', cancelable: true });
    input.dispatchEvent(event);
    if (!event.defaultPrevented) {
      input.value += text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return event.defaultPrevented;
  };
  const leave = async (id: string) => {
    field(id).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };
  return { fixture, field, type, leave, host: fixture.componentInstance };
}

describe('price and quantity fields', () => {
  it('refuse letters and a third decimal while typing', async () => {
    const { type, host } = await setup();
    expect(type('price', '1')).toBe(false);
    expect(type('price', 'a')).toBe(true);
    expect(type('price', ',5')).toBe(false);
    expect(type('price', '0')).toBe(false);
    expect(type('price', '0')).toBe(true);
    expect(host.price()).toBe('1,50');
  });

  it('a price leaves the field with its 2 decimals, and the form knows it', async () => {
    const { type, leave, field, host } = await setup();
    type('price', '1');
    await leave('price');
    expect(field('price').value).toBe('1,00');
    expect(host.price()).toBe('1,00');
  });

  it('a product counted whole takes no decimals', async () => {
    const { type, host } = await setup();
    type('qty', '10');
    expect(type('qty', ',')).toBe(true);
    expect(host.qty()).toBe('10');
  });

  it('whatever slipped in is cleaned on the way out', () => {
    expect(clean('12safsadfasdf', 2, false, true)).toBe('12,00');
    expect(clean('1,500000000', 2, false, true)).toBe('1,50');
    expect(clean('10dfsfs', 0, false, false)).toBe('10');
    expect(clean('-5', 0, true, false)).toBe('-5');
    expect(clean('-5', 0, false, false)).toBe('5');
    expect(clean('abc', 2, false, true)).toBe('');
  });
});

describe('product code field', () => {
  it('writes lower case as upper case and refuses spaces and signs', async () => {
    const { type, host } = await setup();
    expect(type('code', 'pan')).toBe(true);
    expect(host.code()).toBe('PAN');
    expect(type('code', '-01')).toBe(false);
    expect(type('code', ' x')).toBe(true);
    expect(host.code()).toBe('PAN-01');
  });

  it('stops at 40 characters, and cleans a paste on the way out', async () => {
    const { type, field } = await setup();
    field('code').value = 'A'.repeat(40);
    expect(type('code', 'B')).toBe(true);
    expect(cleanCode('n-jam-01 ffff!')).toBe('N-JAM-01FFFF');
    expect(cleanCode('x'.repeat(50))).toHaveLength(40);
  });
});
