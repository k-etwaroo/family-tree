# 🌳 Family Tree

An interactive family tree website with four visualization modes — built for GitHub Pages.

## Views

- **Tree** — Classic vertical tree with collapsible branches (D3.js)
- **Radial** — Sunburst fan chart with daughter at the center
- **Cards** — Filterable card grid with photos and bios
- **Timeline** — Chronological view of births, marriages, and milestones

## Quick Start

1. Edit `data/family.json` directly, or use the admin panel at `/admin.html`
2. Push to GitHub — site deploys automatically via GitHub Pages

## Google Sheets Pipeline

1. Create a Google Sheet with columns: `id, name, relation, side, generation, parent_id, spouse_id, born, died, birthplace, bio, fun_fact, photo`
2. Publish the sheet as CSV: File → Share → Publish to web → CSV
3. Run: `python scripts/export_family.py <CSV_URL>`
4. Commit and push `data/family.json`

## Admin Panel

Visit `/admin.html` and enter the password (default: `family2026` — change it in admin.html).

Add, edit, or delete members through the form, then export the updated JSON to commit.

## Photos

Drop photos in the `photos/` directory. Reference them by filename in the sheet or admin panel.

## Tech

- Vanilla HTML/CSS/JS — no build step
- D3.js v7 for tree and radial visualizations
- GitHub Pages for hosting
- Cloudflare for custom domain (optional)
