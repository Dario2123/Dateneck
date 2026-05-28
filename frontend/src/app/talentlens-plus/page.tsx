'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  PlayerStats,
  calcTLS, calcGTS, calcCOR, calcDIS, calcPBC,
  calcOffensiveUsageRate, per90
} from '@/lib/metrics'

type MetricKey = 'TLS' | 'GTS' | 'COR' | 'DIS' | 'PBC' | 'OUR'

const METRICS: { key: MetricKey; label: string; desc: string; nba: string }[] = [
  { key: 'TLS', label: 'TalentLens Score', desc: 'Positionsgewichteter Gesamtscore', nba: '≈ PER' },
  { key: 'GTS', label: 'Goal Threat Score', desc: 'xG/90 + Shot Accuracy + Conversion', nba: '≈ True Shooting %' },
  { key: 'COR', label: 'Creative Output Rating', desc: 'xA/90 + Key Passes + Big Chances', nba: '≈ Assist Rate' },
  { key: 'DIS', label: 'Defensive Impact Score', desc: 'Tackles + Interceptions + Clearances + Recovery /90', nba: '≈ Defensive Rating' },
  { key: 'PBC', label: 'Progressive Ball Carrier', desc: 'Dribbles + Final Third Passes /90', nba: '≈ Ball Movement IQ' },
  { key: 'OUR', label: 'Offensive Usage Rate', desc: '% der offensiven Aktionen des Teams', nba: '≈ NBA Usage Rate' },
]

const METRIC_STATS: Record<MetricKey, { label: string; getValue: (p: PlayerStats) => number }[]> = {
  TLS: [
    { label: 'Rating', getValue: p => p.rating ?? 0 },
    { label: 'xG/90', getValue: p => per90(p.expected_goals, p.minutes_played) ?? 0 },
    { label: 'xA/90', getValue: p => per90(p.expected_assists, p.minutes_played) ?? 0 },
    { label: 'Tackles/90', getValue: p => per90(p.tackles_won, p.minutes_played) ?? 0 },
    { label: 'Dribbles/90', getValue: p => per90(p.successful_dribbles, p.minutes_played) ?? 0 },
    { label: 'Key Passes/90', getValue: p => per90(p.key_passes, p.minutes_played) ?? 0 },
  ],
  GTS: [
    { label: 'xG/90', getValue: p => per90(p.expected_goals, p.minutes_played) ?? 0 },
    { label: 'Schüsse/90', getValue: p => per90(p.total_shots, p.minutes_played) ?? 0 },
    { label: 'Schüsse auf Tor %', getValue: p => p.shots_on_target ?? 0 },
    { label: 'Big Chances/90', getValue: p => per90(p.big_chances_created, p.minutes_played) ?? 0 },
    { label: 'Headers Won %', getValue: p => p.aerial_duels_won_pct ?? 0 },
  ],
  COR: [
    { label: 'xA/90', getValue: p => per90(p.expected_assists, p.minutes_played) ?? 0 },
    { label: 'Key Passes/90', getValue: p => per90(p.key_passes, p.minutes_played) ?? 0 },
    { label: 'Big Chances/90', getValue: p => per90(p.big_chances_created, p.minutes_played) ?? 0 },
    { label: 'Final 3rd Passes/90', getValue: p => per90(p.accurate_final_third_passes, p.minutes_played) ?? 0 },
    { label: 'Crosses/90', getValue: p => per90(p.accurate_crosses, p.minutes_played) ?? 0 },
  ],
  DIS: [
    { label: 'Tackles/90', getValue: p => per90(p.tackles_won, p.minutes_played) ?? 0 },
    { label: 'Interceptions/90', getValue: p => per90(p.interceptions, p.minutes_played) ?? 0 },
    { label: 'Clearances/90', getValue: p => per90(p.clearances, p.minutes_played) ?? 0 },
    { label: 'Ball Recovery/90', getValue: p => per90(p.ball_recovery, p.minutes_played) ?? 0 },
    { label: 'Duels Won %', getValue: p => p.ground_duels_won_pct ?? 0 },
  ],
  PBC: [
    { label: 'Dribbles/90', getValue: p => per90(p.successful_dribbles, p.minutes_played) ?? 0 },
    { label: 'Final 3rd Passes/90', getValue: p => per90(p.accurate_final_third_passes, p.minutes_played) ?? 0 },
    { label: 'Dribble Success %', getValue: p => p.successful_dribbles_pct ?? 0 },
    { label: 'Long Balls/90', getValue: p => per90(p.accurate_long_balls, p.minutes_played) ?? 0 },
    { label: 'Poss. Won/90', getValue: p => per90(p.ball_recovery, p.minutes_played) ?? 0 },
  ],
  OUR: [
    { label: 'Schüsse/90', getValue: p => per90(p.total_shots, p.minutes_played) ?? 0 },
    { label: 'Dribbles/90', getValue: p => per90(p.successful_dribbles, p.minutes_played) ?? 0 },
    { label: 'Key Passes/90', getValue: p => per90(p.key_passes, p.minutes_played) ?? 0 },
    { label: 'Big Chances/90', getValue: p => per90(p.big_chances_created, p.minutes_played) ?? 0 },
    { label: 'xG/90', getValue: p => per90(p.expected_goals, p.minutes_played) ?? 0 },
  ],
}

function RoseChart({ player, allPlayers, metric }: { player: PlayerStats; allPlayers: PlayerStats[]; metric: MetricKey }) {
  const stats = METRIC_STATS[metric]
  const n = stats.length
  const cx = 120, cy = 120, r = 90

  const maxVals = stats.map(s => Math.max(...allPlayers.map(p => s.getValue(p)), 0.001))
  const playerVals = stats.map((s, i) => Math.min(s.getValue(player) / maxVals[i], 1))
  const avgVals = stats.map((s, i) => {
    const avg = allPlayers.reduce((sum, p) => sum + s.getValue(p), 0) / (allPlayers.length || 1)
    return Math.min(avg / maxVals[i], 1)
  })

  const angleStep = (2 * Math.PI) / n
  const startAngle = -Math.PI / 2

  const toPoint = (val: number, idx: number) => {
    const angle = startAngle + idx * angleStep
    return { x: cx + val * r * Math.cos(angle), y: cy + val * r * Math.sin(angle) }
  }

  const playerPath = playerVals.map((v, i) => toPoint(v, i))
  const avgPath = avgVals.map((v, i) => toPoint(v, i))
  const toSvgPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <svg width="280" height="280" viewBox="-20 -20 280 280" style={{ overflow: 'visible' }}>
      {rings.map(ring => {
        const pts = stats.map((_, i) => toPoint(ring, i))
        return <polygon key={ring} points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      })}
      {stats.map((_, i) => {
        const end = toPoint(1, i)
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      })}
      <path d={toSvgPath(avgPath)} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3" />
      <path d={toSvgPath(playerPath)} fill="rgba(0,255,135,0.15)" stroke="#00FF87" strokeWidth="1.5" />
      {playerVals.map((v, i) => {
        const pt = toPoint(v, i)
        return <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#00FF87" />
      })}
      {stats.map((s, i) => {
        const angle = startAngle + i * angleStep
        const labelR = r + 36
        const lx = cx + labelR * Math.cos(angle)
        const ly = cy + labelR * Math.sin(angle)
        const val = stats[i].getValue(player)
        return (
          <g key={i}>
            <text x={lx} y={ly - 9} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="rgba(255,255,255,0.9)" fontFamily="monospace" fontWeight="700">{s.label}</text>
            <text x={lx} y={ly + 10} textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="900" fill="#00FF87" fontFamily="monospace">
              {val < 1 && val > 0 ? val.toFixed(2) : val.toFixed(1)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function PlayerModal({ player, allPlayers, metric, onClose }: { player: PlayerStats; allPlayers: PlayerStats[]; metric: MetricKey; onClose: () => void }) {
  const metricInfo = METRICS.find(m => m.key === metric)!
  const score = getScore(player, metric, allPlayers)
  const POS_COLORS: Record<string, string> = { F: '#f87171', M: '#60a5fa', D: '#facc15', G: '#c084fc' }
  const posColor = POS_COLORS[player.position] || '#fff'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0a1929', border: '1px solid rgba(0,255,135,0.25)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '560px', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '1rem', cursor: 'pointer', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.6rem', color: '#fff', letterSpacing: '0.02em' }}>{player.name}</h2>
            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, color: posColor, background: `${posColor}18`, padding: '2px 8px', borderRadius: '4px' }}>{player.position}</span>
          </div>
          <p style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{player.team} · {player.minutes_played?.toFixed(0)} min</p>
        </div>
        <div style={{ background: 'rgba(0,255,135,0.06)', border: '1px solid rgba(0,255,135,0.15)', borderRadius: '10px', padding: '14px 20px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: '2px' }}>{metric} — {metricInfo.label}</p>
            <p style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)' }}>{metricInfo.nba}</p>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2rem', color: '#00FF87' }}>
            {metric === 'OUR' ? `${score.toFixed(1)}%` : score.toFixed(1)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <RoseChart player={player} allPlayers={allPlayers} metric={metric} />
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '2px', background: '#00FF87', borderRadius: '1px' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Spieler</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '20px', height: '2px', background: 'rgba(255,255,255,0.3)', borderRadius: '1px' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Liga-Ø</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const POS_COLORS: Record<string, string> = {
  F: 'text-red-400 bg-red-400/10',
  M: 'text-blue-400 bg-blue-400/10',
  D: 'text-yellow-400 bg-yellow-400/10',
  G: 'text-purple-400 bg-purple-400/10',
}

function MetricTooltip({ m, alignRight }: { m: typeof METRICS[0]; alignRight?: boolean }) {
  return (
    <div style={{ position: 'absolute', top: '110%', left: alignRight ? 'auto' : '50%', right: alignRight ? '0' : 'auto', transform: alignRight ? 'none' : 'translateX(-50%)', width: '220px', zIndex: 9999, background: '#0a1929', border: '1px solid #00FF87', borderRadius: '8px', padding: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>
      <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, color: '#00FF87', marginBottom: '4px' }}>{m.label}</p>
      <p style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{m.desc}</p>
      <p style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>{m.nba}</p>
    </div>
  )
}

function getScore(p: PlayerStats, key: MetricKey, allPlayers: PlayerStats[]): number {
  switch (key) {
    case 'TLS': return calcTLS(p)
    case 'GTS': return calcGTS(p)
    case 'COR': return calcCOR(p)
    case 'DIS': return calcDIS(p)
    case 'PBC': return calcPBC(p)
    case 'OUR': {
      const teamPlayers = allPlayers.filter(tp => tp.team === p.team)
      return calcOffensiveUsageRate(p, teamPlayers)
    }
  }
}

function TalentLensPlusInner() {
  const searchParams = useSearchParams()
  const currentLeague = searchParams.get('league') || 'Bundesliga'

  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMetric, setActiveMetric] = useState<MetricKey>('TLS')
  const [posFilter, setPosFilter] = useState('ALL')
  const [minMinutes, setMinMinutes] = useState(900)
  const [hoveredTab, setHoveredTab] = useState<MetricKey | null>(null)
  const [hoveredCol, setHoveredCol] = useState<MetricKey | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null)

  useEffect(() => {
    setPlayers([])
    setLoading(true)
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('*, player_stats(*)')
        .eq('league', currentLeague)
      if (data) {
        const flat = data.map((p: any) => ({ ...p, ...(p.player_stats?.[0] ?? {}) }))
        setPlayers(flat)
      }
      setLoading(false)
    }
    load()
  }, [currentLeague])

  const filtered = players.filter(p =>
    (p.minutes_played || 0) >= minMinutes &&
    (posFilter === 'ALL' || p.position === posFilter)
  )

  const ranked = [...filtered]
    .map(p => ({ ...p, score: getScore(p, activeMetric, players) }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)

  const top25 = ranked.slice(0, 25)
  const maxScore = top25[0]?.score || 1
  const metric = METRICS.find(m => m.key === activeMetric)!

  return (
    <div style={{ minHeight: '100vh' }}>
      {selectedPlayer && (
        <PlayerModal player={selectedPlayer} allPlayers={filtered} metric={activeMetric} onClose={() => setSelectedPlayer(null)} />
      )}

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <p className="section-label">Modul 03</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '2.2rem', letterSpacing: '0.05em', color: '#fff' }}>
            TALENTLENS<span style={{ color: 'var(--accent-green)' }}>+</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
            NBA-inspirierte Composite Metrics — {currentLeague}
          </p>
        </div>

        {/* Metric Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px' }}>
          {METRICS.map(m => (
            <div key={m.key} style={{ position: 'relative' }}>
              <button
                onClick={() => setActiveMetric(m.key)}
                onMouseEnter={() => setHoveredTab(m.key)}
                onMouseLeave={() => setHoveredTab(null)}
                style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', borderRadius: '6px', border: 'none', cursor: 'pointer', background: activeMetric === m.key ? '#00FF87' : '#0d1f2d', color: activeMetric === m.key ? '#040A0F' : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}
              >
                {m.key}
              </button>
              {hoveredTab === m.key && <MetricTooltip m={m} alignRight={m.key === 'OUR' || m.key === 'PBC'} />}
            </div>
          ))}
        </div>

        {/* Metric Info */}
        <div className="tl-card" style={{ padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--accent-green)', letterSpacing: '0.05em' }}>{metric.label}</h2>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{metric.desc}</p>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', background: 'var(--pitch-800)', padding: '4px 12px', borderRadius: '4px' }}>{metric.nba}</span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['ALL', 'F', 'M', 'D', 'G'].map(pos => (
              <button key={pos} onClick={() => setPosFilter(pos)} style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: '0.72rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: posFilter === pos ? '#00FF87' : '#0d1f2d', color: posFilter === pos ? '#040A0F' : 'rgba(255,255,255,0.5)', fontWeight: posFilter === pos ? 700 : 400, transition: 'all 0.15s' }}>{pos}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[450, 900, 1350].map(m => (
              <button key={m} onClick={() => setMinMinutes(m)} style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: '0.72rem', borderRadius: '4px', border: 'none', cursor: 'pointer', background: minMinutes === m ? '#00FF87' : '#0d1f2d', color: minMinutes === m ? '#040A0F' : 'rgba(255,255,255,0.5)', fontWeight: minMinutes === m ? 700 : 400, transition: 'all 0.15s' }}>{m}+ min</button>
            ))}
          </div>
        </div>

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginBottom: '16px' }}>Spielernamen anklicken für detaillierte Statistiken</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>Laden...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Top 25 */}
            <div className="tl-card">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>TOP 25 — {metric.key}</p>
              </div>
              <div>
                {top25.map((p, i) => (
                  <div key={p.sofascore_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', width: '24px', textAlign: 'right', color: i === 0 ? '#00FF87' : i < 3 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)', fontWeight: i === 0 ? 700 : 400 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => setSelectedPlayer(p)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', color: '#fff', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#00FF87'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#fff'}
                        >{p.name}</button>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>{p.position}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <div style={{ flex: 1, height: '3px', background: 'var(--pitch-700)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--accent-green)', borderRadius: '2px', width: `${(p.score / maxScore) * 100}%` }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 700, width: '48px', textAlign: 'right' }}>
                          {activeMetric === 'OUR' ? `${p.score.toFixed(1)}%` : p.score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.team?.replace('FC ', '').replace('Borussia ', 'BVB ').replace('Bayer 04 ', '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Score Matrix */}
            <div className="tl-card" style={{ overflowX: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>ALLE SCORES — TOP 15</p>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Spieler</th>
                    {METRICS.map(m => (
                      <th key={m.key} style={{ position: 'relative', cursor: 'help', color: activeMetric === m.key ? '#00FF87' : undefined }}
                        onMouseEnter={() => setHoveredCol(m.key)}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        {m.key}
                        {hoveredCol === m.key && <MetricTooltip m={m} alignRight={m.key === 'OUR' || m.key === 'PBC'} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top25.slice(0, 15).map(p => (
                    <tr key={p.sofascore_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>{p.position}</span>
                          <button onClick={() => setSelectedPlayer(p)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff', fontSize: '0.75rem' }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#00FF87'}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#fff'}
                          >{p.name}</button>
                        </div>
                      </td>
                      {METRICS.map(m => {
                        const score = getScore(p, m.key, players)
                        return (
                          <td key={m.key} style={{ color: m.key === activeMetric ? '#00FF87' : 'rgba(255,255,255,0.5)', fontWeight: m.key === activeMetric ? 600 : 400 }}>
                            {m.key === 'OUR' ? `${score.toFixed(1)}%` : score.toFixed(1)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TalentLensPlus() {
  return (
    <Suspense fallback={null}>
      <TalentLensPlusInner />
    </Suspense>
  )
}
