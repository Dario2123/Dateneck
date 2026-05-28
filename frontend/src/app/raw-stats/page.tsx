'use client'
import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, PlayerWithStats } from '@/lib/supabase'
import { per90, formatValue, formatMillions } from '@/lib/metrics'

const STAT_COLUMNS = [
  { key: 'goals',                    label: 'Tore',        group: 'Offensiv' },
  { key: 'assists',                  label: 'Assists',     group: 'Offensiv' },
  { key: 'expected_goals',           label: 'xG',          group: 'Offensiv' },
  { key: 'expected_assists',         label: 'xA',          group: 'Offensiv' },
  { key: 'total_shots',              label: 'Schüsse',     group: 'Offensiv' },
  { key: 'shots_on_target',          label: 'Schüsse Tor', group: 'Offensiv' },
  { key: 'big_chances_created',      label: 'Big Chances', group: 'Offensiv' },
  { key: 'key_passes',               label: 'Key Passes',  group: 'Pässe' },
  { key: 'accurate_final_third_passes', label: 'Final 3rd Pass', group: 'Pässe' },
  { key: 'accurate_passes_pct',      label: 'Pass%',       group: 'Pässe',  noPer90: true },
  { key: 'accurate_long_balls',      label: 'Long Balls',  group: 'Pässe' },
  { key: 'accurate_crosses',         label: 'Crosses',     group: 'Pässe' },
  { key: 'successful_dribbles',      label: 'Dribbles',    group: 'Duell' },
  { key: 'ground_duels_won_pct',     label: 'Boden%',      group: 'Duell',  noPer90: true },
  { key: 'aerial_duels_won_pct',     label: 'Luft%',       group: 'Duell',  noPer90: true },
  { key: 'tackles',                  label: 'Tackles',     group: 'Defensiv' },
  { key: 'tackles_won_pct',          label: 'Tackle%',     group: 'Defensiv', noPer90: true },
  { key: 'interceptions',            label: 'Intercept.',  group: 'Defensiv' },
  { key: 'clearances',               label: 'Clearances',  group: 'Defensiv' },
  { key: 'ball_recovery',            label: 'Ball Recov.', group: 'Defensiv' },
  { key: 'possession_lost',          label: 'Ballverl.',   group: 'Ballbesitz' },
  { key: 'touches',                  label: 'Touches',     group: 'Ballbesitz' },
  { key: 'appearances',              label: 'Spiele',      group: 'Einsatz', noPer90: true },
  { key: 'minutes_played',           label: 'Minuten',     group: 'Einsatz', noPer90: true },
  { key: 'rating',                   label: 'Rating',      group: 'Einsatz', noPer90: true },
]

const GROUPS = ['Alle', 'Offensiv', 'Pässe', 'Duell', 'Defensiv', 'Ballbesitz', 'Einsatz']
const POSITIONS = ['Alle', 'F', 'M', 'D', 'G']
const MIN_MINUTES = [0, 90, 270, 450, 900]

function RawStatsInner() {
  const searchParams = useSearchParams()
  const currentLeague = searchParams.get('league') || 'Bundesliga'

  const [players, setPlayers] = useState<PlayerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('expected_goals')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [per90Mode, setPer90Mode] = useState(false)
  const [group, setGroup] = useState('Alle')
  const [posFilter, setPosFilter] = useState('Alle')
  const [minMin, setMinMin] = useState(270)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setPlayers([])
    setLoading(true)
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('*, player_stats(*)')
        .eq('league', currentLeague)
      if (data) {
        const flat = data.map((p: any) => ({
          ...p,
          ...(p.player_stats?.[0] ?? {}),
        }))
        setPlayers(flat)
      }
      setLoading(false)
    }
    load()
  }, [currentLeague])

  const visibleCols = useMemo(() =>
    STAT_COLUMNS.filter(c => group === 'Alle' || c.group === group),
    [group]
  )

  const getValue = (p: PlayerWithStats, key: string) => {
    const col = STAT_COLUMNS.find(c => c.key === key)
    const raw = (p as any)[key] as number | null
    if (per90Mode && !col?.noPer90) return per90(raw, p.minutes_played)
    return raw
  }

  const sorted = useMemo(() => {
    return [...players]
      .filter(p => posFilter === 'Alle' || p.position === posFilter)
      .filter(p => (p.minutes_played ?? 0) >= minMin)
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const av = getValue(a, sortKey) ?? -Infinity
        const bv = getValue(b, sortKey) ?? -Infinity
        return sortDir === 'desc' ? bv - av : av - bv
      })
  }, [players, sortKey, sortDir, per90Mode, posFilter, minMin, search])

  const maxVal = useMemo(() => {
    return Math.max(...sorted.map(p => getValue(p, sortKey) ?? 0), 0.001)
  }, [sorted, sortKey, per90Mode])

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  if (loading) return <LoadingState />

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <p className="section-label">Modul 01</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2.2rem', letterSpacing: '0.02em', color: '#fff' }}>
          RAW STATS EXPLORER
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
          {sorted.length} Spieler · {currentLeague} · Saison 25/26
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <input className="tl-input" style={{ width: '200px' }} placeholder="Spieler suchen..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="tl-input" style={{ width: '140px' }} value={group} onChange={e => setGroup(e.target.value)}>
          {GROUPS.map(g => <option key={g}>{g}</option>)}
        </select>
        <select className="tl-input" style={{ width: '110px' }} value={posFilter} onChange={e => setPosFilter(e.target.value)}>
          {POSITIONS.map(p => <option key={p}>{p === 'Alle' ? 'Position' : p}</option>)}
        </select>
        <select className="tl-input" style={{ width: '150px' }} value={minMin} onChange={e => setMinMin(Number(e.target.value))}>
          {MIN_MINUTES.map(m => <option key={m} value={m}>{m === 0 ? 'Alle Minuten' : `Min. ${m} Min.`}</option>)}
        </select>
        <button
          onClick={() => setPer90Mode(m => !m)}
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.75rem',
            letterSpacing: '0.1em', padding: '8px 16px', borderRadius: '4px',
            border: `1px solid ${per90Mode ? 'var(--accent-green)' : 'rgba(255,255,255,0.12)'}`,
            background: per90Mode ? 'rgba(0,255,135,0.1)' : 'transparent',
            color: per90Mode ? 'var(--accent-green)' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          PER 90
        </button>
      </div>

      <div className="tl-card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '32px' }}>#</th>
              <th style={{ minWidth: '160px' }}>Spieler</th>
              <th>Team</th>
              <th>Pos</th>
              {visibleCols.map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)} style={{ color: sortKey === col.key ? '#fff' : undefined }}>
                  {col.label}
                  {sortKey === col.key && <span style={{ marginLeft: '4px', color: 'var(--accent-green)' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const sortVal = getValue(p, sortKey)
              const barWidth = sortVal != null ? Math.round((sortVal / maxVal) * 100) : 0
              return (
                <tr key={p.sofascore_id}>
                  <td><span className={`rank-badge ${i < 3 ? 'top3' : ''}`}>{i + 1}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#fff', fontWeight: 500 }}>{p.name}</span>
                      <div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${barWidth}%` }} /></div>
                    </div>
                  </td>
                  <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{p.team}</td>
                  <td><span className={`pos-badge pos-${p.position}`}>{p.position}</span></td>
                  {visibleCols.map(col => {
                    const val = getValue(p, col.key)
                    const isSort = col.key === sortKey
                    return (
                      <td key={col.key} style={{ color: isSort ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: isSort ? 500 : 400 }}>
                        {formatValue(val, col.key.endsWith('_pct') ? 1 : 2)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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

export default function RawStats() {
  return (
    <Suspense fallback={null}>
      <RawStatsInner />
    </Suspense>
  )
}
