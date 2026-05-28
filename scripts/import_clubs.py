"""
import_clubs.py — Importiert clubs_raw.json in die Supabase clubs-Tabelle.
Voraussetzung: clubs-Tabelle bereits via db_setup.py angelegt.
"""
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")  # service_role key

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL oder SUPABASE_KEY fehlt in .env!")

HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "resolution=merge-duplicates",
}

DATA_PATH = os.path.join(os.path.dirname(__file__), "../frontend/public/data/clubs_raw.json")

with open(DATA_PATH, encoding="utf-8") as f:
    clubs = json.load(f)

print(f"{len(clubs)} Vereine geladen aus clubs_raw.json")

records = [
    {
        "tm_id":       c["tm_id"],
        "name":        c["name"],
        "avg_age":     c.get("avg_age"),
        "top_players": c.get("top_players", []),
    }
    for c in clubs
]

url = f"{SUPABASE_URL}/rest/v1/clubs"
r = requests.post(url, json=records, headers=HEADERS)

if r.status_code in (200, 201):
    print(f"OK — {len(records)} Vereine importiert.")
else:
    print(f"Fehler {r.status_code}: {r.text[:400]}")
