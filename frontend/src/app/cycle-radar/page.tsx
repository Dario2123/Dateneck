'use client'
import { useEffect, useRef, useState } from 'react'
import { Chart, ScatterController, LinearScale, PointElement, Tooltip, Legend } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

Chart.register(ScatterController, LinearScale, PointElement, Tooltip, Legend, ChartDataLabels)

const SHORT: Record<number, string> = {
  27: 'Bayern',      16: 'Dortmund',  23826: 'Leipzig',   79: 'Stuttgart',
  533: 'Hoffenheim', 15: 'Leverkusen', 24: 'Frankfurt',   60: 'Freiburg',
  89: 'Union',        3: 'Köln',       18: 'Gladbach',    82: 'Wolfsburg',
  86: 'Bremen',      41: 'Hamburg',   167: 'Augsburg',  2036: 'Heidenheim',
  39: 'Mainz',       35: 'St. Pauli',
}

const PHASE_COLOR: Record<string, string> = {
  prime: '#22c55e',
  transition: '#f59e0b',
  rebuild: '#ef4444',
  stable: '#3b82f6',
}

const PHASE_LABEL: Record<string, string> = {
  prime: 'Prime',
  transition: 'Transition',
  rebuild: 'Rebuild',
  stable: 'Stabil',
}

type Player = { name: string; position?: string; age?: number; minutes?: number; rating?: number | null; market_value?: string }
type Club = { tm_id: number; name: string; avg_age: number; top_players: Player[]; short?: string; avgRating?: number | null; phase?: string }

function topAvgRating(club: Club): number | null {
  const rated = club.top_players.filter(p => p.rating).slice(0, 8)
  return rated.length ? rated.reduce((s, p) => s + (p.rating as number), 0) / rated.length : null
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function phase(avgAge: number, avgRating: number | null, medAge: number, medRating: number): string {
  const y = avgAge <= medAge
  const g = (avgRating ?? 6.5) >= medRating
  if (y && g) return 'prime'
  if (!y && g) return 'transition'
  if (y && !g) return 'rebuild'
  return 'stable'
}

function fmt(r: number | null | undefined): string { return r != null ? r.toFixed(2) : '—' }
function fmtMin(m?: number): string { return m ? (m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + 'k' : m + "'") : '—' }
function rCls(r?: number | null): string { return !r ? 'r-none' : r >= 7.5 ? 'r-great' : r >= 7.0 ? 'r-good' : r >= 6.5 ? 'r-avg' : 'r-low' }

export default function CycleRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [clubs, setClubs] = useState<Club[]>([])
  const [activePhase, setActivePhase] = useState('all')
  const [activeTab, setActiveTab] = useState<'chart' | 'data'>('chart')
  const [modal, setModal] = useState<Club | null>(null)
  const [medAge, setMedAge] = useState(0)
  const [medRating, setMedRating] = useState(0)

  // Load data
  useEffect(() => {
    fetch('/data/clubs_raw.json')
      .then(r => r.json())
      .then((raw: Club[]) => {
        const processed = raw.map(c => ({ ...c, short: SHORT[c.tm_id] || c.name, avgRating: topAvgRating(c) }))
        const mAge = median(processed.map(c => c.avg_age))
        const mRating = median(processed.map(c => c.avgRating ?? 6.5))
        const all = processed.map(c => ({ ...c, phase: phase(c.avg_age, c.avgRating ?? null, mAge, mRating) }))
        setMedAge(mAge)
        setMedRating(mRating)
        setClubs(all)
      })
  }, [])

  // Build chart
  useEffect(() => {
    if (!clubs.length || !canvasRef.current || activeTab !== 'chart') return

    const show = activePhase === 'all' ? clubs : clubs.filter(c => c.phase === activePhase)
    const dimmed = activePhase !== 'all' ? clubs.filter(c => c.phase !== activePhase) : []

    const datasets: any[] = []

    if (dimmed.length) {
      datasets.push({
        label: '__dimmed__',
        data: dimmed.map(c => ({ x: c.avg_age, y: c.avgRating ?? 6.5 })),
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1, pointRadius: 7, pointHoverRadius: 7,
      })
    }

    const phases = Array.from(new Set(show.map(c => c.phase!)))
    phases.forEach(ph => {
      datasets.push({
        label: PHASE_LABEL[ph],
        data: show.filter(c => c.phase === ph).map(c => ({ x: c.avg_age, y: c.avgRating ?? 6.5, club: c })),
        backgroundColor: PHASE_COLOR[ph] + '30',
        borderColor: PHASE_COLOR[ph],
        borderWidth: 2,
        pointRadius: 9,
        pointHoverRadius: 12,
        pointStyle: 'circle',
      })
    })

    const textColor = 'rgba(232,244,253,0.5)'
    const gridColor = 'rgba(19,36,51,0.8)'

    const quadrantPlugin = {
      id: 'quadrant',
      beforeDraw({ ctx, chartArea: { left, right, top, bottom }, scales }: any) {
        const xM = scales.x.getPixelForValue(medAge)
        const yM = scales.y.getPixelForValue(medRating)
        ctx.save()
        ctx.strokeStyle = 'rgba(0,255,135,0.15)'
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(xM, top); ctx.lineTo(xM, bottom); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(left, yM); ctx.lineTo(right, yM); ctx.stroke()
        ctx.font = "700 10px 'Barlow Condensed', sans-serif"
        ctx.globalAlpha = 0.4
        const p = 8
        ctx.fillStyle = PHASE_COLOR.rebuild;    ctx.fillText('REBUILD',    left + p, bottom - p)
        ctx.fillStyle = PHASE_COLOR.prime;      ctx.fillText('PRIME',      left + p, top + p + 12)
        ctx.fillStyle = PHASE_COLOR.stable;     ctx.fillText('STABIL',     xM + p,   bottom - p)
        ctx.fillStyle = PHASE_COLOR.transition; ctx.fillText('TRANSITION', xM + p,   top + p + 12)
        ctx.restore()
      },
    }

    if (chartRef.current) {
      chartRef.current.data.datasets = datasets
      chartRef.current.update()
      return
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Ø Alter', color: textColor, font: { size: 12 } },
            min: 22, max: 30,
            grid: { color: gridColor },
            ticks: { color: textColor, stepSize: 1 },
          },
          y: {
            type: 'linear',
            title: { display: true, text: 'Ø Sofascore Note', color: textColor, font: { size: 12 } },
            min: 6.3, max: 7.8,
            grid: { color: gridColor },
            ticks: { color: textColor, callback: (v: any) => Number(v).toFixed(1) },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: textColor,
              font: { size: 12 },
              filter: (i: any) => i.text !== '__dimmed__',
              padding: 20,
              usePointStyle: true,
            },
          },
          tooltip: {
            filter: (i: any) => !!i.raw.club,
            callbacks: {
              title: (ctx: any) => ctx[0]?.raw?.club?.name ?? '',
              label: (ctx: any) => {
                const c = ctx.raw.club as Club
                const top3 = c.top_players.slice(0, 3).map(p => `${p.name.split(' ').pop()} ${fmt(p.rating)}`).join('  ·  ')
                return [`Ø Alter ${c.avg_age}  ·  Ø Note ${fmt(c.avgRating)}`, top3]
              },
            },
            backgroundColor: '#070F17',
            borderColor: 'rgba(0,255,135,0.2)',
            borderWidth: 1,
            titleColor: '#fff',
            bodyColor: textColor,
            padding: 12,
            titleFont: { size: 13, weight: 'bold' as const },
          },
          datalabels: {
            display: (ctx: any) => !!ctx.dataset.data[ctx.dataIndex]?.club,
            formatter: (val: any) => val.club?.short ?? '',
            color: (ctx: any) => PHASE_COLOR[ctx.dataset.data[ctx.dataIndex]?.club?.phase] ?? textColor,
            font: { size: 11, weight: '600' },
            anchor: 'end',
            align: 'top',
            offset: 4,
          } as any,
        },
      },
      plugins: [ChartDataLabels as any, quadrantPlugin],
    })

    canvasRef.current.addEventListener('click', (e) => {
      if (!chartRef.current) return
      const pts = chartRef.current.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false)
      if (!pts.length) return
      const club = (chartRef.current.data.datasets[pts[0].datasetIndex]?.data[pts[0].index] as any)?.club
      if (club) setModal(club)
    })
  }, [clubs, activePhase, activeTab, medAge, medRating])

  // Cleanup chart on tab switch away
  useEffect(() => {
    if (activeTab !== 'chart' && chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }
  }, [activeTab])

  const counts: Record<string, number> = { all: clubs.length }
  clubs.forEach(c => { if (c.phase) counts[c.phase] = (counts[c.phase] || 0) + 1 })

  const visibleClubs = activePhase === 'all' ? clubs : clubs.filter(c => c.phase === activePhase)
  const sortedClubs = [...visibleClubs].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <p className="section-label">Modul 04</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2.2rem', letterSpacing: '0.02em', color: '#fff' }}>
          CYCLE RADAR
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
          Bundesliga Kaderzyklen 2025/26 — Alter, Leistung & strategischer Ausblick
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
        {(['chart', 'data'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '6px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em',
            background: activeTab === tab ? 'var(--pitch-800)' : 'transparent',
            color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.4)',
            boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
            transition: 'all 0.15s',
          }}>
            {tab === 'chart' ? 'DIAGRAMM' : 'VEREINE'}
          </button>
        ))}
      </div>

      {/* Phase filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {['all', 'prime', 'transition', 'rebuild', 'stable'].filter(p => counts[p]).map(p => (
          <button key={p} onClick={() => setActivePhase(p)} style={{
            padding: '5px 14px', borderRadius: '20px', border: `1px solid ${activePhase === p ? 'rgba(0,255,135,0.5)' : 'rgba(255,255,255,0.1)'}`,
            background: activePhase === p ? 'rgba(0,255,135,0.1)' : 'transparent',
            color: activePhase === p ? '#00FF87' : 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-mono)', fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {p === 'all' ? 'Alle' : PHASE_LABEL[p]} ({counts[p]})
          </button>
        ))}
      </div>

      {/* Chart tab */}
      {activeTab === 'chart' && (
        <div className="tl-card" style={{ padding: '20px', height: '520px', position: 'relative' }}>
          {!clubs.length ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '32px', height: '32px', border: '2px solid rgba(0,255,135,0.2)', borderTopColor: 'var(--accent-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>LADE DATEN...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <canvas ref={canvasRef} />
          )}
        </div>
      )}

      {/* Data tab */}
      {activeTab === 'data' && (
        <div className="tl-card" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Verein</th>
                <th>Phase</th>
                <th style={{ textAlign: 'center' }}>Ø Alter</th>
                <th style={{ textAlign: 'center' }}>Ø Note</th>
                <th style={{ textAlign: 'center' }}>Benotet</th>
                <th>Top-Spieler</th>
              </tr>
            </thead>
            <tbody>
              {sortedClubs.map(c => (
                <tr key={c.tm_id} style={{ cursor: 'pointer' }} onClick={() => setModal(c)}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(0,255,135,0.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                >
                  <td style={{ fontWeight: 500, color: '#fff' }}>{c.name}</td>
                  <td>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600,
                      padding: '2px 8px', borderRadius: '4px',
                      background: PHASE_COLOR[c.phase!] + '18',
                      color: PHASE_COLOR[c.phase!],
                      border: `1px solid ${PHASE_COLOR[c.phase!]}40`,
                    }}>
                      {PHASE_LABEL[c.phase!]}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>{c.avg_age}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
                      background: (c.avgRating ?? 0) >= 7.5 ? 'rgba(34,197,94,0.15)' : (c.avgRating ?? 0) >= 7.0 ? 'rgba(132,204,22,0.15)' : (c.avgRating ?? 0) >= 6.5 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                      color: (c.avgRating ?? 0) >= 7.5 ? '#22c55e' : (c.avgRating ?? 0) >= 7.0 ? '#84cc16' : (c.avgRating ?? 0) >= 6.5 ? '#f59e0b' : '#ef4444',
                    }}>{fmt(c.avgRating)}</span>
                  </td>
                  <td style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>{c.top_players.filter(p => p.rating).length}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {c.top_players.slice(0, 3).map((p, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.rating ? ((p.rating >= 7.5 ? '#22c55e' : p.rating >= 7.0 ? '#84cc16' : p.rating >= 6.5 ? '#f59e0b' : '#ef4444')) : 'rgba(255,255,255,0.2)', flexShrink: 0, display: 'inline-block' }} />
                          {p.name.split(' ').pop()} <span style={{ color: 'rgba(255,255,255,0.25)' }}>{fmt(p.rating)}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px', backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#070F17', border: '1px solid rgba(0,255,135,0.2)', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '88vh', overflowY: 'auto', position: 'relative', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
            <button onClick={() => setModal(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: '1rem' }}>✕</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingRight: '32px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color: '#fff' }}>{modal.name}</h2>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: PHASE_COLOR[modal.phase!] + '18', color: PHASE_COLOR[modal.phase!], border: `1px solid ${PHASE_COLOR[modal.phase!]}40` }}>{PHASE_LABEL[modal.phase!]}</span>
            </div>

            <div style={{ display: 'flex', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
              {[['Ø Alter', String(modal.avg_age)], ['Ø Note Top 8', fmt(modal.avgRating)], ['Benotet', String(modal.top_players.filter(p => p.rating).length)]].map(([label, val]) => (
                <div key={label} style={{ flex: 1, padding: '12px', borderRight: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', color: '#fff', lineHeight: 1.2 }}>{val}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{label}</div>
                </div>
              ))}
            </div>

            <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: '12px' }}>SCHLÜSSELSPIELER NACH WICHTIGKEIT</p>

            <div>
              {modal.top_players.slice(0, 8).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap', background: (p.rating ?? 0) >= 7.5 ? 'rgba(34,197,94,0.15)' : (p.rating ?? 0) >= 7.0 ? 'rgba(132,204,22,0.15)' : (p.rating ?? 0) >= 6.5 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: (p.rating ?? 0) >= 7.5 ? '#22c55e' : (p.rating ?? 0) >= 7.0 ? '#84cc16' : (p.rating ?? 0) >= 6.5 ? '#f59e0b' : '#ef4444' }}>{fmt(p.rating)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 500, color: '#fff' }}>{p.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>{p.position || '—'} · {p.age || '—'} J. · {fmtMin(p.minutes)} Min.</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{p.market_value || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
