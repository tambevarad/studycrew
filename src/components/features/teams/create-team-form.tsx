"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import type { TeamDetailDTO } from "@/contracts/teams";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";

const DESCRIPTION_MAX = 500;

/** PB-04 `/teams/new`: name, course, description, listed toggle → the new team's members page. */
export function CreateTeamForm({ defaultCourse }: { defaultCourse: string }) {
  const router = useRouter();
  const { run, pending, fieldErrors } = useApiAction();
  const [description, setDescription] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const team = await run(
      () =>
        apiFetch<TeamDetailDTO>("/api/v1/teams", {
          method: "POST",
          body: {
            name: String(form.get("name") ?? ""),
            courseCode: String(form.get("courseCode") ?? ""),
            description: description.trim() || undefined,
            isOpen: form.get("isOpen") === "on",
          },
        }),
      { success: "Team created", refresh: false },
    );
    if (team) {
      router.push(`/teams/${team.id}/members?created=1`);
      router.refresh(); // the sidebar lists the new team
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-label="Create a team">
          <FormField label="Team name" required error={fieldErrors.name}>
            <Input name="name" maxLength={80} autoComplete="off" placeholder="e.g. Query Optimizers" />
          </FormField>
          <FormField
            label="Course code"
            required
            hint="Like CSE 6324. Classmates search by course, so use the code from your syllabus."
            error={fieldErrors.courseCode}
          >
            <Input name="courseCode" maxLength={20} defaultValue={defaultCourse} autoComplete="off" />
          </FormField>
          <FormField
            label="Description"
            hint={`${description.length} / ${DESCRIPTION_MAX}. What you're working on and who you're looking for.`}
            error={fieldErrors.description}
          >
            <Textarea
              name="description"
              maxLength={DESCRIPTION_MAX}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <div className="flex items-start gap-3">
            <input
              id="isOpen"
              name="isOpen"
              type="checkbox"
              defaultChecked
              className="accent-brand-600 mt-0.5 size-4"
              aria-describedby="isOpen-hint"
            />
            <div>
              <label htmlFor="isOpen" className="text-sm font-medium text-slate-800">
                Listed in course search
              </label>
              <p id="isOpen-hint" className="text-xs text-slate-600">
                Classmates can find the team and ask to join. Turn off to join by invite only.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <LinkButton href="/teams" variant="ghost">
              Cancel
            </LinkButton>
            <Button type="submit" loading={pending}>
              Create team
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
