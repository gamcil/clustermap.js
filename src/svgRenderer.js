import legend from "./legend.js";
import colourBar from "./colourBar.js";
import scaleBar from "./scaleBar.js";
import { renameText } from "./utils.js";
import { filterLinks } from "./links/groups.mjs";

// Owns the D3 joins for chart-world SVG. The chart controller owns the SVG
// host, camera viewport, and interaction state that causes a redraw.
export function renderSvg({
  plot,
  data,
  api,
  transition,
  flipLocus,
  animate,
}) {
  const linkGroup = plot
    .selectAll("g.links")
    .data([data])
    .join("g")
    .attr("class", "links");
  const clusterGroup = plot
    .selectAll("g.clusters")
    .data([data.clusters])
    .join("g")
    .attr("class", "clusters");

  const clusters = clusterGroup
    .selectAll("g.cluster")
    .data(data.clusters, (d) => d.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", api.cluster.getId)
          .attr("class", "cluster");
        const info = enter
          .append("g")
          .attr("id", (cluster) => `cinfo_${cluster.uid}`)
          .attr("class", "clusterInfo")
          .attr("transform", "translate(-10, 0)")
          .call(api.cluster.drag);

        info
          .append("text")
          .text((cluster) => cluster.name)
          .attr("class", "clusterText")
          .attr("y", 8)
          .attr("cursor", "pointer")
          .style("font-weight", "bold")
          .style("font-size", `${api.config.cluster.nameFontSize}px`)
          .style("font-family", api.config.plot.fontFamily)
          .on("click", renameText);
        info
          .append("text")
          .attr("class", "locusText")
          .attr("y", 12)
          .attr("dominant-baseline", "hanging")
          .style("text-rendering", "geometricPrecision")
          .style("font-size", `${api.config.cluster.lociFontSize}px`)
          .style("font-family", api.config.plot.fontFamily);
        info.selectAll("text").attr("text-anchor", "end");
        enter.append("g").attr("class", "loci");
        return enter.call(api.cluster.update);
      },
      (update) =>
        update.call((selection) =>
          selection.transition(transition).call(api.cluster.update)
        )
    );

  api.layout.update(data);

  const loci = clusters
    .selectAll("g.loci")
    .selectAll("g.locus")
    .data((cluster) => cluster.loci, (locus) => locus.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", api.locus.getId)
          .attr("class", "locus");
        enter.append("line").attr("class", "trackBar").style("fill", "#111");
        const hover = enter
          .append("g")
          .attr("class", "hover hidden")
          .attr("opacity", 0);
        // Hover must remain below genes: a handle drag may finish over a gene,
        // and the overlay must not intercept that pointer-up event.
        enter.append("g").attr("class", "genes");
        hover
          .append("rect")
          .attr("class", "hover")
          .attr("fill", "rgba(0, 0, 0, 0.4)")
          .call(api.locus.dragPosition);
        hover
          .append("rect")
          .attr("class", "leftHandle")
          .attr("x", -8)
          .call(api.locus.dragResize);
        hover
          .append("rect")
          .attr("class", "rightHandle")
          .call(api.locus.dragResize);
        hover
          .selectAll(".leftHandle, .rightHandle")
          .attr("width", 8)
          .attr("cursor", "pointer");
        enter
          .on("mouseenter", (event) => {
            if (!api.flags.isDragging) {
              d3.select(event.target).select("g.hover").transition().attr("opacity", 1);
            }
          })
          .on("mouseleave", (event) => {
            if (!api.flags.isDragging) {
              d3.select(event.target).select("g.hover").transition().attr("opacity", 0);
            }
          })
          .on("dblclick", (_, locus) => flipLocus(locus));
        return enter.call(api.locus.update);
      },
      (update) =>
        update.call((selection) =>
          selection.transition(transition).call(api.locus.update)
        )
    );

  loci
    .selectAll("g.genes")
    .selectAll("g.gene")
    .data((locus) => locus.genes, (gene) => gene.uid)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", api.gene.getId)
          .attr("class", "gene")
          .attr("display", "inline");
        enter
          .append("polygon")
          .on("click", api.config.gene.shape.onClick)
          .on("contextmenu", api.gene.contextMenu)
          .attr("class", "genePolygon");
        enter
          .append("text")
          .attr("class", "geneLabel")
          .attr("dy", "-0.3em")
          .style("font-family", api.config.plot.fontFamily);
        return enter.call(api.gene.update);
      },
      (update) =>
        update.call((selection) =>
          selection.transition(transition).call(api.gene.update)
        )
    );

  const visibleLinks = filterLinks(data.links, {
    groupForGene: api.scales.group,
    geneForUid: api.get.geneData,
    bestOnly: api.config.link.bestOnly,
    threshold: api.config.link.threshold,
  });
  linkGroup
    .selectAll("g.geneLinkG")
    .data(visibleLinks, api.link.getId)
    .join(
      (enter) => {
        enter = enter
          .append("g")
          .attr("id", api.link.getId)
          .attr("class", "geneLinkG");
        enter.append("path").attr("class", "geneLink");
        enter
          .append("text")
          .text((link) => link.identity.toFixed(2))
          .attr("class", "geneLinkLabel")
          .style("fill", "white")
          .style("text-anchor", "middle")
          .style("font-family", api.config.plot.fontFamily);
        return enter.call(api.link.update, true);
      },
      (update) =>
        update.call((selection) =>
          selection
            .classed("hidden", !api.config.link.show)
            .transition(transition)
            .call(api.link.update, true)
        ),
      (exit) =>
        exit.call((selection) => selection.transition(transition).attr("opacity", 0).remove())
    );

  plot
    .call(getLegend(api))
    .call(getColourBar(api, transition))
    .call(getScaleBar(api, transition));
  arrangePlot(plot, api, transition, animate);
}

function arrangePlot(plot, api, transition, animate) {
  let scale = plot
    .select("g.scaleBar")
    .classed("hidden", !api.config.plot.scaleGenes);
  if (animate) scale = scale.transition(transition);
  scale
    .attr("opacity", api.config.plot.scaleGenes ? 1 : 0)
    .attr("transform", api.plot.scaleBarTransform);

  const showColour = api.config.link.groupColour || !api.config.link.show;
  let colour = plot.select("g.colourBar").classed("hidden", showColour);
  if (animate) colour = colour.transition(transition);
  colour
    .attr("opacity", showColour ? 0 : 1)
    .attr("transform", api.plot.colourBarTransform);

  let key = plot.select("g.legend");
  if (animate) key = key.transition(transition);
  key.attr("transform", api.plot.legendTransform);
}

function getScaleBar(api, transition) {
  return scaleBar(api.scales.x)
    .stroke(api.config.scaleBar.stroke)
    .height(api.config.scaleBar.height)
    .colour(api.config.scaleBar.colour)
    .basePair(api.config.scaleBar.basePair)
    .fontSize(api.config.scaleBar.fontSize)
    .onClickText(() => {
      const value = prompt("Enter new length (bp):", api.config.scaleBar.basePair);
      if (value) {
        api.config.scaleBar.basePair = value;
        api.plot.update();
      }
    })
    .transition(transition);
}

function getColourBar(api, transition) {
  return colourBar(api.scales.score)
    .width(api.config.colourBar.width)
    .height(api.config.colourBar.height)
    .fontSize(api.config.colourBar.fontSize)
    .transition(transition);
}

function getLegend(api) {
  const genes = d3.selectAll("g.gene");
  let hidden = genes.empty() ? [] : api.scales.colour.domain();
  genes.each(function (gene) {
    if (d3.select(this).attr("display") === "inline") {
      const group = api.scales.group(gene.uid);
      if (group !== null) hidden = hidden.filter((id) => id !== group);
    }
  });

  return legend(api.scales.colour)
    .hidden(hidden)
    .fontSize(api.config.legend.fontSize)
    .entryHeight(api.config.legend.entryHeight)
    .onClickCircle(
      api.config.legend.onClickCircle ||
        ((_, data) => {
          const picker = d3.select("input.colourPicker");
          picker.on("change", () => {
            data.colour = picker.node().value;
            api.plot.update();
          });
          picker.node().click();
        })
    )
    .onClickText(api.config.legend.onClickText)
    .onAltClickText(api.config.legend.onAltClickText);
}
