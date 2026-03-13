#!/usr/bin/env python3
"""
export_family.py — Export family data from Google Sheets to JSON.

Usage:
  1. Publish your Google Sheet: File → Share → Publish to web → CSV
  2. Copy the published CSV URL
  3. Run: python scripts/export_family.py <CSV_URL>
     Or set FAMILY_SHEET_URL environment variable

The script reads the CSV and outputs data/family.json
"""

import csv
import io
import json
import os
import sys
import urllib.request


def fetch_csv(url):
    """Fetch CSV from published Google Sheet URL."""
    print(f"Fetching sheet from: {url[:60]}...")
    req = urllib.request.Request(url, headers={"User-Agent": "FamilyTreeExporter/1.0"})
    with urllib.request.urlopen(req) as response:
        return response.read().decode("utf-8")


def parse_members(csv_text):
    """Parse CSV text into list of member dicts."""
    reader = csv.DictReader(io.StringIO(csv_text))
    members = []

    for row in reader:
        # Skip empty rows
        if not row.get("name", "").strip():
            continue

        member = {
            "id": int(row.get("id", 0)),
            "name": row.get("name", "").strip(),
            "relation": row.get("relation", "").strip().lower(),
            "side": row.get("side", "").strip().lower(),
            "generation": int(row.get("generation", 0)),
            "parent_id": int(row["parent_id"]) if row.get("parent_id", "").strip() else None,
            "spouse_id": int(row["spouse_id"]) if row.get("spouse_id", "").strip() else None,
            "born": row.get("born", "").strip(),
            "died": row.get("died", "").strip(),
            "birthplace": row.get("birthplace", "").strip(),
            "bio": row.get("bio", "").strip(),
            "fun_fact": row.get("fun_fact", "").strip(),
            "photo": row.get("photo", "").strip(),
        }
        members.append(member)

    return members


def build_events(members):
    """Build timeline events from member data."""
    events = []
    for m in members:
        if m["born"]:
            try:
                year = int(m["born"][:4])
                events.append({
                    "year": year,
                    "type": "birth",
                    "person": m["name"],
                    "personId": m["id"]
                })
            except ValueError:
                pass

        if m["died"]:
            try:
                year = int(m["died"][:4])
                events.append({
                    "year": year,
                    "type": "death",
                    "person": m["name"],
                    "personId": m["id"]
                })
            except ValueError:
                pass

    return sorted(events, key=lambda e: e["year"])


def main():
    # Get CSV URL
    url = None
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = os.environ.get("FAMILY_SHEET_URL")

    if not url:
        print("Usage: python scripts/export_family.py <GOOGLE_SHEET_CSV_URL>")
        print("  Or set FAMILY_SHEET_URL environment variable")
        print()
        print("To get the URL:")
        print("  1. Open your Google Sheet")
        print("  2. File → Share → Publish to web")
        print("  3. Select your sheet tab, format: CSV")
        print("  4. Click Publish and copy the URL")
        sys.exit(1)

    # Fetch and parse
    csv_text = fetch_csv(url)
    members = parse_members(csv_text)
    events = build_events(members)

    print(f"Found {len(members)} family members")
    print(f"Generated {len(events)} timeline events")

    # Output
    output = {
        "members": members,
        "events": events
    }

    output_path = os.path.join(os.path.dirname(__file__), "..", "data", "family.json")
    output_path = os.path.abspath(output_path)

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {output_path}")
    print("Done! Commit and push to update the site.")


if __name__ == "__main__":
    main()
