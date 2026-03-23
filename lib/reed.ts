const REED_API_BASE_URL = "https://www.reed.co.uk/api/1.0/search";
const ENTRY_LEVEL_KEYWORDS = [
  "junior",
  "graduate",
  "trainee",
  "entry level",
  "assistant",
  "coordinator",
  "administrator",
  "support"
];

export type ReedJob = {
  jobId: number;
  jobTitle: string;
  employerName: string;
  locationName: string;
  minimumSalary?: number;
  maximumSalary?: number;
  date: string;
  jobUrl: string;
  jobDescription: string;
};

type ReedResponse = {
  results: ReedJob[];
  totalResults: number;
};

type ReedCacheEntry = {
  jobs: ReedJob[];
  expiresAt: number;
};

const reedResponseCache = new Map<string, ReedCacheEntry>();

function buildBasicAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export async function fetchReedJobs(options?: {
  maxPages?: number;
  resultsToTake?: number;
  graduate?: boolean;
}): Promise<ReedJob[]> {
  const apiKey = process.env.REED_API_KEY;
  if (!apiKey) {
    throw new Error("Missing REED_API_KEY environment variable.");
  }

  const maxPages = options?.maxPages ?? 60;
  const resultsToTake = options?.resultsToTake ?? 100;
  const graduate = options?.graduate ?? true;
  const cacheKey = `${maxPages}:${resultsToTake}:${graduate}`;
  const now = Date.now();
  const cached = reedResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.jobs;
  }

  const allResults: ReedJob[] = [];
  let totalResults = Number.POSITIVE_INFINITY;

  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      graduate: graduate ? "true" : "false",
      resultsToTake: String(resultsToTake),
      resultsToSkip: String((page - 1) * resultsToTake)
    });

    const res = await fetch(`${REED_API_BASE_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: buildBasicAuthHeader(apiKey),
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Reed API request failed: ${res.status} ${res.statusText} - ${body}`);
    }

    const data = (await res.json()) as ReedResponse;
    totalResults = data.totalResults ?? totalResults;
    allResults.push(...(data.results ?? []));

    if (!data.results?.length) break;
    if (allResults.length >= totalResults) break;
  }

  reedResponseCache.set(cacheKey, {
    jobs: allResults,
    expiresAt: now + 5 * 60 * 1000
  });

  return allResults;
}

export function filterEntryLevelJobs(jobs: ReedJob[]): ReedJob[] {
  return jobs.filter((job) => {
    const haystack = `${job.jobTitle ?? ""} ${job.jobDescription ?? ""}`.toLowerCase();
    return ENTRY_LEVEL_KEYWORDS.some((keyword) => haystack.includes(keyword));
  });
}

export function filterJobsByDateRange(
  jobs: ReedJob[],
  fromDate?: string | null,
  toDate?: string | null
): ReedJob[] {
  if (!fromDate && !toDate) return jobs;
  const toIsoDate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // ISO-like values from API, e.g. 2026-03-24 or 2026-03-24T00:00:00
    const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    // UK-style values, e.g. 24/03/2026
    const ukMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ukMatch) {
      const [, dd, mm, yyyy] = ukMatch;
      return `${yyyy}-${mm}-${dd}`;
    }

    // Fallback parser for other date strings.
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  };

  return jobs.filter((job) => {
    const jobIsoDate = toIsoDate(job.date);
    if (!jobIsoDate) return false;
    if (fromDate && jobIsoDate < fromDate) return false;
    if (toDate && jobIsoDate > toDate) return false;
    return true;
  });
}
