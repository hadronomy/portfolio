/** IGIC rate values require a matching legal supply category. They are not inferred from item descriptions. */
export const igicRates = ['0', '3', '5', '7', '9.5', '15', '20'] as const;
export const repepLegend = 'Exención franquicia fiscal';
export const taxSources = {
  rates: 'https://www.boe.es/buscar/act.php?id=BOC-j-2025-90249',
  repep:
    'https://www3.gobiernodecanarias.org/tributos/atc/w/regimen-especial-peque%C3%B1o-empresario-o-profesional-repep',
  transition: 'https://www.gobiernodecanarias.org/boc/2026/066/1094.html',
} as const;
