# Mindset Orbit

No-build static page: `index.html`, `style.css`, `orbit.js`. Content lives in JSON, never in code.

## Rules

- Personal data (`data/`) is git-ignored. Never commit photos or notes of a real person's set. Examples go in `template/` with placeholder art.
- Small logical commits, stage only touched paths, push each. Never commit secrets.
- Motion: transform and opacity only, ease-out, under 300ms for UI, gate hover with `(hover: hover)`, honor `prefers-reduced-motion`.
- Keep focus-visible parity with hover. Items must stay keyboard reachable.
- Docs: concise, neutral voice, no personal names.
