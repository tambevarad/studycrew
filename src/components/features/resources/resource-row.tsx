"use client";

import { ExternalLink, FileText, Link2, Pencil, Pin, PinOff, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ResourceDTO } from "@/contracts/resources";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { detectSource, hostOf } from "./source";

const ICON = { NOTE: StickyNote, LINK: Link2, FILE_REF: FileText } as const;
const TYPE_LABEL = { NOTE: "Note", LINK: "Link", FILE_REF: "File" } as const;

export function ResourceRow({
  resource,
  timeZone,
  canEdit,
  pinPending,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  resource: ResourceDTO;
  timeZone: string;
  canEdit: boolean;
  pinPending: boolean;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON[resource.type];
  const source = detectSource(resource.url);
  const bodyId = `note-${resource.id}`;

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 rounded-md bg-slate-100 p-1.5 text-slate-600">
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{TYPE_LABEL[resource.type]}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {resource.type === "NOTE" ? (
            <button
              type="button"
              className="hover:text-brand-700 text-left font-medium text-slate-900"
              aria-expanded={expanded}
              aria-controls={bodyId}
              onClick={() => setExpanded((v) => !v)}
            >
              {resource.title}
            </button>
          ) : (
            <a
              href={resource.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 inline-flex items-center gap-1 font-medium hover:underline"
            >
              {resource.title}
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          {source ? (
            <Badge tone={source === "Web" ? "neutral" : "brand"}>
              {source === "Web" ? hostOf(resource.url) : source}
            </Badge>
          ) : null}
          {resource.pinned ? <Badge tone="warning">Pinned</Badge> : null}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Added by {resource.createdBy.name} ·{" "}
          <time
            dateTime={resource.createdAt}
            title={formatDateTime(resource.createdAt, timeZone)}
            suppressHydrationWarning
          >
            {relativeTime(resource.createdAt, undefined, timeZone)}
          </time>
        </p>
        {resource.type === "NOTE" ? (
          <div
            id={bodyId}
            hidden={!expanded}
            className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-800"
          >
            {resource.body}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label={`Pin “${resource.title}”`}
          pressed={resource.pinned}
          disabled={pinPending}
          onClick={onTogglePin}
        >
          {resource.pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
        </IconButton>
        {canEdit ? (
          <>
            <IconButton label={`Edit “${resource.title}”`} onClick={onEdit}>
              <Pencil className="size-4" aria-hidden />
            </IconButton>
            <IconButton label={`Delete “${resource.title}”`} onClick={onDelete} danger>
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </>
        ) : null}
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  children,
  pressed,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50",
        danger ? "hover:text-danger-700" : "hover:text-slate-800",
        pressed && "text-warning-700",
      )}
    >
      {children}
    </button>
  );
}
