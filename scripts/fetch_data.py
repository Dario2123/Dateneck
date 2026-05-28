"""
Bundesliga Squad Cycle Radar - Transfermarkt Data Fetcher v3
Zieht Kaderdaten + Leistungsdaten (Minuten, Note) für alle 18 Bundesligisten.

Fixes v3:
- Vertragsende: nur td.zentriert mit Jahreszahl 2025-2030, kein volles Datum
- Leistungsdaten: korrekte URL mit saison_id
- Noten-Parser: robusteres Regex für Format "7,50"
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import unicodedata
import difflib

# Load API key from .env
def _load_env():
    env = {}
    try:
        with open(".env") as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    except Exception:
        pass
    return env

_ENV = _load_env()
SOFASCORE_KEY = _ENV.get("SOFASCORE_API_KEY", "")
SOFASCORE_HEADERS = {
    "x-rapidapi-key": SOFASCORE_KEY,
    "x-rapidapi-host": "sofascore.p.rapidapi.com",
}
SS_TOURNAMENT_ID = 35
SS_SEASON_ID = 77333  # Bundesliga 25/26

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.transfermarkt.de/",
}

CLUBS = [
    {"name": "FC Bayern München",        "tm_id": 27,    "tm_slug": "fc-bayern-munchen",        "ss_id": 2672},
    {"name": "Borussia Dortmund",        "tm_id": 16,    "tm_slug": "borussia-dortmund",        "ss_id": 2673},
    {"name": "RB Leipzig",               "tm_id": 23826, "tm_slug": "rasenballsport-leipzig",   "ss_id": 36360},
    {"name": "VfB Stuttgart",            "tm_id": 79,    "tm_slug": "vfb-stuttgart",            "ss_id": 2677},
    {"name": "TSG Hoffenheim",           "tm_id": 533,   "tm_slug": "tsg-1899-hoffenheim",      "ss_id": 2569},
    {"name": "Bayer 04 Leverkusen",      "tm_id": 15,    "tm_slug": "bayer-04-leverkusen",      "ss_id": 2681},
    {"name": "Eintracht Frankfurt",      "tm_id": 24,    "tm_slug": "eintracht-frankfurt",      "ss_id": 2674},
    {"name": "SC Freiburg",              "tm_id": 60,    "tm_slug": "sc-freiburg",              "ss_id": 2538},
    {"name": "1. FC Union Berlin",       "tm_id": 89,    "tm_slug": "1-fc-union-berlin",        "ss_id": 2547},
    {"name": "1. FC Köln",               "tm_id": 3,     "tm_slug": "1-fc-koeln",               "ss_id": 2671},
    {"name": "Borussia Mönchengladbach", "tm_id": 18,    "tm_slug": "borussia-monchengladbach", "ss_id": 2527},
    {"name": "VfL Wolfsburg",            "tm_id": 82,    "tm_slug": "vfl-wolfsburg",            "ss_id": 2524},
    {"name": "Werder Bremen",            "tm_id": 86,    "tm_slug": "werder-bremen",            "ss_id": 2534},
    {"name": "Hamburger SV",             "tm_id": 41,    "tm_slug": "hamburger-sv",             "ss_id": 2676},
    {"name": "FC Augsburg",              "tm_id": 167,   "tm_slug": "fc-augsburg",              "ss_id": 2600},
    {"name": "1. FC Heidenheim",         "tm_id": 2036,  "tm_slug": "1-fc-heidenheim-1846",    "ss_id": 5885},
    {"name": "1. FSV Mainz 05",          "tm_id": 39,    "tm_slug": "1-fsv-mainz-05",           "ss_id": 2556},
    {"name": "FC St. Pauli",             "tm_id": 35,    "tm_slug": "fc-st-pauli",              "ss_id": 2526},
]

def parse_market_value(text):
    text = text.strip().replace("\xa0", "").replace(" ", "")
    try:
        if "Mio" in text:
            return float(text.replace("Mio.€", "").replace(",", "."))
        elif "Tsd" in text:
            return float(text.replace("Tsd.€", "").replace(",", ".")) / 1000
    except:
        pass
    return 0.0

def fetch_squad(club):
    url = f"https://www.transfermarkt.de/{club['tm_slug']}/kader/verein/{club['tm_id']}/saison_id/2025/plus/1"
    print(f"  [{club['name']}] Kader...", end=" ")
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            print(f"Status {r.status_code}")
            return []
        players = parse_squad(r.text)
        print(f"{len(players)} Spieler")
        return players
    except Exception as e:
        print(f"Fehler: {e}")
        return []

def parse_squad(html):
    soup = BeautifulSoup(html, "html.parser")
    players = []
    rows = soup.select("table.items tbody tr:not(.spacer):not(.bg_Ueberschrift)")
    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 5:
            continue

        name_tag = row.select_one("td.hauptlink a")
        if not name_tag:
            continue
        name = name_tag.text.strip()

        pos_tag = row.select_one("td.posrela table tr:last-child td")
        position = pos_tag.text.strip() if pos_tag else ""

        # Alter aus td mit Format "DD.MM.YYYY (Alter)"
        dob, age = "", None
        for td in cols:
            text = td.text.strip()
            m = re.match(r'\d{2}\.\d{2}\.\d{4}\s*\((\d+)\)', text)
            if m:
                dob = text.split("(")[0].strip()
                age = int(m.group(1))
                break

        # Vertragsende: td.zentriert das NUR eine Jahreszahl enthält (kein volles Datum)
        # Format auf TM Kader-Seite: "Jun 2027" oder "2027" – NICHT "30.06.2027"
        contract_end = ""
        contract_year = None
        for td in cols:
            classes = td.get("class", [])
            text = td.text.strip()
            if "zentriert" in classes:
                # Nur kurze Einträge ohne DD.MM. Muster
                if re.search(r'\d{2}\.\d{2}', text):
                    continue  # Transferdatum, kein Vertragsende
                m = re.search(r'\b(202[5-9]|203\d)\b', text)
                if m:
                    contract_end = text
                    contract_year = int(m.group(1))
                    break

        market_value_str = ""
        market_value_num = 0.0
        mv_tag = row.select_one("td.rechts.hauptlink")
        if mv_tag:
            market_value_str = mv_tag.text.strip()
            market_value_num = parse_market_value(market_value_str)

        if name:
            players.append({
                "name": name,
                "position": position,
                "age": age,
                "dob": dob,
                "contract_end": contract_end,
                "contract_year": contract_year,
                "market_value": market_value_str,
                "market_value_num": market_value_num,
                "minutes": None,
                "rating": None,
                "importance_score": 0,
            })
    return players

def fetch_performance(club, players):
    # Korrekte URL für Leistungsdaten Saison 2025/26
    url = f"https://www.transfermarkt.de/{club['tm_slug']}/leistungsdaten/verein/{club['tm_id']}/saison_id/2025/plus/1"
    print(f"  [{club['name']}] Leistungsdaten...", end=" ")
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            print(f"Status {r.status_code}")
            return players
        result = merge_performance(r.text, players)
        rated = sum(1 for p in result if p["rating"])
        print(f"{rated} benotet")
        return result
    except Exception as e:
        print(f"Fehler: {e}")
        return players

def merge_performance(html, players):
    soup = BeautifulSoup(html, "html.parser")
    player_index = {p["name"]: p for p in players}

    rows = soup.select("table.items tbody tr:not(.spacer):not(.bg_Ueberschrift)")
    for row in rows:
        name_tag = row.select_one("td.hauptlink a")
        if not name_tag:
            continue
        name = name_tag.text.strip()
        if name not in player_index:
            continue

        cols = row.find_all("td")
        minutes = None
        rating = None

        for td in cols:
            raw = td.text.strip()
            classes = td.get("class", [])

            # Minuten: Zahl mit optionalem Apostroph, z.B. "1.350'" oder "890'"
            if re.match(r"^[\d\.]+\'$", raw):
                try:
                    minutes = int(raw.replace("'", "").replace(".", ""))
                except:
                    pass

            # Note: Format "7,50" oder "6,84" – immer Komma, zwischen 1,00 und 10,00
            if re.match(r'^\d[,\.]\d{2}$', raw):
                try:
                    val = float(raw.replace(",", "."))
                    if 1.0 <= val <= 10.0:
                        rating = val
                except:
                    pass

        if minutes is not None:
            player_index[name]["minutes"] = minutes
        if rating is not None:
            player_index[name]["rating"] = rating

    return players

def _norm(name):
    """Lowercase + strip accents for fuzzy name matching."""
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()

def fetch_sofascore_ratings(club):
    url = (
        f"https://sofascore.p.rapidapi.com/teams/get-player-statistics"
        f"?teamId={club['ss_id']}&tournamentId={SS_TOURNAMENT_ID}&seasonId={SS_SEASON_ID}"
    )
    print(f"  [{club['name']}] Sofascore...", end=" ")
    try:
        r = requests.get(url, headers=SOFASCORE_HEADERS, timeout=15)
        if r.status_code != 200:
            print(f"Status {r.status_code}")
            return {}
        rated = r.json().get("topPlayers", {}).get("rating", [])
        result = {p["player"]["name"]: round(p["statistics"]["rating"], 2) for p in rated}
        print(f"{len(result)} benotet")
        return result
    except Exception as e:
        print(f"Fehler: {e}")
        return {}

def merge_sofascore_ratings(players, ss_ratings):
    if not ss_ratings:
        return players
    ss_norm = {_norm(k): v for k, v in ss_ratings.items()}
    ss_keys = list(ss_norm.keys())
    for player in players:
        key = _norm(player["name"])
        if key in ss_norm:
            player["rating"] = ss_norm[key]
            continue
        # Try reversed name order (e.g. "Min-jae Kim" <-> "Kim Min-jae")
        parts = key.split()
        reversed_key = " ".join(parts[1:] + parts[:1]) if len(parts) > 1 else key
        if reversed_key in ss_norm:
            player["rating"] = ss_norm[reversed_key]
            continue
        # Fuzzy fallback
        matches = difflib.get_close_matches(key, ss_keys, n=1, cutoff=0.82)
        if matches:
            player["rating"] = ss_norm[matches[0]]
    return players


def calc_importance_score(player):
    """
    Score = Marktwert (Mio€) × (Minuten/90) × (1 / (11 - Note))
    Note-Skala TM: höher = besser (7.5 gut, 5.5 schlecht)
    Fallback wenn Daten fehlen: nur Marktwert
    """
    mv = player.get("market_value_num", 0) or 0
    minutes = player.get("minutes")
    rating = player.get("rating")

    if minutes and rating and rating < 11:
        appearances = minutes / 90
        rating_factor = 1 / (11 - rating)
        return round(mv * appearances * rating_factor, 2)
    elif minutes:
        return round(mv * (minutes / 90), 2)
    else:
        return mv

def calc_avg_age(players):
    ages = [p["age"] for p in players if p["age"]]
    return round(sum(ages) / len(ages), 1) if ages else None

def count_expiring(players, year):
    return sum(1 for p in players if p.get("contract_year") == year)

def get_top_players(players, n=8):
    scored = sorted(players, key=lambda p: p["importance_score"], reverse=True)
    result = []
    for p in scored[:n]:
        result.append({
            "name": p["name"],
            "position": p["position"],
            "age": p["age"],
            "contract_end": p["contract_end"],
            "contract_year": p["contract_year"],
            "market_value": p["market_value"],
            "minutes": p["minutes"],
            "rating": p["rating"],
            "importance_score": p["importance_score"],
        })
    return result

def main():
    print("=== Transfermarkt Data Fetcher v3 ===\n")
    result = []

    for club in CLUBS:
        players = fetch_squad(club)
        time.sleep(1.5)
        players = fetch_performance(club, players)
        time.sleep(1.5)
        ss_ratings = fetch_sofascore_ratings(club)
        players = merge_sofascore_ratings(players, ss_ratings)
        time.sleep(1.0)

        for p in players:
            p["importance_score"] = calc_importance_score(p)

        avg_age = calc_avg_age(players)
        exp26 = count_expiring(players, 2026)
        exp27 = count_expiring(players, 2027)
        exp28 = count_expiring(players, 2028)
        top = get_top_players(players)

        entry = {
            "name": club["name"],
            "tm_id": club["tm_id"],
            "avg_age": avg_age,
            "expiring_2026": exp26,
            "expiring_2027": exp27,
            "expiring_2028_plus": exp28,
            "top_players": top,
            "players": players,
        }
        result.append(entry)

        print(f"  -> Ø {avg_age} J. | Verträge: {exp26}×26 / {exp27}×27 / {exp28}×28+")
        top3 = ", ".join(f"{p['name']} ({p['rating'] or '?'})" for p in top[:3])
        print(f"     Top 3: {top3}")
        print()

    with open("src/data/clubs_raw.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    total = sum(len(c["players"]) for c in result)
    rated = sum(sum(1 for p in c["players"] if p["rating"]) for c in result)
    print(f"Fertig! 18 Vereine, {total} Spieler, {rated} benotet.")

if __name__ == "__main__":
    main()
