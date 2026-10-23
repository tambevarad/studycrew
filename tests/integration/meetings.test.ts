import { describe, expect, it, vi } from "vitest";
import { GET as listRoute, POST as createRoute } from "@/app/api/v1/teams/[teamId]/meetings/route";
import {
  DELETE as deleteRoute,
  GET as getRoute,
  PATCH as patchRoute,
} from "@/app/api/v1/teams/[teamId]/meetings/[meetingId]/route";
import { PUT as rsvpRoute } from "@/app/api/v1/teams/[teamId]/meetings/[meetingId]/rsvp/route";
import { GET as suggestRoute } from "@/app/api/v1/teams/[teamId]/meeting-suggestions/route";
import { slotOf } from "@/contracts/availability";
import { db } from "@/server/db";
import {
  createMeeting,
  deleteMeeting,
  getSuggestions,
  getWeekHeatmap,
  listMeetings,
  listTeamMembersForMeeting,
  setRsvp,
  updateMeeting,
} from "@/server/services/meetings/service";
import { makeMeeting, makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const CHI = "America/Chicago";
const THU_7PM = "2026-10-30T00:00:00.000Z"; // Thu Oct 29, 7 pm CDT
const THU_8PM = "2026-10-30T01:00:00.000Z";
const BEFORE = new Date("2026-10-22T12:00:00Z");

function hours(day: number, from: number, to: number) {
  const out: number[] = [];
  for (let h = from * 2; h < to * 2; h++) out.push(slotOf(day, h));
  return out;
}

describe("PB-06 meetings", () => {
  it("AC5: creating a meeting notifies the other members, logs activity, and RSVPs the organizer", async () => {
    const { team, leader, members } = await makeTeam({ members: 2 });
    const m = await createMeeting(team.id, members[0].id, {
      title: "Sprint review",
      startsAt: THU_7PM,
      endsAt: THU_8PM,
      location: "ERB 331",
    });

    expect(m).toMatchObject({
      title: "Sprint review",
      location: "ERB 331",
      startsAt: THU_7PM,
      myRsvp: "YES",
      createdBy: { id: members[0].id },
    });
    const notes = await db.notification.findMany({ where: { type: "MEETING_SCHEDULED" } });
    expect(notes.map((n) => n.userId).sort()).toEqual([leader.id, members[1].id].sort());
    expect(notes[0]).toMatchObject({
      title: "New meeting: “Sprint review”",
      link: `/teams/${team.id}/calendar/${m.id}`,
    });
    expect(notes[0].body).toContain("Thu, Oct 29, 7:00 PM CDT");
    expect(await db.activityEvent.findFirst({ where: { type: "MEETING_CREATED" } })).toMatchObject({
      summary: "scheduled “Sprint review”",
      entityId: m.id,
    });
  });

  it("AC5: RSVPs update counts and only log when the answer changes", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const m = await createMeeting(team.id, leader.id, { title: "Retro", startsAt: THU_7PM, endsAt: THU_8PM });
    const after = await setRsvp(team.id, members[0].id, m.id, { response: "MAYBE" });
    expect(after.myRsvp).toBe("MAYBE");
    expect(after.rsvps.map((r) => r.response).sort()).toEqual(["MAYBE", "YES"]);
    await setRsvp(team.id, members[0].id, m.id, { response: "MAYBE" });
    await setRsvp(team.id, members[0].id, m.id, { response: "NO" });
    const summaries = (
      await db.activityEvent.findMany({ where: { type: "MEETING_RSVP" }, orderBy: { createdAt: "asc" } })
    ).map((e) => e.summary);
    expect(summaries).toEqual(["might join “Retro”", "can't make “Retro”"]);
  });

  it("lists meetings overlapping a range, earliest first, with my RSVP", async () => {
    const { team, leader } = await makeTeam();
    await makeMeeting(team.id, leader.id, new Date("2026-10-28T15:00:00Z"));
    await makeMeeting(team.id, leader.id, new Date("2026-10-27T15:00:00Z"));
    await makeMeeting(team.id, leader.id, new Date("2026-11-20T15:00:00Z"));
    const list = await listMeetings(team.id, leader.id, { from: "2026-10-26T05:00:00Z", to: "2026-11-02T06:00:00Z" });
    expect(list.map((m) => m.startsAt)).toEqual(["2026-10-27T15:00:00.000Z", "2026-10-28T15:00:00.000Z"]);
    expect(list[0].myRsvp).toBeNull();
  });

  it("AC6: rejects bad ranges and lets only the organizer or a leader edit or cancel", async () => {
    const { team, leader, members } = await makeTeam({ members: 2 });
    const [organizer, other] = members;
    await expect(
      createMeeting(team.id, organizer.id, { title: "x", startsAt: THU_8PM, endsAt: THU_7PM }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const m = await createMeeting(team.id, organizer.id, { title: "Study", startsAt: THU_7PM, endsAt: THU_8PM });

    await expect(updateMeeting(team.id, other.id, m.id, { title: "Mine now" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(deleteMeeting(team.id, other.id, m.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Moving only the start past the existing end is caught even though the contract refine can't see both fields.
    await expect(
      updateMeeting(team.id, organizer.id, m.id, { startsAt: "2026-10-30T02:00:00Z" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const renamed = await updateMeeting(team.id, leader.id, m.id, { title: "Study session" });
    expect(renamed.title).toBe("Study session");
    expect(await db.notification.count({ where: { type: "MEETING_UPDATED" } })).toBe(0); // no time/place change → no ping
  });

  it("AC7: each member's notification shows the time in their own zone", async () => {
    const { team, leader } = await makeTeam();
    const ny = await makeUser({ timezone: "America/New_York" });
    const la = await makeUser({ timezone: "America/Los_Angeles" });
    await db.teamMember.createMany({
      data: [
        { teamId: team.id, userId: ny.id },
        { teamId: team.id, userId: la.id },
      ],
    });
    await createMeeting(team.id, leader.id, { title: "Standup", startsAt: THU_7PM, endsAt: THU_8PM });
    const body = async (userId: string) =>
      (await db.notification.findFirstOrThrow({ where: { userId, type: "MEETING_SCHEDULED" } })).body;
    expect(await body(ny.id)).toContain("Thu, Oct 29, 8:00 PM EDT");
    expect(await body(la.id)).toContain("Thu, Oct 29, 5:00 PM PDT");
    expect(await db.notification.count({ where: { userId: leader.id } })).toBe(0);
  });

  it("a save that changes nothing logs nothing and notifies no one", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const m = await createMeeting(team.id, leader.id, {
      title: "Same",
      startsAt: THU_7PM,
      endsAt: THU_8PM,
      location: "Lab",
    });
    await updateMeeting(team.id, leader.id, m.id, {
      title: "Same",
      startsAt: THU_7PM,
      endsAt: THU_8PM,
      location: "Lab",
    });
    expect(await db.activityEvent.count({ where: { type: "MEETING_UPDATED" } })).toBe(0);
    expect(await db.notification.count({ where: { userId: members[0].id, type: "MEETING_UPDATED" } })).toBe(0);
  });

  it("notifies on a time or place change and on cancellation", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const m = await createMeeting(team.id, leader.id, { title: "Demo prep", startsAt: THU_7PM, endsAt: THU_8PM });
    await updateMeeting(team.id, leader.id, m.id, { startsAt: THU_8PM, endsAt: "2026-10-30T02:00:00Z" });
    await updateMeeting(team.id, leader.id, m.id, { location: "Library 2F" });
    await deleteMeeting(team.id, leader.id, m.id);
    const titles = (
      await db.notification.findMany({
        where: { userId: members[0].id, type: "MEETING_UPDATED" },
        orderBy: { createdAt: "asc" },
      })
    ).map((n) => n.title);
    expect(titles).toEqual(["“Demo prep” was moved", "“Demo prep” has a new location", "“Demo prep” was cancelled"]);
    expect(await db.meeting.count()).toBe(0);
    expect(
      (await db.activityEvent.findMany({ where: { entityId: m.id }, orderBy: { createdAt: "asc" } })).map(
        (e) => e.type,
      ),
    ).toEqual(["MEETING_CREATED", "MEETING_UPDATED", "MEETING_UPDATED", "MEETING_CANCELLED"]);
  });

  it("AC1/AC4: suggestions come from saved availability and skip existing meetings", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    await db.availability.create({ data: { userId: leader.id, slots: hours(3, 18, 21) } });
    await db.availability.create({ data: { userId: members[0].id, slots: hours(3, 19, 21) } });
    await makeMeeting(team.id, leader.id, new Date(THU_7PM)); // 7–8 pm busy

    const res = await getSuggestions(
      team.id,
      leader.id,
      CHI,
      { from: "2026-10-29", to: "2026-10-29", durationMinutes: 60, earliestHour: 8, latestHour: 22, limit: 10 },
      BEFORE,
    );
    expect(res[0]).toMatchObject({ startsAt: THU_8PM, availableCount: 2, totalMembers: 2 }); // 8–9 pm, both free
    expect(res.some((s) => s.startsAt === THU_7PM)).toBe(false);
  });

  it("validates the suggestion window", async () => {
    const { team, leader } = await makeTeam();
    const q = { from: "2026-10-29", to: "2026-10-28", durationMinutes: 60, earliestHour: 8, latestHour: 22, limit: 10 };
    await expect(getSuggestions(team.id, leader.id, CHI, q)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(getSuggestions(team.id, leader.id, CHI, { ...q, to: "2026-12-31" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(
      getSuggestions(team.id, leader.id, CHI, {
        ...q,
        to: "2026-10-29",
        earliestHour: 20,
        latestHour: 21,
        durationMinutes: 90,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      getSuggestions(team.id, leader.id, CHI, { ...q, from: "2026-02-30", to: "2026-03-01" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("builds the week heatmap and lists who hasn't painted availability", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    await db.availability.create({ data: { userId: leader.id, slots: hours(3, 19, 20) } });
    const heat = await getWeekHeatmap(team.id, leader.id, "2026-10-26", CHI);
    expect(heat.cells).toHaveLength(336);
    expect(heat.cells[slotOf(3, 38)]).toEqual([leader.id]);
    expect(heat.missing.map((u) => u.id)).toEqual([members[0].id]);
    const roster = await listTeamMembersForMeeting(team.id, members[0].id);
    expect(roster).toMatchObject({ myRole: "MEMBER" });
    expect(roster.members).toHaveLength(2);
  });

  it("404 for another team's meeting; 403 for non-members", async () => {
    const { team, leader } = await makeTeam();
    const other = await makeTeam();
    const theirs = await makeMeeting(other.team.id, other.leader.id, new Date(THU_7PM));
    const outsider = await makeUser();
    await expect(setRsvp(team.id, leader.id, theirs.id, { response: "YES" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(listMeetings(team.id, outsider.id, { from: THU_7PM, to: THU_8PM })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getWeekHeatmap(team.id, outsider.id, "2026-10-26", CHI)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("routes: create 201, list, get, patch, rsvp, suggestions in the caller's zone, delete", async () => {
    const { team, leader } = await makeTeam();
    await db.availability.create({ data: { userId: leader.id, slots: hours(3, 8, 22) } });
    signInAs({ ...leader, timezone: CHI });

    const bad = await callRoute(createRoute, {
      params: { teamId: team.id },
      body: { title: "x", startsAt: THU_8PM, endsAt: THU_7PM },
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error.details.fields.endsAt).toContain("End time must be after the start");

    const created = await callRoute(createRoute, {
      params: { teamId: team.id },
      body: { title: "Kickoff", startsAt: THU_7PM, endsAt: THU_8PM },
    });
    expect(created.status).toBe(201);
    const id = created.json.data.id as string;
    const p = { teamId: team.id, meetingId: id };

    expect(
      (await callRoute(listRoute, { params: { teamId: team.id }, query: { from: THU_7PM, to: THU_8PM } })).json.data,
    ).toHaveLength(1);
    expect((await callRoute(getRoute, { params: p })).json.data.title).toBe("Kickoff");
    expect(
      (await callRoute(patchRoute, { method: "PATCH", params: p, body: { location: "Zoom" } })).json.data.location,
    ).toBe("Zoom");
    expect((await callRoute(rsvpRoute, { method: "PUT", params: p, body: { response: "NO" } })).json.data.myRsvp).toBe(
      "NO",
    );
    expect((await callRoute(rsvpRoute, { method: "PUT", params: p, body: { response: "SURE" } })).status).toBe(400);

    const sugg = await callRoute(suggestRoute, {
      params: { teamId: team.id },
      query: { from: "2030-10-31", to: "2030-10-31", durationMinutes: "60" },
    });
    expect(sugg.status).toBe(200);
    expect(sugg.json.data[0].startsAt).toBe("2030-10-31T13:00:00.000Z"); // 8 am CDT on Thu Oct 31, 2030
    expect(
      (
        await callRoute(suggestRoute, {
          params: { teamId: team.id },
          query: { from: "2030-10-31", to: "2030-10-31", durationMinutes: "45" },
        })
      ).status,
    ).toBe(400);

    expect((await callRoute(deleteRoute, { method: "DELETE", params: p })).json.data).toEqual({ deleted: true });
    expect((await callRoute(getRoute, { params: p })).status).toBe(404);
  });
});
