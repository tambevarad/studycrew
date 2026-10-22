# REST API contract — `/api/v1`

All endpoints require a session (401 otherwise). **Member** = any member of `teamId` (403 for others).
**Leader** = team leader. Inputs/outputs reference `src/contracts/<file>.ts`. Side effects list the activity types
(`logActivity`) and notification types (`notify`) the service must emit. Route file path = URL path under
`src/app/api/v1/` + `/route.ts`.

Service function names are part of the contract where another item calls them (marked ★).

## PB-02 Profile — `contracts/profile.ts` · owner Krish

| Method | Path | Who | Input | Output | Side effects |
|---|---|---|---|---|---|
| GET | `/me/profile` | self | — | `ProfileDTO` | — |
| PATCH | `/me/profile` | self | `updateProfileInput` | `ProfileDTO` | — |

Sign-up/sign-in/sign-out use Better Auth at `/api/auth/*` (already wired). Service: `getProfile(userId)`,
`updateProfile(userId, input)`.

## PB-03 Availability — `contracts/availability.ts` · owner Krish

| Method | Path | Who | Input | Output | Side effects |
|---|---|---|---|---|---|
| GET | `/me/availability` | self | — | `AvailabilityDTO` | — |
| PUT | `/me/availability` | self | `updateAvailabilityInput` | `AvailabilityDTO` (slots de-duplicated + sorted) | — |
| GET | `/teams/[teamId]/availability` | Member | — | `TeamAvailabilityDTO` (use `shared/team-availability.ts`) | — |

## PB-04 Teams — `contracts/teams.ts` · owner Dev

| Method | Path | Who | Input | Output | Side effects |
|---|---|---|---|---|---|
| POST | `/teams` | any user | `createTeamInput` | `TeamDetailDTO` (201; creator = LEADER) | `TEAM_CREATED` |
| GET | `/teams?course=&q=` | any user | `searchTeamsQuery` | `TeamSummaryDTO[]` (open teams in course + teams I'm in) | — |
| GET | `/teams/[teamId]` | Member | — | `TeamDetailDTO` | — |
| PATCH | `/teams/[teamId]` | Leader | `updateTeamInput` | `TeamDetailDTO` | `TEAM_UPDATED` |
| POST | `/teams/[teamId]/invites` | Leader | `inviteByEmailInput` | `TeamInviteDTO[]` (201) | `INVITE_SENT`; notify `TEAM_INVITE` to existing users with those emails |
| POST | `/teams/[teamId]/invite-code` | Leader | — | `{ inviteCode }` (rotates the link) | — |
| GET | `/teams/[teamId]/join-requests` | Leader | — | `JoinRequestDTO[]` (PENDING) | — |
| PATCH | `/teams/[teamId]/members/[userId]` | Leader | `changeRoleInput` | `TeamMemberDTO` | `MEMBER_ROLE_CHANGED` |
| DELETE | `/teams/[teamId]/members/[userId]` | Leader, or self (leave) | — | `{ removed: true }` | `MEMBER_REMOVED` / `MEMBER_LEFT` |
| POST | `/join/[inviteCode]` | any user | — | `TeamDetailDTO` (idempotent) | `MEMBER_JOINED` |
| GET | `/me/invites` | self | — | `TeamInviteDTO[]` (pending, my email) | — |
| POST | `/me/invites/[inviteId]/accept` | invitee | — | `TeamDetailDTO` | `MEMBER_JOINED` |
| POST | `/me/invites/[inviteId]/decline` | invitee | — | `{ declined: true }` | — |
| POST | `/join-requests` | non-member | `createJoinRequestInput` | `JoinRequestDTO` (201) | `JOIN_REQUESTED`; notify `JOIN_REQUEST` to leaders |
| GET | `/me/join-requests` | self | — | `JoinRequestDTO[]` | — |
| DELETE | `/join-requests/[requestId]` | requester | — | `{ cancelled: true }` | — |
| POST | `/join-requests/[requestId]/decision` | Leader of that team | `decideJoinRequestInput` | `JoinRequestDTO` | `JOIN_APPROVED`+`MEMBER_JOINED` or `JOIN_DECLINED`; notify `JOIN_DECISION` to requester |

Rules: max `MAX_TEAM_SIZE` (8) members → 409; a team always keeps ≥ 1 leader (last leader can't leave/demote → 409);
one PENDING request per (team, user) → 409; closed teams (`isOpen=false`) reject join requests and are hidden from
search; invites expire after `INVITE_TTL_DAYS` (14) days.

## PB-05 Tasks — `contracts/tasks.ts` · owner Devarsh

| Method | Path | Who | Input | Output | Side effects |
|---|---|---|---|---|---|
| GET | `/teams/[teamId]/tasks` | Member | `listTasksQuery` | `TaskDTO[]` (by status, then position) | — |
| POST | `/teams/[teamId]/tasks` | Member | `createTaskInput` | `TaskDTO` (201; appended to column) | `TASK_CREATED`; `TASK_ASSIGNED` notify to assignees |
| GET | `/teams/[teamId]/tasks/[taskId]` | Member | — | `TaskDTO` | — |
| PATCH | `/teams/[teamId]/tasks/[taskId]` | Member | `updateTaskInput` | `TaskDTO` | `TASK_UPDATED`; `TASK_ASSIGNED` activity + notify for newly added assignees |
| DELETE | `/teams/[teamId]/tasks/[taskId]` | Member | — | `{ deleted: true }` | `TASK_DELETED` |
| POST | `/teams/[teamId]/tasks/[taskId]/move` | Member | `moveTaskInput` | `TaskDTO` | `TASK_MOVED`; `TASK_COMPLETED` when entering DONE |

★ Exported for other items: `createTask(teamId, actorId, input)` (PB-11), `listTasks(teamId, actorId, query)`,
`toTaskDTO(row)` + `taskInclude` (PB-12, PB-13).

## PB-06 Calendar & meeting finder — `contracts/meetings.ts` · owner Varad

| Method | Path | Who | Input | Output | Side effects |
|---|---|---|---|---|---|
| GET | `/teams/[teamId]/meetings` | Member | `listMeetingsQuery` | `MeetingDTO[]` | — |
| POST | `/teams/[teamId]/meetings` | Member | `createMeetingInput` | `MeetingDTO` (201) | `MEETING_CREATED`; notify `MEETING_SCHEDULED` to other members |
| GET | `/teams/[teamId]/meetings/[meetingId]` | Member | — | `MeetingDTO` | — |
| PATCH | `/teams/[teamId]/meetings/[meetingId]` | creator or Leader | `updateMeetingInput` | `MeetingDTO` | `MEETING_UPDATED`; notify `MEETING_UPDATED` if time/location changed |
| DELETE | `/teams/[teamId]/meetings/[meetingId]` | creator or Leader | — | `{ deleted: true }` | `MEETING_CANCELLED`; notify `MEETING_UPDATED` ("cancelled") |
| PUT | `/teams/[teamId]/meetings/[meetingId]/rsvp` | Member | `rsvpInput` | `MeetingDTO` | `MEETING_RSVP` |
| GET | `/teams/[teamId]/meeting-suggestions` | Member | `meetingSuggestionsQuery` | `MeetingSuggestionDTO[]` | — |

★ Exported: `listMeetings(teamId, actorId, query)`, `toMeetingDTO` (PB-12).

## PB-07 Resources — `contracts/resources.ts` · owner Devarsh

| Method | Path | Who | Input | Output | Side effects |
|---|---|---|---|---|---|
| GET | `/teams/[teamId]/resources` | Member | `listResourcesQuery` | `ResourceDTO[]` (pinned first, newest first) | — |
| POST | `/teams/[teamId]/resources` | Member | `createResourceInput` | `ResourceDTO` (201) | `RESOURCE_ADDED` |
| PATCH | `/teams/[teamId]/resources/[resourceId]` | Member (pin) / creator or Leader (edit) | `updateResourceInput` | `ResourceDTO` | `RESOURCE_UPDATED` |
| DELETE | `/teams/[teamId]/resources/[resourceId]` | creator or Leader | — | `{ deleted: true }` | `RESOURCE_DELETED` |

## PB-08 Notifications — `contracts/notifications.ts` · owner Krish

| Method | Path | Who | Input | Output | Side effects |
|---|---|---|---|---|---|
| GET | `/me/notifications` | self | `listNotificationsQuery` | `Page<NotificationDTO>` (newest first) | generates due-soon first |
| GET | `/me/notifications/unread-count` | self | — | `UnreadCountDTO` | generates due-soon first |
| POST | `/me/notifications/read` | self | `markReadInput` | `{ updated: number }` | — |

Due-soon: `generateDueSoonNotifications(userId, now)` creates `TASK_DUE_SOON` for the user's assigned, not-DONE tasks
with `dueAt` in `(now, now + 24h]`, `dedupeKey = due:<taskId>:<dueAt ISO>`.

## PB-09 Activity — `contracts/activity.ts` · owner Varad

| Method | Path | Who | Input | Output |
|---|---|---|---|---|
| GET | `/teams/[teamId]/activity` | Member | `listActivityQuery` | `Page<ActivityDTO>` (newest first) |

★ Exported: `listActivity(teamId, actorId, query)`; component slot `RecentActivity` (PB-12).

## PB-10 AI Coverage Check — `contracts/coverage.ts` · owner Devarsh

| Method | Path | Who | Input | Output | Side effects |
|---|---|---|---|---|---|
| POST | `/teams/[teamId]/coverage-reports` | Member | `runCoverageInput` | `CoverageReportDTO` (201). Provider failure/timeout → FAILED report saved, respond 502 `UPSTREAM`. Over limit → 429 | `COVERAGE_RUN` |
| GET | `/teams/[teamId]/coverage-reports` | Member | — | `CoverageReportSummaryDTO[]` | — |
| GET | `/teams/[teamId]/coverage-reports/[reportId]` | Member | — | `CoverageReportDTO` | — |
| DELETE | `/teams/[teamId]/coverage-reports/[reportId]` | author or Leader | — | `{ deleted: true }` (hard delete) | `COVERAGE_DELETED` |

## Sprint 4–5 items (contract fixed now so nothing blocks later)

| Item | Method | Path | Who | Input → Output | Side effects |
|---|---|---|---|---|---|
| PB-11 | POST | `/teams/[teamId]/coverage-items/[itemId]/task` | Member | `createTaskFromItemInput` → `TaskDTO` (201; 409 if item already has a task) | via `createTask`; `COVERAGE_TASK_CREATED` |
| PB-11 | PUT | `/teams/[teamId]/coverage-items/[itemId]/rating` | Member | `rateItemInput` → `CoverageItemDTO` | — |
| PB-12 | GET | `/teams/[teamId]/dashboard` | Member | — → `TeamDashboardDTO` | — |
| PB-13 | GET/POST | `/teams/[teamId]/milestones` | Member | `createMilestoneInput` → `MilestoneDTO` | `MILESTONE_CREATED` |
| PB-13 | POST | `/teams/[teamId]/milestones/apply-template` | Member | `applyTemplateInput` → `MilestoneDTO[]` | `MILESTONE_CREATED` ×n |
| PB-13 | PATCH/DELETE | `/teams/[teamId]/milestones/[milestoneId]` | Member | `updateMilestoneInput` → `MilestoneDTO` | `MILESTONE_UPDATED` / `MILESTONE_DELETED` |
| PB-13 | POST | `/teams/[teamId]/milestones/[milestoneId]/tasks` | Member | `linkTaskInput` → `MilestoneDTO` (writes via PB-05 `updateTask`) | `TASK_UPDATED` |
| PB-14 | GET/POST | `/teams/[teamId]/polls` | Member | `createPollInput` → `PollDTO` | `POLL_CREATED`; notify `POLL_CREATED` |
| PB-14 | PUT | `/teams/[teamId]/polls/[pollId]/vote` | Member | `voteInput` → `PollDTO` (409 if closed) | — |
| PB-14 | POST | `/teams/[teamId]/polls/[pollId]/close` | creator or Leader | — → `PollDTO` | `POLL_CLOSED` (summary names the winner); notify `POLL_CLOSED` |
| PB-15 | GET/POST | `/teams/[teamId]/meetings/[meetingId]/agenda` | Member | `createAgendaItemInput` → `AgendaItemDTO` (list sorted by helpCount desc, then createdAt) | `AGENDA_ITEM_ADDED` |
| PB-15 | PUT | `/teams/[teamId]/meetings/[meetingId]/agenda/[itemId]/help` | Member | `helpFlagInput` → `AgendaItemDTO` | — |
| PB-15 | DELETE | `/teams/[teamId]/meetings/[meetingId]/agenda/[itemId]` | author or Leader | — | — |

Polls past `closesAt` are closed lazily by the service on the next read (`closeDuePolls(teamId)`), which records the
final choice in activity history (FR-09).
