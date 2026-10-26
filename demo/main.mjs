import * as d3 from "d3";
import { ClusterMap } from "../dist/clustermap.mjs";
import { mountPlotSelectionToolbar } from "../dist/editor.mjs";
import { createLargeTestingData, SYNTHETIC_FIXTURES } from "../fixtures/synthetic.mjs";
import { applyTheme } from "../src/ui/theme.mjs";

const params = new URLSearchParams(location.search);
const testMode = params.has("test");
const fixture = params.get("fixture");
const syntheticFixture = Object.hasOwn(SYNTHETIC_FIXTURES, fixture) ? SYNTHETIC_FIXTURES[fixture] : null;
const biologicalFixtures = { mcaa: "../fixtures/mcaa-neighbourhoods-173.json", pks: "../fixtures/pks-regions-142.json", "tree-styling": "../fixtures/tree-styling.json", heatmap: "../fixtures/heatmap.json", "group-markers": "../fixtures/group-markers.json" };
const biologicalFixture = biologicalFixtures[fixture];
const projectFixtures = { "heatmap-project": "../fixtures/clinker-project-heatmap.json" };
const projectFixture = projectFixtures[fixture];
const treeFixture = fixture === "burnettii";
const renderer = params.get("renderer") || (syntheticFixture || biologicalFixture ? "canvas" : "svg");
const minZoom = Number(params.get("minZoom"));
const chart = ClusterMap().config({
  plot: { transitionDuration: testMode ? 0 : 250, renderer, minZoom: Number.isFinite(minZoom) ? minZoom : 0, minimap: { show: params.has("minimap") } },
  cluster: { alignLabels: false },
  gene: { label: { show: false } },
  legend: { show: true, position: syntheticFixture || biologicalFixture ? "bottom" : "right", columns: biologicalFixture ? 8 : 1 },
  link: { threshold: 0.3, bestOnly: true },
});
const source = projectFixture ? d3.json(projectFixture) : syntheticFixture ? Promise.resolve(createLargeTestingData(syntheticFixture)) : treeFixture ? d3.json("../fixtures/bua-genbank-tree.json") : biologicalFixture ? d3.json(biologicalFixture) : d3.json("../fixtures/testing.json");
const themeSelect = document.querySelector("#theme-mode");
const syncTheme = () => {
  themeSelect.value = chart.uiAppearance();
  applyTheme(document.querySelector("main"), themeSelect.value);
};
chart.on("change", (event) => { if (event.type === "config.change" || event.type === "theme.change") syncTheme(); });
themeSelect.addEventListener("change", () => chart.uiAppearance(themeSelect.value));
syncTheme();
const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
const validateData = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("the file must contain a JSON object");
  if (!Array.isArray(data.clusters) || !Array.isArray(data.links) || !Array.isArray(data.groups)) throw new Error("expected clusters, links, and groups arrays");
  if (!data.clusters.every((cluster) => Array.isArray(cluster?.loci) && cluster.loci.every((locus) => Array.isArray(locus?.genes)))) throw new Error("each cluster must contain loci with genes arrays");
};
const loadFile = (button, input, validate, apply, noun) => {
  button.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const [file] = input.files;
    input.value = "";
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      validate(value);
      apply(value);
      status.textContent = `Loaded ${noun} ${file.name}`;
      status.dataset.error = "false";
    } catch (error) {
      status.textContent = `Could not load ${file.name}: ${error.message}`;
      status.dataset.error = "true";
    }
  });
};

const editor = document.querySelector("clinker-editor");
const status = document.querySelector("#data-import-status");
source.then((loaded) => {
  const project = loaded.format === "clinker-project" ? loaded : null;
  const data = project ? project.data : loaded;
  if (project) chart.config({ ...project.config, plot: {
    ...project.config.plot,
    renderer: params.get("renderer") || project.config.plot.renderer,
    ...(testMode ? { transitionDuration: 0 } : {}),
    ...(params.has("minZoom") ? { minZoom } : {}),
    ...(params.has("minimap") ? { minimap: { ...project.config.plot.minimap, show: true } } : {}),
  } });
  // Annotation examples opt in explicitly; ordinary charts remain synteny-only.
  if (params.has("theme")) chart.uiAppearance(params.get("theme"));
  if (fixture === "heatmap" || fixture === "heatmap-project" || fixture === "group-markers") chart.config({ annotations: { enabled: true } });
  if (testMode) { window.__demoChart = chart; window.d3 = d3; }
  d3.select("#plot").selectAll("div").data([data]).join("div").attr("class", "chart-host").call(chart);
  if (project?.state) chart.state(project.state);
  editor.chart = chart;
  editor.addEventListener("clinker-editor-open", () => document.querySelector("#btn-editor").setAttribute("aria-expanded", "true"));
  const workspace = document.querySelector("#workspace");
  workspace.addEventListener("clustermap:edit-annotation", (event) => {
    if (event.detail.chart !== chart) return;
    event.preventDefault(); editor.editAnnotations(event.detail.panelUid);
  });
  mountPlotSelectionToolbar(chart, workspace, { editor });
  document.querySelector("#btn-editor").addEventListener("click", () => {
    editor.hidden = !editor.hidden;
    document.querySelector("#btn-editor").setAttribute("aria-expanded", String(!editor.hidden));
  });
  if (params.has("editor")) document.querySelector("#btn-editor").click();
  document.querySelector("#btn-save-svg").addEventListener("click", () => download(new Blob([chart.exportSvg()], { type: "image/svg+xml" }), "clinker.svg"));
  document.querySelector("#btn-export-data").addEventListener("click", () => download(new Blob([`${JSON.stringify(chart.data(), null, 2)}\n`], { type: "application/json" }), "clinker-data.json"));
  document.querySelector("#btn-export-project").addEventListener("click", () => download(new Blob([`${JSON.stringify(chart.project(), null, 2)}\n`], { type: "application/json" }), "clinker-project.json"));
  loadFile(document.querySelector("#btn-import-data"), document.querySelector("#data-import-file"), validateData, (value) => chart.data(value), "data");
  loadFile(document.querySelector("#btn-import-project"), document.querySelector("#project-import-file"), (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("the file must contain a project object");
    if (value.format !== "clinker-project" || value.version !== 1) throw new Error("unsupported project format");
    if (!value.config || typeof value.config !== "object" || Array.isArray(value.config)) throw new Error("the project needs appearance settings");
    validateData(value.data);
  }, (value) => chart.project(value), "project");
});
