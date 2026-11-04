# Usability test (PB-17 · NFR-04)

> **Status: plan ready, sessions not run yet.** The results tables in §9 are deliberately empty. Krish runs the sessions
> with at least 5 students and fills them in from the timing sheets and SUS forms. Never fill in a cell with an
> estimate, an example, or AI-generated data. A cell stays blank until a real session produced it.
>
> **Dry run on staging: 2026-11-03.** All five tasks work on staging, using seeded demo accounts only (§3.1). The
> script below includes what the dry run changed.

Owner: Krish Ruparel (M2) · Moderator: Krish · Note-taker: a teammate who didn't build the feature being tested

## 1. Goal and pass criteria

Find out whether students who have never seen StudyCrew can do the core team-project jobs without help, and fix what
gets in their way before the final demo.

| Measure | Pass criterion (NFR-04) | Where it comes from |
|---|---|---|
| Core-flow completion | **≥ 80 %** of participants finish Tasks 1–4 **unaided within 10 minutes** in total | Timing sheet (§7) |
| Satisfaction | Mean **SUS ≥ 70** | SUS form (§6) |
| Problems found | Every issue logged with a severity and a link to the fix or a GitHub issue | Observation notes (§9.3) |

**Core flow = Tasks 1–4** (join a team → availability → meeting → task). This follows the core flow in
`docs/contracts/ui-guidelines.md` §8, extended with the availability step the meeting finder depends on. Task 5 (AI
Coverage Check) is timed and scored the same way, but it doesn't count toward the 10 minutes.

## 2. Participants

- **At least 5** UTA students who are **not** on the StudyCrew team and have **not** used the app before. Aim for a mix
  of programs and of experience with tools like Trello, When2meet, or Google Calendar.
- Each participant gets a code: **P1, P2, …** Only codes go into this repo. No names, emails, student IDs, photos, or
  recordings.
- Sessions take about **25 minutes**. In person or over a video call with screen sharing.

## 3. Setup (before each session)

Use **staging** (`https://studycrew-staging.vercel.app`, see `docs/process/deployment.md`) unless it's down, then a
local `npm run build && npm run start`. Record the commit SHA from the deploy (or `git rev-parse --short HEAD`) in the
session log, so every result is tied to a build.

For each participant **P#**, as the moderator (signed in with your own account):

1. Create a team **"Usability P#"** with course **CSE 6324**. Copy the **invite link** from the Members tab.
2. Make sure the team has at least one other member **with saved availability** that overlaps Mon–Thu 6–9 pm (your
   own account, plus one helper account if you have one), so **Find a time** has something to suggest.
3. Leave the board empty or with 1–2 tasks, and schedule no meetings this week.
4. **Staging uses a real AI provider.** On Nov 3 the consent box named *Anthropic Claude*, and the report said
   `claude-haiku-5-5`. Write the provider and model shown on the report in the session log. Each account can run
   10 checks a day.
5. **Warm up staging** just before the participant arrives: open the team's Overview, Board, Calendar, and AI
   Coverage Check once. On the dry run the first load of a tab took several seconds (a cold start), which would
   otherwise count against the participant's time.
6. Open a fresh **private / incognito** browser window on the sign-up page. Have the invite link, the task cards, and
   Appendix A printed or ready to paste in chat.
7. Prepare a test email for the participant to sign up with: **`p#.usability@studycrew.test`**. It's a fake domain,
   so no real personal data is entered.
8. Write the session's dates on the T3 and T4 cards (the next 7 days; the date of the next Friday), so the tasks
   mean the same thing whatever day the session is on.

After the last session: StudyCrew has no "delete team" or "delete account" feature yet, so send Dev the list of test
emails and team names to remove from the staging database. **Never re-run the seed on staging:** it deletes all data.

### 3.1 Dry run on staging (2026-11-03)

Run by Krish's agent (Claude Code) on `https://studycrew-staging.vercel.app` at commit `5cd4cae` (#49, D-01 fix),
using **seeded demo accounts only**. No team or account was created for it. The seeded **Olivia Outsider**
(`outsider@studycrew.test`, on no team) played the participant, and the seeded team **Query Optimizers** (leader
Maya Chen) played the team. Sign-up itself (the first half of T1) was **not** tried, so no new account was made.

| Task | What was done | Result |
|---|---|---|
| T1 | Signed out, opened the team's invite link (`/join/query-opt-demo`) | Redirected to Sign in with `?next=/join/query-opt-demo`, and **"Create an account" keeps the same `next`**. After signing in, Olivia was back on "Join Query Optimizers"; **Join team** opened the team's Overview ("Olivia Outsider joined the team"). ✅ |
| T2 | My availability: Clear all (Olivia had seeded times), dragged Mon 6:00 PM → Thu 8:30 PM, **Save availability** | "Availability saved"; after a reload, 24 half-hours, Mon–Thu 6–9 PM. ✅ |
| T3 | Calendar → **Find a time** → Search (defaults: today + 6 days, 1 hour, 8 am–10 pm) → **Schedule** on the top result, title "Kickoff" | Wed Nov 4, 6:30–7:30 PM, "Everyone is free 2/2"; "Meeting scheduled — the team was notified"; the app opens the meeting's page. ✅ The same suggestions also appear under **Best times this week** on the Calendar page, each with its own Schedule button. |
| T4 | Board → **New task**: title, due Fri Nov 6 5:00 PM, assignee Olivia → Add task; then **Move to…** → In Progress | After a reload: In Progress, assigned to Olivia, due Nov 6. ✅ The New task dialog also has a **Status** field, so "In Progress" can be set without moving the card. |
| T5 | AI Coverage Check: Appendix A title, instructions, and draft; consent ticked; **Run check** | Report in 7.3 s (Anthropic `claude-haiku-5-5`): score 50. **Missing: "Recommend specific collaboration software…"**, as the card expects. ✅ See Appendix A for the full result. |

**Data the dry run left on staging** (all in Query Optimizers; nothing was deleted):

- Olivia Outsider is now a member.
- Her availability changed from the seeded Mon–Fri 6–10 PM + Sat to Mon–Thu 6–9 PM.
- The meeting "Kickoff" (Wed Nov 4, 6:30 PM CT; Maya was notified).
- The task "Draft the introduction" (In Progress). An extra edit assigns Olivia: the agent's first form fill didn't
  register the checkbox.
- The coverage report "Remote work essay".
- The matching activity events.

Add these to the cleanup list for Dev.

## 4. Consent (read aloud; participant agrees before anything starts)

> Thanks for helping us test StudyCrew, a class project for CSE 6324 at UT Arlington. We're testing **the app, not
> you**. If something is hard, that's a problem with our design, and it's exactly what we want to find.
>
> - The session takes about 25 minutes. You'll try five short tasks and then fill in a 10-question form.
> - Please think aloud as you work. I'll mostly stay quiet and won't help unless you're stuck.
> - We'll write down **how long each task takes, where you hesitate, and what you say**. We record your answers under
>   a code like "P3", never your name. You'll use a made-up email address, not your own.
> - [If recording] We'd like to record the screen and audio so we don't miss anything. Only the StudyCrew team sees
>   it, and we delete it when the course ends. You can say no to recording and still take part.
> - Taking part is **voluntary**. You can skip a task or stop at any time, with no consequence, including for your
>   grade in any course.
> - Anonymous results (times, success rates, SUS scores, and quotes without names) may appear in our course report.
>
> Do you agree to take part? [ ] Yes  [ ] No · Do you agree to screen and audio recording? [ ] Yes  [ ] No

Keep the signed or ticked consent forms **outside this repo** (for example, the team's private drive). Delete them and
any recordings at the end of the semester.

## 5. Moderator script

**Before the tasks (about 2 min).**

> "StudyCrew helps student teams find meeting times, track tasks, and check an assignment draft against its
> instructions. I'll hand you five cards, one at a time. Read each card, then do it as you would on your own. There are
> no wrong answers. Please say out loud what you're looking for and what you expect to happen. When you think you're
> done with a task, say 'done'."

**During each task.**

- Hand over the task card (§5.1) and start the timer when the participant **finishes reading it**. Stop the timer when
  they say "done" or when the success check passes, whichever is first. Then check success yourself.
- Don't help, point, or confirm. Neutral prompts only: *"What are you looking for?"*, *"What do you expect that to
  do?"*, *"Where would you look next?"*
- **Hint rule:** after **3 minutes stuck**, or when the participant asks for help a **second** time, give the smallest
  hint that unblocks them (for example *"Have a look at the tabs at the top"*) and note it. A task with a hint counts as
  **H**, not a success, for NFR-04.
- **Give-up rule:** after **5 minutes** on one task, or if they want to stop, mark it **F**. If a later task depends
  on it, set that up yourself (for example, join them to the team) and continue.
- Outcome codes: **S** = success, unaided · **H** = success with a hint · **F** = failed / gave up / timed out.
- After each task ask: *"Was anything confusing or unexpected?"* Write their words down as close to verbatim as you can.

**After the tasks.** Hand over the SUS form (§6). Then ask: *"What was the most frustrating part? What did you like?
Would your team use this?"* Thank them and explain that their test account and team will be removed after the sessions.

### 5.1 Task cards

Print one card per task. Read the scenario aloud and leave the card with the participant.

| # | Card text (give to the participant) | Success check (moderator only) | Watch for |
|---|---|---|---|
| **T1** | *"You're on a CSE 6324 project team. A teammate sent you this invite link. Create a StudyCrew account with the email on this card and join the team."* | The participant is a member: "Usability P#" is in their sidebar and they can open its Overview | The invite link opens **Sign in**. Do they find **Create an account**? (It keeps the invite: D-01, fixed in #49.) Are the password rules clear? After sign-up they should land on "Join Usability P#": do they press **Join team**? |
| **T2** | *"Tell your team when you're usually free: Monday to Thursday, 6 pm to 9 pm. Save it."* | My availability shows Mon–Thu 18:00–21:00 after a reload (24 half-hour slots) | Do they find "My availability"? Drag vs. click on the grid? Do they notice the Save button and the confirmation? |
| **T3** | *"Your team needs a one-hour meeting in the next 7 days (by \_\_\_\_). Use StudyCrew to find a time when everyone is free and schedule it as 'Kickoff'."* | A 60-minute meeting "Kickoff" exists in the team calendar within those 7 days, at a time where everyone is free | Do they use **Best times this week** on the Calendar page or **Find a time**? Note which. Do they understand the ranking and time zones? After scheduling, the app opens the meeting's page: is it clear that it was saved? |
| **T4** | *"Add a task 'Draft the introduction', assign it to yourself, and make it due on Friday (\_\_\_\_). Then show your team you've started working on it."* | The board shows the card in **In Progress** with the participant as assignee and that Friday as the due date | Do they find the board, and the assignee and due-date fields? Do they get to In Progress by the dialog's **Status** field, by dragging, or by **Move to…**? Note which; all three count. |
| **T5** | *"Your team wrote a short draft. Use the AI Coverage Check to compare it with the assignment instructions (Appendix A), and tell me which requirement the draft is missing."* | A report is shown, and the participant names **"Recommend specific collaboration software…"** as missing | Do they find the tab? Do they read and tick the consent box? Do they understand Covered / Partial / Missing? |

## 6. SUS questionnaire

The System Usability Scale (John Brooke, 1986; free to use with this acknowledgement). "System" is replaced by
"StudyCrew". The participant fills it in **alone, right after the tasks, before any discussion**. Ask them to answer
every item and to go with their first reaction.

Participant: **P\_\_** · Date: \_\_\_\_ · 1 = Strongly disagree … 5 = Strongly agree

| # | Statement | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 1 | I think that I would like to use StudyCrew frequently. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | I found StudyCrew unnecessarily complex. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | I thought StudyCrew was easy to use. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | I think that I would need the support of a technical person to be able to use StudyCrew. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | I found the various functions in StudyCrew were well integrated. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | I thought there was too much inconsistency in StudyCrew. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | I would imagine that most people would learn to use StudyCrew very quickly. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | I found StudyCrew very cumbersome to use. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | I felt very confident using StudyCrew. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | I needed to learn a lot of things before I could get going with StudyCrew. | ☐ | ☐ | ☐ | ☐ | ☐ |

**Scoring:**

- Odd items (1, 3, 5, 7, 9) contribute *answer − 1*.
- Even items (2, 4, 6, 8, 10) contribute *5 − answer*.
- SUS = (sum of the 10 contributions) × 2.5, which gives a score from 0 to 100.
- If an item is left blank, ask the participant to complete it on the spot. If they decline, note it, and leave that
  participant's SUS blank in §9 rather than guessing a value.

Report each participant's score and the mean. With 5 participants, also give the range: the mean alone hides a lot.

## 7. Timing sheet (one per participant)

Print this, or copy it into a private spreadsheet. Use clock times (hh:mm:ss) so durations can be checked later.

Participant **P\_\_** · Date \_\_\_\_ · Moderator \_\_\_\_ · Note-taker \_\_\_\_ · Build (commit) \_\_\_\_ · `AI_PROVIDER` \_\_\_\_
· Device / browser \_\_\_\_ · Consent ☐ · Recording ☐ yes ☐ no

| Task | Start | End | Duration (mm:ss) | Outcome (S / H / F) | Hints given (what, when) | Errors, hesitations, quotes |
|---|---|---|---|---|---|---|
| T1 join a team | | | | | | |
| T2 availability | | | | | | |
| T3 find a time | | | | | | |
| T4 create + move a task | | | | | | |
| **Core flow T1–T4** | start of T1 | end of T4 | | finished unaided within 10:00? ☐ yes ☐ no | | |
| T5 AI Coverage Check | | | | | | |

Post-task comments and the final questions: \_\_\_\_

## 8. Analysis

1. **Core-flow completion.** A participant passes when T1–T4 are all **S** and the core-flow time is **≤ 10:00**. The
   rate is passing participants ÷ all participants; NFR-04 passes at ≥ 80 % (4 of 5).
2. **SUS:** each participant's score, then the mean and the range. NFR-04 passes at a mean ≥ 70.
3. **Issues.** Merge duplicates. Give each issue a severity:
   - 0: not a problem.
   - 1: cosmetic.
   - 2: minor; it slows people down.
   - 3: major; it causes an H or F or a wrong result.
   - 4: blocker.

   Open a GitHub issue for every severity ≥ 2 and link it in §9.3.
4. Copy the summary rows (§9.2) into `docs/test-report.md` under NFR-04 with a link back to this file.

## 9. Results (to be filled in by Krish after the sessions; empty on purpose)

### 9.1 Session log

| Participant | Date | Build (commit) | `AI_PROVIDER` | T1 | T2 | T3 | T4 | Core flow time (T1–T4) | Core flow unaided ≤ 10 min? | T5 | T5 time | SUS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | | | | |
| P2 | | | | | | | | | | | | |
| P3 | | | | | | | | | | | | |
| P4 | | | | | | | | | | | | |
| P5 | | | | | | | | | | | | |

Add a row for each extra participant.

### 9.2 Summary

| Measure | Result | Criterion | Pass? |
|---|---|---|---|
| Participants | | ≥ 5 | |
| Core flow finished unaided within 10 min | \_\_ of \_\_ (\_\_ %) | ≥ 80 % | |
| Mean SUS (range) | | ≥ 70 | |
| T5 AI Coverage Check success | \_\_ of \_\_ | (not part of NFR-04) | |

### 9.3 Issues found

| # | Task | What happened | Participants | Severity (0–4) | Issue / fix PR |
|---|---|---|---|---|---|
| | | | | | |

## Appendix A: sample text for T5

Hand this to the participant to paste. It's made up for the test, so nobody's real coursework is sent anywhere.

| Provider | Checked | Result |
|---|---|---|
| Staging, Anthropic `claude-haiku-5-5` | Nov 3, 2026 (dry run, §3.1) | Score 50 / 100 · **Missing:** "Recommend specific collaboration software…" · **Partial:** "Write between 400 and 600 words" (the model counts the length as a requirement) and the productivity comparison · **Covered:** the benefits |
| `mock` (tests, local) | Nov 1, 2026 (`src/server/ai/mock-model.ts`) | Two **Covered**, one **Missing**: the same collaboration-software item |

With either provider, exactly one requirement is **Missing**: the one T5 asks for. A real model can word things
differently from run to run. If a session shows a different Missing item, write down what the report said, and score
T5 on whether the participant reads the report correctly.

**Assignment title:** Remote work essay

**Instructions:**

```text
In 400–600 words:
1. Summarize the benefits of remote work for software teams.
2. Compare remote work productivity with office productivity.
3. Recommend specific collaboration software, such as chat or video calling apps.
```

**Draft:**

```text
Remote work gives software teams real benefits: flexible hours, no commute, and access to talent in other cities. When we compare remote work productivity with office productivity, most studies find remote developers do about as much, and more on focused work. Overall, remote work suits teams that plan their week carefully.
```
