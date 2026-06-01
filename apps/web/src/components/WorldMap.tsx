import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import type { CountryMetrics } from '@crm-plp/shared'
import { formatCurrency } from '@/lib/utils'

interface Props {
  data: CountryMetrics[]
  metric: 'quoted' | 'orders' | 'hit_rate'
  onCountryClick?: (country: CountryMetrics) => void
}

interface TooltipState {
  x: number
  y: number
  content: CountryMetrics | null
}

export function WorldMap({ data, metric, onCountryClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState>({ x: 0, y: 0, content: null })
  const [worldData, setWorldData] = useState<any>(null)

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(setWorldData)
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!svgRef.current || !worldData) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth || 900
    const height = 450

    const projection = d3.geoNaturalEarth1()
      .scale(width / 6.28)
      .translate([width / 2, height / 2])

    const path = d3.geoPath().projection(projection)

    // ISO3 → ISO2 mapping for the few countries we operate in
    const iso3toISO2: Record<string, string> = {
      '032': 'AR', '152': 'CL', '170': 'CO', '604': 'PE', '600': 'PY',
      '858': 'UY', '484': 'MX', '076': 'BR', '840': 'US', '724': 'ES',
      '616': 'PL', '764': 'TH', '068': 'BO', '218': 'EC',
    }

    const metricByIso2 = new Map(data.map(d => [d.country_iso2, d]))

    const maxVal = d3.max(data, d => {
      if (metric === 'quoted') return d.quoted_value_usd
      if (metric === 'orders') return d.orders_value_usd
      return d.hit_rate
    }) ?? 1

    const colorScale = d3.scaleSequential()
      .domain([0, maxVal])
      .interpolator(d3.interpolate('#f0f0f0', '#f59e0b'))

    const countries = topojson.feature(worldData, worldData.objects.countries)

    svg
      .append('g')
      .selectAll('path')
      .data((countries as any).features)
      .join('path')
      .attr('d', path as any)
      .attr('fill', (d: any) => {
        const iso2 = iso3toISO2[d.id]
        const entry = iso2 ? metricByIso2.get(iso2) : null
        if (!entry) return '#e5e7eb'
        const val =
          metric === 'quoted' ? entry.quoted_value_usd :
          metric === 'orders' ? entry.orders_value_usd :
          entry.hit_rate
        return colorScale(val)
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .style('cursor', (d: any) => {
        const iso2 = iso3toISO2[d.id]
        return iso2 && metricByIso2.has(iso2) ? 'pointer' : 'default'
      })
      .on('mousemove', function(event: MouseEvent, d: any) {
        const iso2 = iso3toISO2[d.id]
        const entry = iso2 ? metricByIso2.get(iso2) : null
        if (!entry) { setTooltip({ x: 0, y: 0, content: null }); return }
        const [mx, my] = d3.pointer(event, svgRef.current)
        setTooltip({ x: mx, y: my, content: entry })
      })
      .on('mouseleave', () => setTooltip({ x: 0, y: 0, content: null }))
      .on('click', (_event: MouseEvent, d: any) => {
        const iso2 = iso3toISO2[d.id]
        const entry = iso2 ? metricByIso2.get(iso2) : null
        if (entry && onCountryClick) onCountryClick(entry)
      })

  }, [worldData, data, metric, onCountryClick])

  return (
    <div className="relative w-full">
      <svg ref={svgRef} className="w-full" style={{ height: 450 }} />
      {tooltip.content && (
        <div
          className="absolute z-10 pointer-events-none card p-2 text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-semibold">{tooltip.content.country}</p>
          <p>Cotado: {formatCurrency(tooltip.content.quoted_value_usd)}</p>
          <p>Pedidos: {formatCurrency(tooltip.content.orders_value_usd)}</p>
          <p>Hit rate: {(tooltip.content.hit_rate * 100).toFixed(0)}%</p>
        </div>
      )}
    </div>
  )
}
