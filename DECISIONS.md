# DECISIONS: Mental-Models Learning App

Status: planning. No app code yet. ✅ = decided by the owner. ★ = the default that applies unless the owner changes it.

## Context
The brainstorm chat described a visual learning app for 50 mental models plus their sources. The repo `2lemoff/1claude` is still empty (no commits; branch `claude/fervent-brahmagupta-cd9r0d`). Building can't start until the decisions below are made. ✅ marks a decision you've made. ★ marks my recommended default, which applies to anything you leave open.

Some tool facts in the brainstorm are dated after my training data: the Sora shutdown, Veo and Grok limits, and Project Genie pricing. Check them again before paying for anything.

---

## ✅ Decided so far
| # | Choice | Decision |
|---|---|---|
| 1 | v1 scope | **A pilot with 20 models.** These are the top 20 by impact from the ranked list: M1–M13 (thinking moves) and M14–M20 (feedback loops, exponentials, incentives, fat tails, evolution, game theory, trade-offs). Use it for a week, then expand to all 50. |
| 2 | Core concept | **One visual scene holds every demonstration.** A single persistent 2D world is the stage for every model. Each model is shown as a different event, example or overlay happening inside that same world, never as a new setting. |
| 3 | Story | **One continuous story set in that one scenario**, focused on the present and the future (the past isn't essential). Everyday life, work, society and future decisions all happen in the same world. |
| 4 | Navigation | **Free exploration of the scene/map.** The story order appears as a suggested, numbered trail, but you can open any place at any time. |
| 5 | Depth | Plain language, with a **formula toggle**. |
| 6 | Audience | **Only you.** No accounts, minimal licensing concerns. |
| 7 | Story/visual style | **Animated abstract shapes** (Heider & Simmel style): circles and triangles as characters whose motion tells the story. It's all drawn in code, so no image model is needed. |
| 8 | Simulations | **Start with 2 types**, probability dots and flow/stocks, drawn as overlays in the scene. The shape-characters in the scene already work as the agent-world simulation that incentives, evolution and game theory need. |
| 9 | Video | **At most 2 code-made animations** for the whole project (Manim or Remotion), plus curated existing videos (3Blue1Brown, Kurzgesagt and others) linked or embedded. No AI-generated video. |
| 10 | Form | **A Claude Artifact web app**: progress is saved, the "ask Claude" tutor is built in, and nothing needs hosting. |
| 11 | Evidence tags, AI tutor, final project | Yes (★ defaults kept). |
| 12 | Scene setting | **A space colony.** A bounded habitat with life support, a power plant, greenhouses, a clinic, a market, docks and a comms link to Earth. Hard physics constraints (energy, air, scale) come built in, and people's everyday life, work and politics happen inside the habitat. |
| 18 | The 2 animations | **Exponentials/S-curves (M15)** and **feedback loops (M14)**. |

## Open: choices still needed (★ = default if you don't answer)
**Scene and story**
13. **Protagonist**: ★ one shape-character, "you" (a newly arrived colonist), plus a small recurring crew (3–5 shapes, each with a colour and personality) · no protagonist, just a narrator.
14. **Story arc across the 20 pilot models**: ★ the colony faces one growing problem, such as a failing oxygen greenhouse or a mystery illness spreading, with supply ships from Earth delayed. Each model is the tool that solves the next piece of it: diagnosing the cause (thinking moves M1–M13), then the growth and loops inside the habitat (M14–M15), then the crew's incentives, factions and trade (M16–M20). The final choices set the colony's future.

**Lesson content**
15. **Lesson recipe**: ★ the full 8 steps (predict → story in the scene → simulate → name → same model elsewhere in the scene → failure → explain back → review) · a shorter 4 steps.
16. **Fields for each model**: name, originator and year, rule, formula, 3 in-scene examples, real-world failure, misuse card, related models, sources, quiz. ★ Keep all of them.
17. **Real-world failures** (Mars Orbiter, Hanoi rats and others) when everything else happens in one scene: ★ show them as "archive transmissions from Earth" cards · re-enact them inside the colony.

**Visual and technical**
19. **Curated video density**: ★ one hand-picked video for each model, where a good one exists · one per group.
20. **3D**: ★ none in the pilot (the scene is 2D) · a 3D version of the scene later.
21. **Theme**: ★ follows the system's light/dark setting. Colour mood still to be chosen.
22. **Main device**: ★ phone and desktop equally · phone first.
23. **Content storage**: ★ one JSON file per model in this repo, with the app built from them.
24. **Spaced review**: ★ built-in FSRS scheduling, mixed across models · export to Anki.

**Learning mechanics**
25. **Question types**: ★ predict first, "which model is this?", and a confidence rating on every answer.
26. **Daily time and review cap**: ★ about 20 minutes a day, with at most 30 reviews.
27. **Gamification**: ★ light (the scene gradually "lights up" as you master models, plus a "spotted it in real life" log) · heavy (XP and streaks) · none.
28. **Measuring progress**: ★ a short test before and after the pilot.

**Process**
29. **Fact-checking**: ★ I cite a source for every item and you spot-check a sample.
30. **Build order**: ★ (1) content JSON for the 20 models → (2) the scene engine, shape cast and the 2 overlay types → (3) the first 5 models playable → (4) your feedback → (5) the remaining 15 → (6) review system, 2 animations and curated videos → (7) expand to 50.

---
