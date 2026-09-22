(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ClusterMap = {}));
})(this, (function (exports) { 'use strict';

  function createLinkGroups(links, oldGroups) {
    const groups = links
      .map((link) => [link.query.uid, link.target.uid])
      .map((group, index, allGroups) =>
        allGroups.slice(index).reduce(
          (merged, candidate) =>
            group.some((gene) => candidate.includes(gene))
              ? [...new Set([...merged, ...candidate])]
              : merged,
          []
        )
      )
      .map((genes, index) => ({
        label: `Group ${index}`,
        genes,
        hidden: false,
        colour: null,
      }))
      .reduce((result, group) => {
        let merged = false;
        result = result.map((existing) => {
          if (existing.genes.some((gene) => group.genes.includes(gene))) {
            merged = true;
            existing.genes = [...new Set([...existing.genes, ...group.genes])];
          }
          return existing;
        });
        if (!merged) result.push({ ...group, uid: result.length });
        return result;
      }, oldGroups || []);

    if (!oldGroups)
      groups.forEach((group, index) => (group.label = `Group ${index}`));
    return groups;
  }

  function getGroupScaleValues(groups) {
    const domain = [];
    const range = [];

    groups.forEach((group) => {
      if (group.hidden) return;
      group.genes.forEach((gene) => {
        domain.push(gene);
        range.push(group.uid);
      });
    });

    return { domain, range };
  }

  function filterLinks(
    links,
    { groupForGene, geneForUid, bestOnly, threshold }
  ) {
    const visibleLinks = links.filter(
      (link) =>
        groupForGene(link.query.uid) !== null &&
        groupForGene(link.target.uid) !== null
    );
    if (!bestOnly) return visibleLinks;

    const setsEqual = (a, b) =>
      a.size === b.size && [...a].every((value) => b.has(value));

    class ClusterPairMap extends Map {
      has(pair) {
        return [...this.keys()].some((key) => setsEqual(pair, key));
      }

      get(pair) {
        for (const [key, value] of this) {
          if (setsEqual(pair, key)) return value;
        }
      }

      set(pair, value) {
        return super.set(this.get(pair) || pair, value);
      }
    }

    const linksByClusterPair = new ClusterPairMap();
    const byIdentity = [...visibleLinks].sort((a, b) => b.identity - a.identity);

    for (const link of byIdentity) {
      const clusterPair = new Set([
        geneForUid(link.query.uid)._cluster,
        geneForUid(link.target.uid)._cluster,
      ]);

      if (!linksByClusterPair.has(clusterPair)) {
        linksByClusterPair.set(clusterPair, [link]);
        continue;
      }

      const selected = linksByClusterPair.get(clusterPair);
      const superseded = selected.some((candidate) => {
        const genes = new Set([candidate.query.uid, candidate.target.uid]);
        const sharesGene = genes.has(link.query.uid) || genes.has(link.target.uid);
        return sharesGene && link.identity < candidate.identity;
      });
      if (!superseded) selected.push(link);
    }

    return [...linksByClusterPair.values()]
      .flat()
      .filter((link) => link.identity > threshold);
  }

  function createChartState(data, previous = null) {
    const loci = previous?.loci || new Map();
    const genes = previous?.genes || new Map();
    const clusterOffsets = previous?.clusterOffsets || new Map();
    const locusOffsets = previous?.locusOffsets || new Map();
    const camera = previous?.camera || { x: 0, y: 0, k: 1 };
    const dragging = previous?.dragging || false;
    const clusterIds = data.clusters.map((cluster) => cluster.uid);
    const clusterIdSet = new Set(clusterIds);
    const clusterOrder = [
      ...(previous?.clusterOrder || []).filter((uid) => clusterIdSet.has(uid)),
      ...clusterIds.filter((uid) => !previous?.clusterOrder?.includes(uid)),
    ];
    const present = new Set();
    for (const cluster of data.clusters) {
      if (!clusterOffsets.has(cluster.uid)) clusterOffsets.set(cluster.uid, 0);
      for (const locus of cluster.loci) {
        present.add(locus.uid);
        if (!loci.has(locus.uid)) {
          loci.set(locus.uid, {
            start: locus._start ?? locus.start,
            end: locus._end ?? locus.end,
            flipped: locus._flipped ?? false,
            trimLeft: locus._trimLeft ?? null,
            trimRight: locus._trimRight ?? null,
          });
        }
        for (const gene of locus.genes) {
          const geneBio = gene.bio || {
            start: gene.start,
            end: gene.end,
            strand: gene.strand,
          };
          const locusBio = locus.bio || { start: locus.start, end: locus.end };
          const key = `${locus.uid}:${gene.uid}`;
          present.add(key);
          if (!genes.has(key)) {
            genes.set(key, {
              start: geneBio.start - locusBio.start,
              end: geneBio.end - locusBio.start,
              strand: geneBio.strand,
            });
          }
        }
      }
    }
    for (const uid of loci.keys()) {
      if (!data.clusters.some((cluster) => cluster.loci.some((locus) => locus.uid === uid))) loci.delete(uid);
    }
    for (const uid of genes.keys()) if (!present.has(uid)) genes.delete(uid);
    for (const uid of clusterOffsets.keys()) {
      if (!clusterIdSet.has(uid)) clusterOffsets.delete(uid);
    }
    for (const uid of locusOffsets.keys()) {
      if (!loci.has(uid)) locusOffsets.delete(uid);
    }
    return { loci, genes, clusterOffsets, locusOffsets, clusterOrder, camera, dragging };
  }

  function isDragging(chartState) {
    return chartState.dragging;
  }

  function setDragging(chartState, dragging) {
    chartState.dragging = dragging;
  }

  function getClusterOrder(chartState) {
    return chartState.clusterOrder;
  }

  function moveClusterToIndex(chartState, uid, index) {
    const order = [...chartState.clusterOrder];
    const current = order.indexOf(uid);
    if (current === -1) return order;
    order.splice(current, 1);
    order.splice(Math.max(0, Math.min(index, order.length)), 0, uid);
    chartState.clusterOrder = order;
    return order;
  }

  function getClusterOffset(chartState, uid) {
    return chartState.clusterOffsets.get(uid) ?? 0;
  }

  function setClusterOffset(chartState, uid, offset) {
    chartState.clusterOffsets.set(uid, offset);
  }

  function getLocusOffset(chartState, uid) {
    return chartState.locusOffsets.get(uid) ?? 0;
  }

  function setLocusOffset(chartState, uid, offset) {
    chartState.locusOffsets.set(uid, offset);
  }

  function initializeLocusOffsets(chartState, defaults) {
    for (const [uid, offset] of defaults) {
      if (!chartState.locusOffsets.has(uid)) chartState.locusOffsets.set(uid, offset);
    }
  }

  function getCamera(chartState) {
    return chartState.camera;
  }

  function setCamera(chartState, { x, y, k }) {
    chartState.camera = { x, y, k };
  }

  function getLocusState(chartState, locus) {
    return chartState.loci.get(locus.uid);
  }

  function getGeneState(chartState, gene) {
    return chartState.genes.get(`${gene._locus}:${gene.uid}`);
  }

  function formatLocusText(loci, chartState, hideCoordinates) {
    return loci
      .map((locus) => {
        let start;
        let end;

        const state = getLocusState(chartState, locus);
        if (locus._bio_start != null && locus._bio_end != null) {
          let startDiff = state.start - locus.start;
          let endDiff = locus.end - state.end;
          if (state.flipped) [startDiff, endDiff] = [endDiff, startDiff];
          start = locus._bio_start + startDiff + 1;
          end = locus._bio_end - endDiff;
        } else {
          start = state.start + 1;
          end = state.end;
        }

        if (state.flipped) [start, end] = [end, start];

        const reversed = state.flipped ? " (reversed)" : "";
        if (hideCoordinates || state.start == null || state.end == null)
          return `${locus.name}${reversed}`;
        return `${locus.name}${reversed}:${start.toFixed(0)}-${end.toFixed(0)}`;
      })
      .join(", ");
  }

  function recalculateLocusCoordinates(chartState, locus, scaleGenes) {
    locus.genes.forEach((gene, index, genes) => {
      const state = getGeneState(chartState, gene);
      const length = scaleGenes ? state.end - state.start : 1000;
      state.start = scaleGenes
        ? state.start
        : index > 0
        ? getGeneState(chartState, genes[index - 1]).end
        : 0;
      state.end = state.start + length;
    });

    const state = getLocusState(chartState, locus);
    const oldStart = state.start;
    const lastGene = locus.genes[locus.genes.length - 1];
    state.start = state.trimLeft
      ? getGeneState(chartState, state.trimLeft).start
      : 0;
    state.end = state.trimRight
      ? getGeneState(chartState, state.trimRight).end
      : scaleGenes
      ? locus.end
      : lastGene.end;

    return { oldStart };
  }

  function closestIndex(values, target) {
    let low = 0;
    let high = values.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (values[middle] < target) low = middle + 1;
      else high = middle;
    }
    return Math.max(Math.min(low, values.length - 1), 0);
  }

  /**
   * Apply a trim at the display coordinate nearest to a valid gene boundary.
   * `coordinateFor` is supplied by the caller, keeping the state transition
   * independent of D3 scales and any particular renderer.
   */
  function trimLocus(chartState, locus, {
    edge,
    position,
    coordinateFor,
    scaleGenes,
  }) {
    const state = getLocusState(chartState, locus);
    const genes = [...locus.genes].sort(
      (left, right) =>
        getGeneState(chartState, left).start - getGeneState(chartState, right).start
    );

    if (edge === "left") {
      const visible = genes.filter(
        (gene) => getGeneState(chartState, gene).end <= state.end
      );
      const boundaries = [
        locus.start,
        ...visible.map((gene) => getGeneState(chartState, gene).start),
      ];
      const index = closestIndex(boundaries.map(coordinateFor), position);
      state.start = boundaries[index];
      state.trimLeft = index === 0 ? null : visible[index - 1];
      return { state, coordinate: coordinateFor(state.start) };
    }

    if (edge === "right") {
      const visible = genes.filter(
        (gene) => getGeneState(chartState, gene).start >= state.start
      );
      const boundaries = [
        ...visible.map((gene) => getGeneState(chartState, gene).end),
        scaleGenes ? locus.end : state.end,
      ];
      const index = closestIndex(boundaries.map(coordinateFor), position);
      state.end = boundaries[index];
      state.trimRight = visible[index] || null;
      return { state, coordinate: coordinateFor(state.end) };
    }

    throw new Error(`Unknown locus trim edge: ${edge}`);
  }

  function finalizeLocusTrim(chartState, locus) {
    const state = getLocusState(chartState, locus);
    if (state.end === locus.end) state.trimRight = null;
    if (state.start === locus.start) state.trimLeft = null;
  }

  /**
   * Align each represented cluster with an anchor gene. Coordinate projection is
   * injected by the controller, so this state transition remains independent of
   * D3 and of a particular renderer.
   */
  function anchorGeneGroup(chartState, {
    anchor,
    genes,
    locusForGene,
    coordinateForGene,
    flipMismatchedLoci = false,
    onLocusFlipped = () => {},
  }) {
    const anchorsByCluster = new Map();
    const anchorState = getGeneState(chartState, anchor);

    for (const gene of genes) {
      if (
        flipMismatchedLoci &&
        getGeneState(chartState, gene).strand !== anchorState.strand
      ) {
        const locus = locusForGene(gene);
        flipLocus(chartState, locus);
        onLocusFlipped(locus);
      }
      const clusterGenes = anchorsByCluster.get(gene._cluster) || [];
      clusterGenes.push(gene);
      anchorsByCluster.set(gene._cluster, clusterGenes);
    }

    const midpoint = coordinateForGene(anchor);
    const changes = [];
    for (const [clusterUid, clusterGenes] of anchorsByCluster) {
      if (clusterGenes.some((gene) => gene.uid === anchor.uid)) continue;
      const closest = clusterGenes.reduce((best, gene) =>
        Math.abs(coordinateForGene(gene) - midpoint) <
        Math.abs(coordinateForGene(best) - midpoint)
          ? gene
          : best
      );
      const offset = midpoint - coordinateForGene(closest);
      setClusterOffset(
        chartState,
        clusterUid,
        getClusterOffset(chartState, clusterUid) + offset
      );
      changes.push({ clusterUid, offset, gene: closest });
    }
    return changes;
  }

  function flipLocus(chartState, locus) {
    const state = getLocusState(chartState, locus);
    state.flipped = !state.flipped;
    const length = locus.end - locus.start;

    [state.trimLeft, state.trimRight] = [
      state.trimRight,
      state.trimLeft,
    ];

    locus.genes.forEach((gene) => {
      const geneState = getGeneState(chartState, gene);
      const start = geneState.start;
      geneState.start = length - geneState.end;
      geneState.end = length - start;
      geneState.strand = geneState.strand === 1 ? -1 : 1;
    });
    locus.genes.sort(
      (a, b) => getGeneState(chartState, a).start - getGeneState(chartState, b).start
    );
  }

  function setDefault(object, key, value) {
    if (object[key] == null) object[key] = value;
  }

  function normalizeGene(gene) {
    return {
      ...gene,
      bio: gene.bio || { start: gene.start, end: gene.end, strand: gene.strand },
    };
  }

  function normalizeLocus(locus) {
    const bio = locus.bio || { start: locus.start, end: locus.end };
    return {
      ...locus,
      bio,
      _bio_start: bio.start,
      _bio_end: bio.end,
      start: 0,
      end: bio.end - bio.start,
      genes: locus.genes.map(normalizeGene),
    };
  }

  function normalizeChartData(data) {
    return {
      ...data,
      clusters: data.clusters.map((cluster) => ({
        ...cluster,
        loci: cluster.loci.map(normalizeLocus),
      })),
      links: [...data.links],
      groups: data.groups?.map((group) => ({
        ...group,
        genes: group.genes ? [...group.genes] : group.genes,
      })),
    };
  }

  function initializeClusterData(cluster) {
    for (const locus of cluster.loci) {
      setDefault(locus, "_cluster", cluster.uid);

      for (const gene of locus.genes) {
        setDefault(gene, "_locus", locus.uid);
        setDefault(gene, "_cluster", cluster.uid);
      }
    }

    return cluster;
  }

  function appendToIndex(index, key, value) {
    const values = index.get(key);
    if (values) values.push(value);
    else index.set(key, [value]);
  }

  function createChartIndex(data) {
    const clusterById = new Map();
    const locusById = new Map();
    const geneById = new Map();
    const linkById = new Map();
    const linksByGeneId = new Map();

    for (const cluster of data.clusters) {
      initializeClusterData(cluster);
      clusterById.set(cluster.uid, cluster);

      for (const locus of cluster.loci) {
        locusById.set(locus.uid, locus);
        for (const gene of locus.genes) geneById.set(gene.uid, gene);
      }
    }

    for (const link of data.links) {
      linkById.set(link.uid, link);
      appendToIndex(linksByGeneId, link.query.uid, link);
      appendToIndex(linksByGeneId, link.target.uid, link);
    }

    return { clusterById, locusById, geneById, linkById, linksByGeneId };
  }

  // Browser-only tooltip lifecycle shared by any chart renderer. Menu content is
  // supplied by the caller because those controls may dispatch chart actions.
  function createHtmlOverlay({ tooltip, scales, actions }) {
    const show = (event, contents) => {
      tooltip.html("").append(() => contents.node());
      const rect = event.target.getBoundingClientRect();
      const bounds = tooltip.node().getBoundingClientRect();
      tooltip
        .style("left", `${rect.x + rect.width / 2 - bounds.width / 2}px`)
        .style("top", `${rect.y + rect.height * 1.2}px`)
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

  function legend(colourScale) {
    /* Creates a legend component from a colour scale.
     */

    let entryHeight = 15;
    let fontSize = 12;
    let hidden = [];
    let onClickCircle = () => {};
    let onClickText = () => {};
    let onAltClickText = () => {};
    let fontFamily = null;
    let y = d3.scaleBand().paddingInner(0.5);
    let t = d3.transition().duration(500);

    function my(selection) {
      selection.each(function (data) {
        // Grab new domain from colourScale and update the y-scale
        let visible = data.groups.filter(
          (g) => !hidden.includes(g.uid) && !g.hidden
        );

        y.domain(visible.map((v) => v.uid)).range([
          0,
          entryHeight * visible.length,
        ]);

        // Grab the <g> element, if it exists
        let g = d3
          .select(this)
          .selectAll("g.legend")
          .data([data])
          .join("g")
          .attr("class", "legend");

        // Render each legend element <g>
        let translate = (d) => `translate(0, ${y(d.uid)})`;
        g.selectAll("g.element")
          .data(visible, (d) => d.uid)
          .join(
            (enter) => {
              enter = enter
                .append("g")
                .attr("class", "element")
                .attr("transform", translate);
              enter.append("circle").attr("class", (d) => `group-${d.uid}`);
              enter
                .append("text")
                .attr("x", 16)
                .attr("text-anchor", "start")
                .style("font-family", fontFamily)
                .style("dominant-baseline", "middle");
              return enter.call(updateLegend);
            },
            (update) =>
              update.call((update) =>
                update
                  .transition(t)
                  .attr("transform", translate)
                  .call(updateLegend)
              )
          );

        // If click callbacks are specified, bind them
        if (onClickCircle)
          g.selectAll("circle")
            .attr("cursor", "pointer")
            .on("click", onClickCircle);
        g.selectAll("text")
          .attr("cursor", "pointer")
          .on("click", onClickText)
          .on("contextmenu", onAltClickText);
      });
    }

    function updateLegend(selection) {
      selection.attr("transform", (d) => `translate(0, ${y(d.uid)})`);
      let half = y.bandwidth() / 2;
      selection
        .selectAll("text")
        .text((d) => d.label)
        .attr("x", half + 6)
        .attr("y", half + 1)
        .style("font-size", `${fontSize}px`);
      selection
        .selectAll("circle")
        .attr("cy", half)
        .attr("r", half)
        .attr("fill", (d) => colourScale(d.uid));
    }

    my.colourScale = (_) =>
      arguments.length ? ((colourScale = _), my) : colourScale;
    my.transition = (_) => (arguments.length ? ((t = _), my) : t);
    my.hidden = (_) => (arguments.length ? ((hidden = _), my) : hidden);
    my.entryHeight = (_) =>
      arguments.length ? ((entryHeight = parseInt(_)), my) : entryHeight;
    my.fontSize = (_) =>
      arguments.length ? ((fontSize = parseInt(_)), my) : fontSize;
    my.fontFamily = (_) =>
      arguments.length ? ((fontFamily = _), my) : fontFamily;
    my.onClickCircle = (_) =>
      arguments.length ? ((onClickCircle = _), my) : onClickCircle;
    my.onClickText = (_) =>
      arguments.length ? ((onClickText = _), my) : onClickText;
    my.onAltClickText = (_) =>
      arguments.length ? ((onAltClickText = _), my) : onAltClickText;

    return my;
  }

  function colourBar(colourScale) {
    /* Creates the colour bar component.
     */

    let height = 25;
    let width = 150;
    let fontSize = 12;
    let t = d3.transition();
    let fontFamily = null;

    function my(selection) {
      selection.each(function (data) {
        d3.select(this)
          .selectAll("g.colourBar")
          .data([data])
          .join(
            (enter) => {
              enter = enter.append("g").attr("class", "colourBar");

              // Add the gradient to <defs>
              let defs = enter.append("defs");
              let gradient = defs
                .append("linearGradient")
                .attr("id", "cbarGradient")
                .attr("x1", "0%")
                .attr("x2", "100%");
              gradient
                .append("stop")
                .attr("class", "startStop")
                .attr("offset", "0%");
              gradient
                .append("stop")
                .attr("class", "endStop")
                .attr("offset", "100%");

              // Draw the colour bar itself
              let cbar = enter.append("g").attr("class", "cbarParts");
              cbar
                .append("rect")
                .attr("class", "colourBarBG")
                .style("fill", "white")
                .style("stroke", "black")
                .style("stroke-width", "1px");
              cbar
                .append("rect")
                .attr("class", "colourBarFill")
                .style("fill", "url(#cbarGradient)");
              cbar
                .append("text")
                .text("Identity (%)")
                .attr("class", "labelText")
                .attr("text-anchor", "middle");
              cbar
                .append("text")
                .text("0")
                .attr("class", "startText")
                .attr("text-anchor", "start");
              cbar
                .append("text")
                .text("100")
                .attr("class", "endText")
                .attr("text-anchor", "end");
              cbar
                .selectAll("text")
                .style("font-family", fontFamily)
                .style("dominant-baseline", "hanging");

              enter.call(updateColourBar);
              return enter;
            },
            (update) =>
              update.call((update) => update.transition(t).call(updateColourBar))
          );
      });
    }

    function updateColourBar(selection) {
      // Updates colour bar styling/positioning
      selection.select(".startStop").attr("stop-color", colourScale(0));
      selection.select(".endStop").attr("stop-color", colourScale(1));
      selection.selectAll("rect").attr("width", width).attr("height", height);
      selection
        .selectAll(".startText, .endText, .labelText")
        .attr("y", height + 5);
      selection.select(".labelText").attr("x", width / 2);
      selection.select(".endText").attr("x", width);
      selection.selectAll("text").style("font-size", `${fontSize}pt`);
    }

    // Setters/getters
    my.width = (_) => (arguments.length ? ((width = parseInt(_)), my) : width);
    my.height = (_) => (arguments.length ? ((height = parseInt(_)), my) : height);
    my.fontSize = (_) =>
      arguments.length ? ((fontSize = parseInt(_)), my) : fontSize;
    my.fontFamily = (_) =>
      arguments.length ? ((fontFamily = _), my) : fontFamily;
    my.colourScale = (_) =>
      arguments.length ? ((colourScale = _), my) : colourScale;
    my.transition = (_) => (arguments.length ? ((t = _), my) : t);

    return my;
  }

  function scaleBar(x) {
    /* Creates a scale bar component
     */

    let basePair = 1000;
    let stroke = 1;
    let height = 10;
    let colour = "black";
    let fontSize = 12;
    let t = d3.transition().duration(500);
    let onClickText = null;
    let fontFamily = null;

    function my(selection) {
      selection.each(function (data) {
        // Grab the <g> element, if it exists and draw scale bar
        d3.select(this)
          .selectAll("g.scaleBar")
          .data([data])
          .join(
            (enter) => {
              enter = enter.append("g").attr("class", "scaleBar");
              enter.append("line").attr("class", "flatBar");
              enter.append("line").attr("class", "leftBar");
              enter.append("line").attr("class", "rightBar");
              enter
                .append("text")
                .attr("class", "barText")
                .attr("text-anchor", "middle")
                .attr("cursor", "pointer")
                .style("font-family", fontFamily)
                .on("click", onClickText || promptNewLength);
              enter.call(updateScaleBar);
              return enter;
            },
            (update) =>
              update.call((update) => update.transition(t).call(updateScaleBar))
          );
      });
    }

    function getLabel() {
      return `${+(basePair / 1000).toFixed(1)}kb`;
    }

    function updateScaleBar(selection) {
      // Updates position and styling of scale bar components
      let middle = height / 2;
      let end = x(basePair);
      selection
        .select(".flatBar")
        .attr("x2", end)
        .attr("y1", middle)
        .attr("y2", middle);
      selection.select(".leftBar").attr("y2", height);
      selection
        .select(".rightBar")
        .attr("x1", end)
        .attr("x2", end)
        .attr("y2", height);
      selection
        .select("text.barText")
        .text(getLabel)
        .attr("x", end / 2)
        .attr("y", height + 5)
        .style("dominant-baseline", "hanging")
        .style("font-size", `${fontSize}pt`);
      selection
        .selectAll("line")
        .style("stroke", colour)
        .style("stroke-width", stroke);
    }

    function promptNewLength() {
      let result = prompt("Enter new length (bp):", basePair);
      if (result) my.basePair(result);
    }

    my.basePair = (_) =>
      arguments.length ? ((basePair = parseInt(_)), my) : basePair;
    my.colour = (_) => (arguments.length ? ((colour = _), my) : colour);
    my.colourScale = (_) =>
      arguments.length ? ((colourScale = _), my) : colourScale;
    my.fontSize = (_) =>
      arguments.length ? ((fontSize = parseInt(_)), my) : fontSize;
    my.fontFamily = (_) =>
      arguments.length ? ((fontFamily = _), my) : fontFamily;
    my.height = (_) => (arguments.length ? ((height = parseInt(_)), my) : height);
    my.onClickText = (_) =>
      arguments.length ? ((onClickText = _), my) : onClickText;
    my.stroke = (_) => (arguments.length ? ((stroke = parseInt(_)), my) : stroke);
    my.transition = (_) => (arguments.length ? ((t = _), my) : t);
    my.width = (_) => (arguments.length ? ((width = parseInt(_)), my) : width);

    return my;
  }

  // Changes value of a text node to a prompted value
  function renameText(event) {
    if (event.defaultPrevented) return;
    let text = d3.select(event.target);
    let result = prompt("Enter new value:", text.text());
    if (result) text.text(result);
  }

  function isObject(a) {
    return !!a && a.constructor === Object;
  }

  function updateConfig(target, source) {
    for (const [key, value] of Object.entries(source)) {
      if (!target.hasOwnProperty(key)) continue;
      if (isObject(value)) {
        updateConfig(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }

  function rgbaToRgb(rgba, opacity = 0.6) {
    let colour = d3.color(rgba).rgb();
    return d3.rgb(
      (1 - opacity) * 255 + opacity * colour.r,
      (1 - opacity) * 255 + opacity * colour.g,
      (1 - opacity) * 255 + opacity * colour.b
    );
  }

  function getLinkAnchors(
    link,
    {
      geneForUid,
      areClustersAdjacent,
      scaleX,
      horizontalOffset,
      verticalPosition,
      geneMidpoint,
    }
  ) {
    const query = geneForUid(link.query.uid);
    const target = geneForUid(link.target.uid);

    if (!areClustersAdjacent(query._cluster, target._cluster)) return null;

    const getGeneAnchors = (gene) => {
      const offset = horizontalOffset(gene);
      const left = scaleX(gene.start) + offset;
      const right = scaleX(gene.end) + offset;
      const forward = gene.strand === 1;
      return [
        forward ? left : right,
        forward ? right : left,
        verticalPosition(gene) + geneMidpoint,
      ];
    };

    const [ax1, ax2, ay] = getGeneAnchors(query);
    const [bx1, bx2, by] = getGeneAnchors(target);

    return ay > by
      ? [bx1, bx2, by, ax1, ax2, ay]
      : [ax1, ax2, ay, bx1, bx2, by];
  }

  function getLinkLabelPosition(
    [ax1, ax2, ay, bx1, bx2, by],
    position
  ) {
    const aMid = ax1 + (ax2 - ax1) / 2;
    const bMid = bx1 + (bx2 - bx1) / 2;
    return {
      x: aMid + (bMid - aMid) * position,
      y: ay + Math.abs(by - ay) * position,
    };
  }

  function straightLinkPath([ax1, ax2, ay, bx1, bx2, by]) {
    return `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by} L${ax1},${ay}`;
  }

  function sankeyLinkPath([ax1, ax2, ay, bx1, bx2, by]) {
    const verticalMidpoint = ay + Math.abs(by - ay) / 2;
    return `M${ax2},${ay}C${ax2},${verticalMidpoint},${bx2},${verticalMidpoint},${bx2},${by}L${bx1},${by}C${bx1},${verticalMidpoint},${ax1},${verticalMidpoint},${ax1},${ay}L${ax2},${ay}`;
  }

  function lineLinkPath([ax1, ax2, ay, bx1, bx2, by], straight) {
    const aMid = ax1 + (ax2 - ax1) / 2;
    const bMid = bx1 + (bx2 - bx1) / 2;
    if (straight) return `M${aMid},${ay} L${bMid},${by}`;

    const verticalMidpoint = (ay + by) / 2;
    return `M${aMid},${ay}C${aMid},${verticalMidpoint},${bMid},${verticalMidpoint},${bMid},${by}`;
  }

  function getLinkPath(anchors, { asLine, straight }) {
    if (!anchors) return "";
    if (asLine) return lineLinkPath(anchors, straight);
    return straight ? straightLinkPath(anchors) : sankeyLinkPath(anchors);
  }

  // Owns the D3 joins for chart-world SVG. The chart controller owns the SVG
  // host, camera viewport, and interaction state that causes a redraw.
  function renderSvg({
    plot,
    data,
    scene,
    transition,
    animate,
    config,
    scales,
    ids,
    lookup,
    interactions,
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
    const refreshLinkPreview = createLinkPreview({
      plot,
      config,
      scales,
      ids,
      lookup,
      interactions,
    });

    const clusters = clusterGroup
      .selectAll("g.cluster")
      .data(data.clusters, (d) => d.uid)
      .join(
        (enter) => {
          enter = enter
            .append("g")
            .attr("id", ids.cluster)
            .attr("class", "cluster");
          const info = enter
            .append("g")
            .attr("id", ids.clusterInfo)
            .attr("class", "clusterInfo")
            .attr("transform", "translate(-10, 0)")
            .call(
              createClusterDrag({ plot, scales, ids, interactions, refreshLinkPreview })
            );

          info
            .append("text")
            .text((cluster) => cluster.name)
            .attr("class", "clusterText")
            .attr("y", 8)
            .attr("cursor", "pointer")
            .style("font-weight", "bold")
            .style("font-size", `${config.cluster.nameFontSize}px`)
            .style("font-family", config.plot.fontFamily)
            .on("click", renameText);
          info
            .append("text")
            .attr("class", "locusText")
            .attr("y", 12)
            .attr("dominant-baseline", "hanging")
            .style("text-rendering", "geometricPrecision")
            .style("font-size", `${config.cluster.lociFontSize}px`)
            .style("font-family", config.plot.fontFamily);
          info.selectAll("text").attr("text-anchor", "end");
          enter.append("g").attr("class", "loci");
          return enter;
        },
        (update) => update
      );

    // A cluster drag can leave an in-flight transform transition on sibling
    // rows. Cancel it before the scene supplies their snapped final positions.
    const clusterRender = animate
      ? clusters.interrupt().transition(transition)
      : clusters.interrupt();
    updateClusters(clusterRender, scene);

    const loci = clusters
      .selectAll("g.loci")
      .selectAll("g.locus")
      .data((cluster) => cluster.loci, (locus) => locus.uid)
      .join(
        (enter) => {
          enter = enter
            .append("g")
            .attr("id", ids.locus)
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
            .call(
              createLocusPositionDrag({
                config,
                plot,
                scales,
                ids,
                interactions,
                refreshLinkPreview,
              })
            );
          hover
            .append("rect")
            .attr("class", "leftHandle")
            .attr("x", -8)
            .call(
              createLocusResizeDrag({
                config,
                plot,
                scales,
                ids,
                interactions,
                refreshLinkPreview,
              })
            );
          hover
            .append("rect")
            .attr("class", "rightHandle")
            .call(
              createLocusResizeDrag({
                config,
                plot,
                scales,
                ids,
                interactions,
                refreshLinkPreview,
              })
            );
          hover
            .selectAll(".leftHandle, .rightHandle")
            .attr("width", 8)
            .attr("cursor", "pointer");
          enter
            .on("mouseenter", (event) => {
              if (!interactions.isDragging()) {
                d3.select(event.target).select("g.hover").transition().attr("opacity", 1);
              }
            })
            .on("mouseleave", (event) => {
              if (!interactions.isDragging()) {
                d3.select(event.target).select("g.hover").transition().attr("opacity", 0);
              }
            })
            .on("dblclick", (_, locus) => interactions.flipLocus(locus));
          return updateLoci(enter, scene, config);
        },
        (update) =>
          update.call((selection) =>
            updateLoci(selection.transition(transition), scene, config)
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
            .attr("id", ids.gene)
            .attr("class", "gene")
            .attr("display", "inline");
          enter
            .append("polygon")
            .on("click", interactions.onGeneClick)
            .on("contextmenu", interactions.showGeneMenu)
            .attr("class", "genePolygon");
          enter
            .append("text")
            .attr("class", "geneLabel")
            .attr("dy", "-0.3em")
            .style("font-family", config.plot.fontFamily);
          return updateGenes(enter, scene, config, scales);
        },
        (update) =>
          update.call((selection) =>
            updateGenes(selection.transition(transition), scene, config, scales)
          )
      );

    const visibleLinks = filterLinks(data.links, {
      groupForGene: scales.group,
      geneForUid: lookup.gene,
      bestOnly: config.link.bestOnly,
      threshold: config.link.threshold,
    });
    linkGroup
      .selectAll("g.geneLinkG")
      .data(visibleLinks, ids.link)
      .join(
        (enter) => {
          enter = enter
            .append("g")
            .attr("id", ids.link)
            .attr("class", "geneLinkG");
          enter.append("path").attr("class", "geneLink");
          enter
            .append("text")
            .text((link) => link.identity.toFixed(2))
            .attr("class", "geneLinkLabel")
            .style("fill", "white")
            .style("text-anchor", "middle")
            .style("font-family", config.plot.fontFamily);
          return updateLinks(enter, scene, config, scales, ids);
        },
        (update) =>
          update.call((selection) =>
            selection
              .classed("hidden", !config.link.show)
              .transition(transition)
              .call(updateLinks, scene, config, scales, ids)
          ),
        (exit) =>
          exit.call((selection) => selection.transition(transition).attr("opacity", 0).remove())
      );

    plot
      .call(getLegend(scene, config, scales, interactions))
      .call(getColourBar(config, scales, transition))
      .call(getScaleBar(config, scales, transition, interactions));
    arrangePlot(plot, scene, config, transition, animate);
  }

  function updateClusters(selection, scene) {
    const layout = (cluster) => scene.clusters.get(cluster.uid);
    selection.attr("transform", (cluster) => {
      const { x, y } = layout(cluster);
      return `translate(${x}, ${y})`;
    });
    selection.selectAll("g.clusterInfo").attr("transform", (cluster) => {
      const { x, y } = layout(cluster).info;
      return `translate(${x}, ${y})`;
    });
    selection.selectAll("text.locusText").each(function (cluster) {
      const text = layout(cluster).info.locusText;
      if (this.textContent !== text) this.textContent = text;
    });
    return selection;
  }

  function createClusterDrag({ plot, scales, ids, interactions, refreshLinkPreview }) {
    let pointerOffset;
    let range;
    let order;

    const clusterSelection = (uid) => plot.select(`#${ids.cluster({ uid })}`);
    const matrixY = (selection) => {
      const transform = selection.node().transform.baseVal;
      return transform.numberOfItems ? transform.getItem(0).matrix.f : 0;
    };

    const started = (event, cluster) => {
      interactions.setDragging(true);
      order = [...interactions.getClusterOrder()];
      const subject = clusterSelection(cluster.uid);
      subject.classed("active", true).attr("cursor", "grabbing");
      pointerOffset = matrixY(subject) - event.y;
      range = scales.y.range();
    };

    const dragged = (event, cluster) => {
      const subject = clusterSelection(cluster.uid);
      subject.raise();
      const y = Math.min(
        range[range.length - 1],
        Math.max(range[0], pointerOffset + event.y)
      );
      subject.attr("transform", `translate(${scales.offset(cluster.uid)}, ${y})`);

      const targetIndex = range.reduce(
        (closest, position, index) =>
          Math.abs(position - y) < Math.abs(range[closest] - y) ? index : closest,
        0
      );
      const currentIndex = order.indexOf(cluster.uid);
      refreshLinkPreview();
      if (targetIndex === currentIndex) return;

      order.splice(currentIndex, 1);
      order.splice(targetIndex, 0, cluster.uid);
      order.forEach((uid, index) => {
        if (uid === cluster.uid) return;
        clusterSelection(uid)
          .transition()
          .attr("transform", `translate(${scales.offset(uid)}, ${range[index]})`);
      });
    };

    const ended = (_, cluster) => {
      interactions.setDragging(false);
      interactions.moveClusterToIndex(cluster.uid, order.indexOf(cluster.uid));
      interactions.redraw();
    };

    return d3
      .drag()
      .container(function () {
        return this.parentNode.parentNode;
      })
      .on("start", started)
      .on("drag", dragged)
      .on("end", ended);
  }

  function createLocusPositionDrag({
    config,
    plot,
    scales,
    ids,
    interactions,
    refreshLinkPreview,
  }) {
    let minPos;
    let maxPos;
    let pointerStart;
    let value;

    const locusSelection = (uid) => plot.select(`#${ids.locus({ uid })}`);

    const started = (event, locus) => {
      [minPos, maxPos] = interactions.getLocusMoveBounds(locus.uid);
      pointerStart = event.x;
      value = interactions.getLocusOffset(locus.uid);
      interactions.setDragging(true);
    };

    const dragged = (event, locus) => {
      value += event.x - pointerStart;
      const subject = locusSelection(locus.uid);
      subject.attr("transform", `translate(${value}, 0)`);
      refreshLinkPreview();

      const state = interactions.getLocusState(locus);
      const locusStart = scales.x(state.start);
      if (config.cluster.alignLabels) {
        const locusMin = value + scales.offset(locus._cluster) + locusStart;
        const newMin = Math.min(locusMin, minPos) - 10;
        plot.selectAll("g.clusterInfo").attr(
          "transform",
          (cluster) => `translate(${newMin - scales.offset(cluster.uid)}, 0)`
        );
      } else {
        plot.select(`#${ids.clusterInfo({ uid: locus._cluster })}`).attr(
          "transform",
          `translate(${value + locusStart - 10}, 0)`
        );
      }

      const locusEnd = scales.x(state.end);
      const newMax = Math.max(value + scales.offset(locus._cluster) + locusEnd, maxPos) + 20;
      plot.select("g.legend").attr("transform", `translate(${newMax}, 0)`);
    };

    const ended = (_, locus) => {
      interactions.setDragging(false);
      interactions.setLocusOffset(locus.uid, value);
      interactions.redraw();
    };

    return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
  }

  // Resize changes chart state through the controller, while this renderer-owned
  // adapter supplies immediate SVG feedback until the final redraw.
  function createLocusResizeDrag({
    config,
    plot,
    scales,
    ids,
    interactions,
    refreshLinkPreview,
  }) {
    let minPos;
    let maxPos;

    const locusSelection = (uid) => plot.select(`#${ids.locus({ uid })}`);
    const realLength = (state) => scales.x(state.end) - scales.x(state.start);
    const updateTrackBar = (selection, state) => {
      const y = config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2;
      selection
        .select("line.trackBar")
        .attr("x1", scales.x(state.start))
        .attr("x2", scales.x(state.end))
        .attr("y1", y)
        .attr("y2", y);
    };
    const updateVisibleGenes = (selection, state) => {
      selection.selectAll("g.gene").attr("display", (gene) => {
        const display = interactions.getGeneState(gene);
        return display.start >= state.start && display.end <= state.end + 1
          ? "inline"
          : "none";
      });
    };
    const started = (_, locus) => {
      [minPos, maxPos] = interactions.getLocusMoveBounds(locus.uid);
      interactions.setDragging(true);
    };

    const dragLeft = (event, locus, handle) => {
      const { state, coordinate } = interactions.trimLocus(locus, {
        edge: "left",
        position: event.x,
        coordinateFor: scales.x,
        scaleGenes: config.plot.scaleGenes,
      });
      const subject = locusSelection(locus.uid);
      handle.attr("x", coordinate - 8);
      subject
        .select("rect.hover")
        .attr("x", coordinate)
        .attr("width", realLength(state));
      updateVisibleGenes(subject, state);
      updateTrackBar(subject, state);
      refreshLinkPreview();

      if (config.cluster.alignLabels) {
        const offset = scales.offset(locus._cluster) + scales.locus(locus.uid);
        const newMin = Math.min(coordinate + offset, minPos) - 10;
        plot.selectAll("g.clusterInfo").attr(
          "transform",
          (cluster) => `translate(${newMin - scales.offset(cluster.uid)}, 0)`
        );
      } else {
        plot.select(`#${ids.clusterInfo({ uid: locus._cluster })}`).attr(
          "transform",
          `translate(${scales.locus(locus.uid) + scales.x(state.start) - 10}, 0)`
        );
      }
    };

    const dragRight = (event, locus, handle) => {
      const { state, coordinate } = interactions.trimLocus(locus, {
        edge: "right",
        position: event.x,
        coordinateFor: scales.x,
        scaleGenes: config.plot.scaleGenes,
      });
      const subject = locusSelection(locus.uid);
      handle.attr("x", coordinate);
      subject.select("rect.hover").attr("width", realLength(state));
      updateVisibleGenes(subject, state);
      updateTrackBar(subject, state);
      refreshLinkPreview();

      const locusEnd = scales.x(state.end);
      const newMax = Math.max(
        scales.offset(locus._cluster) + scales.locus(locus.uid) + locusEnd,
        maxPos
      ) + config.legend.marginLeft;
      plot.select("g.legend").attr("transform", `translate(${newMax}, 0)`);
    };

    const dragged = function (event, locus) {
      const handle = d3.select(this);
      if (handle.classed("leftHandle")) dragLeft(event, locus, handle);
      else dragRight(event, locus, handle);
    };

    const ended = (_, locus) => {
      interactions.setDragging(false);
      interactions.finalizeLocusTrim(locus);
      locusSelection(locus.uid).select("g.hover").transition().attr("opacity", 0);
      interactions.redraw();
    };

    return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
  }

  function createLinkPreview({ plot, config, scales, ids, lookup, interactions }) {
    const matrix = (selection) => {
      const transform = selection.node().transform.baseVal;
      return transform.numberOfItems ? transform.getItem(0).matrix : { e: 0, f: 0 };
    };
    const geneIsVisible = (uid) =>
      plot.select(`#${ids.gene({ uid })}`).attr("display") !== "none";
    const displayGene = (uid) => {
      const gene = lookup.gene(uid);
      return gene && { ...gene, ...interactions.getGeneState(gene) };
    };
    const areClustersAdjacent = (one, two) => {
      const order = interactions.getClusterOrder();
      return Math.abs(order.indexOf(one) - order.indexOf(two)) === 1;
    };
    const linkValues = (link) => {
      if (
        !config.link.show ||
        link.identity < config.link.threshold ||
        !geneIsVisible(link.query.uid) ||
        !geneIsVisible(link.target.uid)
      ) {
        return { anchors: null, visible: false, labelPosition: null };
      }
      const anchors = getLinkAnchors(link, {
        geneForUid: displayGene,
        areClustersAdjacent,
        scaleX: scales.x,
        horizontalOffset: (gene) =>
          scales.offset(gene._cluster) + matrix(plot.select(`#${ids.locus({ uid: gene._locus })}`)).e,
        verticalPosition: (gene) => matrix(plot.select(`#${ids.cluster({ uid: gene._cluster })}`)).f,
        geneMidpoint: config.gene.shape.tipHeight + config.gene.shape.bodyHeight / 2,
      });
      return {
        anchors,
        visible: Boolean(anchors),
        labelPosition: anchors
          ? getLinkLabelPosition(anchors, config.link.label.position)
          : null,
      };
    };

    return () => {
      const values = new Map();
      const links = plot.selectAll("g.geneLinkG");
      links.each((link) => values.set(link.uid, linkValues(link)));
      links.attr("opacity", (link) => (values.get(link.uid).visible ? 1 : 0));
      links
        .select("path.geneLink")
        .attr("d", (link) =>
          getLinkPath(values.get(link.uid).anchors, {
            asLine: config.link.asLine,
            straight: config.link.straight,
          })
        );
      links
        .select("text.geneLinkLabel")
        .attr("opacity", (link) =>
          config.link.label.show && values.get(link.uid).visible ? 1 : 0
        )
        .attr("x", (link) => values.get(link.uid).labelPosition?.x)
        .attr("y", (link) => values.get(link.uid).labelPosition?.y);
    };
  }

  function updateLoci(selection, scene, config) {
    const layout = (locus) => scene.loci.get(locus.uid);

    selection.attr("transform", (locus) => {
      const { x, y } = layout(locus).transform;
      return `translate(${x}, ${y})`;
    });
    selection
      .select("line.trackBar")
      .attr("x1", (locus) => layout(locus).track.x1)
      .attr("x2", (locus) => layout(locus).track.x2)
      .attr("y1", (locus) => layout(locus).track.y)
      .attr("y2", (locus) => layout(locus).track.y)
      .style("stroke", config.locus.trackBar.colour)
      .style("stroke-width", config.locus.trackBar.stroke);
    selection
      .selectAll("rect.hover, rect.leftHandle, rect.rightHandle")
      .attr("y", (locus) => layout(locus).hover.y)
      .attr("height", (locus) => layout(locus).hover.height);
    selection
      .select("rect.hover")
      .attr("x", (locus) => layout(locus).hover.x)
      .attr("width", (locus) => layout(locus).hover.width);
    selection
      .select("rect.leftHandle")
      .attr("x", (locus) => layout(locus).hover.leftHandleX);
    selection
      .select("rect.rightHandle")
      .attr("x", (locus) => layout(locus).hover.rightHandleX);
    return selection;
  }

  function updateGenes(selection, scene, config, scales) {
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

  function updateLinks(selection, scene, config, scales, ids) {
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
      .attr("filter", config.link.label.background ? `url(#${ids.filter})` : null)
      .style("font-size", `${config.link.label.fontSize}px`)
      .attr("x", (link) => linkLayout(link)?.labelPosition?.x)
      .attr("y", (link) => linkLayout(link)?.labelPosition?.y);
    return selection;
  }

  function arrangePlot(plot, scene, config, transition, animate) {
    const chrome = scene.chrome;
    if (!chrome) return;
    const transform = ({ x, y }) => `translate(${x}, ${y})`;
    let scale = plot
      .select("g.scaleBar")
      .classed("hidden", !config.plot.scaleGenes);
    if (animate) scale = scale.transition(transition);
    scale
      .attr("opacity", config.plot.scaleGenes ? 1 : 0)
      .attr("transform", transform(chrome.scaleBar));

    const showColour = config.link.groupColour || !config.link.show;
    let colour = plot.select("g.colourBar").classed("hidden", showColour);
    if (animate) colour = colour.transition(transition);
    colour
      .attr("opacity", showColour ? 0 : 1)
      .attr("transform", transform(chrome.colourBar));

    let key = plot.select("g.legend");
    if (animate) key = key.transition(transition);
    key.attr("transform", transform(chrome.legend));
  }

  function getScaleBar(config, scales, transition, interactions) {
    return scaleBar(scales.x)
      .stroke(config.scaleBar.stroke)
      .height(config.scaleBar.height)
      .colour(config.scaleBar.colour)
      .basePair(config.scaleBar.basePair)
      .fontSize(config.scaleBar.fontSize)
      .fontFamily(config.plot.fontFamily)
      .onClickText(() => {
        const value = prompt("Enter new length (bp):", config.scaleBar.basePair);
        if (value) interactions.setScaleBarLength(value);
      })
      .transition(transition);
  }

  function getColourBar(config, scales, transition) {
    return colourBar(scales.score)
      .width(config.colourBar.width)
      .height(config.colourBar.height)
      .fontSize(config.colourBar.fontSize)
      .fontFamily(config.plot.fontFamily)
      .transition(transition);
  }

  function getLegend(scene, config, scales, interactions) {
    let hidden = scene.genes.size ? scales.colour.domain() : [];
    for (const gene of scene.genes.values()) {
      if (gene.visible) {
        const group = scales.group(gene.source.uid);
        if (group !== null) hidden = hidden.filter((id) => id !== group);
      }
    }

    return legend(scales.colour)
      .hidden(hidden)
      .fontSize(config.legend.fontSize)
      .fontFamily(config.plot.fontFamily)
      .entryHeight(config.legend.entryHeight)
      .onClickCircle(
        config.legend.onClickCircle ||
          ((_, group) => interactions.chooseLegendColour(group))
      )
      .onClickText(config.legend.onClickText)
      .onAltClickText(config.legend.onAltClickText || interactions.showGroupMenu);
  }

  var defaultConfig = {
    plot: {
      transitionDuration: 250,
      scaleFactor: 15,
      scaleGenes: true,
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Oxygen, Cantarell, sans-serif',
    },
    legend: {
      entryHeight: 18,
      fontSize: 14,
      onClickCircle: null,
      onClickText: null,
      show: true,
      marginLeft: 20,
    },
    colourBar: {
      fontSize: 10,
      height: 12,
      show: true,
      width: 150,
      marginTop: 20,
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

  function xDistance(scaleX, start, end) {
    return scaleX(end) - scaleX(start);
  }

  function getClusterLocusRange(
    cluster,
    { scaleX, locusOffset, spacing, locusState }
  ) {
    const range = [];
    let value = 1;
    let start;
    let end;

    for (const [index, locus] of cluster.loci.entries()) {
      if (index > 0) value = range[range.length - 1] + end - start + spacing;
      const offset = locusOffset(locus.uid) || 0;
      const state = locusState ? locusState(locus) : locus;
      start = scaleX(state.start ?? state._start ?? locus.start);
      end = scaleX(state.end ?? state._end ?? locus.end);
      range.push(value - start + offset);
    }

    return range;
  }

  function getLocusScaleValues(clusters, layout) {
    const domain = [];
    const range = [];

    for (const cluster of clusters) {
      domain.push(...cluster.loci.map((locus) => locus.uid));
      range.push(...getClusterLocusRange(cluster, layout));
    }

    return { domain, range };
  }

  function getGenePolygonCoordinates(gene, { scaleX, shape }) {
    const scaledStart = scaleX(gene.start);
    const scaledEnd = scaleX(gene.end);
    const geneLength = scaledEnd - scaledStart;
    const bottom = shape.tipHeight * 2 + shape.bodyHeight;
    const midpoint = bottom / 2;
    const third = shape.tipHeight + shape.bodyHeight;
    let points;

    if (gene.strand === 1) {
      const shaft = scaledEnd - shape.tipLength;
      points = [
        scaledStart,
        shape.tipHeight,
        shaft,
        shape.tipHeight,
        shaft,
        0,
        scaledEnd,
        midpoint,
        shaft,
        bottom,
        shaft,
        third,
        scaledStart,
        third,
      ];
      if (geneLength < shape.tipLength) {
        [2, 4, 8, 10].forEach((index) => (points[index] = scaledStart));
      }
    } else {
      const shaft = scaledStart + shape.tipLength;
      points = [
        scaledEnd,
        shape.tipHeight,
        shaft,
        shape.tipHeight,
        shaft,
        0,
        scaledStart,
        midpoint,
        shaft,
        bottom,
        shaft,
        third,
        scaledEnd,
        third,
      ];
      if (geneLength < shape.tipLength) {
        [2, 4, 8, 10].forEach((index) => (points[index] = scaledEnd));
      }
    }

    return points;
  }

  function getGeneLabelTransform(gene, { scaleX, shape, label }) {
    const scaledLength = scaleX(gene.end) - scaleX(gene.start);
    const x = scaleX(gene.start) + scaledLength * label.start;
    let y;

    if (label.position === "middle") {
      y = shape.tipHeight + shape.bodyHeight / 2;
    } else if (label.position === "bottom") {
      y = 2 * shape.tipHeight + shape.bodyHeight + label.spacing;
    } else {
      y = -label.spacing;
    }

    const rotation = ["start", "middle"].includes(label.anchor)
      ? -label.rotation
      : label.rotation;
    return `translate(${x}, ${y}) rotate(${rotation})`;
  }

  function getGeneLabelDy(position) {
    switch (position) {
      case "top":
        return "-0.4em";
      case "middle":
        return "0.4em";
      case "bottom":
        return "0.8em";
      default:
        return undefined;
    }
  }

  function worldPolygon(points, x, y) {
    return points.map((point, index) => point + (index % 2 === 0 ? x : y));
  }

  /**
   * Derive renderer-neutral, world-space geometry from chart data and state.
   * The returned records contain no DOM selections and can be consumed by SVG,
   * Canvas, or an SVG export renderer.
   */
  function buildScene(
    data,
    {
      scaleX,
      scaleY,
      clusterOffset,
      locusOffset,
      getLocusState,
      getGeneState,
      areClustersAdjacent,
      shape,
      label,
      link,
      clusterLabel = () => "",
      alignLabels = true,
      chrome = null,
    }
  ) {
    const clusters = new Map();
    const loci = new Map();
    const genes = new Map();
    const links = new Map();
    const geneMidpoint = shape.tipHeight + shape.bodyHeight / 2;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const cluster of data.clusters) {
      const x = clusterOffset(cluster.uid);
      const y = scaleY(cluster.uid);
      const clusterLayout = { source: cluster, x, y, loci: [] };
      clusters.set(cluster.uid, clusterLayout);

      for (const locus of cluster.loci) {
        const state = getLocusState(locus);
        const localX = locusOffset(locus.uid);
        const start = scaleX(state.start);
        const end = scaleX(state.end);
        const worldX = x + localX;
        const locusLayout = {
          source: locus,
          cluster,
          state,
          localX,
          x: worldX,
          y,
          start,
          end,
          worldStart: worldX + start,
          worldEnd: worldX + end,
          transform: { x: localX, y: 0 },
          track: {
            x1: start,
            x2: end,
            y: geneMidpoint,
          },
          hover: {
            x: start,
            y: -10,
            width: end - start,
            height: shape.tipHeight * 2 + shape.bodyHeight + 20,
            leftHandleX: start - 8,
            rightHandleX: end,
          },
        };
        loci.set(locus.uid, locusLayout);
        clusterLayout.loci.push(locusLayout);
        minX = Math.min(minX, locusLayout.worldStart);
        maxX = Math.max(maxX, locusLayout.worldEnd);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + shape.tipHeight * 2 + shape.bodyHeight);

        for (const gene of locus.genes) {
          const display = { ...gene, ...getGeneState(gene) };
          const visible =
            display.start >= state.start && display.end <= state.end + 1;
          const localPolygon = getGenePolygonCoordinates(display, { scaleX, shape });
          genes.set(gene.uid, {
            source: gene,
            display,
            locus: locusLayout,
            visible,
            localPolygon,
            polygon: worldPolygon(localPolygon, worldX, y),
            labelTransform: getGeneLabelTransform(display, { scaleX, shape, label }),
            labelDy: getGeneLabelDy(label.position),
          });
        }
      }
    }

    const bounds =
      minX === Infinity ? null : { minX, maxX, minY, maxY };
    for (const cluster of clusters.values()) {
      const clusterMinX = cluster.loci.length
        ? Math.min(...cluster.loci.map((locus) => locus.worldStart))
        : cluster.x;
      const labelX = (alignLabels && bounds ? bounds.minX : clusterMinX) - cluster.x - 10;
      cluster.info = {
        x: labelX,
        y: 0,
        locusText: clusterLabel(cluster.source),
      };
    }

    for (const source of data.links) {
      const query = genes.get(source.query.uid);
      const target = genes.get(source.target.uid);
      let anchors = null;
      if (query && target) {
        anchors = getLinkAnchors(source, {
          geneForUid: (uid) => genes.get(uid)?.display,
          areClustersAdjacent,
          scaleX,
          horizontalOffset: (gene) => {
            const locus = loci.get(gene._locus);
            return locus ? locus.x : 0;
          },
          verticalPosition: (gene) => clusters.get(gene._cluster)?.y ?? 0,
          geneMidpoint,
        });
      }
      links.set(source.uid, {
        source,
        anchors,
        path: getLinkPath(anchors, link),
        labelPosition: anchors
          ? getLinkLabelPosition(anchors, link.labelPosition)
          : null,
        visible:
          Boolean(anchors) &&
          source.identity >= link.threshold &&
          query?.visible &&
          target?.visible,
      });
    }

    return {
      clusters,
      loci,
      genes,
      links,
      bounds,
      chrome:
        chrome && bounds
          ? {
              legend: { x: bounds.maxX + chrome.legendMarginLeft, y: 0 },
              scaleBar: { x: chrome.scaleBarX, y: bounds.maxY + chrome.scaleBarMarginTop },
              colourBar: {
                x: chrome.colourBarX,
                y: bounds.maxY + chrome.colourBarMarginTop,
              },
            }
          : null,
    };
  }

  // This is deliberately one factory per chart, not a collection of tiny API
  // factories: configuration, scales, indexes, and mutable scene state must not
  // leak between independently mounted maps.
  function createChartRuntime({ idPrefix = "" } = {}) {
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

  let nextChartInstance = 0;

  function clusterMap() {
    /* A ClusterMap plot. */

    let container = null;
    let transition = d3.transition();
    let zoom = null;
    let hasInitialView = false;
    let chartState = null;
    const api = createChartRuntime({ idPrefix: `chart-${nextChartInstance++}-` });

    api.plot.update = () => container.call(my);
    api.plot.data = (data) => my.data(data);

    function my(selection) {
      selection.each(update);
    }

    function update(data) {
      data = normalizeChartData(data);
      const chartIndex = createChartIndex(data);
      chartState = createChartState(data, chartState);
      api.setChartIndex(chartIndex);
      api.setChartState(chartState);

      // Save the container for later updates
      container = d3.select(this).attr("width", "100%").attr("height", "100%");

      // Set up the shared transition
      transition = d3.transition().duration(api.config.plot.transitionDuration);

      // Build the figure
      const svg = container
        .selectAll("svg.clusterMap")
        .data([data])
        .join(
          (enter) => {
            // Add HTML colour picker input
            enter
              .append("input")
              .attr("id", api.ids.picker)
              .attr("class", "colourPicker")
              .attr("type", "color")
              .style("position", "absolute")
              .style("opacity", 0);

            // Add tooltip element
            enter
              .append("div")
              .attr("class", "tooltip")
              .style("opacity", 0)
              .style("position", "absolute")
              .style("pointer-events", "none")
              .style("z-index", 1)
              .style("box-sizing", "border-box")
              .style("padding", "8px")
              .style("background", "white")
              .style("border", "1px solid #999")
              .style("border-radius", "4px")
              .style("box-shadow", "0 2px 8px rgba(0, 0, 0, 0.2)")
              .style("font-family", api.config.plot.fontFamily);

            // Add root SVG element
            let svg = enter
              .append("svg")
              .attr("class", "clusterMap")
              .attr("id", api.ids.root)
              .attr("cursor", "grab")
              .attr("width", "100%")
              .attr("height", "100%")
              .attr("xmlns", "http://www.w3.org/2000/svg")
              .attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

            let defs = svg.append("defs");
            let filter = defs
              .append("filter")
              .attr("id", api.ids.filter)
              .attr("x", 0)
              .attr("y", 0)
              .attr("width", 1)
              .attr("height", 1);
            filter.append("feFlood").attr("flood-color", "rgba(0, 0, 0, 0.8)");
            filter
              .append("feComposite")
              .attr("in", "SourceGraphic")
              .attr("in2", "");

            // Keep the viewport transform separate from the chart content. Layout
            // and fit-to-view measure `clusterMapG` in world coordinates, while
            // zoom/pan only transform this outer viewport group.
            const viewport = svg.append("g").attr("class", "clusterMapViewport");
            viewport.append("g").attr("class", "clusterMapG");

            // Attach pan/zoom behaviour
            zoom = d3
              .zoom()
              .scaleExtent([0, 8])
              .on("zoom", (event) => {
                setCamera(chartState, event.transform);
                applyCamera(viewport);
              })
              .on("start", () => svg.attr("cursor", "grabbing"))
              .on("end", () => svg.attr("cursor", "grab"));
            svg.call(zoom).on("dblclick.zoom", null);

            return svg;
          }
        );

      const plot = svg.select("g.clusterMapG");
      const overlay = createHtmlOverlay({
        tooltip: container.select("div.tooltip"),
        scales: api.scales,
        actions: {
          redraw: () => api.plot.update(),
          anchorGene: (gene) => api.gene.anchor(null, gene, true),
          getGroups: () => data.groups,
          setGroups: (groups) => {
            data.groups = groups;
            api.plot.update();
          },
        },
      });
      container
        .select("div.tooltip")
        .on("mouseenter", overlay.enter)
        .on("mouseleave", overlay.leave);
      applyCamera(svg.select("g.clusterMapViewport"));

      api.scale.update(data);

      // Only disable grouping if explicitly defined false
      if (data.config && data.config.updateGroups === false) {
        if (!data.groups) data.groups = [];
      } else {
        data.groups = createLinkGroups(data.links, data.groups);
      }

      api.link.updateGroups(data.groups);

      const scene = api.layout.update(data);

      renderSvg({
        plot,
        data,
        scene,
        transition,
        animate: hasInitialView,
        config: api.config,
        scales: api.scales,
        ids: api.ids,
        lookup: { gene: api.get.geneData },
        interactions: {
          isDragging: () => isDragging(chartState),
          setDragging: (dragging) => setDragging(chartState, dragging),
          getClusterOrder: () => getClusterOrder(chartState),
          moveClusterToIndex: (uid, index) =>
            moveClusterToIndex(chartState, uid, index),
          redraw: () => api.plot.update(),
          getLocusOffset: (uid) => getLocusOffset(chartState, uid),
          getLocusState: (locus) => getLocusState(chartState, locus),
          getGeneState: (gene) => getGeneState(chartState, gene),
          setLocusOffset: (uid, offset) => setLocusOffset(chartState, uid, offset),
          trimLocus: (locus, options) => trimLocus(chartState, locus, options),
          finalizeLocusTrim: (locus) => finalizeLocusTrim(chartState, locus),
          getLocusMoveBounds: (locusUid) => {
            const otherLoci = [...scene.loci.values()].filter(
              (locus) => locus.source.uid !== locusUid
            );
            const currentLocus = scene.loci.get(locusUid);
            if (!otherLoci.length) {
              return [currentLocus.worldStart, currentLocus.worldEnd];
            }
            return [
              Math.min(...otherLoci.map((locus) => locus.worldStart)),
              Math.max(...otherLoci.map((locus) => locus.worldEnd)),
            ];
          },
          flipLocus: (locus) => {
            flipLocus(chartState, locus);
            api.plot.update();
          },
          onGeneClick: api.config.gene.shape.onClick,
          showGeneMenu: overlay.showGeneMenu,
          showGroupMenu: overlay.showGroupMenu,
          setScaleBarLength: (value) => {
            api.config.scaleBar.basePair = value;
            api.plot.update();
          },
          chooseLegendColour: (group) => {
            const picker = container.select("input.colourPicker");
            picker.on("change", () => {
              group.colour = picker.node().value;
              api.plot.update();
            });
            picker.node().click();
          },
        },
      });

      if (!hasInitialView) fitInitialView(svg, plot);
    }

    function fitInitialView(svg, plot) {
      const svgNode = svg.node();
      const plotNode = plot.node();
      if (!zoom || !svgNode || !plotNode) return;

      const { width, height } = svgNode.getBoundingClientRect();
      const bounds = plotNode.getBBox();
      if (!width || !height || !bounds.width || !bounds.height) return;

      const padding = 20;
      const scale = Math.min(
        1.2,
        (width - padding * 2) / bounds.width,
        (height - padding * 2) / bounds.height
      );
      const x = (width - bounds.width * scale) / 2 - bounds.x * scale;
      const y = (height - bounds.height * scale) / 2 - bounds.y * scale;

      svg.call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
      hasInitialView = true;
    }

    function applyCamera(selection) {
      const { x, y, k } = getCamera(chartState);
      selection.attr("transform", `translate(${x}, ${y}) scale(${k})`);
    }

    my.config = function (_) {
      if (!arguments.length) return api.config;
      api.plot.updateConfig(_);
      return my;
    };
    my.data = (data) => {
      if (!data) return container.select("svg.clusterMap").datum();
      container.datum(data).call(my);
      return my;
    };

    return my;
  }

  exports.ClusterMap = clusterMap;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
