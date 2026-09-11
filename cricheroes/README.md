# KATL CricHeroes Data API

This module imports publicly accessible CricHeroes team/scorecard data into Supabase and exposes normalized API endpoints for the KATL dashboard.

## Architecture

CricHeroes -> Python/Selenium collector -> Supabase Postgres -> Supabase Edge Function -> KATL dashboard

## Environment

The collector expects:

- `KATL_TEAM_URL`: CricHeroes team-profile path, for example `2580003/CP-Sm@shers`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key must only be used by the server/collector and must never be committed or exposed to the browser.

## Scope

The collector is intentionally conservative: it reads publicly accessible pages, stores normalized match/team/player data, and should be run at a modest refresh interval. Do not bypass authentication, CAPTCHAs, rate limits, or access controls.

The importer is a starting point because CricHeroes page markup can change. Validate the selectors against the KATL team page before enabling scheduled production imports.
