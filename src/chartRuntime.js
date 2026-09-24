import { renameText, updateConfig } from "./utils.js";
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
import { buildScene, patchFlippedLocusScene } from "./layout.mjs";

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

const get = {
  geneData: (uid) => chartIndex?.geneById.get(uid),
  locusData: (uid) => chartIndex?.locusById.get(uid),
  clusterData: (uid) => chartIndex?.clusterById.get(uid),
  linksForGene: (uid) => chartIndex?.linksByGeneId.get(uid) || [],
};

const plot = {
  updateConfig: function (target) {
    updateConfig(config, target);
  },
  update: null,
  data: null,
};

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

const scene = {
  build: (data) => {
    // Scene construction is read-only. The controller synchronizes any
    // scale-dependent chart state before asking the runtime to project it.
    currentScene = buildScene(data, {
      scaleX: scales.x,
      scaleY: scales.y,
      clusterPosition: (uid) => getClusterPosition(chartState, uid, scales.y(uid)),
      clusterOffset: scales.offset,
      locusOffset: scales.locus,
      getLocusState: locusState,
      getGeneState: (gene) => getGeneState(chartState, gene),
      areClustersAdjacent: cluster.adjacent,
      shape: config.gene.shape,
      label: config.gene.label,
      link: {
        asLine: config.link.asLine,
        straight: config.link.straight,
        threshold: config.link.threshold,
        labelPosition: config.link.label.position,
      },
      clusterLabel: cluster.locusText,
      alignLabels: config.cluster.alignLabels,
      chrome: {
        legend: {
          show: config.legend.show,
          marginLeft: config.legend.marginLeft,
          entryHeight: config.legend.entryHeight,
          fontSize: config.legend.fontSize,
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
        },
        link: {
          show: config.link.show,
          groupColour: config.link.groupColour,
        },
      },
    });
    return currentScene;
  },
  patchFlippedLocus: (previousScene, locus) => {
    currentScene = patchFlippedLocusScene(previousScene, locus, {
      scaleX: scales.x,
      locusOffset: scales.locus,
      getLocusState: locusState,
      getGeneState: (gene) => getGeneState(chartState, gene),
      areClustersAdjacent: cluster.adjacent,
      shape: config.gene.shape,
      label: config.gene.label,
      link: {
        asLine: config.link.asLine,
        straight: config.link.straight,
        threshold: config.link.threshold,
        labelPosition: config.link.label.position,
      },
      clusterLabel: cluster.locusText,
      alignLabels: config.cluster.alignLabels,
      linksForGene: get.linksForGene,
    });
    return currentScene;
  },
  get: () => currentScene,
};

const gene = {
  getId: ids.gene,
  setBeforeAnchorUpdate: (callback) => {
    beforeGeneAnchorUpdate = callback;
  },
  anchor: (_, anchor, flipLoci = false, { beforeUpdate } = {}) => {
    const genes = scales.group
      .domain()
      .filter((uid) => {
        return scales.group(uid) === scales.group(anchor.uid);
      })
      .map(get.geneData);

    const flippedLoci = new Set();
    const changes = anchorGeneGroup(chartState, {
      anchor,
      genes,
      locusForGene: (gene) => get.locusData(gene.locusUid),
      coordinateForGene: (gene) => {
        const display = displayGene(gene);
        return (
          scales.x(display.start + (display.end - display.start) / 2) +
          scales.locus(gene.locusUid) +
          scales.offset(gene.clusterUid)
        );
      },
      flipMismatchedLoci: flipLoci,
      onLocusFlipped: (locus) => {
        synchronizeLocusLayoutState(locus);
        flippedLoci.add(locus.uid);
      },
    });

    refreshClusterOffsetScale();
    (beforeUpdate || beforeGeneAnchorUpdate)?.({ changes, flippedLoci });
    plot.update();
    return { changes, flippedLoci };
  },
};

const cluster = {
  getId: ids.cluster,
  /**
   * Generates locus coordinates displayed next underneath a cluster name.
   * If a locus is flipped, (reversed) will be added to its name.
   * @param {Object} cluster - Cluster data object
   * @returns {String} Comma-separated locus coordinates
   */
  locusText: (cluster) =>
    formatLocusText(cluster.loci, chartState, config.cluster.hideLocusCoordinates),
  /**
   * Tests if two clusters are vertically adjacent.
   * @param {String} one - First cluster UID
   * @param {String} two - Second cluster UID
   * @return {bool} - Clusters are adjacent
   */
  adjacent: (one, two) => {
    const domain = getClusterOrder(chartState);
    return Math.abs(domain.indexOf(one) - domain.indexOf(two)) === 1;
  },
};

const link = {
  getId: ids.link,
  /**
   * Update group scales given new data.
   */
  updateGroups: (groups) => {
    let { domain, range } = getGroupScaleValues(groups);
    let uids = groups.map((g) => g.uid);
    scales.group.domain(domain).range(range);
    scales.name.domain(uids).range(groups.map((g) => g.label));
    let colours = d3.quantize(d3.interpolateRainbow, groups.length + 1);
    groups.forEach((group, index) => {
      if (group.colour) colours[index] = group.colour;
      else group.colour = colours[index];
    });
    scales.colour.domain(uids).range(colours);
  },
  hide: (event, datum) => {
    event.preventDefault();
    datum.hidden = true;
    plot.update();
  },
  rename: (event, datum) => {
    if (event.defaultPrevented) return;
    let text = d3.select(event.target);
    let result = prompt("Enter new value:", text.text());
    if (result) {
      datum.label = result;
      text.text(result);
      plot.update();
    }
  },
};

const locus = {
  getId: ids.locus,
};

const scale = {
  check: (s) => scale.checkDomain(s) && scale.checkRange(s),
  checkDomain: (s) => scales[s].domain().length > 0,
  checkRange: (s) => scales[s].range().length > 0,
  updateX: () => {
    scales.x.range([0, config.plot.scaleFactor]);
  },
  updateY: (data) => {
    let body = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight;
    let rng = data.clusters.map((cluster, index) => {
      return index * (config.cluster.spacing + body);
    });
    scales.y.range(rng);
  },
  updateOffset: (clusters) => {
    scales.offset.domain(clusters.map((d) => d.uid));
    refreshClusterOffsetScale();
  },
  updateLocus: (clusters) => {
    let { domain, range } = getLocusScaleValues(clusters, {
      ...locusLayout(),
      locusOffset: () => 0,
    });
    initializeLocusOffsets(
      chartState,
      domain.map((uid, index) => [uid, range[index]])
    );
    scales.locus.domain(domain);
    refreshLocusOffsetScale();
  },
  /**
   * Rescales offset and locus scales with an updated x scale.
   * @param {d3.scale} old - The old x scale
   */
  rescaleRanges: (old) => {
    for (const [uid, offset] of chartState.clusterOffsets) {
      setClusterOffset(chartState, uid, scales.x(old.invert(offset)));
    }
    for (const [uid, offset] of chartState.locusOffsets) {
      setLocusOffset(chartState, uid, scales.x(old.invert(offset)));
    }
    refreshClusterOffsetScale();
    refreshLocusOffsetScale();
  },
  /**
   * Updates all scales based on new data.
   * @param {Object} data - New data object
   */
  update: (data) => {
    let oldX = scales.x.copy();
    scale.updateX();
    // Reproject dependent ranges only when the x-scale range actually
    // changes. Repeating invert()/scale() on every redraw accumulates small
    // floating-point errors, causing static link paths to drift after flips.
    let xRangeChanged = oldX
      .range()
      .some((value, index) => value !== scales.x.range()[index]);
    if (xRangeChanged) scale.rescaleRanges(oldX);

    scales.y.domain(getClusterOrder(chartState));
    scale.updateY(data);

    scale.updateOffset(data.clusters);
    scale.updateLocus(data.clusters);
  },
};

config.gene.shape.onClick = gene.anchor;
config.legend.onClickText = link.rename;

return {
  config,
  get,
  ids,
  synchronizeLocusLayoutState,
  synchronizeLocusLayoutStates,
  setChartIndex,
  setChartState,
  plot,
  scales,
  cluster,
  gene,
  link,
  locus,
  scale,
  scene,
};
}
