import * as d3 from "d3";
import { updateConfig } from "./utils.js";
import { createDefaultConfig } from "./config.js";
import { getGroupScaleValues } from "./links/groups.mjs";
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
} from "./chartState.mjs";
import {
  getLocusScaleValues,
  xDistance,
} from "./loci/layout.mjs";
import {
  buildScene,
  patchAnchoredGeneScene,
  patchFlippedLocusScene,
} from "./layout.mjs";
import { isRendererMode } from "./rendererMode.mjs";

// This is deliberately one factory per chart, not a collection of tiny API
// factories: configuration, scales, indexes, and mutable scene state must not
// leak between independently mounted maps.
export function createChartRuntime({ idPrefix = "" } = {}) {
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

function synchronizeLocusLayoutState(locus) {
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
  refreshLocusOffsetScale();
}

function synchronizeLocusLayoutStates(data) {
  data.clusters.forEach((cluster) =>
    cluster.loci.forEach((locus) => synchronizeLocusLayoutState(locus))
  );
}

const config = createDefaultConfig();
let chartIndex = null;
let chartState = null;
let currentScene = null;
let beforeGeneAnchorUpdate = null;

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
  linksForGene: (uid) => chartIndex?.linksByGeneId.get(uid) || [],
};

function configure(options) {
  const renderer = options?.plot?.renderer;
  if (renderer !== undefined && !isRendererMode(renderer)) {
    throw new TypeError(`Unknown plot renderer: ${renderer}. Expected svg, canvas, or webgpu.`);
  }
  updateConfig(config, options);
}

const scales = {
  x: d3.scaleLinear().domain([1, 1001]).range([0, config.plot.scaleFactor]),
  y: d3.scaleOrdinal(),
  group: d3.scaleOrdinal().unknown(null),
  colour: d3.scaleOrdinal().unknown("#bbb"),
  name: d3.scaleOrdinal().unknown("None"),
  score: d3.scaleSequential(d3.interpolateGreys).domain([0, 1]),
  offset: d3.scaleOrdinal(),
  locus: d3.scaleOrdinal(),
};

function updateIdentityScale(data) {
  const identities = data.links
    .map((link) => Number(link.identity))
    .filter(Number.isFinite);
  const dataMin = identities.length ? d3.min(identities) : 0;
  const dataMax = identities.length ? d3.max(identities) : 1;
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
function clustersAreAdjacent(one, two) {
  const order = getClusterOrder(chartState);
  return Math.abs(order.indexOf(one) - order.indexOf(two)) === 1;
}

function locusText(cluster) {
  return formatLocusText(cluster.loci, chartState, config.cluster.hideLocusCoordinates);
}

function locusTextForCluster(uid) {
  const cluster = lookup.clusterData(uid);
  return cluster ? locusText(cluster) : "";
}

function sceneProjectionOptions({ areClustersAdjacent = clustersAreAdjacent } = {}) {
  return {
    scaleX: scales.x,
    locusOffset: scales.locus,
    getLocusState: locusState,
    getGeneState: (gene) => getGeneState(chartState, gene),
    areClustersAdjacent,
    shape: config.gene.shape,
    label: config.gene.label,
    link: {
      asLine: config.link.asLine,
      straight: config.link.straight,
      threshold: config.link.threshold,
      labelPosition: config.link.label.position,
    },
    clusterLabel: locusText,
    alignLabels: config.cluster.alignLabels,
  };
}

function sceneChromeOptions(data) {
  return {
    legend: {
      show: config.legend.show,
      placement: config.legend.position,
      columns: config.legend.columns,
      columnWidth: config.legend.columnWidth,
      marginLeft: config.legend.marginLeft,
      marginTop: config.legend.marginTop,
      entryHeight: config.legend.entryHeight,
      fontSize: config.legend.fontSize,
      subtitleFontSize: config.legend.subtitleFontSize,
      fontFamily: config.plot.fontFamily,
      groups: data.groups,
      groupForGene: scales.group,
      colourForGroup: scales.colour,
    },
    scaleBar: {
      show: config.plot.scaleGenes && config.scaleBar.show,
      x: 0,
      marginTop: config.scaleBar.marginTop,
      basePair: config.scaleBar.basePair,
      coordinateFor: scales.x,
      height: config.scaleBar.height,
      colour: config.scaleBar.colour,
      strokeWidth: config.scaleBar.stroke,
      fontSize: config.scaleBar.fontSize,
      fontFamily: config.plot.fontFamily,
    },
    colourBar: {
      show: config.colourBar.show,
      x: config.plot.scaleGenes ? scales.x(config.scaleBar.basePair) + 20 : 0,
      marginTop: config.colourBar.marginTop,
      width: config.colourBar.width,
      height: config.colourBar.height,
      fontSize: config.colourBar.fontSize,
      fontFamily: config.plot.fontFamily,
      scoreColour: scales.score,
      domain: scales.score.domain(),
    },
    link: {
      show: config.link.show,
      groupColour: config.link.groupColour,
    },
  };
}

function adjacencyForClusterOrder(order) {
  const index = new Map(order.map((uid, position) => [uid, position]));
  return (one, two) => Math.abs(index.get(one) - index.get(two)) === 1;
}

function buildChartScene(data) {
  // Scene construction is read-only. The controller synchronizes any
  // scale-dependent chart state before asking the runtime to project it.
  currentScene = buildScene(data, {
    ...sceneProjectionOptions(),
    scaleY: scales.y,
    clusterPosition: (uid) => getClusterPosition(chartState, uid, scales.y(uid)),
    clusterOffset: scales.offset,
    clusterOrder: getClusterOrder(chartState),
    chrome: sceneChromeOptions(data),
  });
  return currentScene;
}

function patchFlippedLocus(previousScene, locus) {
  currentScene = patchFlippedLocusScene(previousScene, locus, {
    ...sceneProjectionOptions(),
    linksForGene: lookup.linksForGene,
  });
  return currentScene;
}

function patchGeneAnchor(previousScene, changes, flippedLoci) {
  currentScene = patchAnchoredGeneScene(previousScene, { changes, flippedLoci }, {
    ...sceneProjectionOptions({
      areClustersAdjacent: adjacencyForClusterOrder(getClusterOrder(chartState)),
    }),
    linksForGene: lookup.linksForGene,
  });
  return currentScene;
}

function getScene() {
  return currentScene;
}

function setBeforeGeneAnchorUpdate(callback) {
  beforeGeneAnchorUpdate = callback;
}

function anchorGene(anchor, { flipMismatchedLoci = false, beforeUpdate } = {}) {
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
  (beforeUpdate || beforeGeneAnchorUpdate)?.({ changes, flippedLoci });
  return { changes, flippedLoci };
}

function updateGroups(groups) {
  const { domain, range } = getGroupScaleValues(groups);
  const uids = groups.map((group) => group.uid);
  scales.group.domain(domain).range(range);
  scales.name.domain(uids).range(groups.map((group) => group.label));
  const colours = d3.quantize(d3.interpolateRainbow, groups.length + 1);
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

function updateScales(data) {
  const oldX = scales.x.copy();
  scales.x.range([0, config.plot.scaleFactor]);
  // Reproject dependent ranges only when the x-scale range actually changes.
  // Repeating invert()/scale() on every redraw accumulates small
  // floating-point errors, causing static link paths to drift after flips.
  if (oldX.range().some((value, index) => value !== scales.x.range()[index])) {
    rescaleRanges(oldX);
  }

  scales.y.domain(getClusterOrder(chartState));
  const body = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight;
  scales.y.range(data.clusters.map((cluster, index) => index * (config.cluster.spacing + body)));

  updateIdentityScale(data);

  scales.offset.domain(data.clusters.map((cluster) => cluster.uid));
  refreshClusterOffsetScale();
  const { domain, range } = getLocusScaleValues(data.clusters, {
    ...locusLayout(),
    locusOffset: () => 0,
  });
  initializeLocusOffsets(chartState, domain.map((uid, index) => [uid, range[index]]));
  scales.locus.domain(domain);
  refreshLocusOffsetScale();
}

return {
  config,
  configure,
  lookup,
  ids,
  locusTextForCluster,
  synchronizeLocusLayoutState,
  synchronizeLocusLayoutStates,
  setChartIndex,
  setChartState,
  scales,
  updateScales,
  updateGroups,
  getScene,
  buildScene: buildChartScene,
  patchFlippedLocus,
  patchGeneAnchor,
  setBeforeGeneAnchorUpdate,
  anchorGene,
};
}
