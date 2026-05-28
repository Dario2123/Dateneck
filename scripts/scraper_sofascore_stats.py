import requests
import pandas as pd
import time
import os
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

load_dotenv()

# ─────────────────────────────────────────────────────────────
# TalentLens — Sofascore Stats Scraper v1.0
# Holt Saisonstatistiken pro Spieler via players/get-statistics
# Input:  scraper/players_all_leagues.csv  (aus scraper_sofascore.py)
# Output: scraper/players_stats.csv
# ─────────────────────────────────────────────────────────────

API_KEY  = os.getenv("RAPIDAPI_KEY")
API_HOST = os.getenv("RAPIDAPI_HOST", "sofascore.p.rapidapi.com")
BASE_URL = "https://sofascore.p.rapidapi.com"

HEADERS = {
    "x-rapidapi-key":  API_KEY,
    "x-rapidapi-host": API_HOST
}

# Liga → tournament_id Mapping (für get-statistics benötigt)
LEAGUE_TO_TOURNAMENT = {
    "Bundesliga":      35,
    "2. Bundesliga":   44,
    "Premier League":  17,
    "Championship":    18,
    "La Liga":          8,
    "Serie A":         23,
    "Ligue 1":         34,
    "Eredivisie":      37,
    "Primeira Liga":  238,
    "Super Lig":       52,
}

# ─────────────────────────────────────────────────────────────
# HTTP-Session mit Retry (ohne 429)
# ─────────────────────────────────────────────────────────────
session = requests.Session()
retry = Retry(
    total=3,
    connect=3,
    read=3,
    backoff_factor=2.0,
    status_forcelist=[500, 502, 503, 504],
    allowed_methods=["GET"]
)
adapter = HTTPAdapter(max_retries=retry)
session.mount("https://", adapter)
session.mount("http://",  adapter)


def api_get(endpoint: str, params: dict) -> dict | None:
    """API-Call mit manuellem 429-Handling."""
    url = f"{BASE_URL}/{endpoint}"
    wait = 10
    for attempt in range(5):
        try:
            r = session.get(url, headers=HEADERS, params=params, timeout=15)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 429:
                print(f"    ⏳ 429 Rate Limit — warte {wait}s (Versuch {attempt+1}/5)")
                time.sleep(wait)
                wait = min(wait * 2, 160)
            else:
                print(f"    ⚠️  HTTP {r.status_code} für {endpoint}")
                return None
        except Exception as e:
            print(f"    ❌ Fehler: {e}")
            return None
    print(f"    ❌ Alle Versuche gescheitert: {endpoint}")
    return None


def get_current_season_id(tournament_id: int) -> int | None:
    """Holt die aktuelle Saison-ID für ein Tournament."""
    data = api_get("tournaments/get-seasons", {"tournamentId": tournament_id})
    if not data:
        return None
    seasons = data.get("seasons", [])
    if not seasons:
        return None
    return seasons[0]["id"]


def get_player_stats(player_id: int, tournament_id: int, season_id: int) -> dict | None:
    """Holt Saisonstatistiken für einen Spieler in einer Liga."""
    data = api_get("players/get-statistics", {
        "playerId":     player_id,
        "tournamentId": tournament_id,
        "seasonId":     season_id,
        "type":         "overall"
    })
    if not data:
        return None
    return data.get("statistics")


# Alle Statistik-Felder die wir extrahieren wollen
STAT_FIELDS = [
    # Tore & Assists
    "goals", "assists", "goalsAssistsSum",
    "expectedGoals", "expectedAssists",
    "bigChancesCreated", "bigChancesMissed",
    # Schüsse
    "totalShots", "shotsOnTarget", "shotsOffTarget",
    "shotsFromInsideTheBox", "shotsFromOutsideTheBox",
    "goalsFromInsideTheBox", "goalsFromOutsideTheBox",
    # Pässe
    "accuratePasses", "totalPasses", "accuratePassesPercentage",
    "accurateFinalThirdPasses", "keyPasses",
    "accurateLongBalls", "totalLongBalls", "accurateLongBallsPercentage",
    "accurateCrosses", "totalCross", "accurateCrossesPercentage",
    # Dribbling & Duelle
    "successfulDribbles", "successfulDribblesPercentage",
    "groundDuelsWon", "groundDuelsWonPercentage",
    "aerialDuelsWon", "aerialDuelsWonPercentage",
    "totalDuelsWon", "totalDuelsWonPercentage",
    "dribbledPast",
    # Defensive
    "tackles", "tacklesWon", "tacklesWonPercentage",
    "interceptions", "clearances", "blockedShots",
    "errorLeadToGoal", "errorLeadToShot",
    # Ballbesitz
    "possessionLost", "dispossessed", "ballRecovery",
    "touches",
    # Karten & Fouls
    "yellowCards", "redCards", "yellowRedCards",
    "fouls", "wasFouled",
    # Einsatz
    "appearances", "matchesStarted", "minutesPlayed",
    "rating",
]


def scrape_stats_for_league(league_name: str, players_df: pd.DataFrame,
                             tournament_id: int, season_id: int) -> list[dict]:
    """Holt Stats für alle Spieler einer Liga."""
    league_players = players_df[players_df["league"] == league_name].copy()
    total = len(league_players)
    print(f"\n  👥 {total} Spieler in {league_name} (Saison-ID: {season_id})")

    results = []
    for i, (_, player) in enumerate(league_players.iterrows(), 1):
        pid   = int(player["sofascore_id"])
        pname = player["name"]

        stats = get_player_stats(pid, tournament_id, season_id)

        row = {
            "sofascore_id": pid,
            "name":         pname,
            "team":         player["team"],
            "league":       league_name,
            "position":     player["position"],
            "nationality":  player["nationality"],
            "age":          player.get("age"),
            "height":       player.get("height"),
            "market_value": player.get("market_value"),
        }

        if stats:
            for field in STAT_FIELDS:
                row[field] = stats.get(field)
            print(f"    ✅ [{i}/{total}] {pname} — {stats.get('appearances', 0)} Spiele, "
                  f"{stats.get('goals', 0)}G {stats.get('assists', 0)}A")
        else:
            for field in STAT_FIELDS:
                row[field] = None
            print(f"    ⚠️  [{i}/{total}] {pname} — keine Stats")

        results.append(row)
        time.sleep(0.8)

    return results


def scrape_stats(leagues: list[dict] | None = None):
    """
    Hauptfunktion. Liest players_all_leagues.csv und holt Stats.

    Parameter:
        leagues: Liste von {"name": ..., "tournament_id": ...}
                 None = alle Ligen aus LEAGUE_TO_TOURNAMENT
    """
    # CSV laden
    csv_path = "scraper/players_all_leagues.csv"
    if not os.path.exists(csv_path):
        print(f"❌ {csv_path} nicht gefunden. Erst scraper_sofascore.py ausführen!")
        return

    players_df = pd.read_csv(csv_path)
    print(f"📂 {len(players_df)} Spieler geladen aus {csv_path}")

    if leagues is None:
        leagues = [{"name": k, "tournament_id": v} for k, v in LEAGUE_TO_TOURNAMENT.items()]

    all_results = []
    total_requests = 0

    for league in leagues:
        lname = league["name"]
        tid   = league["tournament_id"]

        if lname not in players_df["league"].values:
            print(f"\n⚠️  Liga '{lname}' nicht in CSV — überspringen")
            continue

        print(f"\n{'='*60}")
        print(f"🏆 Liga: {lname}  (tournament_id={tid})")
        print(f"{'='*60}")

        # Aktuelle Saison holen
        season_id = get_current_season_id(tid)
        if not season_id:
            print(f"  ❌ Keine Saison-ID für {lname}")
            continue
        total_requests += 1

        # Stats scrapen
        n_players = len(players_df[players_df["league"] == lname])
        results = scrape_stats_for_league(lname, players_df, tid, season_id)
        all_results.extend(results)
        total_requests += n_players

        print(f"\n  ⏸️  Pause zwischen Ligen...")
        time.sleep(3.0)

    # Speichern
    if all_results:
        out_df = pd.DataFrame(all_results)
        out_path = "scraper/players_stats.csv"
        out_df.to_csv(out_path, index=False)

        print(f"\n{'='*60}")
        print(f"📊 Gesamt-Requests: ~{total_requests}")
        print(f"📊 Gesamt-Spieler:  {len(out_df)}")
        print(f"✅ Gespeichert → {out_path}")
        print(f"📐 Spalten: {list(out_df.columns)}")

        # Vorschau
        print("\n── Vorschau (erste 5, Kernfelder) ──────────────────────")
        preview_cols = ["name", "team", "league", "appearances", "minutesPlayed",
                        "goals", "assists", "totalShots", "tackles", "rating"]
        available = [c for c in preview_cols if c in out_df.columns]
        print(out_df[available].head(5).to_string(index=False))

        # Stats-Coverage
        print("\n── Coverage (Spieler mit Stats) ────────────────────────")
        covered = out_df.groupby("league")["appearances"].apply(lambda x: x.notna().sum())
        total   = out_df.groupby("league")["appearances"].count()
        print(pd.concat([covered.rename("mit_stats"), total.rename("gesamt")], axis=1))


# ─────────────────────────────────────────────────────────────
# START
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":

    # Alle 10 Ligen (~5.400 Requests, 20-40 Minuten):
    scrape_stats()
