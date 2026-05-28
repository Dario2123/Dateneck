'use client'
import './globals.css'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'

const LEAGUES = [
  'Bundesliga',
  '2. Bundesliga',
  'Premier League',
  'Championship',
  'La Liga',
  'Serie A',
  'Ligue 1',
  'Eredivisie',
  'Primeira Liga',
  'Super Lig',
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={<div style={{ height: 56, background: 'var(--pitch-900)' }} />}>
            <Nav />
          </Suspense>
          <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

function Nav() {
  const path = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [leagueOpen, setLeagueOpen] = useState(false)

  const currentLeague = searchParams.get('league') || 'Bundesliga'

  useEffect(() => {
    async function fetchLastUpdated() {
      const { data } = await supabase
        .from('player_stats')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      if (data?.updated_at) {
        const date = new Date(data.updated_at)
        setLastUpdated(date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }))
      }
    }
    fetchLastUpdated()
  }, [])

  function selectLeague(league: string) {
    setLeagueOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    params.set('league', league)
    router.push(`${path}?${params.toString()}`)
  }

  useEffect(() => {
    if (!leagueOpen) return
    const handler = () => setLeagueOpen(false)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [leagueOpen])

  const LEAGUE_SHORT: Record<string, string> = {
    'Bundesliga': 'BL1',
    '2. Bundesliga': 'BL2',
    'Premier League': 'EPL',
    'Championship': 'EFL',
    'La Liga': 'LAL',
    'Serie A': 'SA',
    'Ligue 1': 'L1',
    'Eredivisie': 'ERE',
    'Primeira Liga': 'PRL',
    'Super Lig': 'STL',
  }

  return (
    <nav style={{
      background: 'var(--pitch-900)',
      borderBottom: '1px solid rgba(0,255,135,0.1)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      height: '56px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', marginRight: '16px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em', color: 'var(--accent-green)' }}>
          DATEN<span style={{ color: 'rgba(255,255,255,0.9)' }}>ECK</span>
        </span>
      </Link>

      {/* League Selector */}
      <div style={{ position: 'relative', marginRight: '8px' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setLeagueOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(0,255,135,0.1)',
            border: '1px solid rgba(0,255,135,0.3)',
            borderRadius: '6px',
            padding: '5px 12px',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            color: '#00FF87',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>⚽</span>
          {LEAGUE_SHORT[currentLeague] || currentLeague}
          <span style={{ fontSize: '0.5rem', opacity: 0.6, marginLeft: '2px' }}>▼</span>
        </button>

        {leagueOpen && (
          <div style={{
            position: 'absolute', top: '110%', left: 0,
            background: '#0a1929',
            border: '1px solid rgba(0,255,135,0.2)',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            zIndex: 999,
            minWidth: '180px',
          }}>
            {LEAGUES.map(league => (
              <button
                key={league}
                onClick={() => selectLeague(league)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 16px',
                  background: currentLeague === league ? 'rgba(0,255,135,0.1)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontWeight: currentLeague === league ? 700 : 500,
                  fontSize: '0.78rem',
                  letterSpacing: '0.05em',
                  color: currentLeague === league ? '#00FF87' : 'rgba(255,255,255,0.65)',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (currentLeague !== league) (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (currentLeague !== league) (e.target as HTMLElement).style.background = 'transparent' }}
              >
                {currentLeague === league && <span style={{ marginRight: '6px' }}>✓</span>}
                {league}
              </button>
            ))}
          </div>
        )}
      </div>

      <NavLink href={`/raw-stats?league=${currentLeague}`} active={path === '/raw-stats'} label="Raw Stats" />
      <NavLink href={`/moneyball?league=${currentLeague}`} active={path === '/moneyball'} label="Moneyball" />
      <NavLink href={`/talentlens-plus?league=${currentLeague}`} active={path === '/talentlens-plus'} label="TalentLens+" badge />
      <NavLink href="/cycle-radar" active={path === '/cycle-radar'} label="Cycle Radar" />
      <NavLink href="/about" active={path === '/about'} label="About" />

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em', fontWeight: 600 }}>
          4705 SPIELER · 10 LIGEN{lastUpdated ? ` · Stand ${lastUpdated}` : ''}
        </span>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }} />
      </div>
    </nav>
  )
}

function NavLink({ href, active, label, badge }: { href: string; active: boolean; label: string; badge?: boolean }) {
  return (
    <Link href={href} className={`nav-link ${active ? 'active' : ''}`} style={{ position: 'relative' }}>
      {label}
      {badge && (
        <span style={{ position: 'absolute', top: '2px', right: '2px', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 6px var(--accent-green)' }} />
      )}
    </Link>
  )
}
