"""Regenerate labs.json from the course pages.

Run from the cyber-hub repo:  python3 ../report-builder/tools/labs.py
It calls each Cyber Hub page builder and records its think questions and deliverables.
"""
import json, re, html, os, sys
sys.path.insert(0, os.getcwd())
import components
cap = {"q": [], "d": []}
_think, _deliv = components.think, components.deliverable
def think(qs): cap["q"].extend(qs); return _think(qs)
def deliverable(n, title, role, kind, instr, checks, fig=""):
    cap["d"].append(dict(n=str(n), title=title, role=role, kind=kind, instr=instr, checks=checks))
    return _deliv(n, title, role, kind, instr, checks, fig)
components.think, components.deliverable = think, deliverable
import pages_hub, goal1
for m in (pages_hub, goal1): m.think, m.deliverable = think, deliverable
strip = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s)).replace("⟦R⟧", "R")
def grab(num, title, fn):
    cap["q"].clear(); cap["d"].clear(); fn()
    return dict(num=num, title=title.split(": ", 1)[-1], questions=[strip(q) for q in cap["q"]],
                deliverables=[dict(n=d["n"], title=strip(d["title"]), role=strip(d["role"]), kind=strip(d["kind"]),
                                   instr=strip(d["instr"]), checks=[[strip(a), strip(b)] for a, b in d["checks"]]) for d in cap["d"]])
out = [grab(n, t, f) for n, t, f in pages_hub.HUB_PAGES if n != "16"]
out.insert(1, grab("01", "Cyber Hub 01: Switch Provisioning", goal1.build))
dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "labs.json")
json.dump(out, open(dest, "w"), indent=1)
print("labs.json:", len(out), "Cyber Hubs")
