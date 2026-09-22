import { renameText, updateConfig } from "./utils.js";
import defaultConfig from "./config.js";
import { getGroupScaleValues } from "./links/groups.mjs";
import {
  anchorGeneGroup,
  getClusterOffset,
  formatLocusText,
  getClusterOrder,
  getGeneState,
  getLocusOffset,
  getLocusState,
  initializeLocusOffsets,
  recalculateLocusCoordinates,
  setClusterOffset,
  setLocusOffset,
} from "./chartState.mjs";
import {
  getLocusScaleValues,
  xDistance,
} from "./loci/layout.mjs";
import { buildScene } from "./layout.mjs";

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

function updateLocusScaling(locus) {
  const { oldStart } = recalculateLocusCoordinates(
    chartState,
    locus,
    config.plot.scaleGenes
  );
  setLocusOffset(
    chartState,
    locus.uid,
    getLocusOffset(chartState, locus.uid) +
      xDistance(scales.x, locusState(locus).start, oldStart)
  );
  refreshLocusOffsetScale();
}

const config = Object.assign({}, defaultConfig);
let chartIndex = null;
let chartState = null;
let scene = null;

// IDs are part of the SVG surface, so they must be unique when several maps
// are mounted on the same document. Keep the logical suffix stable: it is
// useful for debugging and for data-driven selectors within a chart.
const ids = {
  root: `${idPrefix}root-svg`,
  picker: `${idPrefix}picker`,
  filter: `${idPrefix}filter_solid`,
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

const _layout = {
  update: (data) => {
    // Normalise scale-dependent locus state before deriving immutable scene
    // geometry. Rendering must not be responsible for this state work.
    data.clusters.forEach((cluster) =>
      cluster.loci.forEach((locus) => updateLocusScaling(locus))
    );
    scene = buildScene(data, {
      scaleX: scales.x,
      scaleY: scales.y,
      clusterOffset: scales.offset,
      locusOffset: scales.locus,
      getLocusState: locusState,
      getGeneState: (gene) => getGeneState(chartState, gene),
      areClustersAdjacent: _cluster.adjacent,
      shape: config.gene.shape,
      label: config.gene.label,
      link: {
        asLine: config.link.asLine,
        straight: config.link.straight,
        threshold: config.link.threshold,
        labelPosition: config.link.label.position,
      },
      clusterLabel: _cluster.locusText,
      alignLabels: config.cluster.alignLabels,
      chrome: {
        legendMarginLeft: config.legend.marginLeft,
        scaleBarX: 0,
        scaleBarMarginTop: config.scaleBar.marginTop,
        colourBarX: config.plot.scaleGenes
          ? scales.x(config.scaleBar.basePair) + 20
          : 0,
        colourBarMarginTop: config.colourBar.marginTop,
      },
    });
    return scene;
  },
  get: () => scene,
};

const _gene = {
  getId: ids.gene,
  anchor: (_, anchor, flipLoci = false) => {
    const genes = scales.group
      .domain()
      .filter((uid) => {
        return scales.group(uid) === scales.group(anchor.uid);
      })
      .map(get.geneData);

    anchorGeneGroup(chartState, {
      anchor,
      genes,
      locusForGene: (gene) => get.locusData(gene._locus),
      coordinateForGene: (gene) => {
        const display = displayGene(gene);
        return (
          scales.x(display.start + (display.end - display.start) / 2) +
          scales.locus(gene._locus) +
          scales.offset(gene._cluster)
        );
      },
      flipMismatchedLoci: flipLoci,
      onLocusFlipped: updateLocusScaling,
    });

    refreshClusterOffsetScale();
    plot.update();
  },
};

const _cluster = {
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

const _link = {
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

const _locus = {
  getId: ids.locus,
};

const _scale = {
  check: (s) => _scale.checkDomain(s) && _scale.checkRange(s),
  checkDomain: (s) => scales[s].domain().length > 0,
  checkRange: (s) => scales[s].range().length > 0,
  updateX: () => {
    scales.x.range([0, config.plot.scaleFactor]);
  },
  updateY: (data) => {
    let body = config.gene.shape.tipHeight * 2 + config.gene.shape.bodyHeight;
    let rng = data.clusters.map((_, i) => {
      return i * (config.cluster.spacing + body);
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
    _scale.updateX();
    // Reproject dependent ranges only when the x-scale range actually
    // changes. Repeating invert()/scale() on every redraw accumulates small
    // floating-point errors, causing static link paths to drift after flips.
    let xRangeChanged = oldX
      .range()
      .some((value, index) => value !== scales.x.range()[index]);
    if (xRangeChanged) _scale.rescaleRanges(oldX);

    scales.y.domain(getClusterOrder(chartState));
    _scale.updateY(data);

    _scale.updateOffset(data.clusters);
    _scale.updateLocus(data.clusters);
  },
};

config.gene.shape.onClick = _gene.anchor;
config.legend.onClickText = _link.rename;

return {
  config,
  get,
  ids,
  setChartIndex,
  setChartState,
  plot,
  scales,
  cluster: _cluster,
  gene: _gene,
  link: _link,
  locus: _locus,
  scale: _scale,
  layout: _layout,
};
}
