# Dateneck

Football data platform for the Bundesliga — built with Next.js, Supabase and Sofascore data.

Live: **[dateneck.vercel.app](https://dateneck.vercel.app)**

---

## Modules

### Raw Stats
Season statistics for all players across 10 leagues — goals, assists, minutes, rating, market value.

### Moneyball
Efficiency analysis: which players deliver the most value relative to market worth.

### TalentLens+
Young talent scouting — filters by age, position, league and performance metrics.

### Cycle Radar
4-year squad projection for all 18 Bundesliga clubs. Plots the projected average rating of each team's top 5 starters over time, factoring in contract expiry dates as automatic departures. Departed slots are filled with the league average to prevent artificially inflated scores when squads thin out.

**How the score is calculated:**
```
Score (per season) = (Ø rating of active top-5 starters + league avg × departed slots) / 5
```
- "Active" = not yet departed based on contract data or manual toggle
- "Starter" = ≥ 5 appearances started in the current season
- Contract data scraped from Transfermarkt

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Charts | Chart.js |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Data source | Sofascore via RapidAPI |
| Contract data | Transfermarkt (scraped) |

---

## Data

**10 leagues:** Bundesliga, 2. Bundesliga, Premier League, Championship, La Liga, Serie A, Ligue 1, Eredivisie, Primeira Liga, Super Lig

**~5,500 players** with stats and contract data in Supabase.

---

## Local setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Requires `frontend/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Scripts (Python)

```bash
cd scripts
pip install requests pandas python-dotenv beautifulsoup4
```

Requires `scripts/.env`:
```
SUPABASE_URL=...
SUPABASE_KEY=...         # service role key
RAPIDAPI_KEY=...
```

**Scrapers:**
```bash
python scraper_sofascore.py        # player data → players table
python scraper_sofascore_stats.py  # season stats → player_stats table
python scraper_contracts.py        # contract dates from Transfermarkt
```

---

## Database schema

```sql
players (
  sofascore_id   BIGINT PRIMARY KEY,
  name           TEXT,
  team           TEXT,
  league         TEXT,
  position       TEXT,
  nationality    TEXT,
  age            INT,
  height         NUMERIC,
  market_value   NUMERIC,
  contract_until DATE,
  updated_at     TIMESTAMPTZ
)

player_stats (
  sofascore_id   BIGINT REFERENCES players,
  rating         NUMERIC,
  minutes_played INT,
  matches_started INT,
  goals          INT,
  assists        INT,
  -- ... further Sofascore stat fields
)

clubs (
  id             SERIAL PRIMARY KEY,
  name           TEXT,
  league         TEXT
)
```
