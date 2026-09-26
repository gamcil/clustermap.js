// Browser-only tooltip lifecycle shared by any chart renderer. Menu content is
// supplied by the caller because those controls may dispatch chart actions.
import * as d3 from "d3";

export function createHtmlOverlay({
  tooltip,
  scales,
  actions,
  eventNamespace = ".clusterMapTooltip",
}) {
  const windowRef = tooltip.node()?.ownerDocument?.defaultView;
  const clickEvent = `click${eventNamespace}`;

  const hide = () =>
    tooltip.style("opacity", 0).style("pointer-events", "none");

  const dismissOnOutsideClick = (event) => {
    const node = tooltip.node();
    if (!node || event.target === node || node.contains(event.target)) return;
    hide();
  };

  const show = (event, contents) => {
    tooltip.html("").append(() => contents.node());
    const bounds = tooltip.node().getBoundingClientRect();
    const rect = event.target?.getBoundingClientRect?.();
    const x = event.clientX ?? (rect ? rect.x + rect.width / 2 : 0);
    const y = event.clientY ?? (rect ? rect.y + rect.height : 0);
    tooltip
      .interrupt()
      .style("left", `${x - bounds.width / 2}px`)
      .style("top", `${y + 12}px`)
      .style("opacity", 1)
      .style("pointer-events", "all");
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
      .on("change", (event) => actions.updateGene(gene, { colour: event.target.value }));
    div.append("button").text("Anchor map on gene").on("click", () => actions.anchorGene(gene));
    if (typeof actions.revealGene === "function") {
      div.append("button").text("Reveal in data editor").on("click", () => {
        actions.revealGene(gene);
        hide();
      });
    }
    text.on("input", (event) => { actions.updateGene(gene, { label: event.target.value }); select.attr("value", null); });
    select.on("change", (event) => { actions.updateGene(gene, { label: event.target.value }); text.attr("value", event.target.value); });
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
      const sourceIds = [...select.node().options]
        .filter((option) => option.selected)
        .map((option) => groups.find((candidate) => String(candidate.uid) === option.value)?.uid)
        .filter((uid) => uid !== undefined);
      if (sourceIds.length) actions.mergeGroups(group, sourceIds);
    });
    const colour = d3.color(group.colour);
    const pickerColour = colour ? colour.formatHex() : "#000000";
    div.append("label").text("Choose group colour: ").append("input")
      .attr("type", "color").attr("value", pickerColour).property("value", pickerColour)
      .on("change", (event) => actions.updateGroup(group, { colour: event.target.value }));
    div.append("button").text("Hide group").on("click", () => actions.updateGroup(group, { hidden: true }));
    if (typeof actions.revealGroup === "function") {
      div.append("button").text("Reveal in data editor").on("click", () => {
        actions.revealGroup(group);
        hide();
      });
    }
    text.on("input", (event) => actions.updateGroup(group, { label: event.target.value }));
    return div;
  };

  return {
    enter: () => {
      tooltip
        .interrupt()
        .style("opacity", 1)
        .style("pointer-events", "all");
      // A chart must never replace another chart's window listener. The
      // namespace is supplied by the chart runtime and is removed on redraw
      // or destroy, which also releases this overlay's closure.
      if (windowRef) d3.select(windowRef).on(clickEvent, dismissOnOutsideClick);
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
    dispose: () => {
      if (windowRef) d3.select(windowRef).on(clickEvent, null);
      tooltip.interrupt();
      hide();
    },
  };
}
