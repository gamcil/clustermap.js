import { max as d3max, min as d3min } from "d3-array";
import { quantize } from "d3-interpolate";
import { scaleLinear, scaleOrdinal, scaleSequential } from "d3-scale";
import { interpolateGreys, interpolateRainbow } from "d3-scale-chromatic";
import { createDefaultConfig, updateConfig } from "./config.js";
import { validateTreeColouring, validateTreePresentation } from "../tree/model.mjs";
import { filterLinks, getGroupScaleValues } from "../links/groups.mjs";
import {
  anchorGeneGroup,
  getClusterOffset,
  getClusterPosition,
  getCommittedLocusOffset,
  formatLocusText,
  getClusterOrder,
  getGeneState,
  getLocusOffset,
  getLocusState,
  initializeLocusOffsets,
  synchronizeLocusState,
  setClusterOffset,
  setLocusOffset,
} from "./state.mjs";
import {
  getLocusScaleValues,
  xDistance,
} from "../loci/layout.mjs";
import {
  buildScene,
  patchScene,
  patchAnnotationScene,
} from "../scene/layout.mjs";
import { isRendererMode } from "../renderers/mode.mjs";
import { figureConfig } from "../ui/theme.mjs";

// This is deliberately one factory per chart, not a collection of tiny API
// factories: configuration, scales, indexes, and mutable scene state must not
// leak between independently mounted maps.
export function createChartRuntime({ idPrefix = "", measureText = null } = {}) {
function refreshClusterOffsetScale() {
  scales.offset.range(
    scales.offset.domain().map((uid) => getClusterOffset(chartState, uid))
  );
}

function refreshLocusOffsetScale() {
  scales.locus.range(
    scales.locus.domain().map((uid) => getLocusOffset(chartState, uid))
  );
}

function locusLayout() {
  return {
    scaleX: scales.x,
    clusterOffset: scales.offset,
    locusOffset: scales.locus,
    locusState,
    spacing: config.locus.spacing,
  };
}

function synchronizeLocusLayoutState(locus, { refresh = true } = {}) {
  const { oldStart } = synchronizeLocusState(
    chartState,
    locus,
    config.plot.scaleGenes
  );
  setLocusOffset(
    chartState,
    locus.uid,
    getCommittedLocusOffset(chartState, locus.uid) +
      xDistance(scales.x, locusState(locus).start, oldStart)
  );
  if (refresh) refreshLocusOffsetScale();
}

function synchronizeLocusLayoutStates(data, locusIds = null) {
  const loci = locusIds
    ? [...locusIds].map(lookup.locusData).filter(Boolean)
    : data.clusters.flatMap((cluster) => cluster.loci);
  for (const locus of loci) synchronizeLocusLayoutState(locus, { refresh: false });
  refreshLocusOffsetScale();
}

const config = createDefaultConfig();
let renderedConfig = null;
function renderConfig() {
  if (!renderedConfig) renderedConfig = figureConfig(config);
  return renderedConfig;
}
let chartIndex = null;
let chartState = null;
let currentScene = null;
let allowedLinkIds = null;

// IDs are part of the SVG surface, so they must be unique when several maps
// are mounted on the same document. Keep the logical suffix stable: it is
// useful for debugging and for data-driven selectors within a chart.
const ids = {
  root: `${idPrefix}root-svg`,
  picker: `${idPrefix}picker`,
  filter: `${idPrefix}filter_solid`,
  colourGradient: `${idPrefix}colour-gradient`,
  cluster: (d) => `${idPrefix}cluster_${d.uid}`,
  clusterInfo: (d) => `${idPrefix}cinfo_${d.uid}`,
  locus: (d) => `${idPrefix}locus_${d.uid}`,
  gene: (d) => `${idPrefix}gene_${d.uid}`,
  link: (d) => `${idPrefix}link-${d.uid}`,
};

function setChartIndex(index) {
  chartIndex = index;
}

function setChartState(state) {
  chartState = state;
}

function locusState(locus) {
  return getLocusState(chartState, locus);
}

function displayGene(gene) {
  return { ...gene, ...getGeneState(chartState, gene) };
}

const lookup = {
  geneData: (uid) => chartIndex?.geneById.get(uid),
  locusData: (uid) => chartIndex?.locusById.get(uid),
  clusterData: (uid) => chartIndex?.clusterById.get(uid),
};

function validateConfiguration(options, tree = null) {
  validateTreeColouring(options?.tree?.colouring);
  const candidate = createDefaultConfig();
  updateConfig(candidate, config);
  updateConfig(candidate, options);
  if (!["light", "dark", "auto"].includes(candidate.plot.theme)) throw new TypeError("plot.theme must be light, dark or auto.");
  if (typeof candidate.annotations?.enabled !== "boolean") {
    throw new TypeError("annotations.enabled must be a boolean.");
  }
  if (!isRendererMode(candidate.plot.renderer)) {
    throw new TypeError(`Unknown plot renderer: ${candidate.plot.renderer}. Expected svg, canvas, or webgpu.`);
  }
  validateTreePresentation(tree, candidate.tree);
  return candidate;
}

function configure(options, tree = null) {
  validateConfiguration(options, tree);
  updateConfig(config, options);
  renderedConfig = null;
}

const scales = {
  x: scaleLinear().domain([1, 1001]).range([0, config.plot.scaleFactor]),
  y: scaleOrdinal(),
  group: scaleOrdinal().unknown(null),
  colour: scaleOrdinal().unknown("#bbb"),
  name: scaleOrdinal().unknown("None"),
  score: scaleSequential(interpolateGreys).domain([0, 1]),
  offset: scaleOrdinal(),
  locus: scaleOrdinal(),
};

function updateIdentityScale(data) {
  const identities = data.links
    .map((link) => Number(link.identity))
    .filter(Number.isFinite);
  const dataMin = identities.length ? d3min(identities) : 0;
  const dataMax = identities.length ? d3max(identities) : 1;
  const domain = config.colourBar.domain;
  let min = domain.minMode === "data" ? dataMin : Number(domain.min);
  let max = domain.maxMode === "data" ? dataMax : Number(domain.max);
  min = Number.isFinite(min) ? Math.max(0, Math.min(1, min)) : 0;
  max = Number.isFinite(max) ? Math.max(0, Math.min(1, max)) : 1;
  if (min === max) {
    min = Math.max(0, min - 0.005);
    max = Math.min(1, max + 0.005);
  }
  if (min > max) [min, max] = [max, min];
  scales.score.domain([min, max]).clamp(true);
}

// Every scene variant must project the same biological state with the same
// scales and visual policy. Keep that dependency bundle in one place so a
// configuration addition cannot silently affect full builds but not retained
// flip/anchor patches (or vice versa).
function locusText(cluster) {
  return formatLocusText(cluster.loci, chartState, config.cluster.hideLocusCoordinates);
}

function locusTextForCluster(uid) {
  const cluster = lookup.clusterData(uid);
  return cluster ? locusText(cluster) : "";
}

function sceneProjectionOptions({ clusterOrder = null, tree = null } = {}) {
  const config = renderConfig();
  return {
    scaleX: scales.x,
    locusOffset: scales.locus,
    getLocusState: locusState,
    getGeneState: (gene) => getGeneState(chartState, gene),
    clusterOrder,
    clusterSpacing: config.cluster.spacing,
    shape: config.gene.shape,
    label: config.gene.label,
    link: {
      threshold: config.link.threshold,
      labelPosition: config.link.label.position,
    },
    linkVisible: (link) => !allowedLinkIds || allowedLinkIds.has(link.uid),
    clusterLabel: locusText,
    alignLabels: config.cluster.alignLabels,
    trimIndicatorStyle: config.locus.trimIndicators,
    fontFamily: config.plot.fontFamily,
    measureText,
    annotationsEnabled: config.annotations.enabled,
    tree,
    theme: config.figureStyle,
  };
}

function sceneChromeOptions(data) {
  const config = renderConfig();
  const textStyle = { textColour: config.figureStyle.foreground, fontFamily: config.plot.fontFamily };
  return {
    legend: {
      ...config.legend, ...textStyle,
      subtitleColour: config.figureStyle.muted,
      placement: config.legend.position,
      groups: data.groups,
      groupForGene: scales.group,
      colourForGroup: scales.colour,
    },
    scaleBar: {
      ...config.scaleBar, ...textStyle,
      show: config.plot.scaleGenes && config.scaleBar.show,
      x: 0,
      coordinateFor: scales.x,
      strokeWidth: config.scaleBar.stroke,
    },
    colourBar: {
      ...config.colourBar, ...textStyle,
      x: config.plot.scaleGenes ? scales.x(config.scaleBar.basePair) + 20 : 0,
      scoreColour: scales.score,
      domain: scales.score.domain(),
    },
    link: {
      show: config.link.show,
      groupColour: config.link.groupColour,
    },
  };
}

function clusterOrderForData(data) {
  const ids = new Set(data.clusters.map((cluster) => cluster.uid));
  return getClusterOrder(chartState).filter((uid) => ids.has(uid));
}

function buildChartScene(data) {
  // Resolve link policy once for all renderers and their previews.
  allowedLinkIds = new Set(filterLinks(data.links, {
    groupForGene: scales.group,
    geneForUid: lookup.geneData,
    bestOnly: config.link.bestOnly,
    threshold: config.link.threshold,
  }).map((link) => link.uid));
  const clusterOrder = clusterOrderForData(data);
  currentScene = buildScene(data, {
    ...sceneProjectionOptions({
      tree: data.tree,
      clusterOrder,
    }),
    scaleY: scales.y,
    clusterPosition: (uid) => getClusterPosition(chartState, uid, scales.y(uid)),
    clusterOffset: scales.offset,
    chrome: sceneChromeOptions(data),
  });
  return currentScene;
}

function patchChartScene(previousScene, changes = {}, data) {
  const loci = new Set(changes.loci || []);
  const clusters = new Set(changes.clusters || []);
  // Packing, tree rotations and state changes can affect neighbours beyond
  // the explicit edit. Compare only the cheap locus/cluster state here, never
  // re-project all genes or repeat biological link filtering.
  for (const [uid, cluster] of previousScene.clusters) {
    if (cluster.x !== scales.offset(uid) || cluster.y !== getClusterPosition(chartState, uid, scales.y(uid))) {
      clusters.add(uid);
    }
  }
  for (const [uid, locus] of previousScene.loci) {
    const state = locusState(locus.source);
    if (locus.localX !== scales.locus(uid) ||
        state.start !== locus.state.start || state.end !== locus.state.end ||
        state.flipped !== locus.state.flipped) loci.add(uid);
  }
  currentScene = patchScene(previousScene, { loci, clusters }, {
    ...sceneProjectionOptions({
      tree: data.tree,
      clusterOrder: clusterOrderForData(data),
    }),
    clusterOffset: scales.offset,
    clusterPosition: (uid) => getClusterPosition(chartState, uid, scales.y(uid)),
    chrome: sceneChromeOptions(data),
  });
  return currentScene;
}

function updateScene(data, { sourceScene = null, changes = {}, synchronize = true } = {}) {
  if (sourceScene && changes.annotationsOnly) {
    currentScene = patchAnnotationScene(sourceScene, data.annotationPanels, sceneProjectionOptions({ tree: data.tree }));
    return currentScene;
  }
  updateScales(data, { geometryOnly: Boolean(sourceScene) });
  if (synchronize) synchronizeLocusLayoutStates(data, sourceScene ? changes.loci || [] : null);
  if (!sourceScene) updateGroups(data.groups);
  return sourceScene ? patchChartScene(sourceScene, changes, data) : buildChartScene(data);
}

function getScene() {
  return currentScene;
}

function anchorGene(anchor, { flipMismatchedLoci = false } = {}) {
  const genes = scales.group
    .domain()
    .filter((uid) => scales.group(uid) === scales.group(anchor.uid))
    .map(lookup.geneData);

  const flippedLoci = new Set();
  const changes = anchorGeneGroup(chartState, {
    anchor,
    genes,
    locusForGene: (gene) => lookup.locusData(gene.locusUid),
    coordinateForGene: (gene) => {
      const display = displayGene(gene);
      return (
        scales.x(display.start + (display.end - display.start) / 2) +
        scales.locus(gene.locusUid) +
        scales.offset(gene.clusterUid)
      );
    },
    flipMismatchedLoci,
    onLocusFlipped: (locus) => {
      synchronizeLocusLayoutState(locus);
      flippedLoci.add(locus.uid);
    },
  });

  refreshClusterOffsetScale();
  return { changes, flippedLoci };
}

function updateGroups(groups) {
  const { domain, range } = getGroupScaleValues(groups);
  const uids = groups.map((group) => group.uid);
  scales.group.domain(domain).range(range);
  scales.name.domain(uids).range(groups.map((group) => group.label));
  const colours = quantize(interpolateRainbow, groups.length + 1);
  groups.forEach((group, index) => {
    if (group.colour) colours[index] = group.colour;
    else group.colour = colours[index];
  });
  scales.colour.domain(uids).range(colours);
}

function rescaleRanges(oldX) {
  for (const [uid, offset] of chartState.clusterOffsets) {
    setClusterOffset(chartState, uid, scales.x(oldX.invert(offset)));
  }
  for (const [uid, offset] of chartState.locusOffsets) {
    setLocusOffset(chartState, uid, scales.x(oldX.invert(offset)));
  }
  refreshClusterOffsetScale();
  refreshLocusOffsetScale();
}

function updateScales(data, { geometryOnly = false } = {}) {
  const oldX = scales.x.copy();
  scales.x.range([0, config.plot.scaleFactor]);
  // Reproject dependent ranges only when the x-scale range actually changes.
  // Repeating invert()/scale() on every redraw accumulates small
  // floating-point errors, causing static link paths to drift after flips.
  if (oldX.range().some((value, index) => value !== scales.x.range()[index])) {
    rescaleRanges(oldX);
  }

  scales.y.domain(clusterOrderForData(data));
  const body = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight;
  scales.y.range(data.clusters.map((cluster, index) => index * (config.cluster.spacing + body)));

  if (!geometryOnly) updateIdentityScale(data);

  scales.offset.domain(data.clusters.map((cluster) => cluster.uid));
  refreshClusterOffsetScale();
  const { domain, range } = getLocusScaleValues(data.clusters, {
    ...locusLayout(),
    locusOffset: () => 0,
  });
  // A producer such as clinker may supply an initial alignment as a locus
  // offset in sequence-coordinate units. Convert it through the active x
  // scale here, rather than making callers depend on plot.scaleFactor. An
  // existing chart/project state still wins, so data refreshes never undo a
  // user drag or restored project layout.
  const suppliedOffsets = new Map(
    data.clusters.flatMap((cluster) => cluster.loci)
      .filter((locus) => Number.isFinite(locus.offset))
      .map((locus) => [locus.uid, xDistance(scales.x, 0, locus.offset)])
  );
  initializeLocusOffsets(chartState, domain.map((uid, index) => [
    uid,
    suppliedOffsets.get(uid) ?? range[index],
  ]));
  scales.locus.domain(domain);
  refreshLocusOffsetScale();
}

return {
  config,
  get renderConfig() { return renderConfig(); },
  configure,
  validateConfiguration,
  lookup,
  ids,
  locusTextForCluster,
  synchronizeLocusLayoutState,
  setChartIndex,
  setChartState,
  scales,
  updateScales,
  getScene,
  patchScene: patchChartScene,
  updateScene,
  anchorGene,
};
}
