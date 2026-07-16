# SessionMUN — MUN Session Manager

A **frontend-only** web app for chairing Model UN committee sessions. It mirrors
the screen flow of session.muncommand.com and layers a Gavelling-style
scoring/ranking system on top, plus a post-session **delegate comments** feature.

No backend, no database — a static React bundle you can host on Vercel. All state
("memory") lives in the chair's browser.

## Tech

- **React 19 + TypeScript**, built with **Vite**.
- Lightweight custom store (`useSyncExternalStore`) — no state library, no router.
  In-app screen flow is driven by a small route union in `src/store/store.ts`.

## Persistence model (client-side only)

| Slice | Store | Why |
| --- | --- | --- |
| roster, sessions, chair name | **localStorage** (typed wrapper, `src/lib/storage.ts`) | Primary store, bounded size |
| score history, comments | **IndexedDB** via `idb-keyval` | These grow across ~8–9 sessions and risk the ~5 MB localStorage ceiling, so they're offloaded rather than silently hitting quota. Falls back to localStorage if IDB is unavailable. |
| `activeMunEventId` flag | **cookie** | A single trivial flag only — never bulk data. |
| full backup | **JSON export/import** | Safety net for a purely-local app (Home → Backup). |

> **Single-device assumption.** Everything lives in one browser. There is **no
> real-time multi-device sync** — the app is designed for single-device,
> chair-operated use. Use **Export all data (JSON)** on the Home screen to back up
> or move state between machines.

See `src/lib/persistence.ts` for the load/save split and `src/types.ts` for the
full data model (`MunEvent`, `Session`, `ScoreEvent`, `Comment`, …).

## Screen flow

1. **Committee Setup** — *All Countries* (searchable, checkboxes, select-all/none;
   193 UN member states with flag emoji) and *Custom Countries* (name / emoji /
   code). Both feed one roster → creates a `MunEvent`.
2. **Home** — committee logo + name, roster summary, past-session list
   (Session I, II, …), **Start Session** / **Resume Session**, **End Event**
   (ends the whole committee — data is kept, Scoreboard/export stay
   available, but no further sessions can be started), open an ended session
   in read-only review, plus JSON backup/restore.
3. **Live Session** — top bar (menu, logo, scoreboard/links/fullscreen), agenda
   banner with three quorum counters (Present / Present&Voting / Roster), and a
   six-tab bottom nav:
   - **GSL** — timer card (`remaining / per-speaker`), four full-width square
     controls (roll call · speaker-time · reset · play), current + upcoming
     speakers, add-speaker panel **gated until a roll call is conducted**.
     Advancing to the next speaker asks how they yielded:
     - **Chair** — just advances.
     - **Points of Information** — did they handle it well (+1) or poorly (−1)?
     - **Other Delegate** — pick who; if that delegate accepts, they earn a
       0.2-point acceptance bonus plus normal time-based credit for however
       long they then spoke. Declining awards nothing.
   - **Motions** — raise/second/pass/fail; passing a moderated-caucus motion
     configures & opens the Mod tab.
   - **Mod / Unmod** — shared caucus timer component (Mod adds topic, per-speaker
     time and a temporary queue; Unmod is a bare countdown). Ending returns to GSL.
   - **Single Speaker** — one-off timed floor time (right of reply / personal
     privilege / other), logged as its own event.
   - **Vote** — Configure Voting modal (Procedural/Substantive; Simple / Two-Thirds
     / Security Council (9) / Consensus), live tally dashboard with **Hide/Show
     Results**, per-delegate ballots, pass/fail with breakdown stored on the session.

## Scoring (Gavelling-style)

Every floor-time category is scored purely from actual speaking duration, at
one shared rate — **1 point per full minute spoken** (minimum 1 point for any
nonzero speech) — so nothing stacks a flat "you spoke" bonus on top of a
separate time bonus for the same speech. Non-time actions (motions, POI,
sponsorship, attendance, manual) are calibrated relative to that same
per-minute unit. Rules live in `src/lib/scoring.ts`:

| Column | Source | Points |
| --- | --- | --- |
| GSL | GSL speech, scored on "Next Speaker" | 1 pt / min spoken |
| POI | how a delegate answered Points of Information when yielding | +1 well handled / −1 poorly handled |
| Cauc | moderated-caucus speech(es) | 1 pt / min, **summed across all of a delegate's turns and awarded once the caucus ends** (not per turn) |
| Time | floor time for Personal Privilege / Other single-speaker events | 1 pt / min spoken |
| Mot | motion passed (proposer) | +1 |
| RTR | right of reply | 1 pt / min spoken |
| WP | sponsor of adopted working paper | +3 |
| DR | sponsor of adopted draft resolution | +5 |
| ± | manual adjustments | signed |
| *(Attendance)* | roll call | +1 present / +2 present & voting |

GSL scores per-speech immediately; caucus scores are deferred to when the
caucus ends so a delegate who holds the floor across several turns in one
caucus is scored on total time, not double-counted per turn.

Open the **Scoreboard** (top bar / hamburger / Home): **Ranking** and **Matrix**
views, per-delegate **detail** (breakdown, attendance line, **Manual Adjustment**
with required reason), **Export CSV**. Auto events are de-duplicated by a
`sourceRef` so re-triggering an action never double-awards.

## Ending a session — forced Review Mode

Ending a session (from Home or the Live Session menu) drops the chair straight
into **Review Mode**: every roster delegate is listed, and the chair must
leave a comment **plus a required 1–5★ rubric** (preparation / diplomacy /
public speaking — all three must be rated) on each delegate before "Return
Home" unlocks. There is no menu or shortcut off this screen, and the app
refuses to route back to Home (even after a reload) while an ended session
still has unreviewed delegates.

## New feature — Post-session delegate comments

Once a session is **ended**, each delegate's Scoreboard detail view also
unlocks a Comments panel for adding further freeform notes any time afterward:
timestamped, author-attributed, editable/deletable, stored per
`(delegateId, sessionId)`, shown as a combined timeline across the event and
tagged by session. The rubric is optional on these follow-up comments (it's
only mandatory on the one required during Review Mode above).

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check (tsc -b) + production build to dist/
npm run preview  # serve the built bundle
```

## Deploy (Vercel, static)

`vercel.json` sets framework `vite`, build `npm run build`, output `dist/`, and a
catch-all rewrite to `/` (harmless for the in-app router). Import the repo into
Vercel and deploy — zero server-side code.
