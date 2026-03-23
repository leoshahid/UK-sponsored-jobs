"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchedJob } from "@/app/api/jobs/route";

type JobsApiResponse = {
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

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return "Not specified";
  if (min && max)
    return `GBP ${min.toLocaleString()} - ${max.toLocaleString()}`;
  if (min) return `From GBP ${min.toLocaleString()}`;
  return `Up to GBP ${max!.toLocaleString()}`;
}

function getMatchTypeStyle(matchType: MatchedJob["matchType"]): {
  label: string;
  className: string;
} {
  if (matchType === "exact") {
    return {
      label: "Exact Match",
      className: "bg-green-100 text-green-800 border-green-200"
    };
  }

  if (matchType === "normalized") {
    return {
      label: "Normalized Match",
      className: "bg-blue-100 text-blue-800 border-blue-200"
    };
  }

  return {
    label: "Fuzzy Match",
    className: "bg-amber-100 text-amber-800 border-amber-200"
  };
}

export function JobListClient() {
  const PAGE_SIZE = 20;
  const [data, setData] = useState<JobsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [graduateOnly, setGraduateOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        if (!graduateOnly) params.set("graduate", "false");
        const query = params.toString();
        const res = await fetch(`/api/jobs${query ? `?${query}` : ""}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load jobs.");
        }

        setData(json as JobsApiResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [fromDate, toDate, graduateOnly]);

  const locations = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(data.jobs.map((job) => job.locationName).filter(Boolean)),
    ).sort();
  }, [data]);

  const routes = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(data.jobs.map((job) => job.sponsorRoute).filter(Boolean)),
    ).sort();
  }, [data]);

  const filteredJobs = useMemo(() => {
    if (!data) return [];

    const q = search.trim().toLowerCase();

    return data.jobs.filter((job) => {
      const matchesQuery =
        !q ||
        [job.jobTitle, job.employerName, job.locationName]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesLocation =
        locationFilter === "all" || job.locationName === locationFilter;
      const matchesRoute =
        routeFilter === "all" || job.sponsorRoute === routeFilter;

      return matchesQuery && matchesLocation && matchesRoute;
    });
  }, [data, locationFilter, routeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const paginatedJobs = filteredJobs.slice(pageStart, pageEnd);

  useEffect(() => {
    setCurrentPage(1);
  }, [fromDate, toDate, graduateOnly, search, locationFilter, routeFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        Loading jobs...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        Error loading jobs: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        No data received.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Use date range filters to narrow Reed jobs by posted date before
          sponsor matching.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-6">
        <input
          type="date"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />

        <input
          type="date"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search title, company, location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={graduateOnly}
            onChange={(e) => setGraduateOnly(e.target.checked)}
          />
          Graduate only
        </label>

        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
        >
          <option value="all">All locations</option>
          {locations.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
        >
          <option value="all">All sponsor routes</option>
          {routes.map((route) => (
            <option key={route} value={route}>
              {route}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-700">Results: {filteredJobs.length}</p>
        <p className="mt-1 text-xs text-slate-500">
          Showing {filteredJobs.length === 0 ? 0 : pageStart + 1}-{Math.min(pageEnd, filteredJobs.length)} of{" "}
          {filteredJobs.length}
        </p>
      </div>

      {paginatedJobs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
          No sponsor-matched jobs found with the current filters.
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedJobs.map((job) => (
            <article
              key={job.jobId}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {job.jobTitle}
                  </h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {job.employerName}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getMatchTypeStyle(job.matchType).className}`}
                >
                  Sponsor Match
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                <p>
                  <strong>Matched sponsor:</strong> {job.matchedSponsorName}
                </p>
                <p>
                  <strong>Match type:</strong> {getMatchTypeStyle(job.matchType).label}
                </p>
                <p>
                  <strong>Location:</strong> {job.locationName || "N/A"}
                </p>
                <p>
                  <strong>Salary:</strong>{" "}
                  {formatSalary(job.minimumSalary, job.maximumSalary)}
                </p>
                <p>
                  <strong>Reed posted date:</strong> {job.reedDate}
                </p>
                <p>
                  <strong>Sponsor town/city:</strong>{" "}
                  {job.sponsorTownCity || "N/A"}
                </p>
                <p>
                  <strong>Sponsor county:</strong> {job.sponsorCounty || "N/A"}
                </p>
                <p>
                  <strong>Sponsor route:</strong> {job.sponsorRoute || "N/A"}
                </p>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Match debug: Reed employer &quot;
                {job.matchDebug.reedEmployerName}&quot; vs CSV sponsor &quot;
                {job.matchDebug.sponsorName}&quot;
              </p>

              <a
                href={job.reedUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Open Reed job
              </a>
            </article>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-700">
          Page {safePage} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Debug info</h2>
        <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
          <p>Total sponsors parsed: {data.meta.sponsorsParsed}</p>
          <p>Total Reed jobs fetched: {data.meta.reedJobsFetched}</p>
          <p>Total entry-level jobs: {data.meta.entryLevelJobs}</p>
          <p>Total date-filtered jobs: {data.meta.dateFilteredJobs}</p>
          <p>Total sponsor-matched jobs: {data.meta.sponsorMatchedJobs}</p>
          <p>Graduate filter: {data.meta.graduate ? "On" : "Off"}</p>
        </div>
      </div>
    </div>
  );
}
