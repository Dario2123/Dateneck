import requests
import pandas as pd
import time
import os
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

load_dotenv()

# ─────────────────────────────────────────────────────────────
# TalentLens — Sofascore Multi-Liga Scraper v3.0
# Quelle: Sofascore via RapidAPI
# Endpoints: tournaments/get-seasons + tournaments/get-standings
#            + teams/get-squad
# ─────────────────────────────────────────────────────────────

API_KEY  = os.getenv("RAPIDAPI_KEY")
API_HOST = os.getenv("RAPIDAPI_HOST", "sofascore.p.rapidapi.com")
BASE_URL = "https://sofascore.p.rapidapi.com"

HEADERS = {
    "x-rapidapi-key":  API_KEY,
    "x-rapidapi-host": API_HOST
}

# ─────────────────────────────────────────────────────────────
# Ziel-Ligen  (tournament_id aus sofascore.com URL, ändert sich nie)
# URL-Schema: sofascore.com/tournament/football/<land>/<slug>/<id>
# ─────────────────────────────────────────────────────────────
TARGET_LEAGUES = [
    {"name": "Bundesliga",        "tournament_id": 35},
    {"name": "2. Bundesliga",     "tournament_id": 44},
    {"name": "Premier League",    "tournament_id": 17},
    {"name": "Championship",      "tournament_id": 18},
    {"name": "La Liga",           "tournament_id": 8},
    {"name": "Serie A",           "tournament_id": 23},
    {"name": "Ligue 1",           "tournament_id": 34},
    {"name": "Eredivisie",        "tournament_id": 37},
    {"name": "Primeira Liga",     "tournament_id": 238},
    {"name": "Super Lig",         "tournament_id": 52},
]

# ─────────────────────────────────────────────────────────────
# HTTP-Session
# ─────────────────────────────────────────────────────────────
session = requests.Session()
retry = Retry(
    total=3,
    connect=3,
    read=3,
    backoff_factor=2.0,
    status_forcelist=[500, 502, 503, 504],   # 429 bewusst NICHT drin
    allowed_methods=["GET"]
)
adapter = HTTPAdapter(max_retries=retry)
session.mount("https://", adapter)
session.mount("http://",  adapter)


def api_get(endpoint, params=None):
    """Generischer GET mit manuellem exponentiellem Backoff bei 429."""
    url = f"{BASE_URL}/{endpoint}"
    for attempt in range(5):
        try:
            resp = session.get(url, headers=HEADERS, params=params, timeout=25)

            if resp.status_code == 429:
                wait = 10 * (2 ** attempt)   # 10 → 20 → 40 → 80 → 160 s
                print(f"  ⏳ Rate limit (429), warte {wait}s … (Versuch {attempt+1}/5)")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            return resp.json()

        except requests.exceptions.RequestException as e:
            print(f"  ❌ Fehler bei {endpoint}: {e}")
            return None

    print(f"  ❌ {endpoint} nach 5 Versuchen aufgegeben.")
    return None


# ─────────────────────────────────────────────────────────────
# Schritt 1: Aktuelle Season-ID ermitteln
# ─────────────────────────────────────────────────────────────
def get_current_season_id(tournament_id, league_name):
    """
    Ruft tournaments/get-seasons auf und gibt die ID der ersten (aktuellsten)
    Saison zurück.
    """
    data = api_get("tournaments/get-seasons", params={"tournamentId": tournament_id})
    time.sleep(0.5)

    if not data or "seasons" not in data:
        print(f"  ⚠️  Keine Saisons gefunden für {league_name} (ID {tournament_id})")
        return None

    seasons = data["seasons"]
    if not seasons:
        return None

    current = seasons[0]
    print(f"  📅 Aktuelle Saison: {current['name']} (ID {current['id']})")
    return current["id"]


# ─────────────────────────────────────────────────────────────
# Schritt 2: Alle Teams einer Liga holen (via Standings)
# ─────────────────────────────────────────────────────────────
def get_teams_from_standings(tournament_id, season_id, league_name):
    """
    Holt alle Teams aus tournaments/get-standings.
    Gibt Liste von {"team_id": int, "team_name": str} zurück.
    """
    data = api_get(
        "tournaments/get-standings",
        params={"tournamentId": tournament_id, "seasonId": season_id}
    )
    time.sleep(0.5)

    if not data:
        return []

    teams = []
    try:
        # Standings kann mehrere Gruppen haben (z.B. Meister-/Abstiegsrunde)
        for standings_block in data.get("standings", []):
            for row in standings_block.get("rows", []):
                team = row.get("team", {})
                team_id   = team.get("id")
                team_name = team.get("name")
                if team_id and team_name:
                    # Duplikate vermeiden
                    if not any(t["team_id"] == team_id for t in teams):
                        teams.append({
                            "team_id":   team_id,
                            "team_name": team_name
                        })
    except Exception as e:
        print(f"  ❌ Parse-Fehler in get_teams_from_standings ({league_name}): {e}")

    return teams


# ─────────────────────────────────────────────────────────────
# Schritt 3: Kader eines Teams holen
# ─────────────────────────────────────────────────────────────
def get_team_squad(team_id, team_name, league_name):
    """Holt alle Spieler eines Teams via teams/get-squad."""
    data = api_get("teams/get-squad", params={"teamId": team_id})
    if not data:
        return []

    players = []
    try:
        for item in data.get("players", []):
            p = item.get("player", {})
            players.append({
                "sofascore_id":  p.get("id"),
                "name":          p.get("name"),
                "position":      p.get("position"),
                "nationality":   p.get("country", {}).get("name"),
                "age":           p.get("age"),
                "height":        p.get("height"),
                "market_value":  p.get("proposedMarketValue"),
                "team":          team_name,
                "league":        league_name,
            })
    except Exception as e:
        print(f"  ❌ Parse-Fehler Kader {team_name}: {e}")

    return players


# ─────────────────────────────────────────────────────────────
# Haupt-Scraper
# ─────────────────────────────────────────────────────────────
def scrape_all_leagues(leagues=None):
    print("🔍 TalentLens — Sofascore Multi-Liga Scraper v3.0")
    print("=" * 60)

    if not API_KEY:
        print("❌ RAPIDAPI_KEY nicht gefunden in .env!")
        return None

    if leagues is None:
        leagues = TARGET_LEAGUES

    all_players = []
    request_count = 0

    for league in leagues:
        league_name   = league["name"]
        tournament_id = league["tournament_id"]

        print(f"\n🏆 Liga: {league_name}  (tournament_id={tournament_id})")
        print("-" * 50)

        # --- Season ermitteln ---
        season_id = get_current_season_id(tournament_id, league_name)
        request_count += 1

        if not season_id:
            print(f"  ⚠️  Überspringe {league_name} — keine Season gefunden.")
            continue

        # --- Teams holen ---
        teams = get_teams_from_standings(tournament_id, season_id, league_name)
        request_count += 1
        print(f"  🏠 {len(teams)} Teams gefunden")

        if not teams:
            print(f"  ⚠️  Keine Teams für {league_name}, überspringe.")
            continue

        # --- Kader holen ---
        for j, t in enumerate(teams, start=1):
            team_id   = t["team_id"]
            team_name = t["team_name"]
            print(f"  📋 [{j}/{len(teams)}] {team_name} (ID {team_id})")

            players = get_team_squad(team_id, team_name, league_name)
            request_count += 1
            print(f"    👥 {len(players)} Spieler")

            all_players.extend(players)
            time.sleep(0.8)   # Pause zwischen Teams

        time.sleep(2.0)   # Pause zwischen Ligen

    # ─────────────────────────────────────────────────────────
    # Ergebnis speichern
    # ─────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"📊 Gesamt-Requests: ~{request_count}")
    print(f"📊 Gesamt-Spieler:  {len(all_players)}")

    if not all_players:
        print("❌ Keine Spieler gefunden.")
        return None

    df = pd.DataFrame(all_players)

    desired_columns = [
        "sofascore_id",
        "name",
        "position",
        "nationality",
        "age",
        "height",
        "market_value",
        "team",
        "league",
    ]
    df = df.reindex(columns=desired_columns)

    # Ausgabe
    os.makedirs("scraper", exist_ok=True)
    output_file = "scraper/players_all_leagues.csv"
    df.to_csv(output_file, index=False, encoding="utf-8-sig")

    print(f"\n✅ {len(df)} Spieler gespeichert → {output_file}")
    print(f"📐 Spalten: {list(df.columns)}")

    print("\n── Vorschau (erste 10) ──────────────────────────────────")
    print(df.head(10).to_string(index=False))
    print("─" * 60)

    # Übersicht pro Liga
    print("\n── Spieler pro Liga ────────────────────────────────────")
    print(df.groupby("league")["sofascore_id"].count().to_string())

    return df


# ─────────────────────────────────────────────────────────────
# Einzelne Liga testen (ohne Rate-Limit-Risiko)
# ─────────────────────────────────────────────────────────────
def scrape_single_league(tournament_id, league_name):
    """Hilfsfunktion zum Testen einer einzelnen Liga."""
    return scrape_all_leagues(
        leagues=[{"name": league_name, "tournament_id": tournament_id}]
    )


if __name__ == "__main__":
    # ── Optionen ──────────────────────────────────────────────
    #
    # Alle 10 Ligen auf einmal (~220 Requests):
    # scrape_all_leagues()
    #
    # Nur eine Liga zum Testen (~21 Requests):
    # scrape_single_league(tournament_id=35, league_name="Bundesliga")
    scrape_all_leagues()
    # Nur bestimmte Ligen:
    # scrape_all_leagues(leagues=[
    #     {"name": "Bundesliga",     "tournament_id": 35},
    #     {"name": "Premier League", "tournament_id": 17},
    # ])
