interface Props {
  iso2: string | null
  country?: string
}

export function CountryBadge({ iso2, country }: Props) {
  if (!iso2) return <span className="text-gray-400">—</span>
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400"
      title={country}
    >
      <img
        src={`https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`}
        alt={iso2}
        className="w-4 h-3 rounded-sm object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      {iso2}
    </span>
  )
}
