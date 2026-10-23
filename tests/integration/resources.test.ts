import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/v1/teams/[teamId]/resources/route";
import { DELETE, PATCH } from "@/app/api/v1/teams/[teamId]/resources/[resourceId]/route";
import { db } from "@/server/db";
import { createResource, deleteResource, listResources, updateResource } from "@/server/services/resources/service";
import { makeTeam, makeUser } from "../helpers/factories";
import { callRoute } from "../helpers/route";
import { signInAs } from "../helpers/session";

vi.mock("@/server/session", async () => (await import("../helpers/session")).sessionMock);

describe("PB-07 resources", () => {
  it("AC1: adds a link, a file reference, and a note; newest first; each is logged", async () => {
    const { team, members } = await makeTeam({ members: 1 });
    const me = members[0];
    await createResource(team.id, me.id, { type: "LINK", title: "Syllabus", url: "https://example.edu/syllabus" });
    await createResource(team.id, me.id, { type: "FILE_REF", title: "Proposal", url: "https://drive.google.com/file/d/x" });
    const note = await createResource(team.id, me.id, { type: "NOTE", title: "Retro", body: "Start: pairing" });

    expect(note).toMatchObject({ type: "NOTE", url: null, body: "Start: pairing", pinned: false, createdBy: { id: me.id } });
    const list = await listResources(team.id, me.id, {});
    expect(list.map((r) => r.title)).toEqual(["Retro", "Proposal", "Syllabus"]);

    const summaries = (await db.activityEvent.findMany({ where: { teamId: team.id, type: "RESOURCE_ADDED" }, orderBy: { createdAt: "asc" } })).map((e) => e.summary);
    expect(summaries).toEqual(["added the link “Syllabus”", "added the file “Proposal”", "added the note “Retro”"]);
  });

  it("AC2: pinned items come first for everyone, and any member can pin", async () => {
    const { team, leader, members } = await makeTeam({ members: 1 });
    const old = await createResource(team.id, leader.id, { type: "LINK", title: "Old", url: "https://a.test" });
    await createResource(team.id, leader.id, { type: "LINK", title: "New", url: "https://b.test" });

    const pinned = await updateResource(team.id, members[0].id, old.id, { pinned: true });
    expect(pinned.pinned).toBe(true);
    expect((await listResources(team.id, leader.id, {})).map((r) => r.title)).toEqual(["Old", "New"]);

    const events = await db.activityEvent.findMany({ where: { teamId: team.id, type: "RESOURCE_UPDATED" } });
    expect(events.map((e) => e.summary)).toEqual(["pinned “Old”"]);

    // Re-sending the same pin state doesn't add noise to the history.
    await updateResource(team.id, members[0].id, old.id, { pinned: true });
    expect(await db.activityEvent.count({ where: { teamId: team.id, type: "RESOURCE_UPDATED" } })).toBe(1);
  });

  it("AC3: rejects ftp: and javascript: links with a clear message", async () => {
    const { team, leader } = await makeTeam();
    signInAs(leader);
    for (const url of ["ftp://files.test/a", "javascript:alert(1)"]) {
      const res = await callRoute(POST, { params: { teamId: team.id }, body: { type: "LINK", title: "x", url } });
      expect(res.status).toBe(400);
      expect(res.json.error.details.fields.url).toBeTruthy();
    }
    const missingBody = await callRoute(POST, { params: { teamId: team.id }, body: { type: "NOTE", title: "x" } });
    expect(missingBody.status).toBe(400);
    expect(await db.resource.count()).toBe(0);
  });

  it("AC4: only the creator or a leader can edit or delete", async () => {
    const { team, leader, members } = await makeTeam({ members: 2 });
    const [author, other] = members;
    const r = await createResource(team.id, author.id, { type: "NOTE", title: "Mine", body: "text" });

    await expect(updateResource(team.id, other.id, r.id, { title: "Hacked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteResource(team.id, other.id, r.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect((await updateResource(team.id, author.id, r.id, { title: "Mine v2", body: "more" })).title).toBe("Mine v2");
    expect((await updateResource(team.id, leader.id, r.id, { title: "Leader edit" })).title).toBe("Leader edit");
    expect(await db.activityEvent.findFirst({ where: { teamId: team.id, type: "RESOURCE_UPDATED" }, orderBy: { createdAt: "desc" } })).toMatchObject({
      summary: "updated the note “Leader edit”",
    });

    await expect(deleteResource(team.id, leader.id, r.id)).resolves.toEqual({ deleted: true });
    expect(await db.resource.count()).toBe(0);
    expect(await db.activityEvent.count({ where: { teamId: team.id, type: "RESOURCE_DELETED" } })).toBe(1);
  });

  it("keeps notes and links apart: no url on notes, no text on links, no empty note", async () => {
    const { team, leader } = await makeTeam();
    const note = await createResource(team.id, leader.id, { type: "NOTE", title: "N", body: "b" });
    const link = await createResource(team.id, leader.id, { type: "LINK", title: "L", url: "https://a.test" });
    await expect(updateResource(team.id, leader.id, note.id, { url: "https://x.test" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateResource(team.id, leader.id, link.id, { body: "text" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateResource(team.id, leader.id, note.id, { body: "" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("AC5: search matches title or note text; filters by type", async () => {
    const { team, leader } = await makeTeam();
    await createResource(team.id, leader.id, { type: "NOTE", title: "Retro", body: "We should PAIR on the calendar" });
    await createResource(team.id, leader.id, { type: "LINK", title: "Pairing guide", url: "https://a.test" });
    await createResource(team.id, leader.id, { type: "FILE_REF", title: "Slides", url: "https://drive.google.com/x" });

    expect((await listResources(team.id, leader.id, { q: "pair" })).map((r) => r.title).sort()).toEqual(["Pairing guide", "Retro"]);
    expect((await listResources(team.id, leader.id, { type: "FILE_REF" })).map((r) => r.title)).toEqual(["Slides"]);
    expect(await listResources(team.id, leader.id, { type: "NOTE", q: "slides" })).toEqual([]);
  });

  it("AC6: non-members get 403; another team's resource is 404", async () => {
    const { team, leader } = await makeTeam();
    const other = await makeTeam();
    const outsider = await makeUser();
    const theirs = await createResource(other.team.id, other.leader.id, { type: "LINK", title: "T", url: "https://a.test" });

    await expect(listResources(team.id, outsider.id, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateResource(team.id, leader.id, theirs.id, { pinned: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteResource(team.id, leader.id, theirs.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("routes: create 201, list with query, patch, delete", async () => {
    const { team, leader } = await makeTeam();
    signInAs(leader);
    const created = await callRoute(POST, { params: { teamId: team.id }, body: { type: "LINK", title: "  Syllabus  ", url: "https://example.edu" } });
    expect(created.status).toBe(201);
    expect(created.json.data.title).toBe("Syllabus");
    const id = created.json.data.id as string;

    const list = await callRoute(GET, { params: { teamId: team.id }, query: { type: "LINK", q: "syll" } });
    expect(list.json.data).toHaveLength(1);
    expect((await callRoute(GET, { params: { teamId: team.id }, query: { type: "VIDEO" } })).status).toBe(400);

    const patched = await callRoute(PATCH, { method: "PATCH", params: { teamId: team.id, resourceId: id }, body: { pinned: true } });
    expect(patched.json.data.pinned).toBe(true);

    const del = await callRoute(DELETE, { method: "DELETE", params: { teamId: team.id, resourceId: id } });
    expect(del).toMatchObject({ status: 200, json: { data: { deleted: true } } });
    expect((await callRoute(DELETE, { method: "DELETE", params: { teamId: team.id, resourceId: id } })).status).toBe(404);
  });
});
