"""Build app/dist/kepler-station.html from app/src/* and content/*.json.

Order matters: engine.js (scene, cast, helpers) -> sims.js (dots & flow screens)
-> diagrams.js (tap-to-explore screens) -> lesson.js (8-step lesson, progress, loop).
"""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "app/src"
content = {
    "story": json.loads((root / "content/story.json").read_text()),
    "index": json.loads((root / "content/index.json").read_text()),
    "models": [json.loads(p.read_text()) for p in sorted((root / "content/models").glob("M*.json"))],
}
js = "\n".join((src / f).read_text() for f in ["engine.js", "sims.js", "diagrams.js", "lesson.js"])
assert "/*__CONTENT__*/null" in js
js = js.replace("/*__CONTENT__*/null", json.dumps(content, ensure_ascii=False).replace("</", "<\\/"))
out = root / "app/dist/kepler-station.html"
out.parent.mkdir(exist_ok=True)
out.write_text((src / "head.html").read_text() + "\n<script>\n" + js + "\n</script>\n")
print(f"wrote {out.relative_to(root)} ({out.stat().st_size // 1024} KB)")
