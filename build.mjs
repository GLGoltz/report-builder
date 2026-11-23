// Report Builder: build script.
//
//   node build.mjs    writes index.html
//
// src/shell.html   page layout
// src/style.css    styles, including the printed documents
// src/*.js         data, core (storage, files, helpers), log, var, ssp, report (printing), main (shell)
// labs.json        Cyber Hub titles, questions and deliverables, made from the course pages by tools/labs.py
//
// The app ships no answers or expected values. See REPORT_BUILDER_SPEC.md, section 2.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(HERE, p), "utf8");
const labs = JSON.stringify(JSON.parse(read("labs.json")));
const js = ["data", "core", "log", "var", "ssp", "report", "main"].map((f) => read(`src/${f}.js`)).join("\n")
  .replace("/*LABS*/[]", () => labs);
const html = read("src/shell.html").replace("{{CSS}}", () => read("src/style.css")).replace("{{JS}}", () => js);
writeFileSync(join(HERE, "index.html"), html);
console.log("index.html", html.length, "bytes");
