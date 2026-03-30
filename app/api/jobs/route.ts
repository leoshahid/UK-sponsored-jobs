import { NextResponse } from "next/server";
import { fetchReedJobs } from "@/lib/reed";
import { fetchAdzunaJobs, type AdzunaJob } from "@/lib/adzuna";
import {
  loadSponsors,
  matchSponsorByCompanyName,
  type SponsorRecord,
} from "@/lib/sponsors";

type UnifiedSourceJob = {
  jobId: string;
  jobTitle: string;
  employerName: string;
  locationName: string;
  minimumSalary?: number;
  maximumSalary?: number;
  date: string;
  url: string;
  description: string;
  category: string;
};

type ReedSourceJob = {
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

export type MatchedJob = {
  jobId: string;
  jobTitle: string;
  employerName: string;
  matchedSponsorName: string;
  matchType: "exact" | "normalized" | "fuzzy";
  category: string;
  locationName: string;
  minimumSalary?: number;
  maximumSalary?: number;
  postedDate: string;
  jobUrl: string;
  sponsorTownCity: string;
  sponsorCounty: string;
  sponsorRoute: string;
  matchDebug: {
    employerName: string;
    sponsorName: string;
  };
};

type SourceBlock = {
  jobs: MatchedJob[];
  meta: {
    fetchedJobs: number;
    totalAvailable: number;
    truncated: boolean;
    dateFilteredJobs: number;
    sponsorMatchedJobs: number;
  };
};

type JobsApiPayload = {
  reed: SourceBlock;
  adzuna: SourceBlock;
  meta: {
    sponsorsParsed: number;
    date: string | null;
    graduate: boolean;
    reedError: string | null;
    adzunaError: string | null;
  };
};

const ROUTE_CACHE_TTL_MS = 60 * 1000;
const routeCache = new Map<
  string,
  { payload: JobsApiPayload; expiresAt: number }
>();

function isIsoDate(value: string | null): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function filterByExactDate(
  jobs: UnifiedSourceJob[],
  date: string | null,
): UnifiedSourceJob[] {
  if (!date) return jobs;

  const ukLocalDateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const toUkLocalDate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Reed date format: DD/MM/YYYY
    const reedMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (reedMatch) {
      const [, dd, mm, yyyy] = reedMatch;
      return `${yyyy}-${mm}-${dd}`;
    }

    // ISO-like date already without time: YYYY-MM-DD
    const isoDateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateOnlyMatch) {
      return `${isoDateOnlyMatch[1]}-${isoDateOnlyMatch[2]}-${isoDateOnlyMatch[3]}`;
    }

    // Adzuna typically returns UTC timestamp, e.g. 2026-03-30T05:14:24Z
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    const parts = ukLocalDateFormatter.formatToParts(parsed);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) return null;
    return `${year}-${month}-${day}`;
  };

  return jobs.filter((job) => {
    const jobLocalDate = toUkLocalDate(job.date);
    if (!jobLocalDate) return false;
    return jobLocalDate === date;
  });
}

function mapMatchedJobs(
  jobs: UnifiedSourceJob[],
  sponsors: SponsorRecord[],
): MatchedJob[] {
  const mapped = jobs
    .map((job) => {
      const match = matchSponsorByCompanyName(job.employerName ?? "", sponsors);
      if (!match) return null;

      return {
        jobId: job.jobId,
        jobTitle: job.jobTitle,
        employerName: job.employerName,
        matchedSponsorName: match.sponsor.organisationName,
        matchType: match.matchType,
        category: job.category,
        locationName: job.locationName,
        minimumSalary: job.minimumSalary,
        maximumSalary: job.maximumSalary,
        postedDate: job.date,
        jobUrl: job.url,
        sponsorTownCity: match.sponsor.townCity,
        sponsorCounty: match.sponsor.county,
        sponsorRoute: match.sponsor.route,
        matchDebug: {
          employerName: match.reedEmployerName,
          sponsorName: match.sponsor.organisationName,
        },
      } satisfies MatchedJob;
    })
    .filter((job) => Boolean(job));

  return mapped as MatchedJob[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const graduateParam = searchParams.get("graduate");
    const graduate = graduateParam === null ? true : graduateParam !== "false";
    const cacheKey = `${date ?? ""}:${graduate}`;

    if (date && !isIsoDate(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 },
      );
    }

    const cached = routeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload);
    }

    const sponsors = await loadSponsors();

    const reedMaxTotalJobs = Number(process.env.REED_MAX_TOTAL_JOBS ?? "1000");
    const reedResultsPerPage = Number(process.env.REED_RESULTS_PER_PAGE ?? "100");
    const reedMaxPages = Number(process.env.REED_MAX_PAGES ?? "20");

    const adzunaMaxPages = Number(process.env.ADZUNA_MAX_PAGES ?? "20");
    const adzunaResultsPerPage = Number(process.env.ADZUNA_RESULTS_PER_PAGE ?? "50");
    const adzunaTimeoutMs = Number(process.env.ADZUNA_TIMEOUT_MS ?? "30000");
    const adzunaMaxTotalJobs = Number(process.env.ADZUNA_MAX_TOTAL_JOBS ?? "1000");

    const [reedResult, adzunaResult] = await Promise.allSettled([
      fetchReedJobs({
        maxPages: reedMaxPages,
        resultsToTake: reedResultsPerPage,
        graduate,
        timeoutMs: 10000,
        maxTotalJobs: reedMaxTotalJobs
      }),
      fetchAdzunaJobs({
        maxPages: adzunaMaxPages,
        resultsPerPage: adzunaResultsPerPage,
        graduate,
        timeoutMs: adzunaTimeoutMs,
        maxTotalJobs: adzunaMaxTotalJobs
      })
    ]);

    const reedRaw: ReedSourceJob[] =
      reedResult.status === "fulfilled"
        ? (reedResult.value.jobs as ReedSourceJob[])
        : [];
    const reedTotalAvailable =
      reedResult.status === "fulfilled" ? reedResult.value.totalAvailable : 0;
    const reedTruncated =
      reedResult.status === "fulfilled" ? reedResult.value.truncated : false;
    const reedError: string | null = reedResult.status === "rejected" ? String(reedResult.reason) : null;
    const adzunaRaw: AdzunaJob[] =
      adzunaResult.status === "fulfilled" ? adzunaResult.value.jobs : [];
    const adzunaTotalAvailable =
      adzunaResult.status === "fulfilled" ? adzunaResult.value.totalAvailable : 0;
    const adzunaTruncated =
      adzunaResult.status === "fulfilled" ? adzunaResult.value.truncated : false;
    const adzunaError: string | null = adzunaResult.status === "rejected" ? String(adzunaResult.reason) : null;

    const reedUnified: UnifiedSourceJob[] = reedRaw.map((job) => ({
      jobId: String(job.jobId),
      jobTitle: job.jobTitle,
      employerName: job.employerName,
      locationName: job.locationName,
      minimumSalary: job.minimumSalary,
      maximumSalary: job.maximumSalary,
      date: job.date,
      url: job.jobUrl,
      description: job.jobDescription,
      category: graduate ? "Graduate" : "Non-graduate",
    }));

    const adzunaUnified: UnifiedSourceJob[] = adzunaRaw.map((job) => ({
      jobId: job.id,
      jobTitle: job.title,
      employerName: job.company?.display_name ?? "",
      locationName: job.location?.display_name ?? "",
      minimumSalary: job.salary_min,
      maximumSalary: job.salary_max,
      date: job.created,
      url: job.redirect_url,
      description: job.description,
      category:
        job.category?.label ??
        job.category?.tag ??
        (graduate ? "Graduate Jobs" : "All Jobs"),
    }));

    // No local keyword-based graduate filtering; rely on provider-side filters only.
    const reedEntry = reedUnified;
    const adzunaEntry = adzunaUnified;
    const reedDateFiltered = filterByExactDate(reedEntry, date);
    const adzunaDateFiltered = filterByExactDate(adzunaEntry, date);
    const reedMatched = mapMatchedJobs(reedDateFiltered, sponsors);
    const adzunaMatched = mapMatchedJobs(adzunaDateFiltered, sponsors);

    const payload: JobsApiPayload = {
      reed: {
        jobs: reedMatched,
        meta: {
          fetchedJobs: reedUnified.length,
          totalAvailable: reedTotalAvailable,
          truncated: reedTruncated,
          dateFilteredJobs: reedDateFiltered.length,
          sponsorMatchedJobs: reedMatched.length,
        },
      },
      adzuna: {
        jobs: adzunaMatched,
        meta: {
          fetchedJobs: adzunaUnified.length,
          totalAvailable: adzunaTotalAvailable,
          truncated: adzunaTruncated,
          dateFilteredJobs: adzunaDateFiltered.length,
          sponsorMatchedJobs: adzunaMatched.length,
        },
      },
      meta: {
        sponsorsParsed: sponsors.length,
        date,
        graduate,
        reedError,
        adzunaError,
      },
    };

    routeCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while loading jobs.";
    return NextResponse.json(
      {
        reed: {
          jobs: [],
          meta: {
            fetchedJobs: 0,
            totalAvailable: 0,
            truncated: false,
            dateFilteredJobs: 0,
            sponsorMatchedJobs: 0,
          },
        },
        adzuna: {
          jobs: [],
          meta: {
            fetchedJobs: 0,
            totalAvailable: 0,
            truncated: false,
            dateFilteredJobs: 0,
            sponsorMatchedJobs: 0,
          },
        },
        meta: {
          sponsorsParsed: 0,
          date: null,
          graduate: true,
          reedError: message,
          adzunaError: null,
        },
      },
      { status: 200 },
    );
  }
}
