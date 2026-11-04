import { describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/v1/teams/[teamId]/meetings/[meetingId]/agenda/[itemId]/help/route";
import { DELETE } from "@/app/api/v1/teams/[teamId]/meetings/[meetingId]/agenda/[itemId]/route";
import { GET, POST } from "@/app/api/v1/teams/[teamId]/meetings/[meetingId]/agenda/route";
import { db } from "@/server/db";
import { addAgendaItem, deleteAgendaItem, listAgenda, setHelpFlag } from "@/server/services/agenda/service";
import { makeMeeting, makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

const AT = new Date("2026-10-28T15:00:00Z");

async function setup(members = 2) {
  const { team, leader, members: people } = await makeTeam({ members });
  const meeting = await makeMeeting(team.id, leader.id, AT);
  return { team, leader, people, meeting };
}

describe("PB-15 agenda", () => {
  it("AC1: items are sorted by how many members flagged them, then oldest first", async () => {
    const { team, leader, people, meeting } = await setup();
    const add = (title: string, createdAt: string) =>
      db.agendaItem.create({
        data: { meetingId: meeting.id, authorId: leader.id, title, createdAt: new Date(createdAt) },
      });
    const older = await add("Older, no flags", "2026-10-20T10:00:00Z");
    await add("Newer, no flags", "2026-10-21T10:00:00Z");
    const one = await add("One flag", "2026-10-22T10:00:00Z");
    const two = await add("Two flags", "2026-10-23T10:00:00Z");
    await setHelpFlag(team.id, people[0].id, meeting.id, one.id, { needsHelp: true });
    await setHelpFlag(team.id, people[0].id, meeting.id, two.id, { needsHelp: true });
    await setHelpFlag(team.id, people[1].id, meeting.id, two.id, { needsHelp: true });

    const list = await listAgenda(team.id, leader.id, meeting.id);
    expect(list.map((i) => [i.title, i.helpCount])).toEqual([
      ["Two flags", 2],
      ["One flag", 1],
      ["Older, no flags", 0],
      ["Newer, no flags", 0],
    ]);

    await setHelpFlag(team.id, leader.id, meeting.id, older.id, { needsHelp: true });
    await setHelpFlag(team.id, people[0].id, meeting.id, older.id, { needsHelp: true });
    await setHelpFlag(team.id, people[1].id, meeting.id, older.id, { needsHelp: true });
    expect((await listAgenda(team.id, leader.id, meeting.id))[0].title).toBe("Older, no flags");
  });

  it("AC2: a member can flag and unflag once; sending it twice changes nothing", async () => {
    const { team, leader, people, meeting } = await setup();
    const item = await addAgendaItem(team.id, leader.id, meeting.id, { title: "Slides" });
    const me = people[0];

    expect(await setHelpFlag(team.id, me.id, meeting.id, item.id, { needsHelp: true })).toMatchObject({
      helpCount: 1,
      flaggedByMe: true,
    });
    expect(await setHelpFlag(team.id, me.id, meeting.id, item.id, { needsHelp: true })).toMatchObject({
      helpCount: 1,
      flaggedByMe: true,
    });
    expect(await db.agendaHelpFlag.count({ where: { agendaItemId: item.id } })).toBe(1);

    await setHelpFlag(team.id, people[1].id, meeting.id, item.id, { needsHelp: true });
    expect(await setHelpFlag(team.id, me.id, meeting.id, item.id, { needsHelp: false })).toMatchObject({
      helpCount: 1,
      flaggedByMe: false,
    });
    expect(await setHelpFlag(team.id, me.id, meeting.id, item.id, { needsHelp: false })).toMatchObject({
      helpCount: 1,
      flaggedByMe: false,
    });
  });

  it("AC2: simultaneous flags from one member still count once", async () => {
    const { team, leader, meeting } = await setup();
    const item = await addAgendaItem(team.id, leader.id, meeting.id, { title: "Slides" });
    await Promise.all([1, 2, 3].map(() => setHelpFlag(team.id, leader.id, meeting.id, item.id, { needsHelp: true })));
    expect(await db.agendaHelpFlag.count({ where: { agendaItemId: item.id } })).toBe(1);
  });

  it("flaggedByMe is per viewer, while the count is everyone's", async () => {
    const { team, leader, people, meeting } = await setup();
    const item = await addAgendaItem(team.id, leader.id, meeting.id, { title: "Slides" });
    await setHelpFlag(team.id, people[0].id, meeting.id, item.id, { needsHelp: true });
    expect((await listAgenda(team.id, people[0].id, meeting.id))[0]).toMatchObject({ helpCount: 1, flaggedByMe: true });
    expect((await listAgenda(team.id, people[1].id, meeting.id))[0]).toMatchObject({
      helpCount: 1,
      flaggedByMe: false,
    });
  });

  it("adding a topic stores it and logs AGENDA_ITEM_ADDED", async () => {
    const { team, people, meeting } = await setup();
    const item = await addAgendaItem(team.id, people[0].id, meeting.id, {
      title: "Demo order",
      notes: "Who goes first?",
    });
    expect(item).toMatchObject({
      meetingId: meeting.id,
      title: "Demo order",
      notes: "Who goes first?",
      author: { id: people[0].id },
      helpCount: 0,
      flaggedByMe: false,
    });
    const event = await db.activityEvent.findFirstOrThrow({ where: { teamId: team.id, type: "AGENDA_ITEM_ADDED" } });
    expect(event).toMatchObject({
      actorId: people[0].id,
      entityType: "meeting",
      entityId: meeting.id,
      summary: `added “Demo order” to the agenda of “${meeting.title}”`,
    });
    const blank = await addAgendaItem(team.id, people[0].id, meeting.id, { title: "No notes", notes: "" });
    expect(blank.notes).toBeNull();
  });

  it("AC3: the author and a leader can delete; another member gets 403", async () => {
    const { team, leader, people, meeting } = await setup();
    const mine = await addAgendaItem(team.id, people[0].id, meeting.id, { title: "Mine" });
    const flagged = await addAgendaItem(team.id, people[0].id, meeting.id, { title: "For the leader" });
    await setHelpFlag(team.id, people[1].id, meeting.id, flagged.id, { needsHelp: true });

    await expect(deleteAgendaItem(team.id, people[1].id, meeting.id, mine.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only the person who added this topic or a team leader can delete it.",
    });
    expect(await deleteAgendaItem(team.id, people[0].id, meeting.id, mine.id)).toEqual({ deleted: true });
    expect(await deleteAgendaItem(team.id, leader.id, meeting.id, flagged.id)).toEqual({ deleted: true });
    expect(await db.agendaItem.count({ where: { meetingId: meeting.id } })).toBe(0);
    expect(await db.agendaHelpFlag.count({ where: { agendaItemId: flagged.id } })).toBe(0);
  });

  it("AC3: a meeting from another team is 404 for every action", async () => {
    const mine = await setup();
    const other = await setup();
    const theirItem = await addAgendaItem(other.team.id, other.leader.id, other.meeting.id, { title: "Theirs" });
    const notFound = { code: "NOT_FOUND" };

    await expect(listAgenda(mine.team.id, mine.leader.id, other.meeting.id)).rejects.toMatchObject(notFound);
    await expect(addAgendaItem(mine.team.id, mine.leader.id, other.meeting.id, { title: "x" })).rejects.toMatchObject(
      notFound,
    );
    await expect(
      setHelpFlag(mine.team.id, mine.leader.id, other.meeting.id, theirItem.id, { needsHelp: true }),
    ).rejects.toMatchObject(notFound);
    await expect(deleteAgendaItem(mine.team.id, mine.leader.id, other.meeting.id, theirItem.id)).rejects.toMatchObject(
      notFound,
    );
    expect(await db.agendaItem.count({ where: { id: theirItem.id } })).toBe(1);
  });

  it("a topic from another meeting in the same team is 404", async () => {
    const { team, leader, meeting } = await setup();
    const second = await makeMeeting(team.id, leader.id, new Date("2026-10-29T15:00:00Z"));
    const item = await addAgendaItem(team.id, leader.id, second.id, { title: "Elsewhere" });
    await expect(setHelpFlag(team.id, leader.id, meeting.id, item.id, { needsHelp: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteAgendaItem(team.id, leader.id, meeting.id, item.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("non-members get 403", async () => {
    const { team, leader, meeting } = await setup();
    const outsider = await makeUser();
    const item = await addAgendaItem(team.id, leader.id, meeting.id, { title: "Slides" });
    await expect(listAgenda(team.id, outsider.id, meeting.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setHelpFlag(team.id, outsider.id, meeting.id, item.id, { needsHelp: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(deleteAgendaItem(team.id, outsider.id, meeting.id, item.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("routes: POST → 201, PUT → flag, GET → sorted list, DELETE → removed", async () => {
    const { team, leader, people, meeting } = await setup();
    signInAs(people[0]);
    const params = { teamId: team.id, meetingId: meeting.id };

    const first = await callRoute(POST, { params, body: { title: "First" } });
    const second = await callRoute(POST, { params, body: { title: "Second", notes: "Bring numbers" } });
    expect(first.status).toBe(201);
    expect(second.json.data).toMatchObject({ title: "Second", notes: "Bring numbers", helpCount: 0 });

    const itemParams = { ...params, itemId: second.json.data.id };
    const flagged = await callRoute(PUT, { method: "PUT", params: itemParams, body: { needsHelp: true } });
    expect(flagged.status).toBe(200);
    expect(flagged.json.data).toMatchObject({ helpCount: 1, flaggedByMe: true });

    const list = await callRoute(GET, { params });
    expect(list.status).toBe(200);
    expect(list.json.data.map((i: { title: string }) => i.title)).toEqual(["Second", "First"]);

    signInAs(people[1]);
    const denied = await callRoute(DELETE, { method: "DELETE", params: itemParams });
    expect(denied.status).toBe(403);
    signInAs(leader);
    const removed = await callRoute(DELETE, { method: "DELETE", params: itemParams });
    expect(removed.status).toBe(200);
    expect(removed.json.data).toEqual({ deleted: true });
  });

  it("routes: a blank topic or a bad flag is 400 with a field error", async () => {
    const { team, leader, meeting } = await setup();
    signInAs(leader);
    const params = { teamId: team.id, meetingId: meeting.id };
    const blank = await callRoute(POST, { params, body: { title: "   " } });
    expect(blank.status).toBe(400);
    expect(blank.json.error.details.fields.title).toBe("Add a topic.");

    const item = await addAgendaItem(team.id, leader.id, meeting.id, { title: "Slides" });
    const bad = await callRoute(PUT, {
      method: "PUT",
      params: { ...params, itemId: item.id },
      body: { needsHelp: "yes" },
    });
    expect(bad.status).toBe(400);
  });
});
