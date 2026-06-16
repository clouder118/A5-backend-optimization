# Issue tracker: Local Markdown

Issues and PRDs for this project live as Markdown files in `.scratch/`.

This workspace currently has no Git remote, so local Markdown is the default tracker until the team moves work to GitHub, GitLab, Feishu, Trello, or another shared board.

## Conventions

- One feature or planning effort per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and decisions append under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new Markdown file under `.scratch/<feature-slug>/`, creating the directory if needed.

For this A5 P0 project, issue descriptions should include:

- The demo link it supports, such as visitor home, route recommendation, AI guide chat, admin knowledge management, or deployment.
- The owner lane: AI/product, frontend/experience, or backend/engineering.
- Clear acceptance criteria tied to the 7-minute demo flow.
- Verification steps, preferably `npm run build`, `npm run verify:visitor`, `npm run verify:admin`, or a concrete manual flow.

## When a skill says "fetch the relevant ticket"

Read the referenced `.scratch/...` file. If the user only gives an issue number, search `.scratch/**/issues/` for a matching numeric prefix.
