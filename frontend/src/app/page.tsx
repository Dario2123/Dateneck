'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function HomeInner() {
  const searchParams = useSearchParams()
  const currentLeague = searchParams.get('league') || 'Bundesliga'

  return (
    <div style={{ paddingTop: '60px' }}>
      {/* Hero */}
      <div style={{ marginBottom: '64px', textAlign: 'center' }}>
        <p className="section-label" style={{ marginBottom: '16px' }}>
          Football Data Platform
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(3rem, 8vw, 6rem)',
          lineHeight: 0.9,
          letterSpacing: '-0.02em',
          color: '#fff',
          marginBottom: '24px',
        }}>
          DATEN<span style={{ color: 'var(--accent-green)' }} className="accent-glow">ECK</span>
        </h1>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.4)',
          maxWidth: '480px',
          margin: '0 auto',
          lineHeight: 1.7,
        }}>
          Scouting, Kaderanalyse & Bundesliga Squad Cycle Radar.
          Vier Module, eine Plattform.
        </p>

        {/* League pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '24px' }}>
          {['Bundesliga', '2. Bundesliga', 'Premier League', 'Championship', 'La Liga', 'Serie A', 'Ligue 1', 'Eredivisie', 'Primeira Liga', 'Super Lig'].map(l => (
            <span key={l} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: l === currentLeague ? '#00FF87' : 'rgba(255,255,255,0.25)',
              background: l === currentLeague ? 'rgba(0,255,135,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${l === currentLeague ? 'rgba(0,255,135,0.3)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '4px',
              padding: '3px 10px',
              letterSpacing: '0.05em',
            }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Module cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <ModuleCard
          href={`/raw-stats?league=${currentLeague}`}
          tag="01"
          title="RAW STATS"
          desc="Rohdaten Explorer. Sortiere nach xG, xA, Tackles, Pässen — mit automatischer Per-90-Normalisierung. Für alle 10 Ligen."
          metric="4.705 Spieler · 50+ Felder"
        />
        <ModuleCard
          href={`/moneyball?league=${currentLeague}`}
          tag="02"
          title="MONEYBALL"
          desc="Definiere dein Spielerprofil. Filtere nach Alter, Marktwert, Körpergröße und Performance-Metriken — ligaübergreifend."
          metric="Multi-Filter Scouting"
        />
        <ModuleCard
          href={`/talentlens-plus?league=${currentLeague}`}
          tag="03"
          title="TALENTLENS+"
          desc="Proprietäre Composite Metrics. Goal Threat Score, Creative Output Rating, Defensive Impact, Offensive Usage Rate — inspiriert von NBA Advanced Stats."
          metric="6 Composite Scores"
          highlight
        />
        <ModuleCard
          href="/cycle-radar"
          tag="04"
          title="CYCLE RADAR"
          desc="Bundesliga Kaderzyklen 2025/26. Scatter-Diagramm: Ø Alter vs. Ø Sofascore Note — Prime, Transition, Rebuild, Stabil."
          metric="18 Bundesliga-Vereine"
        />
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  )
}

function ModuleCard({ href, tag, title, desc, metric, highlight }: {
  href: string; tag: string; title: string; desc: string; metric: string; highlight?: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div className="tl-card" style={{
        padding: '28px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderColor: highlight ? 'rgba(0,255,135,0.2)' : 'rgba(255,255,255,0.06)',
        position: 'relative',
        overflow: 'hidden',
      }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'rgba(0,255,135,0.3)'
          el.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = highlight ? 'rgba(0,255,135,0.2)' : 'rgba(255,255,255,0.06)'
          el.style.transform = 'translateY(0)'
        }}
      >
        {highlight && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, var(--accent-green), transparent)',
          }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2rem', color: 'rgba(255,255,255,0.08)', lineHeight: 1 }}>{tag}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--accent-green)', opacity: 0.7, letterSpacing: '0.1em' }}>{metric}</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', letterSpacing: '0.05em', color: '#fff', marginBottom: '12px' }}>{title}</h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>{desc}</p>
      </div>
    </Link>
  )
}
