'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Chart, LineController, LinearScale, CategoryScale,
  PointElement, LineElement, Tooltip,
} from 'chart.js'
import { supabase } from '@/lib/supabase'

Chart.register(LineController, LinearScale, CategoryScale, PointElement, LineElement, Tooltip)

const YEARS = ['25/26', '26/27', '27/28', '28/29', '29/30']

const PHASE_COLOR: Record<string, string> = {
  prime: '#22c55e',
  transition: '#f59e0b',
  rebuild: '#ef4444',
  stable: '#3b82f6',
}
const PHASE_LABEL: Record<string, string> = {
  prime: 'Prime', transition: 'Transition', rebuild: 'Rebuild', stable: 'Stabil',
}

type PlayerData = {
  sofascore_id: number
  name: string
  age: number | null
  position: string | null
  rating: number | null
  minutes_played: number | null
}

type ClubData = {
  name: string
  players: PlayerData[]  // sorted by rating desc, up to top 8
  phase: string
  currentRating: number
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function getPhase(avgAge: number, avgRating: number, medAge: number, medRating: number): string {
  const young = avgAge <= medAge
  const good = avgRating >= medRating
  if (young && good) return 'prime'
  if (!young && good) return 'transition'
  if (young && !good) return 'rebuild'
  return 'stable'
}

// For each year 1-5: take top 5 active players (not yet departed), return avg ratings
function projectRatings(players: PlayerData[], departures: Record<number, number>): number[] {
  return [1, 2, 3, 4, 5].map(year => {
    const active = players.filter(p => {
      const dep = departures[p.sofascore_id]
      return dep === undefined || dep > year
    })
    const top5 = active.slice(0, 5)
    if (!top5.length) return 6.0
    return top5.reduce((s, p) => s + (p.rating ?? 6.5), 0) / top5.length
  })
}

export default function CycleRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [clubs, setClubs] = useState<ClubData[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [departures, setDepartures] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('sofascore_id, name, team, age, position, player_stats(rating, minutes_played)')
        .eq('league', 'Bundesliga')

      if (!data) { setLoading(false); return }

      const flat: (PlayerData & { team: string })[] = data.map((p: any) => ({
        sofascore_id: p.sofascore_id,
        name: p.name,
        team: p.team,
        age: p.age ?? null,
        position: p.position ?? null,
        rating: p.player_stats?.[0]?.rating ?? null,
        minutes_played: p.player_stats?.[0]?.minutes_played ?? null,
      }))

      const teamMap = new Map<string, (PlayerData & { team: string })[]>()
      flat.forEach(p => {
        if (!teamMap.has(p.team)) teamMap.set(p.team, [])
        teamMap.get(p.team)!.push(p)
      })

      const rawClubs: ClubData[] = []
      teamMap.forEach((players, name) => {
        // Sort by rating desc, keep top 8 as pool (top 5 active + 3 backups)
        const sorted = [...players]
          .filter(p => p.rating != null)
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, 8)
        const top5 = sorted.slice(0, 5)
        const currentRating = top5.length
          ? top5.reduce((s, p) => s + (p.rating ?? 0), 0) / top5.length
          : 6.5
        rawClubs.push({ name, players: sorted, currentRating, phase: '' })
      })

      // Classify phases
      const medAge = median(rawClubs.map(c => {
        const top5 = c.players.slice(0, 5)
        return top5.length ? top5.reduce((s, p) => s + (p.age ?? 25), 0) / top5.length : 25
      }))
      const medRating = median(rawClubs.map(c => c.currentRating))

      const finalClubs = rawClubs.map(c => {
        const top5 = c.players.slice(0, 5)
        const avgAge = top5.length ? top5.reduce((s, p) => s + (p.age ?? 25), 0) / top5.length : 25
        return { ...c, phase: getPhase(avgAge, c.currentRating, medAge, medRating) }
      }).sort((a, b) => b.currentRating - a.currentRating)

      setClubs(finalClubs)
      setSelected(finalClubs[0]?.name ?? null)
      setLoading(false)
    }
    load()
  }, [])

  // Reset departures when club changes
  useEffect(() => { setDepartures({}) }, [selected])

  // Build / rebuild chart
  useEffect(() => {
    if (!clubs.length || !canvasRef.current) return

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    const datasets = clubs.map(club => {
      const isSelected = club.name === selected
      const dep = isSelected ? departures : {}
      const ratings = projectRatings(club.players, dep)
      const color = PHASE_COLOR[club.phase] ?? '#888'

      return {
        label: club.name,
        data: ratings,
        borderColor: isSelected ? color : color + '28',
        backgroundColor: 'transparent',
        borderWidth: isSelected ? 2.5 : 1,
        pointRadius: isSelected ? 4 : 0,
        pointHoverRadius: isSelected ? 6 : 0,
        tension: 0.35,
      }
    })

    const textColor = 'rgba(232,244,253,0.45)'
    const gridColor = 'rgba(19,36,51,0.9)'

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels: YEARS, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 } },
          },
          y: {
            min: 6.2,
            max: 7.8,
            title: { display: true, text: 'Ø Note Top 5', color: textColor, font: { size: 11 } },
            grid: { color: gridColor },
            ticks: { color: textColor, callback: (v: any) => Number(v).toFixed(1), stepSize: 0.2 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item: any) => item.dataset.label === selected,
            callbacks: {
              title: (ctx: any) => ctx[0]?.dataset?.label ?? '',
              label: (ctx: any) => `Ø Note: ${ctx.parsed.y.toFixed(2)}`,
            },
            backgroundColor: '#070F17',
            borderColor: 'rgba(0,255,135,0.2)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: textColor,
            padding: 10,
          },
        },
      },
    })
  }, [clubs, selected, departures])

  // Cleanup on unmount
  useEffect(() => () => { chartRef.current?.destroy() }, [])

  const selectedClub = clubs.find(c => c.name === selected)
  const hasDepartures = Object.keys(departures).length > 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid rgba(0,255,135,0.2)', borderTopColor: 'var(--accent-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>LADE DATEN...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px' }}>
        <p className="section-label">Modul 04</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2.2rem', letterSpacing: '0.02em', color: '#fff' }}>
          CYCLE RADAR
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
          Bundesliga Kaderzyklen — 5-Jahres-Projektion · Spieler-Abgänge simulieren
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 220px', gap: '16px', alignItems: 'start' }}>

        {/* Left: Club list */}
        <div className="tl-card" style={{ padding: '8px', maxHeight: '520px', overflowY: 'auto' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', padding: '4px 8px 8px' }}>
            VEREINE
          </p>
          {clubs.map(c => (
            <button key={c.name} onClick={() => setSelected(c.name)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
              marginBottom: '2px', transition: 'all 0.12s',
              background: selected === c.name ? 'rgba(0,255,135,0.07)' : 'transparent',
              border: `1px solid ${selected === c.name ? 'rgba(0,255,135,0.2)' : 'transparent'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  color: selected === c.name ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontWeight: selected === c.name ? 600 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{c.name}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.6rem', flexShrink: 0,
                  padding: '1px 5px', borderRadius: '3px',
                  background: PHASE_COLOR[c.phase] + '18', color: PHASE_COLOR[c.phase],
                }}>{c.currentRating.toFixed(1)}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Center: Chart */}
        <div className="tl-card" style={{ padding: '20px', height: '520px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            {selectedClub && (
              <>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: '#fff' }}>
                  {selected}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.62rem', padding: '2px 7px', borderRadius: '4px',
                  background: PHASE_COLOR[selectedClub.phase] + '18',
                  color: PHASE_COLOR[selectedClub.phase],
                  border: `1px solid ${PHASE_COLOR[selectedClub.phase]}35`,
                }}>{PHASE_LABEL[selectedClub.phase]}</span>
                {hasDepartures && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#ef4444', marginLeft: 'auto' }}>
                    {Object.keys(departures).length} Abgang{Object.keys(departures).length > 1 ? 'ë' : ''} simuliert
                  </span>
                )}
              </>
            )}
          </div>
          <div style={{ height: 'calc(100% - 40px)', position: 'relative' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Right: Player departure toggles */}
        <div className="tl-card" style={{ padding: '16px', maxHeight: '520px', overflowY: 'auto' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', marginBottom: '12px' }}>
            TOP 5 · ABGANG SIMULIEREN
          </p>

          {selectedClub?.players.map((p, i) => {
            const isTop5 = i < 5
            const depYear = departures[p.sofascore_id]
            const rColor = !p.rating ? '#666'
              : p.rating >= 7.5 ? '#22c55e'
              : p.rating >= 7.0 ? '#84cc16'
              : p.rating >= 6.5 ? '#f59e0b' : '#ef4444'

            return (
              <div key={p.sofascore_id} style={{
                padding: '9px 0',
                borderBottom: i < (selectedClub.players.length - 1) ? '1px solid rgba(255,255,255,0.04)' : 'none',
                opacity: !isTop5 ? 0.45 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 600,
                    padding: '1px 5px', borderRadius: '3px', flexShrink: 0,
                    background: rColor + '18', color: rColor,
                  }}>{p.rating?.toFixed(2) ?? '—'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                      color: depYear !== undefined ? '#ef4444' : (isTop5 ? '#fff' : 'rgba(255,255,255,0.5)'),
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: depYear !== undefined ? 'line-through' : 'none',
                    }}>{p.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)' }}>
                      {p.position ?? '—'} · {p.age ?? '—'} J.
                    </div>
                  </div>
                  <button onClick={() => {
                    if (depYear !== undefined) {
                      setDepartures(d => { const n = { ...d }; delete n[p.sofascore_id]; return n })
                    } else {
                      setDepartures(d => ({ ...d, [p.sofascore_id]: 1 }))
                    }
                  }} style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.58rem', padding: '2px 7px',
                    borderRadius: '4px', cursor: 'pointer', flexShrink: 0,
                    border: `1px solid ${depYear !== undefined ? '#ef444455' : 'rgba(255,255,255,0.1)'}`,
                    background: depYear !== undefined ? 'rgba(239,68,68,0.1)' : 'transparent',
                    color: depYear !== undefined ? '#ef4444' : 'rgba(255,255,255,0.35)',
                    transition: 'all 0.12s',
                  }}>
                    {depYear !== undefined ? '✕ entf.' : '+ Abgang'}
                  </button>
                </div>

                {depYear !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', paddingLeft: '2px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'rgba(255,255,255,0.25)', marginRight: '2px' }}>Jahr:</span>
                    {[1, 2, 3, 4, 5].map(y => (
                      <button key={y} onClick={() => setDepartures(d => ({ ...d, [p.sofascore_id]: y }))} style={{
                        width: '22px', height: '22px', borderRadius: '3px', cursor: 'pointer',
                        border: `1px solid ${depYear === y ? '#ef444470' : 'rgba(255,255,255,0.08)'}`,
                        background: depYear === y ? 'rgba(239,68,68,0.15)' : 'transparent',
                        color: depYear === y ? '#ef4444' : 'rgba(255,255,255,0.35)',
                        fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                      }}>{y}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {hasDepartures && (
            <button onClick={() => setDepartures({})} style={{
              marginTop: '14px', width: '100%', padding: '6px', borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.07)', background: 'transparent',
              color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
              cursor: 'pointer', transition: 'all 0.12s',
            }}>
              Reset Simulation
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
