"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TeamDetailDTO } from "@/contracts/teams";
import { apiFetch } from "@/lib/api-client";
import { useApiAction } from "@/lib/use-api-action";

/** `/join/<code>`: joins (idempotent on the server) and opens the team. */
export function JoinTeamButton({ inviteCode, teamName }: { inviteCode: string; teamName: string }) {
  const router = useRouter();
  const { run, pending } = useApiAction();

  async function join() {
    const team = await run(
      () => apiFetch<TeamDetailDTO>(`/api/v1/join/${encodeURIComponent(inviteCode)}`, { method: "POST" }),
      { success: `Welcome to ${teamName}!`, refresh: false },
    );
    if (team) {
      router.push(`/teams/${team.id}`);
      router.refresh();
    }
  }

  return (
    <Button onClick={join} loading={pending}>
      Join team
    </Button>
  );
}
