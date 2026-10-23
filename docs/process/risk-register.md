# Risk register (reviewed at every sprint review; P, I on 1–5; review if P×I ≥ 12)

| ID | Risk | P | I | P×I | Status (Oct 22) | Response · owner |
|---|---|---|---|---|---|---|
| R-01 | Because the plan assumes ~1 h/point with AI help and members carry other courses, we may finish fewer points than planned → unfinished features on Nov 7 | **5** | 4 | **20** | **Triggered**: development started Oct 22 instead of Sep 27 | Re-baselined plan; shared contracts for parallel work; drop order PB-15 → PB-14 → PB-07 polish; measure hours/point in AI logs · Krish |
| R-02 | Because the LLM can misread instructions or invent content, the Coverage Check may flag wrong gaps or miss real ones → bad advice, missed AI targets | 3 | 4 | 12 | Open | Two-step prompt, server-side quote verification + downgrade, disclaimer, 30-case eval (PB-16) · Devarsh |
| R-03 | Because most first-draft code comes from AI agents, we may merge code we don't understand → hidden defects, weak demo answers | **4** | 3 | 12 | Increased (agent-heavy catch-up) | Ownership rules + frozen contracts, required tests + coverage gate, authz sweep, review pairs, "explain every file" DoD item, AI logs · Dev |
| R-04 | Because we're new to Next.js 16 / Prisma 7 / time-zone logic, the calendar and finder may take longer → spillover | 3 | 3 | 9 | Open (spike done in foundation) | Pure finder with DST tests first; Dev pairs on PB-06 · Varad |
| R-05 | Because AI and hosting rely on free tiers, a quota/outage may break tests or the demo | 2 | 4 | 8 | Open | Mock model in all tests, Gemini backup key, $30 cap, recorded demo video · Dev |
| R-06 (new) | Because four agents work in parallel, they may edit shared files and cause merge conflicts or contract drift | 3 | 3 | 9 | New — justified by the parallel-agent plan | Frozen-file list in CLAUDE.md, contract-request process, folder ownership, lint rule blocking DB access from UI · Dev |
