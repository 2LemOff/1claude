# Kepler Station app

Published app: https://claude.ai/artifact/53GUtPYqGo4hvxETmAfXum

- `template.html`: the engine (colony scene, shape cast, station-screen simulations, lesson panel).
- `build.py`: inlines `content/*.json` into the template, producing `dist/kepler-station.html`, which is the file published as the Claude Artifact.

Rebuild after any content or template change: `python3 app/build.py`, then republish `dist/kepler-station.html`.

Status (build step 2): scene, cast, story stepper, and the dots and flow screens for M2, M6, M7, M8, M11, M14, M15, M17 and M20 are done.
Diagram screens are coming in step 3, and agent-world screens (M16, M18, M19) in step 5.
