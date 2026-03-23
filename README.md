# UK Jobs Sponsor Match

A minimal Next.js 14 demo app that:

- reads UK sponsor organisations from a local CSV
- fetches jobs from the Reed API on the server
- filters for entry-level style roles
- matches Reed employers to sponsor companies
- shows only sponsor-matched jobs in a clean UI

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Reed API (server-side)
- Papa Parse (CSV parsing)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add your Reed API key:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```bash
REED_API_KEY=your_reed_api_key_here
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
2. Reed `employerName` is normalized the same way.
3. Matching strategy:
   - **first:** normalized exact match
   - **fallback:** lightweight fuzzy match using high word-overlap threshold and small length gap
4. UI shows both names for debugging:
   - Reed employer name
   - matched CSV sponsor name

## Date limitation in this demo

Reed returns a date field, not exact post time. For demo purposes:

- "last 24h" means jobs whose Reed date is **today**
- if none are found, the app falls back to jobs from the previous 2 calendar days and shows a note in the UI

## API route

- `GET /api/jobs`
- Returns:
  - sponsor-matched jobs only
  - debug stats: sponsors parsed, Reed jobs fetched, entry-level jobs, matched jobs

## Notes

- This is a demo only (no auth, DB, payments, admin, deployment config).
- The page calls only the local API route; browser does not call Reed directly.
