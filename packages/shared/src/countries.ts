export interface StandardCountry {
  name: string
  iso2: string
  currency: string
}

export const STANDARD_COUNTRIES: StandardCountry[] = [
  { name: 'Argentina', iso2: 'AR', currency: 'USD' },
  { name: 'Bolívia', iso2: 'BO', currency: 'USD' },
  { name: 'Brasil', iso2: 'BR', currency: 'BRL' },
  { name: 'Chile', iso2: 'CL', currency: 'USD' },
  { name: 'Colômbia', iso2: 'CO', currency: 'USD' },
  { name: 'Equador', iso2: 'EC', currency: 'USD' },
  { name: 'Espanha', iso2: 'ES', currency: 'EUR' },
  { name: 'Estados Unidos', iso2: 'US', currency: 'USD' },
  { name: 'México', iso2: 'MX', currency: 'USD' },
  { name: 'Paraguai', iso2: 'PY', currency: 'USD' },
  { name: 'Peru', iso2: 'PE', currency: 'USD' },
  { name: 'Polônia', iso2: 'PL', currency: 'EUR' },
  { name: 'Tailândia', iso2: 'TH', currency: 'USD' },
  { name: 'Uruguai', iso2: 'UY', currency: 'USD' },
  { name: 'Venezuela', iso2: 'VE', currency: 'USD' },
]

export function findCountryByIso2(iso2: string | null | undefined): StandardCountry | undefined {
  if (!iso2) return undefined
  const upper = iso2.toUpperCase()
  return STANDARD_COUNTRIES.find(c => c.iso2 === upper)
}

export function findCountryByName(name: string | null | undefined): StandardCountry | undefined {
  if (!name) return undefined
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  return STANDARD_COUNTRIES.find(c => {
    const cNorm = c.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
    return cNorm === normalized || c.iso2.toLowerCase() === normalized
  })
}
