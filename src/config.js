const defaultConfig = {
  plot: {
    transitionDuration: 250,
    renderer: "svg",
    minZoom: 0,
    maxZoom: 8,
    minimap: {
      show: false,
      width: 220,
      height: 160,
      margin: 12,
      showLinks: false,
    },
    scaleFactor: 15,
    scaleGenes: true,
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Oxygen, Cantarell, sans-serif',
  },
  legend: {
    columns: 1,
    columnWidth: 160,
    entryHeight: 18,
    fontSize: 14,
    subtitleFontSize: 10,
    onClickCircle: null,
    onClickText: null,
    // "right" keeps the historical layout. "bottom" places the legend
    // below the chart's content bounds, aligned with its left edge.
    position: "right",
    show: true,
    marginLeft: 20,
    marginTop: 20,
  },
  colourBar: {
    fontSize: 10,
    height: 12,
    show: true,
    width: 150,
    marginTop: 20,
    // Bounds describe the colour mapping only; link.threshold remains the
    // separate visibility filter. "data" resolves against all link records.
    domain: {
      min: 0,
      max: 1,
      minMode: "fixed",
      maxMode: "fixed",
    },
  },
  scaleBar: {
    colour: "black",
    fontSize: 10,
    height: 12,
    basePair: 2500,
    show: true,
    stroke: 1,
    marginTop: 20,
  },
  link: {
    show: true,
    asLine: false,
    straight: false,
    threshold: 0,
    strokeWidth: 0.5,
    groupColour: false,
    bestOnly: false,
    label: {
      show: false,
      fontSize: 10,
      background: true,
      position: 0.5,
    },
  },
  cluster: {
    nameFontSize: 12,
    lociFontSize: 10,
    hideLocusCoordinates: false,
    spacing: 40,
    alignLabels: true,
  },
  locus: {
    trackBar: {
      colour: "#111",
      stroke: 1,
    },
    spacing: 50,
  },
  gene: {
    shape: {
      bodyHeight: 12,
      tipHeight: 5,
      tipLength: 12,
      onClick: null,
      stroke: "black",
      strokeWidth: 1,
    },
    label: {
      anchor: "start",
      fontSize: 10,
      rotation: 25,
      position: "top",
      spacing: 2,
      show: false,
      start: 0.5,
      name: "uid",
    },
  },
};

function cloneConfig(value) {
  if (Array.isArray(value)) return value.map(cloneConfig);
  if (value && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneConfig(child)]));
  }
  // Functions and primitive values are immutable configuration leaves.
  return value;
}

/** Return independent, recursively cloned defaults for one chart instance. */
export function createDefaultConfig() {
  return cloneConfig(defaultConfig);
}

export default defaultConfig;
