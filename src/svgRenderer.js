import legend from "./legend.js";
import colourBar from "./colourBar.js";
import scaleBar from "./scaleBar.js";
import { renameText, rgbaToRgb } from "./utils.js";
import { filterLinks } from "./links/groups.mjs";

// Owns the D3 joins for chart-world SVG. The chart controller owns the SVG
// host, camera viewport, and interaction state that causes a redraw.
export function renderSvg({
  plot,
  data,
  api,
  transition,
  createScene,
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

  // Cluster updates may normalize locus offsets, so derive the immutable scene
  // only after the cluster join has applied that state.
  const scene = createScene(data);

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
        return updateGenes(enter, scene, api);
      },
      (update) =>
        update.call((selection) =>
          updateGenes(selection.transition(transition), scene, api)
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
        return updateLinks(enter, scene, api);
      },
      (update) =>
        update.call((selection) =>
          selection
            .classed("hidden", !api.config.link.show)
            .transition(transition)
            .call(updateLinks, scene, api)
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

function updateGenes(selection, scene, api) {
  const { config, scales } = api;
  const geneLayout = (gene) => scene.genes.get(gene.uid);
  const fill = (gene) => {
    if (gene.colour) return gene.colour;
    const group = scales.group(gene.uid);
    return scales.colour(group);
  };

  selection.attr("display", (gene) =>
    geneLayout(gene)?.visible ? "inline" : "none"
  );
  selection
    .selectAll("polygon")
    .attr("class", (gene) => {
      const group = scales.group(gene.uid);
      return group === null ? "genePolygon" : `genePolygon group-${group}`;
    })
    .attr("points", (gene) => geneLayout(gene)?.localPolygon.join(" ") || "")
    .attr("fill", fill)
    .style("stroke", config.gene.shape.stroke)
    .style("stroke-width", config.gene.shape.strokeWidth);
  selection
    .selectAll("text.geneLabel")
    .text((gene) => gene.label || gene.uid)
    .attr("dy", (gene) => geneLayout(gene)?.labelDy)
    .attr("display", config.gene.label.show ? "inherit" : "none")
    .attr("transform", (gene) => geneLayout(gene)?.labelTransform)
    .attr("font-size", config.gene.label.fontSize)
    .attr("text-anchor", config.gene.label.anchor);
  return selection;
}

function updateLinks(selection, scene, api) {
  const { config, scales } = api;
  const linkLayout = (link) => scene.links.get(link.uid);
  const fill = (link) => {
    if (config.link.asLine) return "none";
    if (config.link.groupColour) return rgbaToRgb(scales.colour(scales.group(link.query.uid)));
    return scales.score(link.identity);
  };
  const stroke = (link) => {
    if (config.link.groupColour) {
      const colour = scales.colour(scales.group(link.query.uid));
      return config.link.asLine ? rgbaToRgb(colour) : colour;
    }
    return config.link.asLine ? scales.score(link.identity) : "black";
  };

  selection.attr("opacity", (link) =>
    config.link.show && linkLayout(link)?.visible ? 1 : 0
  );
  selection
    .selectAll("path")
    .attr("d", (link) => linkLayout(link)?.path || "")
    .style("fill", fill)
    .style("stroke", stroke)
    .style("stroke-width", `${config.link.strokeWidth}px`);
  selection
    .selectAll("text")
    .attr("opacity", (link) =>
      config.link.label.show && linkLayout(link)?.visible ? 1 : 0
    )
    .attr("filter", config.link.label.background ? "url(#filter_solid)" : null)
    .style("font-size", `${config.link.label.fontSize}px`)
    .attr("x", (link) => linkLayout(link)?.labelPosition?.x)
    .attr("y", (link) => linkLayout(link)?.labelPosition?.y);
  return selection;
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
    .fontFamily(api.config.plot.fontFamily)
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
    .fontFamily(api.config.plot.fontFamily)
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
    .fontFamily(api.config.plot.fontFamily)
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
