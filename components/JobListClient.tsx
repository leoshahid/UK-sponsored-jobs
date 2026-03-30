"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchedJob } from "@/app/api/jobs/route";

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

type JobsApiResponse = {
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

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return "Not specified";
  if (min && max) return `GBP ${min.toLocaleString()} - ${max.toLocaleString()}`;
  if (min) return `From GBP ${min.toLocaleString()}`;
  return `Up to GBP ${max!.toLocaleString()}`;
}

function getMatchTypeStyle(matchType: MatchedJob["matchType"]): { label: string; className: string } {
  if (matchType === "exact") {
    return { label: "Exact Match", className: "bg-green-100 text-green-800 border-green-200" };
  }
  if (matchType === "normalized") {
    return { label: "Normalized Match", className: "bg-blue-100 text-blue-800 border-blue-200" };
  }
  return { label: "Fuzzy Match", className: "bg-amber-100 text-amber-800 border-amber-200" };
}

function SourceColumn({
  title,
  jobs,
  meta,
  search,
  locationFilter,
  routeFilter,
  page,
  onPageChange
}: {
  title: string;
  jobs: MatchedJob[];
  meta: SourceBlock["meta"];
  search: string;
  locationFilter: string;
  routeFilter: string;
  page: number;
  onPageChange: (next: number) => void;
}) {
  const PAGE_SIZE = 10;

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesQuery = !q || [job.jobTitle, job.employerName, job.locationName].join(" ").toLowerCase().includes(q);
      const matchesLocation = locationFilter === "all" || job.locationName === locationFilter;
      const matchesRoute = routeFilter === "all" || job.sponsorRoute === routeFilter;
      return matchesQuery && matchesLocation && matchesRoute;
    });
  }, [jobs, search, locationFilter, routeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedJobs = filteredJobs.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
  }, [page, totalPages, onPageChange]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="text-sm text-slate-600">Results: {filteredJobs.length}</span>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Showing {filteredJobs.length === 0 ? 0 : pageStart + 1}-{Math.min(pageEnd, filteredJobs.length)} of {filteredJobs.length}
      </p>

      {paginatedJobs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">No matching jobs.</div>
      ) : (
        <div className="space-y-3">
          {paginatedJobs.map((job) => (
            <article key={`${title}-${job.jobId}`} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{job.jobTitle}</h3>
                  <p className="text-sm text-slate-700">{job.employerName}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getMatchTypeStyle(job.matchType).className}`}>
                  {getMatchTypeStyle(job.matchType).label}
                </span>
              </div>

              <div className="mt-3 grid gap-1 text-sm text-slate-700">
                <p><strong>Matched sponsor:</strong> {job.matchedSponsorName}</p>
                <p><strong>Category:</strong> {job.category || "N/A"}</p>
                <p><strong>Location:</strong> {job.locationName || "N/A"}</p>
                <p><strong>Salary:</strong> {formatSalary(job.minimumSalary, job.maximumSalary)}</p>
                <p><strong>Posted date:</strong> {job.postedDate}</p>
                <p><strong>Sponsor town/city:</strong> {job.sponsorTownCity || "N/A"}</p>
                <p><strong>Sponsor county:</strong> {job.sponsorCounty || "N/A"}</p>
                <p><strong>Sponsor route:</strong> {job.sponsorRoute || "N/A"}</p>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Match debug: employer "{job.matchDebug.employerName}" vs CSV sponsor "{job.matchDebug.sponsorName}"
              </p>

              <a
                href={job.jobUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100"
              >
                Open job
              </a>
            </article>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-700">Page {safePage} of {totalPages}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-sm disabled:opacity-50"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-sm disabled:opacity-50"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p>Fetched: {meta.fetchedJobs}</p>
        <p>Total available in source: {meta.totalAvailable}</p>
        <p>Truncated by limit: {meta.truncated ? "Yes" : "No"}</p>
        <p>Date-filtered: {meta.dateFilteredJobs}</p>
        <p>Sponsor-matched: {meta.sponsorMatchedJobs}</p>
      </div>
    </section>
  );
}

export function JobListClient() {
  const [data, setData] = useState<JobsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState("");
  const [graduateOnly, setGraduateOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");
  const [reedPage, setReedPage] = useState(1);
  const [adzunaPage, setAdzunaPage] = useState(1);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (selectedDate) params.set("date", selectedDate);
        if (!graduateOnly) params.set("graduate", "false");
        const query = params.toString();
        const res = await fetch(`/api/jobs${query ? `?${query}` : ""}`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error ?? "Failed to load jobs.");
        setData(json as JobsApiResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [selectedDate, graduateOnly]);

  useEffect(() => {
    setReedPage(1);
    setAdzunaPage(1);
  }, [selectedDate, graduateOnly, search, locationFilter, routeFilter]);

  const locations = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set([...data.reed.jobs, ...data.adzuna.jobs].map((job) => job.locationName).filter(Boolean))
    ).sort();
  }, [data]);

  const routes = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set([...data.reed.jobs, ...data.adzuna.jobs].map((job) => job.sponsorRoute).filter(Boolean))
    ).sort();
  }, [data]);

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6">Loading jobs...</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">Error loading jobs: {error}</div>;
  }

  if (!data) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6">No data received.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        Side-by-side comparison: Reed and Adzuna listings are shown separately and matched independently against the same sponsor CSV.
      </div>
      {data.meta.adzunaError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Adzuna is temporarily unavailable and Reed results are still shown. Details: {data.meta.adzunaError}
        </div>
      )}
      {data.meta.reedError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Reed is temporarily unavailable and only partial results can be shown. Details: {data.meta.reedError}
        </div>
      )}

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-6">
        <input type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search title, company, location" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          <input type="checkbox" checked={graduateOnly} onChange={(e) => setGraduateOnly(e.target.checked)} />
          Graduate only
        </label>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
          <option value="all">All locations</option>
          {locations.map((location) => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
          <option value="all">All sponsor routes</option>
          {routes.map((route) => (
            <option key={route} value={route}>{route}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SourceColumn
          title="Reed"
          jobs={data.reed.jobs}
          meta={data.reed.meta}
          search={search}
          locationFilter={locationFilter}
          routeFilter={routeFilter}
          page={reedPage}
          onPageChange={setReedPage}
        />
        <SourceColumn
          title="Adzuna"
          jobs={data.adzuna.jobs}
          meta={data.adzuna.meta}
          search={search}
          locationFilter={locationFilter}
          routeFilter={routeFilter}
          page={adzunaPage}
          onPageChange={setAdzunaPage}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Global debug</h2>
        <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
          <p>Total sponsors parsed: {data.meta.sponsorsParsed}</p>
          <p>Graduate filter: {data.meta.graduate ? "On" : "Off"}</p>
          <p>Date: {data.meta.date ?? "N/A"}</p>
          <p>Reed status: {data.meta.reedError ? "Error" : "OK"}</p>
          <p>Adzuna status: {data.meta.adzunaError ? "Error" : "OK"}</p>
        </div>
      </div>
    </div>
  );
}
