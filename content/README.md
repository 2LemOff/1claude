# Content: 20-model pilot

The app is built from these files (build step 1 in `DECISIONS.md`).

- `story.json`: the Kepler Station setting, its 10 locations, the 5-shape cast, the oxygen crisis and the 4 acts.
- `index.json`: the suggested trail (story order), 1 → 20, with each model's act, location and simulation type.
- `models/M*.json`: one file per model. `M` numbers match the ranked list from the original chat.

## Fields in each model file
| Field | What it holds |
|---|---|
| `name`, `aliases`, `originator`, `year` | Proper name, other names, who found it and when |
| `evidence`, `evidenceLabel` | proven ✅ · strong 🔬 · debated ⚖️ · method 🧭 |
| `rule`, `plain`, `formula` | One-line rule, plain-language version, formula (shown by the formula toggle; may be `null`) |
| `story` | Act, trail position, colony location, cast, and the story beat |
| `examples` | 3 more examples of the same model elsewhere in the colony |
| `sim` | Simulation type (`dots`, `flow`, `agents`, or `diagram`) and its settings |
| `realCase` | A real-world failure or success, shown as an "archive transmission from Earth" |
| `misuse` | How the model itself misleads when overused |
| `related`, `sources`, `videos` | Links to other models, citations, curated videos |
| `animation` | Only on M14 and M15, the 2 planned Manim animations |
| `quiz` | `predict` (asked before the lesson), `mcq`, `whichModel` (for mixed review) |

## To check before the app ships
- **Fact spot-check:** read the `realCase` and `formula` in 5 of the files. Suggested sample: M2 Sally Clark, M11 Biosphere 2, M13 Trinity, M16 Hanoi rats, M17 LTCM.
- **Videos:** every entry has `"verified": false`. The titles and channels are real, but only the Nicky Case entries have URLs. The other links need to be found and pasted in.
- **Colony numbers** (200 colonists, 6 t of stored O₂, 90-day delay, doubling every 3 days) are story choices, not facts. The one real figure is 0.84 kg O₂ per person per day (NASA).
