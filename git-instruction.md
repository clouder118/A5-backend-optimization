# Git And Contribution Instructions

## Current Repository State

This local project was extracted from `A5--main.zip`, not cloned as a normal Git
working tree. The ZIP corresponds to GitHub commit:

```text
fef3da011d9178d918b9b0b4290ac0577f20c28c
```

Because the extracted directory does not contain `.git`, Git history, branches,
and remotes are absent until a repository is initialized or the project is
cloned again.

## Recommended Git Setup

If continuing from this extracted copy:

```bash
cd A5--main
git init
git add .
git commit -m "baseline from A5 zip archive"
git remote add origin https://github.com/huts1971/A5-.git
```

Before pushing, confirm with the team whether this extracted baseline should be
used or whether a fresh clone is preferred.

## Branching

- `main`: stable baseline or submission-ready state.
- `feature/<short-topic>`: new visitor/admin/backend work.
- `fix/<short-topic>`: bug fixes.
- `docs/<short-topic>`: documentation-only changes.

Keep each branch focused on one theme. Do not combine visual rewrites, backend
API changes, and knowledge-data changes in one branch unless they are required
for the same feature.

## Commit Rules

Use concise, behavior-focused commit messages:

```text
docs: add root agent handoff
fix: keep audio playback single-instance
feat: add scenic spot image mapping
test: cover ticket answer fallback
```

Each commit should be able to answer:

- What behavior changed?
- Which subsystem changed?
- How was it verified?

## Secrets And Generated Files

Never commit:

- Real API keys, GitHub tokens, admin tokens, or private account credentials.
- Local `backend/.env` files.
- Runtime databases such as `backend/data/app.db`, unless the team explicitly
  decides to version a demo database.
- Runtime logs, local server output, and one-off debug files.

Allowed and currently intentional:

- `frontend/dist` is included for stable demo packaging.
- `frontend/public/live2d` and `frontend/src/vendor/live2d` are part of the
  checked-in Live2D experience.
- `knowledge/` is a curated derived package and should be reviewed like product
  data, not treated as disposable cache.

## Review Checklist

Before merging or handing off:

- Run `python -m pytest -q` in `backend` for backend changes.
- Run `npm run build` in `frontend` for frontend changes.
- Run targeted verify scripts when touching visitor/admin/Live2D/source display.
- Confirm docs do not contain secrets.
- Confirm public routes, API paths, and environment variable names were not
  changed accidentally.
