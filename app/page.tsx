"use client";

import { useEffect, useState } from "react";

type Tender = {
  id: number;
  title: string;
  organization: string;
  deadline: string;
  url: string;
  status: "Monitoring" | "Changed";
  fingerprint?: string;
  lastChecked?: string;
  previousFingerprint?: string;
  changeHistory?: { checkedAt: string; status: string }[];
  preview?: string;
};

const STORAGE_KEY = "tenderwatch-tenders";

export default function Home() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [deadline, setDeadline] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setTenders(parsed as Tender[]);
      }
    } catch {
      console.error("Could not load saved tenders.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tenders));
    } catch {
      setMessage("Could not save changes in this browser.");
    }
  }, [tenders, loaded]);

  function addTender(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!title.trim() || !url.trim()) {
      setMessage("Enter a tender title and public URL.");
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      setMessage("Enter a valid URL starting with https:// or http://");
      return;
    }

    setTenders((current) => [
      {
        id: Date.now(),
        title: title.trim(),
        organization: organization.trim() || "Not specified",
        deadline,
        url: parsed.href,
        status: "Monitoring",
        changeHistory: [],
      },
      ...current,
    ]);

    setTitle("");
    setOrganization("");
    setDeadline("");
    setUrl("");
    setMessage("Tender added. Run the first check to save its baseline.");
  }

  async function checkTender(tender: Tender) {
    setChecking(tender.id);
    setMessage("");

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tender.url }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "The page could not be checked.");
      }

      const checkedAt = result.checkedAt as string;

      setTenders((current) =>
        current.map((item) => {
          if (item.id !== tender.id) return item;

          const isFirstCheck = !item.fingerprint;
          const changed =
            !isFirstCheck && item.fingerprint !== result.fingerprint;

          const status = isFirstCheck
            ? "Baseline saved"
            : changed
              ? "Possible change detected"
              : "No page-text change";

          return {
            ...item,
            status: changed ? "Changed" : "Monitoring",
            previousFingerprint: isFirstCheck
              ? item.previousFingerprint
              : item.fingerprint,
            fingerprint: result.fingerprint,
            lastChecked: checkedAt,
            preview: result.preview,
            changeHistory: [
              ...(item.changeHistory || []),
              { checkedAt, status },
            ].slice(-20),
          };
        })
      );

      setMessage(
        !tender.fingerprint
          ? "First check complete. Baseline saved."
          : "Check complete. Review the tender's latest status."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The check failed."
      );
    } finally {
      setChecking(null);
    }
  }

  function removeTender(id: number) {
    setTenders((current) => current.filter((t) => t.id !== id));
    setMessage("Tender removed.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingCount = tenders.filter((t) => {
    if (!t.deadline) return false;
    const date = new Date(`${t.deadline}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date >= today;
  }).length;

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] text-slate-600">
        Loading your tenders...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
              T
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">TenderWatch</h1>
              <p className="text-xs text-slate-500">Tender change tracking</p>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
<<<<<<< HEAD
            Early-access v1.0
=======
            Prototype
>>>>>>> 8758894ca7d8cfe6328fb4f38071d3985709c1a3
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-9">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Procurement monitoring
          </p>
          <h2 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Spot changes on a tender page.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Track the Ministry of Planning tender page in this demo. Compare
            page-text snapshots manually to spot possible changes.
          </p>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tracked tenders</p>
            <p className="mt-2 text-3xl font-bold">{tenders.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Possible changes</p>
            <p className="mt-2 text-3xl font-bold">
              {tenders.filter((t) => t.status === "Changed").length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Upcoming deadlines</p>
            <p className="mt-2 text-3xl font-bold">{upcomingCount}</p>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-bold">Add a tender</h3>
            <p className="mb-6 mt-1 text-sm text-slate-500">
              Demo support is currently limited to https://www.pc.gov.pk/web/tender.
            </p>

            <form onSubmit={addTender} className="space-y-4">
              <div>
                <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
                  Tender title *
                </label>
                <input id="title" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Supply of office equipment" required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div>
                <label htmlFor="org" className="mb-1.5 block text-sm font-medium">
                  Procuring organization
                </label>
                <input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Organization name"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div>
                <label htmlFor="deadline" className="mb-1.5 block text-sm font-medium">
                  Submission deadline
                </label>
                <input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <div>
                <label htmlFor="url" className="mb-1.5 block text-sm font-medium">
                  Public tender URL *
                </label>
                <input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..." required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500" />
              </div>
              <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-700">
                + Add to tracker
              </button>
              {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Your tenders</h3>
                <p className="mt-1 text-sm text-slate-500">Check each page manually for possible changes.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {tenders.length} total
              </span>
            </div>

            {tenders.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-5 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">+</div>
                <p className="font-semibold">Nothing tracked yet</p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Add a public tender URL to start building your list.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {tenders.map((tender) => (
                  <article key={tender.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="break-words font-semibold">{tender.title}</h4>
                        <p className="mt-1 text-sm text-slate-500">{tender.organization}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                        tender.status === "Changed"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {tender.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-600">
                      Deadline: {tender.deadline || "Not provided"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Last checked: {tender.lastChecked ? new Date(tender.lastChecked).toLocaleString() : "Never"}
                    </p>

                    {tender.preview && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700">
                          Latest page preview
                        </summary>
                        <p className="mt-2 break-words rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                          {tender.preview}
                        </p>
                      </details>
                    )}

                    {tender.changeHistory && tender.changeHistory.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700">
                          Check history ({tender.changeHistory.length})
                        </summary>
                        <ul className="mt-2 space-y-2 text-xs text-slate-600">
                          {[...tender.changeHistory].reverse().map((entry, index) => (
                            <li key={`${entry.checkedAt}-${index}`} className="rounded-lg bg-slate-50 p-2">
                              <span className="font-medium">{entry.status}</span>
                              <br />
                              {new Date(entry.checkedAt).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <a href={tender.url} target="_blank" rel="noopener noreferrer"
                        className="truncate text-sm font-medium text-blue-700 hover:underline">
                        Open tender ?
                      </a>
                      <div className="flex gap-3">
                        <button type="button" disabled={checking !== null}
                          onClick={() => checkTender(tender)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                          {checking === tender.id ? "Checking..." : "Check for updates"}
                        </button>
                        <button type="button" onClick={() => removeTender(tender.id)}
                          className="text-sm text-red-600 hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>Important:</strong> the first successful check establishes a baseline.
              Later checks compare page-text fingerprints. A difference means possible page
              changes, not necessarily a tender amendment. Automatic scheduling and alerts
              are not implemented.
            </p>
          </section>
        </div>

        <footer className="mt-10 border-t border-slate-200 py-6 text-sm text-slate-500">
<<<<<<< HEAD
          TenderWatch · Early v1.0
=======
          TenderWatch Â· Prototype
>>>>>>> 8758894ca7d8cfe6328fb4f38071d3985709c1a3
        </footer>
      </div>
    </main>
  );
}


