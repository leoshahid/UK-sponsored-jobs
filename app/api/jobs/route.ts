import { NextResponse } from "next/server";
import { fetchReedJobs, filterEntryLevelJobs, filterJobsByDateRange, type ReedJob } from "@/lib/reed";
import { loadSponsors, matchSponsorByCompanyName, type SponsorRecord } from "@/lib/sponsors";

export type MatchedJob = {
  jobId: number;
  jobTitle: string;
  employerName: string;
  matchedSponsorName: string;
  matchType: "exact" | "normalized" | "fuzzy";
  locationName: string;
  minimumSalary?: number;
  maximumSalary?: number;
  reedDate: string;
  reedUrl: string;
  sponsorTownCity: string;
  sponsorCounty: string;
  sponsorRoute: string;
  matchDebug: {
    reedEmployerName: string;
    sponsorName: string;
  };
};

function mapMatchedJobs(jobs: ReedJob[], sponsors: SponsorRecord[]) {
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
        locationName: job.locationName,
        minimumSalary: job.minimumSalary,
        maximumSalary: job.maximumSalary,
        reedDate: job.date,
        reedUrl: job.jobUrl,
        sponsorTownCity: match.sponsor.townCity,
        sponsorCounty: match.sponsor.county,
        sponsorRoute: match.sponsor.route,
        matchDebug: {
          reedEmployerName: match.reedEmployerName,
          sponsorName: match.sponsor.organisationName
        }
      } satisfies MatchedJob;
    })
    .filter((job) => Boolean(job));

  return mapped as MatchedJob[];
}

function isIsoDate(value: string | null): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

type JobsApiPayload = {
  jobs: MatchedJob[];
  meta: {
    sponsorsParsed: number;
    reedJobsFetched: number;
    entryLevelJobs: number;
    dateFilteredJobs: number;
    sponsorMatchedJobs: number;
    fromDate: string | null;
    toDate: string | null;
    graduate: boolean;
  };
};

const ROUTE_CACHE_TTL_MS = 60 * 1000;
const routeCache = new Map<string, { payload: JobsApiPayload; expiresAt: number }>();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const graduateParam = searchParams.get("graduate");
    const graduate = graduateParam === null ? true : graduateParam !== "false";
    const cacheKey = `${fromDate ?? ""}:${toDate ?? ""}:${graduate}`;

    if (fromDate && !isIsoDate(fromDate)) {
      return NextResponse.json({ error: "Invalid fromDate format. Use YYYY-MM-DD." }, { status: 400 });
    }

    if (toDate && !isIsoDate(toDate)) {
      return NextResponse.json({ error: "Invalid toDate format. Use YYYY-MM-DD." }, { status: 400 });
    }

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json({ error: "fromDate cannot be later than toDate." }, { status: 400 });
    }

    const cached = routeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload);
    }

    const sponsors = await loadSponsors();
    const reedJobs = await fetchReedJobs({ maxPages: 60, resultsToTake: 100, graduate });
    const entryLevelJobs = graduate ? reedJobs : filterEntryLevelJobs(reedJobs);
    const dateFilteredJobs = filterJobsByDateRange(entryLevelJobs, fromDate, toDate);
    const matchedJobs = mapMatchedJobs(dateFilteredJobs, sponsors);

    const payload: JobsApiPayload = {
      jobs: matchedJobs,
      meta: {
        sponsorsParsed: sponsors.length,
        reedJobsFetched: reedJobs.length,
        entryLevelJobs: entryLevelJobs.length,
        dateFilteredJobs: dateFilteredJobs.length,
        sponsorMatchedJobs: matchedJobs.length,
        fromDate,
        toDate,
        graduate
      }
    };

    routeCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + ROUTE_CACHE_TTL_MS
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while loading jobs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
