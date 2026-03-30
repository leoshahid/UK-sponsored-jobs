const ADZUNA_API_BASE_URL = "https://api.adzuna.com/v1/api/jobs/gb/search";

export type AdzunaJob = {
  id: string;
  title: string;
  description: string;
  created: string;
  redirect_url: string;
  category?: {
    tag?: string;
    label?: string;
  };
  company?: {
    display_name?: string;
  };
  location?: {
    display_name?: string;
  };
  salary_min?: number;
  salary_max?: number;
};

type AdzunaSearchResponse = {
  count: number;
  results: AdzunaJob[];
};

type AdzunaCacheEntry = {
  result: {
    jobs: AdzunaJob[];
    totalAvailable: number;
    truncated: boolean;
  };
  expiresAt: number;
};

const adzunaResponseCache = new Map<string, AdzunaCacheEntry>();

export async function fetchAdzunaJobs(options?: {
  maxPages?: number;
  resultsPerPage?: number;
  graduate?: boolean;
  timeoutMs?: number;
  maxTotalJobs?: number;
}): Promise<{ jobs: AdzunaJob[]; totalAvailable: number; truncated: boolean }> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    throw new Error("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY environment variable.");
  }

  const maxPages = options?.maxPages ?? 20;
  const resultsPerPage = options?.resultsPerPage ?? 50;
  const graduate = options?.graduate ?? true;
  const timeoutMs = options?.timeoutMs ?? 30000;
  const maxTotalJobs = options?.maxTotalJobs ?? 10000;
  const cacheKey = `${maxPages}:${resultsPerPage}:${graduate}:${timeoutMs}:${maxTotalJobs}`;
  const now = Date.now();
  const cached = adzunaResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const allResults: AdzunaJob[] = [];
  let totalResults = Number.POSITIVE_INFINITY;

  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(resultsPerPage),
      sort_by: "date"
    });

    if (graduate) params.set("category", "graduate-jobs");

    let res: Response;
    try {
      res = await fetch(`${ADZUNA_API_BASE_URL}/${page}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "UKJobsDemo/1.0"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error";
      const cause =
        typeof error === "object" &&
        error !== null &&
        "cause" in error &&
        (error as { cause?: unknown }).cause
          ? String((error as { cause?: unknown }).cause)
          : "";
      // If a later page times out/fails, keep already-fetched pages for demo resilience.
      if (allResults.length > 0) {
        break;
      }
      throw new Error(`Adzuna network error: ${message}${cause ? ` | cause: ${cause}` : ""}`);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Adzuna API request failed: ${res.status} ${res.statusText} - ${body}`);
    }

    const data = (await res.json()) as AdzunaSearchResponse;
    totalResults = data.count ?? totalResults;
    allResults.push(...(data.results ?? []));

    if (!data.results?.length) break;
    if (allResults.length >= totalResults) break;
    if (allResults.length >= maxTotalJobs) break;
  }

  const limitedJobs = allResults.slice(0, maxTotalJobs);
  const totalAvailable = Number.isFinite(totalResults) ? totalResults : limitedJobs.length;
  const truncated = limitedJobs.length < totalAvailable;
  const result = { jobs: limitedJobs, totalAvailable, truncated };

  adzunaResponseCache.set(cacheKey, {
    result,
    expiresAt: now + 5 * 60 * 1000
  });

  return result;
}

