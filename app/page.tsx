"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";

type ChangeEntry = {
  checkedAt: string;
  status: string;
};

type ChangeEvidence = {
  addedCount: number;
  removedCount: number;
  addedSamples: string[];
  removedSamples: string[];
  detectionMethod?: string;
};

type ChangeDetail = {
  id: string;
  changeType: string;
  summary: string | null;
  evidence: ChangeEvidence | null;
  detectedAt: string;
};

type Tender = {
  id: string;
  title: string;
  organization: string;
  deadline: string;
  url: string;
  status: "Monitoring" | "Changed";
  fingerprint: string | null;
  lastChecked: string | null;
  preview: string | null;
  pageTitle: string | null;
  latestChange: ChangeDetail | null;
  changeHistory: ChangeEntry[];
};

type Account = {
  user: { id: string; name: string | null; email: string };
  workspaces: {
    id: string;
    name: string;
    slug: string;
    role: string;
  }[];
};

async function getTenders(workspaceId: string): Promise<Tender[]> {
  const response = await fetch(
    `/api/tenders?workspaceId=${encodeURIComponent(workspaceId)}`,
    { cache: "no-store" }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Could not load your tenders.");
  }

  return Array.isArray(data.tenders) ? data.tenders : [];
}

export default function Home() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [deadline, setDeadline] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/account", {
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.replace("/login?callbackUrl=%2F");
          return;
        }

        const account = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(account.error || "Could not load your account.");
        }

        const data = account as Account;
        const workspace = data.workspaces?.[0];

        if (!workspace) {
          throw new Error("Your account has no accessible workspace.");
        }

        if (!active) return;

        setWorkspaceId(workspace.id);
        setWorkspaceName(workspace.name);
        setAccountEmail(data.user.email);

        const items = await getTenders(workspace.id);

        if (active) setTenders(items);
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load your dashboard."
          );
        }
      } finally {
        if (active) setLoaded(true);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  async function refreshTenders() {
    if (!workspaceId) return;
    const items = await getTenders(workspaceId);
    setTenders(items);
  }

  async function addTender(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!workspaceId) {
      setMessage("Your workspace is not ready.");
      return;
    }

    if (!title.trim() || !url.trim()) {
      setMessage("Enter a tender title and public URL.");
      return;
    }

    let parsed: URL;

    try {
      parsed = new URL(url.trim());
      if (parsed.protocol !== "https:") throw new Error();
    } catch {
      setMessage("Enter a valid HTTPS tender URL.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/tenders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: title.trim(),
          organization: organization.trim(),
          deadline,
          url: parsed.href,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not add the tender.");
      }

      await refreshTenders();

      setTitle("");
      setOrganization("");
      setDeadline("");
      setUrl("");
      setMessage("Tender saved to your workspace database.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Tender creation failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function checkTender(tender: Tender) {
    if (!workspaceId) return;

    setChecking(tender.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/tenders/${encodeURIComponent(tender.id)}/check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || "The tender check failed.");
      }

      await refreshTenders();

      if (data.check?.isBaseline) {
        setMessage("First check complete. Baseline snapshot saved.");
      } else if (data.check?.changeDetected) {
        setMessage("Possible page-text change detected and saved.");
      } else {
        setMessage("Check complete. No page-text change detected.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The check failed."
      );
    } finally {
      setChecking(null);
    }
  }

  async function removeTender(id: string) {
    if (!workspaceId) return;

    setDeleting(id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/tenders/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "DELETE" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not remove the tender.");
      }

      await refreshTenders();
      setMessage("Tender removed from your workspace.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Tender removal failed."
      );
    } finally {
      setDeleting(null);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingCount = tenders.filter((t) => {
    if (!t.deadline) return false;
    const date = new Date(`${t.deadline}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date >= today;
  }).length;

  const changedCount = tenders.filter(
    (t) => t.status === "Changed"
  ).length;

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] text-slate-600">
        Loading your TenderWatch workspace...
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

          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
              Early-access v1.0
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">
              {accountEmail}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
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
            Monitor public tender pages from your workspace. Save page
            snapshots and review possible changes over time.
          </p>
          {workspaceName && (
            <p className="mt-3 text-sm text-slate-500">
              Workspace: <strong>{workspaceName}</strong>
            </p>
          )}
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tracked tenders</p>
            <p className="mt-2 text-3xl font-bold">{tenders.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Possible changes</p>
            <p className="mt-2 text-3xl font-bold">{changedCount}</p>
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
              Current demo support: https://www.pc.gov.pk/web/tender
            </p>

            <form onSubmit={addTender} className="space-y-4">
              <div>
                <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
                  Tender title *
                </label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Supply of office equipment"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label htmlFor="org" className="mb-1.5 block text-sm font-medium">
                  Procuring organization
                </label>
                <input
                  id="org"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Organization name"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label htmlFor="deadline" className="mb-1.5 block text-sm font-medium">
                  Submission deadline
                </label>
                <input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label htmlFor="url" className="mb-1.5 block text-sm font-medium">
                  Public tender URL *
                </label>
                <input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.pc.gov.pk/web/tender"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !workspaceId}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "+ Add to tracker"}
              </button>

              {message && (
                <p role="status" className="text-sm text-slate-600">
                  {message}
                </p>
              )}
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Your tenders</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Checks and history are saved to your workspace database.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {tenders.length} total
              </span>
            </div>

            {tenders.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-5 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  +
                </div>
                <p className="font-semibold">Nothing tracked yet</p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Add a supported public tender URL to start building your list.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {tenders.map((tender) => (
                  <article
                    key={tender.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="break-words font-semibold">{tender.title}</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {tender.organization || "Organization not specified"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                          tender.status === "Changed"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {tender.status === "Changed"
                          ? "Possible change"
                          : "Monitoring"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-600">
                      Deadline: {tender.deadline || "Not provided"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Last checked:{" "}
                      {tender.lastChecked
                        ? new Date(tender.lastChecked).toLocaleString()
                        : "Never"}
                    </p>

                    {(tender.preview || tender.pageTitle) && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700">
                          Latest page snapshot
                        </summary>
                        <p className="mt-2 break-words rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                          {tender.preview || tender.pageTitle}
                        </p>
                      </details>
                    )}

                    {tender.latestChange && (
                      <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-950">
                          Most recent possible change
                        </p>
                        <p className="mt-1 text-xs text-amber-800">
                          Detected: {new Date(tender.latestChange.detectedAt).toLocaleString()}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-amber-950">
                          {tender.latestChange.summary || "Page text differs from the previous snapshot."}
                        </p>

                        {tender.latestChange.evidence && (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold text-emerald-800">
                                Added segments ({tender.latestChange.evidence.addedCount})
                              </p>
                              {tender.latestChange.evidence.addedSamples.length > 0 ? (
                                <ul className="mt-2 space-y-2">
                                  {tender.latestChange.evidence.addedSamples.map((sample, index) => (
                                    <li key={`added-${index}`} className="break-words rounded-lg bg-white p-2 text-xs leading-5 text-slate-700">
                                      + {sample}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-xs text-slate-600">No segment samples available.</p>
                              )}
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-red-800">
                                Removed segments ({tender.latestChange.evidence.removedCount})
                              </p>
                              {tender.latestChange.evidence.removedSamples.length > 0 ? (
                                <ul className="mt-2 space-y-2">
                                  {tender.latestChange.evidence.removedSamples.map((sample, index) => (
                                    <li key={`removed-${index}`} className="break-words rounded-lg bg-white p-2 text-xs leading-5 text-slate-700">
                                      − {sample}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-xs text-slate-600">No segment samples available.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    {tender.changeHistory?.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700">
                          Check history ({tender.changeHistory.length})
                        </summary>
                        <ul className="mt-2 space-y-2 text-xs text-slate-600">
                          {[...tender.changeHistory].reverse().map((entry, index) => (
                            <li
                              key={`${entry.checkedAt}-${index}`}
                              className="rounded-lg bg-slate-50 p-2"
                            >
                              <span className="font-medium">{entry.status}</span>
                              <br />
                              {new Date(entry.checkedAt).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <a
                        href={tender.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium text-blue-700 hover:underline"
                      >
                        Open tender ↗
                      </a>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          disabled={checking !== null || deleting !== null}
                          onClick={() => checkTender(tender)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {checking === tender.id ? "Checking..." : "Check for updates"}
                        </button>
                        <button
                          type="button"
                          disabled={deleting !== null || checking !== null}
                          onClick={() => removeTender(tender.id)}
                          className="text-sm text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deleting === tender.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>Important:</strong> the first successful check establishes
              a baseline. Later checks compare page-text fingerprints. A
              difference means possible page changes, not necessarily a tender
              amendment. Automatic monitoring runs daily. Email alerts are not currently available.
            </p>
          </section>
        </div>

        <footer className="mt-10 border-t border-slate-200 py-6 text-sm text-slate-500">
          TenderWatch · Early v1.0
        </footer>
      </div>
    </main>
  );
}