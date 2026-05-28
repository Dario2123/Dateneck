import os
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────
# TalentLens — Supabase Setup & Import v1.1
# Nutzt direkt die Supabase REST API (kein supabase-py nötig)
# Input:  scraper/players_stats.csv
# Output: Supabase Tabellen players + player_stats
# ─────────────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL oder SUPABASE_KEY fehlt in .env!")

HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "resolution=merge-duplicates",
}


def upsert(table: str, records: list) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = requests.post(url, json=records, headers=HEADERS)
    if r.status_code not in (200, 201):
        print(f"    Fehler {r.status_code}: {r.text[:300]}")
        return False
    return True


CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS players (
    sofascore_id    BIGINT PRIMARY KEY,
    name            TEXT NOT NULL,
    team            TEXT,
    league          TEXT,
    position        TEXT,
    nationality     TEXT,
    age             INTEGER,
    height          NUMERIC,
    market_value    NUMERIC,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_stats (
    id                          SERIAL PRIMARY KEY,
    sofascore_id                BIGINT REFERENCES players(sofascore_id),
    season                      TEXT DEFAULT '25/26',
    goals                       NUMERIC,
    assists                     NUMERIC,
    goals_assists_sum           NUMERIC,
    expected_goals              NUMERIC,
    expected_assists            NUMERIC,
    big_chances_created         NUMERIC,
    big_chances_missed          NUMERIC,
    total_shots                 NUMERIC,
    shots_on_target             NUMERIC,
    shots_off_target            NUMERIC,
    shots_from_inside_box       NUMERIC,
    shots_from_outside_box      NUMERIC,
    goals_from_inside_box       NUMERIC,
    goals_from_outside_box      NUMERIC,
    accurate_passes             NUMERIC,
    total_passes                NUMERIC,
    accurate_passes_pct         NUMERIC,
    accurate_final_third_passes NUMERIC,
    key_passes                  NUMERIC,
    accurate_long_balls         NUMERIC,
    total_long_balls            NUMERIC,
    accurate_long_balls_pct     NUMERIC,
    accurate_crosses            NUMERIC,
    total_crosses               NUMERIC,
    accurate_crosses_pct        NUMERIC,
    successful_dribbles         NUMERIC,
    successful_dribbles_pct     NUMERIC,
    ground_duels_won            NUMERIC,
    ground_duels_won_pct        NUMERIC,
    aerial_duels_won            NUMERIC,
    aerial_duels_won_pct        NUMERIC,
    total_duels_won             NUMERIC,
    total_duels_won_pct         NUMERIC,
    dribbled_past               NUMERIC,
    tackles                     NUMERIC,
    tackles_won                 NUMERIC,
    tackles_won_pct             NUMERIC,
    interceptions               NUMERIC,
    clearances                  NUMERIC,
    blocked_shots               NUMERIC,
    error_lead_to_goal          NUMERIC,
    error_lead_to_shot          NUMERIC,
    possession_lost             NUMERIC,
    dispossessed                NUMERIC,
    ball_recovery               NUMERIC,
    touches                     NUMERIC,
    yellow_cards                NUMERIC,
    red_cards                   NUMERIC,
    yellow_red_cards            NUMERIC,
    fouls                       NUMERIC,
    was_fouled                  NUMERIC,
    appearances                 NUMERIC,
    matches_started             NUMERIC,
    minutes_played              NUMERIC,
    rating                      NUMERIC,
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sofascore_id, season)
);

CREATE INDEX IF NOT EXISTS idx_players_league   ON players(league);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
CREATE INDEX IF NOT EXISTS idx_stats_season     ON player_stats(season);
"""

print("=" * 60)
print("SCHRITT 1: SQL im Supabase SQL Editor ausfuehren")
print("Supabase Dashboard -> SQL Editor -> New Query -> Paste -> Run")
print("=" * 60)
print(CREATE_TABLES_SQL)
print("=" * 60)


def import_data(csv_path: str = "scraper/players_stats.csv"):
    if not os.path.exists(csv_path):
        print(f"Fehler: {csv_path} nicht gefunden!")
        return

    df = pd.read_csv(csv_path)
    print(f"\n{len(df)} Spieler geladen aus {csv_path}")

    # Players
    print("\nLade players Tabelle...")
    players_cols = ["sofascore_id", "name", "team", "league",
                    "position", "nationality", "age", "height", "market_value"]
    players_df = df[players_cols].copy()
    players_df["sofascore_id"] = players_df["sofascore_id"].astype(int)
    players_df = players_df.where(players_df.notna(), None)
    players_records = [{k: (None if (isinstance(v, float) and v != v) else v) for k, v in row.items()} for row in players_df.to_dict("records")]

    batch_size = 200
    for i in range(0, len(players_records), batch_size):
        batch = players_records[i:i+batch_size]
        if upsert("players", batch):
            print(f"  OK Players [{i+1}-{min(i+batch_size, len(players_records))}]")

    # Stats
    print("\nLade player_stats Tabelle...")
    stats_df = df[df["appearances"].notna()].copy()
    print(f"  {len(stats_df)} Spieler mit Statistiken")

    rename_map = {
        "goalsAssistsSum":             "goals_assists_sum",
        "expectedGoals":               "expected_goals",
        "expectedAssists":             "expected_assists",
        "bigChancesCreated":           "big_chances_created",
        "bigChancesMissed":            "big_chances_missed",
        "totalShots":                  "total_shots",
        "shotsOnTarget":               "shots_on_target",
        "shotsOffTarget":              "shots_off_target",
        "shotsFromInsideTheBox":       "shots_from_inside_box",
        "shotsFromOutsideTheBox":      "shots_from_outside_box",
        "goalsFromInsideTheBox":       "goals_from_inside_box",
        "goalsFromOutsideTheBox":      "goals_from_outside_box",
        "accuratePasses":              "accurate_passes",
        "totalPasses":                 "total_passes",
        "accuratePassesPercentage":    "accurate_passes_pct",
        "accurateFinalThirdPasses":    "accurate_final_third_passes",
        "keyPasses":                   "key_passes",
        "accurateLongBalls":           "accurate_long_balls",
        "totalLongBalls":              "total_long_balls",
        "accurateLongBallsPercentage": "accurate_long_balls_pct",
        "accurateCrosses":             "accurate_crosses",
        "totalCross":                  "total_crosses",
        "accurateCrossesPercentage":   "accurate_crosses_pct",
        "successfulDribbles":          "successful_dribbles",
        "successfulDribblesPercentage":"successful_dribbles_pct",
        "groundDuelsWon":              "ground_duels_won",
        "groundDuelsWonPercentage":    "ground_duels_won_pct",
        "aerialDuelsWon":              "aerial_duels_won",
        "aerialDuelsWonPercentage":    "aerial_duels_won_pct",
        "totalDuelsWon":               "total_duels_won",
        "totalDuelsWonPercentage":     "total_duels_won_pct",
        "dribbledPast":                "dribbled_past",
        "tacklesWon":                  "tackles_won",
        "tacklesWonPercentage":        "tackles_won_pct",
        "blockedShots":                "blocked_shots",
        "errorLeadToGoal":             "error_lead_to_goal",
        "errorLeadToShot":             "error_lead_to_shot",
        "possessionLost":              "possession_lost",
        "ballRecovery":                "ball_recovery",
        "yellowCards":                 "yellow_cards",
        "redCards":                    "red_cards",
        "yellowRedCards":              "yellow_red_cards",
        "wasFouled":                   "was_fouled",
        "matchesStarted":              "matches_started",
        "minutesPlayed":               "minutes_played",
    }
    direct = ["goals", "assists", "tackles", "interceptions",
              "clearances", "dispossessed", "touches", "fouls",
              "appearances", "rating"]

    stats_df = stats_df.rename(columns=rename_map)
    stats_df["season"] = "25/26"
    stats_df["sofascore_id"] = stats_df["sofascore_id"].astype(int)

    keep_cols = ["sofascore_id", "season"] + list(rename_map.values()) + direct
    keep_cols = list(dict.fromkeys(keep_cols))
    available = [c for c in keep_cols if c in stats_df.columns]
    stats_df = stats_df[available]
    stats_df = stats_df.where(stats_df.notna(), None)
    stats_records = [{k: (None if (isinstance(v, float) and v != v) else v) for k, v in row.items()} for row in stats_df.to_dict("records")]

    for i in range(0, len(stats_records), batch_size):
        batch = stats_records[i:i+batch_size]
        if upsert("player_stats", batch):
            print(f"  OK Stats [{i+1}-{min(i+batch_size, len(stats_records))}]")

    print(f"\nImport abgeschlossen!")
    print(f"  players:      {len(players_records)} Eintraege")
    print(f"  player_stats: {len(stats_records)} Eintraege")
    print(f"Dashboard: https://supabase.com/dashboard/project/oiykbthdgiwnaucypvqc/editor")


if __name__ == "__main__":
    input("\nHast du das SQL im Supabase SQL Editor ausgefuehrt? [Enter] ")
    import_data()
