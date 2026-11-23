/** The words that change with who pays in bolívares: a company's customers, or the companies paying Vortomi. */
export interface ExchangeRateTexts {
  /** Under the title. */
  lead: string;
  /** Above the rate in use. */
  inUse: string;
  /** Without any rate yet. */
  noRate: string;
  /** A failed BCV read: «… sigue con la última tasa.» */
  keepsLast: string;
  /** The confirmations: switching to the BCV, to a typed rate, reading the BCV now, registering a rate. */
  toBcv: string;
  toCustom: string;
  refreshNow: string;
  /** After «Vale desde el …. Una tasa registrada no se edita ni se borra, …». */
  registered: string;
}

/** The panel's: a company's customers see prices in bolívares. */
export const COMPANY_RATE_TEXTS: ExchangeRateTexts = {
  lead: 'Convierte los precios en USD a bolívares. Los pedidos guardarán la tasa del día en que se hicieron.',
  inUse: 'Tus clientes ven los precios en bolívares con esta tasa:',
  noRate: 'Aún no hay tasa: tus clientes ven solo precios en USD.',
  keepsLast: 'La empresa sigue con la última tasa.',
  toBcv: 'Los precios en bolívares pasan a la tasa oficial del BCV y se actualizan solos cada día.',
  toCustom: 'Los precios en bolívares usarán la tasa que registres aquí, hasta que la cambies.',
  refreshNow: 'Si el BCV ya publicó una tasa nueva para hoy, tus precios en bolívares cambian en este momento.',
  registered: 'tus clientes ven los precios con ella.',
};
