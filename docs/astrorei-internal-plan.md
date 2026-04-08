# Astrorei Team Plan for ReiLabs (Internal Focus)

## Goal
Ship the smallest set of features that makes ReiLabs indispensable for Astrorei daily decisions, then layer unique innovation workflows that competitors do not offer.

## Project Concept (New Core Module)

Create a first-class `Project` object where ideas can mature from early thought to validated initiative.

### Project object
1. `title`
2. `summary`
3. `status` (`idea`, `concept`, `validation`, `building`, `launched`, `archived`)
4. `owner_user_id`
5. `website_url` (optional)
6. `github_repo_url` (optional)
7. `tags`
8. `created_at`, `updated_at`

### Linked content model
1. A project can have many linked posts.
2. A post can be linked to one or more projects.
3. Linked posts should be visible as a timeline inside the project page.
4. Each project should display "latest updates" from linked posts.

### Feature proposals inside a project
1. Each project can contain feature proposals.
2. Feature proposals support upvote/downvote.
3. Feature proposals support comments with max two levels.
4. Feature proposals can be marked as `accepted`, `rejected`, or `deferred` after review.

### Review and evolution flow
1. Every project enters `idea` by default.
2. Status change requires a short rationale note.
3. Reviews can be requested from specific teammates.
4. Important decisions should be captured as "decision notes" in project history.

### History and audit
1. Save full status history (from/to, changed_by, timestamp, rationale).
2. Save project field change history (title/summary/links updates).
3. Save feature proposal decision history.
4. Show a readable timeline so anyone can understand project evolution.

## Must-Have Features (Astrorei Now)

1. Project concept module (project page + status flow + linked posts)
- Why: this becomes the core unit of progress, while posts become supporting evidence.

2. Feature proposals in project (vote + two-level comments + decision state)
- Why: converts broad ideas into concrete, reviewable building blocks.

3. Post edit/delete with history
- Why: authors must fix mistakes, update assumptions, and keep trust in written decisions.

4. Drafts + autosave
- Why: ideas are often half-formed; losing drafts kills contribution.

5. Search + tags + filters (including project and feature scope)
- Why: if teams cannot find old ideas quickly, the blog becomes noise.

6. Notifications that matter
- Why: notify only on relevant events (reply to me, mention me, investment on my post) to avoid alert fatigue.

7. Admin moderation controls
- Why: internal tools still need safety controls for spam/off-topic/accidental leaks.

8. Investment guardrails
- Why: cap budgets, prevent self-investment, and enforce fair allocation rules.

9. Weekly analytics summary
- Why: leadership needs one view of what ideas are gaining traction and funding.

10. Audit log for critical actions
- Why: track edits, deletes, investment changes, and moderation actions for accountability.

## Nice-to-Have Features (After Core Stability)

1. Scheduled publishing
2. Team-specific spaces (engineering, product, design)
3. Templates (project brief, experiment proposal, postmortem, launch note)
4. Slack digest and top-idea recap
5. Advanced profile pages (expertise, track record, funded ideas)
6. Mobile-optimized posting flow
7. Lightweight API/webhooks for internal automations
8. AI writing assistant for clearer posts and summaries
9. Project health score (momentum, review latency, unresolved blockers)

## Edge-Case Ideas to Make ReiLabs Unique

1. Contrarian trigger
- If an idea gets many downvotes but receives high-confidence AI score, mark it as "Contrarian Opportunity" for leadership review.

2. Underfunded high-signal queue
- Detect posts with strong discussion depth but low investment and auto-group them as "Potentially Undervalued".

3. Decision aging alerts
- If a high-investment idea is not updated after N days, alert owner and manager to prevent idea decay.

4. Anti-hype detector
- Identify ideas with fast investment spikes but shallow discussion quality; flag for deeper validation.

5. Duplicate idea merge suggestions
- Use semantic matching to suggest merging similar ideas to avoid fragmented investment.

6. Portfolio balance mode
- Show whether team investment is over-concentrated in one theme (e.g., too much AI infra, no UX bets).

7. Reviewer roulette
- Auto-assign a rotating cross-functional reviewer to each highly funded post to reduce silo bias.

8. "Failed but valuable" badge
- Track closed ideas that did not ship but created useful learning; make learning ROI visible.

9. Project split and merge history
- Let teams split one project into multiple tracks or merge overlapping projects while preserving full lineage.

10. Dormant project auto-revival
- If related posts reappear or external signals rise (for example GitHub stars), suggest reactivating archived concepts.

11. Feature conflict map
- Detect when two upvoted features conflict technically or strategically and force an explicit trade-off decision.

12. Evidence-weighted voting
- Weight votes by evidence quality (benchmarks, customer feedback links, prototype demos), not popularity alone.

## Astrorei 6-Week Execution Plan

### Weeks 1-2: Core Trust Layer
1. Project concept module (project CRUD + status workflow)
2. Linked posts timeline in project
3. Post edit/delete + history

### Weeks 3-4: Discovery and Engagement
1. Feature proposals (votes + 2-level comments + review decisions)
2. Search/tags/filters across projects, features, and posts
3. Notification tuning and preferences

### Weeks 5-6: Differentiation
1. Project history timeline and decision notes
2. Underfunded high-signal queue
3. Decision aging alerts

## Success Metrics (Internal)

1. Time-to-first-post for new member (target: under 3 days)
2. Weekly active contributors (target: >40% of active team)
3. % projects with explicit status and rationale (target: >90%)
4. Feature proposal review turnaround (target: <7 days median)
5. Comment depth per proposal/post (target: median >= 4 comments)
6. % funded ideas with 30-day update (target: >80%)

## Operating Rules

1. Keep investment virtual and transparent (no hidden adjustments)
2. Require a status update when investment crosses a threshold
3. Archive stale posts with clear reason labels
4. Review top 5 funded and top 5 contrarian ideas every week

## One-Line Internal Positioning

"ReiLabs is Astrorei's decision engine: capture ideas, challenge them, fund them, and learn faster."