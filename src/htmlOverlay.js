// Browser-only tooltip lifecycle shared by any chart renderer. Menu content is
// supplied by the caller because those controls may dispatch chart actions.
export function createHtmlOverlay({ tooltip, scales, actions }) {
  const show = (event, contents) => {
    tooltip.html("").append(() => contents.node());
    const bounds = tooltip.node().getBoundingClientRect();
    const rect = event.target?.getBoundingClientRect?.();
    const x = event.clientX ?? (rect ? rect.x + rect.width / 2 : 0);
    const y = event.clientY ?? (rect ? rect.y + rect.height : 0);
    tooltip
      .style("left", `${x - bounds.width / 2}px`)
      .style("top", `${y + 12}px`)
      .transition()
      .duration(100)
      .style("opacity", 1)
      .style("pointer-events", "all");
    tooltip
      .transition()
      .delay(1000)
      .style("opacity", 0)
      .style("pointer-events", "none");
  };

  const geneContents = (gene) => {
    const div = d3.create("div").attr("class", "tooltip-contents")
      .style("display", "flex").style("flex-direction", "column")
      .style("gap", "4px").style("width", "260px");
    div.append("label").attr("for", "gene-label-input").text("Edit label");
    const text = div.append("input").attr("id", "gene-label-input").attr("type", "text")
      .attr("value", gene.label || gene.name || gene.uid).style("box-sizing", "border-box").style("width", "100%");
    div.append("label").attr("for", "gene-qualifiers-input").text("Gene qualifiers");
    const select = div.append("select").attr("id", "gene-qualifiers-input").attr("multiple", true)
      .attr("size", 4).style("box-sizing", "border-box").style("width", "100%");
    const names = gene.names || {};
    select.selectAll("option").data(Object.keys(names)).join("option")
      .text((key) => `${names[key]} [${key}]`).attr("value", (key) => names[key]);
    const groupId = scales.group(gene.uid);
    const group = div.append("div").style("margin-top", "2px");
    group.append("span").text("Similarity group: ");
    group.append("span").text(scales.name(groupId)).style("color", scales.colour(groupId)).style("font-weight", "bold");
    const colour = d3.color(gene.colour || scales.colour(groupId));
    const pickerColour = colour ? colour.formatHex() : "#000000";
    div.append("label").text("Choose gene colour: ").append("input")
      .attr("type", "color").attr("value", pickerColour).property("value", pickerColour)
      .on("change", (event) => { gene.colour = event.target.value; actions.redraw(); });
    div.append("button").text("Anchor map on gene").on("click", () => actions.anchorGene(gene));
    text.on("input", (event) => { gene.label = event.target.value; select.attr("value", null); actions.redraw(); });
    select.on("change", (event) => { gene.label = event.target.value; text.attr("value", event.target.value); actions.redraw(); });
    return div;
  };

  const groupContents = (group) => {
    const div = d3.create("div").attr("class", "tooltip-contents")
      .style("display", "flex").style("flex-direction", "column");
    div.append("label").text("Edit label");
    const text = div.append("input").attr("type", "text").attr("value", group.label || group.uid);
    div.append("label").text("Merge with...");
    const groups = actions.getGroups();
    const select = div.append("select").attr("multiple", true);
    select.selectAll("option").data(groups.filter((candidate) => candidate.uid !== group.uid)).join("option")
      .text((candidate) => candidate.label).attr("value", (candidate) => candidate.uid);
    div.append("button").text("Merge!").on("click", () => {
      const indices = [...select.node().options].filter((option) => option.selected)
        .map((option) => groups.findIndex((candidate) => candidate.uid === option.value))
        .sort((left, right) => right - left);
      for (const index of indices) group.genes.push(...groups[index].genes);
      for (const index of indices) groups.splice(index, 1);
      actions.setGroups(groups);
    });
    const colour = d3.color(group.colour);
    const pickerColour = colour ? colour.formatHex() : "#000000";
    div.append("label").text("Choose group colour: ").append("input")
      .attr("type", "color").attr("value", pickerColour).property("value", pickerColour)
      .on("change", (event) => { group.colour = event.target.value; actions.redraw(); });
    div.append("button").text("Hide group").on("click", () => { group.hidden = true; actions.redraw(); });
    text.on("input", (event) => { group.label = event.target.value; actions.redraw(); });
    return div;
  };

  return {
    enter: () => {
      tooltip
        .interrupt()
        .style("opacity", 1)
        .style("pointer-events", "all");
      d3.select(window).on("click", (event) => {
        const node = tooltip.node();
        if (event.target === node || node.contains(event.target)) return;
        tooltip.style("opacity", 0).style("pointer-events", "none");
      });
    },
    leave: () => {
      const active = document.activeElement;
      if (active?.tagName === "INPUT" && tooltip.node().contains(active)) return;
      tooltip
        .transition()
        .delay(400)
        .style("opacity", 0)
        .style("pointer-events", "none");
    },
    show,
    showGeneMenu: (event, gene) => { event.preventDefault(); show(event, geneContents(gene)); },
    showGroupMenu: (event, group) => { event.preventDefault(); show(event, groupContents(group)); },
  };
}
