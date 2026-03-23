import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { normalizeCompanyName, similarityScore } from "./normalize";

export type SponsorRecord = {
  organisationName: string;
  normalizedName: string;
  townCity: string;
  county: string;
  route: string;
};

type CsvRow = {
  "Organisation Name"?: string;
  "Town/City"?: string;
  County?: string;
  Route?: string;
};

let sponsorsCache: SponsorRecord[] | null = null;
let rawExactMatchIndex: Map<string, SponsorRecord> | null = null;
let exactMatchIndex: Map<string, SponsorRecord> | null = null;
let firstTokenIndex: Map<string, SponsorRecord[]> | null = null;

function buildIndexes(sponsors: SponsorRecord[]) {
  if (rawExactMatchIndex && exactMatchIndex && firstTokenIndex) return;

  rawExactMatchIndex = new Map<string, SponsorRecord>();
  exactMatchIndex = new Map<string, SponsorRecord>();
  firstTokenIndex = new Map<string, SponsorRecord[]>();

  for (const sponsor of sponsors) {
    if (!sponsor.normalizedName) continue;

    if (!rawExactMatchIndex.has(sponsor.organisationName)) {
      rawExactMatchIndex.set(sponsor.organisationName, sponsor);
    }

    if (!exactMatchIndex.has(sponsor.normalizedName)) {
      exactMatchIndex.set(sponsor.normalizedName, sponsor);
    }

    const firstToken = sponsor.normalizedName.split(" ")[0];
    if (!firstToken) continue;
    const existing = firstTokenIndex.get(firstToken) ?? [];
    existing.push(sponsor);
    firstTokenIndex.set(firstToken, existing);
  }
}

export async function loadSponsors(): Promise<SponsorRecord[]> {
  if (sponsorsCache) return sponsorsCache;

  const csvPath = path.join(process.cwd(), "data", "2026-03-23_-_Worker_and_Temporary_Worker.csv");
  const rawCsv = await fs.readFile(csvPath, "utf-8");

  const parsed = Papa.parse<CsvRow>(rawCsv, {
    header: true,
    skipEmptyLines: true
  });

  sponsorsCache = parsed.data
    .map((row) => {
      const organisationName = (row["Organisation Name"] ?? "").trim();
      if (!organisationName) return null;

      return {
        organisationName,
        normalizedName: normalizeCompanyName(organisationName),
        townCity: (row["Town/City"] ?? "").trim(),
        county: (row.County ?? "").trim(),
        route: (row.Route ?? "").trim()
      };
    })
    .filter((row): row is SponsorRecord => Boolean(row));

  buildIndexes(sponsorsCache);
  return sponsorsCache;
}

export function matchSponsorByCompanyName(
  employerName: string,
  sponsors: SponsorRecord[]
): {
  sponsor: SponsorRecord;
  reedEmployerName: string;
  normalizedReedEmployer: string;
  normalizedSponsor: string;
  matchType: "exact" | "normalized" | "fuzzy";
} | null {
  const rawEmployer = employerName.trim();
  const normalizedEmployer = normalizeCompanyName(employerName);
  if (!normalizedEmployer) return null;

  buildIndexes(sponsors);

  const rawExact = rawExactMatchIndex?.get(rawEmployer);
  if (rawExact) {
    return {
      sponsor: rawExact,
      reedEmployerName: employerName,
      normalizedReedEmployer: normalizedEmployer,
      normalizedSponsor: rawExact.normalizedName,
      matchType: "exact"
    };
  }

  const normalizedExact = exactMatchIndex?.get(normalizedEmployer);
  if (normalizedExact) {
    return {
      sponsor: normalizedExact,
      reedEmployerName: employerName,
      normalizedReedEmployer: normalizedEmployer,
      normalizedSponsor: normalizedExact.normalizedName,
      matchType: "normalized"
    };
  }

  // Lightweight and safe fuzzy matching: require high overlap and close lengths.
  const firstToken = normalizedEmployer.split(" ")[0];
  const candidates = firstToken ? (firstTokenIndex?.get(firstToken) ?? []) : [];
  const fuzzy = candidates.find((s) => {
    const score = similarityScore(normalizedEmployer, s.normalizedName);
    const lengthGap = Math.abs(normalizedEmployer.length - s.normalizedName.length);
    return score >= 0.8 && lengthGap <= 6;
  });

  if (!fuzzy) return null;

  return {
    sponsor: fuzzy,
    reedEmployerName: employerName,
    normalizedReedEmployer: normalizedEmployer,
    normalizedSponsor: fuzzy.normalizedName,
    matchType: "fuzzy"
  };
}
