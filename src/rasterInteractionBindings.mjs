// Raster hit testing returns stable scene IDs, while SVG joins already carry
// source records. Adapt IDs at this boundary so controller actions themselves
// retain one record-based contract across renderers.
export function createRasterInteractionBindings({
  interactions,
  getGene,
  getLocus,
  config,
}) {
  return {
    interactions: {
      beginClusterDrag: interactions.beginClusterDrag,
      moveClusterDrag: interactions.moveClusterDrag,
      endClusterDrag: interactions.endClusterDrag,
      cancelClusterDrag: interactions.cancelClusterDrag,
      beginLocusDrag: interactions.beginLocusDrag,
      moveLocusDrag: interactions.moveLocusDrag,
      endLocusDrag: interactions.endLocusDrag,
      cancelLocusDrag: interactions.cancelLocusDrag,
      beginLocusTrim: interactions.beginLocusTrim,
      moveLocusTrim: (locusUid, edge, x) =>
        interactions.moveLocusTrim(getLocus(locusUid), edge, x),
      endLocusTrim: (locusUid) => interactions.endLocusTrim(getLocus(locusUid)),
      cancelLocusTrim: interactions.cancelLocusTrim,
    },
    actions: {
      geneClick: (event, geneUid) => interactions.onGeneClick?.(event, getGene(geneUid)),
      legendColour: (event, group) => {
        if (config.legend.onClickCircle) config.legend.onClickCircle(event, group);
        else interactions.chooseLegendColour(group);
      },
      legendText: (event, group) => config.legend.onClickText?.(event, group),
      scaleBar: interactions.setScaleBarLength,
      flipLocus: (locusUid) => interactions.flipLocus(getLocus(locusUid)),
      geneMenu: (event, geneUid) => interactions.showGeneMenu(event, getGene(geneUid)),
      legendMenu: (event, group) => {
        const handler = config.legend.onAltClickText || interactions.showGroupMenu;
        handler(event, group);
      },
    },
  };
}
