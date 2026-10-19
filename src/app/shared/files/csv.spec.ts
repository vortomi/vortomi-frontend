import { parseCsv, safeCell, toCsv } from './csv';

describe('parseCsv', () => {
  it('reads comma files', () => {
    expect(parseCsv('nombre,telefono\nJosé,0414-555-0187\n')).toEqual([
      ['nombre', 'telefono'],
      ['José', '0414-555-0187'],
    ]);
  });

  it('detects semicolons and handles quotes, escaped quotes and CRLF', () => {
    expect(parseCsv('﻿a;b\r\n"Taller ""El Rayo""; C.A.";2\r\n')).toEqual([
      ['a', 'b'],
      ['Taller "El Rayo"; C.A.', '2'],
    ]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toHaveLength(2);
  });
});

describe('toCsv', () => {
  it('neutralises formulas (CSV injection)', () => {
    expect(safeCell('=HYPERLINK("http://evil")')).toBe(`'=HYPERLINK("http://evil")`);
    expect(safeCell('+58 414')).toBe("'+58 414");
    expect(safeCell('José')).toBe('José');
  });

  it('writes a BOM, semicolons and quotes when needed', () => {
    expect(toCsv(['a', 'b'], [['x;y', 'z']])).toBe('﻿a;b\r\n"x;y";z');
  });

  it('round-trips through the parser', () => {
    const rows = [['Nombre', 'Notas'], ['Ana', 'dijo "hola"; luego\nse fue']];
    expect(parseCsv(toCsv(rows[0]!, rows.slice(1)))).toEqual(rows);
  });
});
