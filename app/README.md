# Kepler Station app

Published app: https://claude.ai/artifact/53GUtPYqGo4hvxETmAfXum

- `src/head.html`: page styles and layout (the desktop layout and the phone layout: pinned scene, bottom Back/Next bar, Stops sheet).
- `src/engine.js`: the colony scene, camera, shape cast and drawing helpers.
- `src/sims.js`: dots and flow station screens. `src/diagrams.js`: tap-to-explore diagram screens.
- `src/recall.js`: the Recall menu (FSRS-4.5 review of 5 cards per model, blurt drill, mixed "which model?" drill, cram, stats and 7-day forecast), the Anki deck export, the spaced-repetition methods guide, and the Socratic tutor chat. Review state is saved to `srs/<card id>` and the chat to `tutor/chat`.
- `src/lesson.js`: the 8-step lesson, progress saving (Artifact database `progress/<model id>`, with a copy in the browser) and the Socratic tutor (Claude via the `sample` capability).
- `build.py`: joins the sources, inlines `content/*.json` and writes `dist/kepler-station.html`, which is published with capabilities `{db:{}, sample:{}, downloads:true}`.

Rebuild after any content or template change: `python3 app/build.py`, then republish `dist/kepler-station.html`.

Status (build step 3): all 20 stops have the 8-step lesson (Predict, Story, Simulate, Name it, Elsewhere, Failure, Explain, Review).
Station screens work for 13 models: M1, M2, M3, M5, M6, M7, M8, M11, M13, M14, M15, M17 and M20.
Still to come: diagram screens for M4, M9, M10 and M12, and agent-world screens for M16, M18 and M19 (step 5).
