import { JobListClient } from "@/components/JobListClient";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] px-3 py-8 md:px-4 md:py-12">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          UK Entry-Level Jobs with Sponsor Match (Reed + Adzuna)
        </h1>
        <p className="text-sm text-slate-700 md:text-base">
          This demo fetches jobs from Reed and Adzuna, keeps the listings
          separate side-by-side, and shows only employers that match
          organisations in your local sponsorship licence CSV.
        </p>
      </header>
      <h2 className="text-2xl font-bold tracking-tight text-red-500 md:text-3xl text-center">
        The Free Quota has been expired.
      </h2>
      <p className="text-sm text-slate-700 md:text-base text-center">
        Please upgrade to a paid plan to continue using the service.
      </p>
      {/* <JobListClient /> */}
    </main>
  );
}
