"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import type { ResourceDTO, ResourceTypeValue } from "@/contracts/resources";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { cn } from "@/lib/utils";
import { ResourceFormDialog } from "./resource-form-dialog";
import { ResourceRow } from "./resource-row";

const FILTERS: Array<{ value: ResourceTypeValue | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "NOTE", label: "Notes" },
  { value: "LINK", label: "Links" },
  { value: "FILE_REF", label: "Files" },
];

export function ResourcesView({
  teamId,
  resources,
  me,
  timeZone,
  type,
  q,
}: {
  teamId: string;
  resources: ResourceDTO[];
  me: { id: string; isLeader: boolean };
  timeZone: string;
  type: ResourceTypeValue | "";
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceDTO | null>(null);
  const [deleting, setDeleting] = useState<ResourceDTO | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [search, setSearch] = useState(q);
  // Resync the box when ?q= changes from outside (Back/Forward). Our own debounced pushes are
  // remembered in `pushedQ` so they don't overwrite what the user is still typing.
  const [seenQ, setSeenQ] = useState(q);
  const [pushedQ, setPushedQ] = useState(q);
  if (q !== seenQ) {
    setSeenQ(q);
    if (q !== pushedQ) setSearch(q);
  }
  const action = useApiAction();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search box → ?q= (debounced) so results come from the server and the URL is shareable.
  useEffect(() => {
    if (search.trim() === q) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
      setPushedQ(search.trim());
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [search, q, params, pathname, router]);

  function filterHref(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("type", value);
    else next.delete("type");
    return next.size ? `${pathname}?${next}` : pathname;
  }

  async function togglePin(r: ResourceDTO) {
    setPinningId(r.id);
    await action.run(
      () => apiFetch(`/api/v1/teams/${teamId}/resources/${r.id}`, { method: "PATCH", body: { pinned: !r.pinned } }),
      { success: r.pinned ? "Unpinned" : "Pinned to the top" },
    );
    setPinningId(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const ok = await action.run(
      () => apiFetch(`/api/v1/teams/${teamId}/resources/${deleting.id}`, { method: "DELETE" }),
      {
        success: "Deleted",
      },
    );
    if (ok) setDeleting(null);
  }

  const pinned = resources.filter((r) => r.pinned);
  const others = resources.filter((r) => !r.pinned);
  const filtered = Boolean(type || q);

  const renderList = (items: ResourceDTO[]) => (
    <ul className="bg-surface divide-y divide-slate-100 rounded-lg border border-slate-200">
      {items.map((r) => (
        <ResourceRow
          key={r.id}
          resource={r}
          timeZone={timeZone}
          canEdit={me.isLeader || r.createdBy.id === me.id}
          pinPending={pinningId === r.id}
          onTogglePin={() => togglePin(r)}
          onEdit={() => {
            setEditing(r);
            setFormOpen(true);
          }}
          onDelete={() => setDeleting(r)}
        />
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Resources"
        description="Notes, links, and file references for the whole team. Files stay in Drive, OneDrive, or Canvas."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus aria-hidden /> Add
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by type" className="flex gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={filterHref(f.value)}
              scroll={false}
              aria-current={type === f.value ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium",
                type === f.value ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search resources"
            placeholder="Search titles and notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {resources.length === 0 ? (
        filtered ? (
          <EmptyState title="Nothing matches" description="Try another word or type, or clear the filters." />
        ) : (
          <EmptyState
            title="No resources yet"
            description="Share the syllabus, your Drive folder, or meeting notes so everyone can find them."
            action={<Button onClick={() => setFormOpen(true)}>Add the first one</Button>}
          />
        )
      ) : (
        <>
          {pinned.length > 0 ? (
            <section aria-labelledby="pinned-heading" className="flex flex-col gap-2">
              <h3 id="pinned-heading" className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Pinned
              </h3>
              {renderList(pinned)}
            </section>
          ) : null}
          {others.length > 0 ? (
            <section aria-labelledby="all-heading" className="flex flex-col gap-2">
              <h3 id="all-heading" className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {pinned.length > 0 ? "Everything else" : "Newest first"}
              </h3>
              {renderList(others)}
            </section>
          ) : null}
        </>
      )}

      {formOpen ? (
        <ResourceFormDialog
          key={editing?.id ?? "new"}
          teamId={teamId}
          open={formOpen}
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        pending={action.pending}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="It will be removed for everyone on the team. This can't be undone."
      />
    </div>
  );
}
