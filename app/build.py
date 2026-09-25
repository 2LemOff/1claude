"""Build app/dist/kepler-station.html by inlining content/*.json into app/template.html."""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
content = {
    "story": json.loads((root / "content/story.json").read_text()),
    "index": json.loads((root / "content/index.json").read_text()),
    "models": [json.loads(p.read_text()) for p in sorted((root / "content/models").glob("M*.json"))],
}
tpl = (root / "app/template.html").read_text()
assert "/*__CONTENT__*/null" in tpl
data = json.dumps(content, ensure_ascii=False).replace("</", "<\\/")
out = root / "app/dist/kepler-station.html"
out.parent.mkdir(exist_ok=True)
out.write_text(tpl.replace("/*__CONTENT__*/null", data))
print(f"wrote {out.relative_to(root)} ({out.stat().st_size // 1024} KB)")
