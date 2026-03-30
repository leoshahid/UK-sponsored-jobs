# UK Jobs Sponsor Match (Reed + Adzuna)

A minimal Next.js 14 demo app that:

- reads UK sponsor organisations from a local CSV
- fetches jobs from Reed and Adzuna on the server
- filters for entry-level style roles
- matches employer names to sponsor companies
- shows only sponsor-matched jobs in separate side-by-side listings

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Reed API + Adzuna API (server-side)
- Papa Parse (CSV parsing)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your API keys:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```bash
REED_API_KEY=your_reed_api_key_here
ADZUNA_APP_ID=your_adzuna_app_id_here
ADZUNA_APP_KEY=your_adzuna_app_key_here
```

3. Put the sponsor CSV in:

`data/2026-03-23_-_Worker_and_Temporary_Worker.csv`

4. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How matching works

1. CSV sponsor names are normalized with:
   - lowercase
   - trim and collapse spaces
   - punctuation removed
   - `&` converted to `and`
   - common suffixes removed (`ltd`, `limited`, `plc`, `llp`, `group`, `uk`, etc.)
2. Reed/Adzuna employer names are normalized the same way.
3. Matching strategy:
   - **first:** raw exact string match (`exact`)
   - **second:** normalized exact match (`normalized`)
   - **fallback:** lightweight fuzzy match (`fuzzy`) using high word-overlap threshold and small length gap
4. UI shows both names for debugging:
   - source employer name
   - matched CSV sponsor name

## Filtering behavior

- `graduate=true` is used by default for both providers
- date range filtering is applied locally in the API route (`fromDate` / `toDate`)
- side-by-side UI keeps Reed and Adzuna listings separate (not mixed)

## API route

- `GET /api/jobs`
- Returns:
  - `reed.jobs` and `adzuna.jobs` separately (both sponsor-matched only)
  - per-source debug stats (`fetchedJobs`, `entryLevelJobs`, `dateFilteredJobs`, `sponsorMatchedJobs`)
  - global debug stats (`sponsorsParsed`, date filters, graduate filter)

## Notes

- This is a demo only (no auth, DB, payments, admin).
- The page calls only the local API route; browser does not call external job APIs directly.
