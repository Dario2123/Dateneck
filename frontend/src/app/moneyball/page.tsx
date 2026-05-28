'use client'
import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, PlayerWithStats } from '@/lib/supabase'
import { per90, formatValue, formatMillions } from '@/lib/metrics'

type FilterConfig = {
  minAge: string; maxAge: string
  minHeight: string; maxHeight: string
  minMarketValue: string; maxMarketValue: string
  minMinutes: string
  position: string
  minXgP90: string
  minAssistsP90: string
  minFinalThirdP90: string
  minTacklesP90: string
  minDribblesP90: string
  minRating: string
}

const DEFAULT_FILTERS: FilterConfig = {
  minAge: '', maxAge: '',
  minHeight: '', maxHeight: '',
  minMarketValue: '', maxMarketValue: '',
  minMinutes: '270',
  position: 'Alle',
  minXgP90: '',
  minAssistsP90: '',
  minFinalThirdP90: '',
  minTacklesP90: '',
  minDribblesP90: '',
  minRating: '',
}

function MoneyballInner() {
  const searchParams = useSearchParams()
  const currentLeague = searchParams.get('league') || 'Bundesliga'

  const [players, setPlayers] = useState<PlayerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS)
  const [sortKey, setSortKey] = useState('market_value')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    setPlayers([])
    setLoading(true)
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('*, player_stats(*)')
        .eq('league', currentLeague)
      if (data) {
        setPlayers(data.map((p: any) => ({ ...p, ...(p.player_stats?.[0] ?? {}) })))
      }
      setLoading(false)
    }
    load()
  }, [currentLeague])

  const setFilter = (key: keyof FilterConfig, val: string) =>
    setFilters(f => ({ ...f, [key]: val }))

  const filtered = useMemo(() => {
    return players
      .filter(p => filters.position === 'Alle' || p.position === filters.position)
      .filter(p => !filters.minAge || (p.age ?? 0) >= Number(filters.minAge))
      .filter(p => !filters.maxAge || (p.age ?? 99) <= Number(filters.maxAge))
      .filter(p => !filters.minHeight || (p.height ?? 0) >= Number(filters.minHeight))
      .filter(p => !filters.maxHeight || (p.height ?? 999) <= Number(filters.maxHeight))
      .filter(p => !filters.minMarketValue || (p.market_value ?? 0) >= Number(filters.minMarketValue) * 1_000_000)
      .filter(p => !filters.maxMarketValue || (p.market_value ?? Infinity) <= Number(filters.maxMarketValue) * 1_000_000)
      .filter(p => (p.minutes_played ?? 0) >= Number(filters.minMinutes || 0))
      .filter(p => !filters.minXgP90 || (per90(p.expected_goals, p.minutes_played) ?? 0) >= Number(filters.minXgP90))
      .filter(p => !filters.minAssistsP90 || (per90(p.assists, p.minutes_played) ?? 0) >= Number(filters.minAssistsP90))
      .filter(p => !filters.minFinalThirdP90 || (per90(p.accurate_final_third_passes, p.minutes_played) ?? 0) >= Number(filters.minFinalThirdP90))
      .filter(p => !filters.minTacklesP90 || (per90(p.tackles, p.minutes_played) ?? 0) >= Number(filters.minTacklesP90))
      .filter(p => !filters.minDribblesP90 || (per90(p.successful_dribbles, p.minutes_played) ?? 0) >= Number(filters.minDribblesP90))
      .filter(p => !filters.minRating || (p.rating ?? 0) >= Number(filters.minRating))
      .sort((a, b) => {
        const av = (a as any)[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
        const bv = (b as any)[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity)
        return sortDir === 'asc' ? av - bv : bv - av
      })
  }, [players, filters, sortKey, sortDir])

  if (loading) return <LoadingState />

  const activeFilters = Object.entries(filters).filter(([k, v]) => v && v !== 'Alle' && k !== 'minMinutes').length

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <p className="section-label">Modul 02</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2.2rem', letterSpacing: '0.02em', color: '#fff' }}>
          MONEYBALL SCOUT
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
          {filtered.length} Spieler matchen deinen Kriterien · {currentLeague}
          {activeFilters > 0 && <span style={{ color: 'var(--accent-green)', marginLeft: '8px' }}>· {activeFilters} Filter aktiv</span>}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FilterSection title="PROFIL">
            <select className="tl-input" value={filters.position} onChange={e => setFilter('position', e.target.value)}>
              {['Alle', 'F', 'M', 'D', 'G'].map(p => <option key={p}>{p}</option>)}
            </select>
            <RangeInput label="Alter" minKey="minAge" maxKey="maxAge" filters={filters} setFilter={setFilter} placeholder={['Min', 'Max']} />
            <RangeInput label="Größe (cm)" minKey="minHeight" maxKey="maxHeight" filters={filters} setFilter={setFilter} placeholder={['Min', 'Max']} />
            <RangeInput label="Marktwert (M€)" minKey="minMarketValue" maxKey="maxMarketValue" filters={filters} setFilter={setFilter} placeholder={['Min', 'Max']} />
            <div>
              <label style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'var(--font-display)', display: 'block', marginBottom: '4px' }}>MIN. MINUTEN</label>
              <input className="tl-input" type="number" placeholder="270" value={filters.minMinutes} onChange={e => setFilter('minMinutes', e.target.value)} />
            </div>
          </FilterSection>

          <FilterSection title="PERFORMANCE / 90">
            <StatFilter label="xG / 90" filterKey="minXgP90" filters={filters} setFilter={setFilter} placeholder="z.B. 0.3" />
            <StatFilter label="Assists / 90" filterKey="minAssistsP90" filters={filters} setFilter={setFilter} placeholder="z.B. 0.2" />
            <StatFilter label="Final 3rd Pässe / 90" filterKey="minFinalThirdP90" filters={filters} setFilter={setFilter} placeholder="z.B. 5" />
            <StatFilter label="Tackles / 90" filterKey="minTacklesP90" filters={filters} setFilter={setFilter} placeholder="z.B. 2" />
            <StatFilter label="Dribbles / 90" filterKey="minDribblesP90" filters={filters} setFilter={setFilter} placeholder="z.B. 1" />
            <StatFilter label="Rating (min)" filterKey="minRating" filters={filters} setFilter={setFilter} placeholder="z.B. 7.0" />
          </FilterSection>

          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.72rem',
              letterSpacing: '0.1em', padding: '10px', borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent', color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
            }}
          >
            FILTER ZURÜCKSETZEN
          </button>
        </div>

        <div className="tl-card" style={{ overflowX: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'rgba(255,255,255,0.2)' }}>KEINE SPIELER GEFUNDEN</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', marginTop: '8px' }}>Filter anpassen</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Spieler</th>
                  <th>Pos</th>
                  <th>Alter</th>
                  <th>Größe</th>
                  <th onClick={() => { setSortKey('market_value'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}
                    style={{ color: sortKey === 'market_value' ? '#fff' : undefined, cursor: 'pointer' }}>
                    Marktwert {sortKey === 'market_value' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>xG/90</th>
                  <th>A/90</th>
                  <th>F3/90</th>
                  <th>Tack/90</th>
                  <th>Drib/90</th>
                  <th onClick={() => { setSortKey('rating'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}
                    style={{ color: sortKey === 'rating' ? '#fff' : undefined, cursor: 'pointer' }}>
                    Rating {sortKey === 'rating' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Min.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.sofascore_id}>
                    <td><span className={`rank-badge ${i < 3 ? 'top3' : ''}`}>{i + 1}</span></td>
                    <td>
                      <span style={{ color: '#fff', fontWeight: 500 }}>{p.name}</span>
                      <span style={{ marginLeft: '8px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>{p.team}</span>
                    </td>
                    <td><span className={`pos-badge pos-${p.position}`}>{p.position}</span></td>
                    <td>{p.age ?? '—'}</td>
                    <td>{p.height ? `${p.height}` : '—'}</td>
                    <td style={{ color: 'var(--accent-green)' }}>{formatMillions(p.market_value)}</td>
                    <td>{formatValue(per90(p.expected_goals, p.minutes_played))}</td>
                    <td>{formatValue(per90(p.assists, p.minutes_played))}</td>
                    <td>{formatValue(per90(p.accurate_final_third_passes, p.minutes_played))}</td>
                    <td>{formatValue(per90(p.tackles, p.minutes_played))}</td>
                    <td>{formatValue(per90(p.successful_dribbles, p.minutes_played))}</td>
                    <td style={{ color: (p.rating ?? 0) >= 7.5 ? 'var(--accent-green)' : undefined }}>{formatValue(p.rating)}</td>
                    <td style={{ color: 'rgba(255,255,255,0.4)' }}>{p.minutes_played ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tl-card" style={{ padding: '16px' }}>
      <p className="section-label" style={{ marginBottom: '12px' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
    </div>
  )
}

function RangeInput({ label, minKey, maxKey, filters, setFilter, placeholder }: any) {
  return (
    <div>
      <label style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'var(--font-display)', display: 'block', marginBottom: '4px' }}>{label}</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <input className="tl-input" type="number" placeholder={placeholder[0]} value={filters[minKey]} onChange={e => setFilter(minKey, e.target.value)} />
        <input className="tl-input" type="number" placeholder={placeholder[1]} value={filters[maxKey]} onChange={e => setFilter(maxKey, e.target.value)} />
      </div>
    </div>
  )
}

function StatFilter({ label, filterKey, filters, setFilter, placeholder }: any) {
  return (
    <div>
      <label style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'var(--font-display)', display: 'block', marginBottom: '4px' }}>{label}</label>
      <input className="tl-input" type="number" step="0.1" placeholder={placeholder} value={filters[filterKey]} onChange={e => setFilter(filterKey, e.target.value)} />
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid rgba(0,255,135,0.2)', borderTopColor: 'var(--accent-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>LADE DATEN...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function Moneyball() {
  return (
    <Suspense fallback={null}>
      <MoneyballInner />
    </Suspense>
  )
}
