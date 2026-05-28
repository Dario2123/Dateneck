import sys
import re
import time
import os
import unicodedata
import difflib
import requests
from datetime import datetime
from dotenv import load_dotenv
from bs4 import BeautifulSoup

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

SB_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
}

TM_HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer":         "https://www.transfermarkt.de/",
}

# DB team name → (tm_slug, tm_id)
CLUBS: dict[str, tuple[str, int]] = {
    "FC Bayern München":    ("fc-bayern-munchen",          27),
    "Borussia Dortmund":    ("borussia-dortmund",          16),
    "Bayer 04 Leverkusen":  ("bayer-04-leverkusen",        15),
    "RB Leipzig":           ("rasenballsport-leipzig",     23826),
    "Eintracht Frankfurt":  ("eintracht-frankfurt",        24),
    "VfB Stuttgart":        ("vfb-stuttgart",              79),
    "Borussia M'gladbach":  ("borussia-monchengladbach",   18),
    "1. FC Union Berlin":   ("1-fc-union-berlin",          89),
    "SV Werder Bremen":     ("sv-werder-bremen",           86),
    "1. FC Heidenheim":     ("1-fc-heidenheim-1846",       2036),
    "TSG Hoffenheim":       ("tsg-hoffenheim",             533),
    "VfL Wolfsburg":        ("vfl-wolfsburg",              82),
    "FC Augsburg":          ("fc-augsburg",                167),
    "1. FSV Mainz 05":      ("1-fsv-mainz-05",             39),
    "SC Freiburg":          ("sport-club-freiburg",        60),
    "FC St. Pauli":         ("fc-st-pauli",                35),
    "Hamburger SV":         ("hamburger-sv",               41),
    "1. FC Köln":           ("1-fc-koeln",                 3),
}

SEASON = 2025  # Saison 25/26


# ─── Hilfsfunktionen ──────────────────────────────────────────


def normalize(name: str) -> str:
    """Lowercase + Akzente entfernen + Sonderzeichen bereinigen."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = nfkd.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_name).strip().lower()


def best_match(tm_name: str, db_players: list[dict]) -> dict | None:
    """Findet den besten Treffer in db_players für tm_name (Score ≥ 0.82)."""
    target = normalize(tm_name)
    best_score = 0.0
    best_player = None
    for p in db_players:
        score = difflib.SequenceMatcher(None, target, normalize(p["name"])).ratio()
        if score > best_score:
            best_score = score
            best_player = p
    if best_score >= 0.82:
        return best_player
    return None


def parse_date(raw: str) -> str | None:
    """Konvertiert TM-Datum DD.MM.YYYY → ISO YYYY-MM-DD."""
    raw = raw.strip()
    try:
        return datetime.strptime(raw, "%d.%m.%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


# ─── Transfermarkt ────────────────────────────────────────────


def scrape_squad(slug: str, tm_id: int) -> list[dict]:
    """
    Scrapt die Kaderliste von Transfermarkt.
    Gibt Liste von {name, contract_until} zurück.
    """
    url = (
        f"https://www.transfermarkt.de/{slug}/kader/verein/{tm_id}"
        f"/saison_id/{SEASON}/plus/1"
    )
    try:
        r = requests.get(url, headers=TM_HEADERS, timeout=15)
        if r.status_code != 200:
            print(f"  HTTP {r.status_code} für {slug}")
            return []
    except Exception as e:
        print(f"  Request-Fehler {slug}: {e}")
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table", class_="items")
    if not table:
        print(f"  Kein items-Table gefunden: {slug}")
        return []

    players = []
    for row in table.find_all("tr", class_=["odd", "even"]):
        # Spielername aus dem Hauptlink
        name_tag = row.find("td", class_="hauptlink")
        if not name_tag:
            continue
        a = name_tag.find("a")
        if not a:
            continue
        tm_name = a.get_text(strip=True)

        # Vertragsdatum: letztes td mit Datumsmuster DD.MM.YYYY
        contract_until = None
        for td in reversed(row.find_all("td")):
            text = td.get_text(strip=True)
            if re.match(r"\d{2}\.\d{2}\.\d{4}", text):
                contract_until = parse_date(text)
                break

        players.append({"name": tm_name, "contract_until": contract_until})

    return players


# ─── Supabase ─────────────────────────────────────────────────


def get_db_players(team: str) -> list[dict]:
    url = (
        f"{SUPABASE_URL}/rest/v1/players"
        f"?league=eq.Bundesliga&team=eq.{requests.utils.quote(team)}"
        f"&select=sofascore_id,name&limit=500"
    )
    r = requests.get(url, headers=SB_HEADERS)
    if r.status_code != 200:
        print(f"  Supabase Fehler ({r.status_code}): {r.text[:200]}")
        return []
    return r.json()


def update_contract(sofascore_id: int, contract_until: str) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/players"
    headers = {**SB_HEADERS, "Prefer": "return=minimal"}
    r = requests.patch(
        url,
        json={"contract_until": contract_until},
        headers=headers,
        params={"sofascore_id": f"eq.{sofascore_id}"},
    )
    return r.status_code in (200, 201, 204)


# ─── Hauptprogramm ────────────────────────────────────────────


def main():
    print("Dateneck — Transfermarkt Contract Scraper")
    print("=" * 55)

    total_ok = total_skip = total_fail = total_no_date = 0

    for db_team, (slug, tm_id) in CLUBS.items():
        print(f"\n[{db_team}]")

        db_players = get_db_players(db_team)
        if not db_players:
            print("  Keine Spieler in DB — übersprungen")
            continue

        tm_players = scrape_squad(slug, tm_id)
        if not tm_players:
            print("  Keine TM-Daten — übersprungen")
            time.sleep(2)
            continue

        print(f"  TM: {len(tm_players)} Spieler  |  DB: {len(db_players)} Spieler")

        ok = skip = fail = no_date = 0
        for tm_p in tm_players:
            match = best_match(tm_p["name"], db_players)
            if not match:
                skip += 1
                continue

            if not tm_p["contract_until"]:
                no_date += 1
                continue

            if update_contract(match["sofascore_id"], tm_p["contract_until"]):
                print(f"    {match['name']:30s} → {tm_p['contract_until']}")
                ok += 1
            else:
                print(f"    {match['name']:30s} — Supabase-Fehler")
                fail += 1

        print(f"  → {ok} gespeichert | {skip} kein Match | {no_date} ohne Datum | {fail} Fehler")
        total_ok += ok
        total_skip += skip
        total_fail += fail
        total_no_date += no_date

        time.sleep(2.5)  # TM Rate-Limit schonen

    print("\n" + "=" * 55)
    print(f"GESAMT: {total_ok} gespeichert | {total_skip} kein Match | "
          f"{total_no_date} ohne Datum | {total_fail} Fehler")


if __name__ == "__main__":
    main()
