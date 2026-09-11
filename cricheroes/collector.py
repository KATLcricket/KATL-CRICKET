"""Import public CricHeroes team-page data into Supabase.

Usage:
  KATL_TEAM_URL='TEAM_PATH' SUPABASE_URL='...' SUPABASE_SERVICE_ROLE_KEY='...' python collector.py

This follows the public-page approach used by pupattan/cricheroes, but keeps the
collector separate from the browser-facing KATL application.
"""
import os
import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup
from dateutil.parser import parse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from supabase import create_client

BASE_URL = "https://cricheroes.in/team-profile"


def browser():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    return webdriver.Chrome(options=options)


def text(node):
    return " ".join(node.get_text(" ", strip=True).split()) if node else ""


def load_team(driver, team_path):
    driver.get(f"{BASE_URL}/{team_path.lstrip('/')}")
    return BeautifulSoup(driver.page_source, "html.parser")


def parse_date(info):
    try:
        parts = [p.strip() for p in info.split(",")]
        return parse(parts[2] if len(parts) > 2 else info, fuzzy=True).date().isoformat()
    except Exception:
        return None


def collect(team_path):
    driver = browser()
    try:
        soup = load_team(driver, team_path)
        result = {"team": {}, "players": [], "matches": [], "stats": [], "leaderboard": {}}

        banner = soup.find(id="player-banner")
        if banner:
            logo = banner.find("img", class_="tournament-logo")
            result["team"] = {
                "name": text(banner.find(class_="pmd-card-title-text")),
                "logo_url": logo.get("src") if logo else None,
                "source_url": f"{BASE_URL}/{team_path.lstrip('/')}"
            }

        members = soup.find(class_="membersDiv")
        if members:
            for div in members.find_all("div", class_=re.compile(r"player\d+")):
                link = div.find("a")
                img = div.find("img")
                result["players"].append({
                    "name": text(div.select_one(".team-profile-player")),
                    "subtitle": text(div.select_one(".pmd-card-subtitle-text")),
                    "profile_url": link.get("href") if link else None,
                    "profile_pic_url": img.get("src") if img else None,
                })

        matches = soup.find(class_="matchesDiv")
        if matches:
            for div in matches.find_all("div", class_="custom-card-matches"):
                info = text(div.select_one(".test-match-card-title"))
                scores = [text(x) for x in div.select_one(".pmd-card-body").find_all("div", class_=re.compile(r"section\d+"))] if div.select_one(".pmd-card-body") else []
                link = div.find("a")
                result["matches"].append({
                    "tournament": text(div.select_one(".matchtournamentDetail")),
                    "info": info,
                    "match_date": parse_date(info),
                    "scores": scores,
                    "result": text(div.select_one(".test-result")),
                    "source_url": link.get("href") if link else None,
                })

        return result
    finally:
        driver.quit()


def upsert(data):
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    db = create_client(url, key)
    team = db.table("cricheroes_teams").upsert(data["team"], on_conflict="source_url").execute().data[0]
    team_id = team["id"]

    for player in data["players"]:
        player["team_id"] = team_id
        db.table("cricheroes_players").upsert(player, on_conflict="team_id,profile_url").execute()

    for match in data["matches"]:
        match["team_id"] = team_id
        db.table("cricheroes_matches").upsert(match, on_conflict="team_id,source_url").execute()

    db.table("cricheroes_sync_runs").insert({
        "team_id": team_id,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "match_count": len(data["matches"]),
        "player_count": len(data["players"]),
    }).execute()


if __name__ == "__main__":
    data = collect(os.environ["KATL_TEAM_URL"])
    upsert(data)
    print(f"Imported {len(data['matches'])} matches and {len(data['players'])} players")
