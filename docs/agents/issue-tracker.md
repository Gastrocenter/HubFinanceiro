# Issue tracker: Local Markdown (docs/issues/)

Issues and specs for this repo live as markdown files in `docs/issues/`, versioned with the code.

## Conventions

- One file per issue, all in one folder: `docs/issues/NN-<slug>.md`. Two-digit number; a letter suffix marks an issue slotted between two others (`05b`). Never a single combined tickets file.
- Near the top of each issue file:
  - a `Status:` line with one of the triage roles (see `triage-labels.md`);
  - a `**Depende de:**` line listing the issue numbers that block it. An issue is unblocked when every issue it lists is closed.
- A closed issue gets a `**Fechada em AAAA-MM-DD.**` line and its acceptance criteria ticked `[x]`.
- Comments and conversation history append to the bottom of the file under a `## Comments` heading.
- A spec for a larger feature (`/to-spec`) lives at `docs/specs/<feature-slug>.md`; its tickets still go in `docs/issues/`, numbered after the last existing one.

## When a skill says "publish to the issue tracker"

Create a new file `docs/issues/NN-<slug>.md` with the next free number.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly (`07` → `docs/issues/07-*.md`).

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `docs/issues/mapas/<effort>.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `docs/issues/NN-<slug>.md`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: the `**Depende de:**` line. A ticket is unblocked when every file it lists is `resolved` or closed.
- **Frontier**: scan `docs/issues/` for files that are open, unblocked, and unclaimed; lowest number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far.
