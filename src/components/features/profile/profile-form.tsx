"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { ProfileDTO, UpdateProfileInput } from "@/contracts/profile";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";
import { ChipInput } from "./chip-input";
import { COURSE_RULES, SKILL_RULES } from "./chips";

const BIO_MAX = 500;

interface Draft {
  name: string;
  timezone: string;
  courses: string[];
  skills: string[];
  bio: string;
}

function toDraft(p: ProfileDTO): Draft {
  return { name: p.name, timezone: p.timezone, courses: p.courses, skills: p.skills, bio: p.bio ?? "" };
}

function sameDraft(a: Draft, b: Draft) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Server field errors arrive as "skills" or "skills.3"; show either under the field. */
function fieldError(errors: Record<string, string>, field: string): string | undefined {
  if (errors[field]) return errors[field];
  const key = Object.keys(errors).find((k) => k.startsWith(`${field}.`));
  return key ? errors[key] : undefined;
}

function withCurrent(zones: string[], current: string): string[] {
  return zones.includes(current) ? zones : [current, ...zones];
}

const noSubscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;

/** `timeZones` comes from the server so the rendered options match during hydration (browsers' lists differ). */
export function ProfileForm({ profile, timeZones }: { profile: ProfileDTO; timeZones: string[] }) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(profile));
  const [draft, setDraft] = useState<Draft>(saved);
  // The browser's zone is only known on the client: null during server render, the real zone after hydration.
  const detectedZone = useSyncExternalStore(noSubscribe, browserTimeZone, () => null);
  const { run, pending, fieldErrors } = useApiAction();
  const zones = useMemo(() => withCurrent(timeZones, saved.timezone), [timeZones, saved.timezone]);
  const dirty = !sameDraft(draft, saved);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;
    const body: UpdateProfileInput = {
      name: draft.name,
      timezone: draft.timezone,
      courses: draft.courses,
      skills: draft.skills,
      bio: draft.bio.trim() === "" ? null : draft.bio,
    };
    const updated = await run(() => apiFetch<ProfileDTO>("/api/v1/me/profile", { method: "PATCH", body }), {
      success: "Profile saved",
    });
    if (updated) {
      const next = toDraft(updated);
      setSaved(next);
      setDraft(next);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" aria-label="Your profile">
      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" required error={fieldError(fieldErrors, "name")}>
            <Input
              name="name"
              autoComplete="name"
              maxLength={80}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </FormField>
          <FormField label="Email" hint="Your email is your sign-in and can't be changed.">
            <Input name="email" type="email" value={profile.email} readOnly className="bg-slate-50 text-slate-600" />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time zone</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <FormField
            label="Your time zone"
            hint="Meeting times, due dates, and your availability grid are shown in this zone."
            error={fieldError(fieldErrors, "timezone")}
          >
            <Select name="timezone" value={draft.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </FormField>
          {detectedZone && detectedZone !== draft.timezone && zones.includes(detectedZone) ? (
            <p className="text-sm text-slate-600">
              Detected: <span className="font-medium text-slate-800">{detectedZone.replaceAll("_", " ")}</span> ·{" "}
              <button
                type="button"
                className="text-brand-700 font-medium hover:underline"
                onClick={() => set("timezone", detectedZone)}
              >
                Use this
              </button>
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Courses</CardTitle>
        </CardHeader>
        <CardBody>
          <FormField
            label="Add a course"
            hint={`Course code, like CSE 6324. Press Enter to add. ${draft.courses.length} of ${COURSE_RULES.max}.`}
            error={fieldError(fieldErrors, "courses")}
          >
            <ChipInput
              values={draft.courses}
              onChange={(v) => set("courses", v)}
              rules={COURSE_RULES}
              placeholder="CSE 6324"
              listLabel="Your courses"
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardBody>
          <FormField
            label="Add a skill"
            hint={`What you can help your team with, like Testing or UI design. Press Enter to add. ${draft.skills.length} of ${SKILL_RULES.max}.`}
            error={fieldError(fieldErrors, "skills")}
          >
            <ChipInput
              values={draft.skills}
              onChange={(v) => set("skills", v)}
              rules={SKILL_RULES}
              placeholder="Testing"
              listLabel="Your skills"
            />
          </FormField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bio</CardTitle>
        </CardHeader>
        <CardBody>
          <FormField
            label="About you"
            hint={`${draft.bio.length} / ${BIO_MAX} characters. Only your teammates can see this.`}
            error={fieldError(fieldErrors, "bio")}
          >
            <Textarea
              name="bio"
              maxLength={BIO_MAX}
              rows={4}
              value={draft.bio}
              onChange={(e) => set("bio", e.target.value)}
            />
          </FormField>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {dirty ? (
          <>
            <span className="text-sm text-slate-600">You have unsaved changes.</span>
            <Button variant="ghost" onClick={() => setDraft(saved)} disabled={pending}>
              Undo changes
            </Button>
          </>
        ) : null}
        <Button type="submit" disabled={!dirty} loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
