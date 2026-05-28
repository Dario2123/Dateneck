export default function About() {
  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px', maxWidth: '800px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '48px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>ABOUT</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '3rem', letterSpacing: '0.02em', color: '#fff', lineHeight: 1 }}>
          DATEN<span style={{ color: '#00FF87' }}>ECK</span>
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '12px' }}>
          Football Data Platform — Scouting, Analytics & Kaderzyklen
        </p>
      </div>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em', color: '#00FF87', marginBottom: '16px' }}>
          WAS IST DATENECK?
        </h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
          DATENECK vereint zwei Fußball-Datenprojekte unter einer Plattform. TalentLens — ein datengetriebenes Scouting-Tool inspiriert von NBA Advanced Metrics — und Cycle Radar, eine visuelle Analyse der Bundesliga-Kaderzyklen nach Alter und Sofascore-Rating.
        </p>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em', color: '#00FF87', marginBottom: '16px' }}>
          DIE MODULE
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { title: 'RAW STATS EXPLORER', desc: 'Vollständige Rohdaten aller Spieler. Sortierbar nach 50+ Metriken mit automatischer Per-90-Normalisierung.' },
            { title: 'MONEYBALL SCOUT', desc: 'Definiere dein Wunschprofil und filtere gleichzeitig nach Alter, Marktwert, xG/90, Tackles/90 und mehr — für smarte Transfers.' },
            { title: 'TALENTLENS+', desc: 'Proprietäre Composite Metrics inspiriert von NBA Advanced Stats: Goal Threat Score, Creative Output Rating, Defensive Impact Score, Progressive Ball Carrier, Offensive Usage Rate.' },
            { title: 'CYCLE RADAR', desc: 'Bundesliga Kaderzyklen 2025/26. Scatter-Diagramm mit Ø Alter (X) vs. Ø Sofascore Note (Y). Median-Split klassifiziert jeden Verein als Prime, Transition, Rebuild oder Stabil.' },
          ].map(m => (
            <div key={m.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '20px' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em', color: '#fff', marginBottom: '8px' }}>{m.title}</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em', color: '#00FF87', marginBottom: '16px' }}>
          TECH STACK
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            ['Frontend', 'Next.js 15, React, TailwindCSS'],
            ['Datenbank', 'Supabase (PostgreSQL)'],
            ['Scraping', 'Python, RapidAPI (Sofascore)'],
            ['Hosting', 'Vercel'],
            ['Scouting-Daten', '10 Ligen · 4.705 Spieler · 50+ Metriken'],
            ['Cycle Radar', 'Chart.js Scatter · Bundesliga 25/26'],
          ].map(([label, value]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>{label.toUpperCase()}</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em', color: '#00FF87', marginBottom: '16px' }}>
          ROADMAP
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { done: true,  text: 'Scraper: 10 Ligen, 5.378 Spieler' },
            { done: true,  text: 'Statistiken: 50+ Felder via Sofascore API' },
            { done: true,  text: 'Raw Stats Explorer mit Per-90-Toggle' },
            { done: true,  text: 'Moneyball Scout mit Multi-Filter' },
            { done: true,  text: 'TalentLens+ Composite Metrics' },
            { done: true,  text: 'Cycle Radar: Bundesliga Kaderzyklen' },
            { done: false, text: 'Spielerprofil-Seite mit Radar Chart' },
            { done: false, text: 'Ligaübergreifende Vergleiche' },
            { done: false, text: 'Cycle Radar für weitere Ligen' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: item.done ? '#00FF87' : 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{item.done ? '✓' : '○'}</span>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: item.done ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)' }}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
