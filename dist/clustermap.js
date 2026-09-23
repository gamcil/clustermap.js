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
        geneForUid(link.query.uid).clusterUid,
        geneForUid(link.target.uid).clusterUid,
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
    const preview = previous?.preview || {
      clusterOrder: null,
      clusterPositions: new Map(),
      locusOffsets: new Map(),
      loci: new Map(),
    };
    const clusterIds = data.clusters.map((cluster) => cluster.uid);
    const clusterIdSet = new Set(clusterIds);
    const clusterOrder = [
      ...(previous?.clusterOrder || []).filter((uid) => clusterIdSet.has(uid)),
      ...clusterIds.filter((uid) => !previous?.clusterOrder?.includes(uid)),
    ];
    if (preview.clusterOrder) {
      preview.clusterOrder = [
        ...preview.clusterOrder.filter((uid) => clusterIdSet.has(uid)),
        ...clusterIds.filter((uid) => !preview.clusterOrder.includes(uid)),
      ];
    }
    if (!preview.locusOffsets) preview.locusOffsets = new Map();
    if (!preview.loci) preview.loci = new Map();
    if (!preview.clusterPositions) preview.clusterPositions = new Map();
    const present = new Set();
    for (const cluster of data.clusters) {
      if (!clusterOffsets.has(cluster.uid)) clusterOffsets.set(cluster.uid, 0);
      for (const locus of cluster.loci) {
        present.add(locus.uid);
        if (!loci.has(locus.uid)) {
          loci.set(locus.uid, {
            start: locus.start,
            end: locus.end,
            flipped: false,
            trimLeft: null,
            trimRight: null,
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
    for (const uid of preview.locusOffsets.keys()) {
      if (!loci.has(uid)) preview.locusOffsets.delete(uid);
    }
    for (const uid of preview.clusterPositions.keys()) {
      if (!clusterIdSet.has(uid)) preview.clusterPositions.delete(uid);
    }
    for (const uid of preview.loci.keys()) {
      if (!loci.has(uid)) preview.loci.delete(uid);
    }
    return { loci, genes, clusterOffsets, locusOffsets, clusterOrder, camera, dragging, preview };
  }

  function isDragging(chartState) {
    return chartState.dragging;
  }

  function setDragging(chartState, dragging) {
    chartState.dragging = dragging;
  }

  function getClusterOrder(chartState) {
    return chartState.preview.clusterOrder || chartState.clusterOrder;
  }

  function setPreviewClusterOrder(chartState, order) {
    chartState.preview.clusterOrder = [...order];
  }

  function getClusterPosition(chartState, uid, fallback) {
    return chartState.preview.clusterPositions.get(uid) ?? fallback;
  }

  function setPreviewClusterPosition(chartState, uid, position) {
    chartState.preview.clusterPositions.set(uid, position);
  }

  function commitPreviewClusterOrder(chartState) {
    if (chartState.preview.clusterOrder) {
      chartState.clusterOrder = chartState.preview.clusterOrder;
      chartState.preview.clusterOrder = null;
    }
    chartState.preview.clusterPositions.clear();
    return chartState.clusterOrder;
  }

  function getClusterOffset(chartState, uid) {
    return chartState.clusterOffsets.get(uid) ?? 0;
  }

  function setClusterOffset(chartState, uid, offset) {
    chartState.clusterOffsets.set(uid, offset);
  }

  function getLocusOffset(chartState, uid) {
    return chartState.preview.locusOffsets.get(uid) ?? getCommittedLocusOffset(chartState, uid);
  }

  function getCommittedLocusOffset(chartState, uid) {
    return chartState.locusOffsets.get(uid) ?? 0;
  }

  function setLocusOffset(chartState, uid, offset) {
    chartState.locusOffsets.set(uid, offset);
  }

  function setPreviewLocusOffset(chartState, uid, offset) {
    chartState.preview.locusOffsets.set(uid, offset);
  }

  function commitPreviewLocusOffset(chartState, uid) {
    const offset = chartState.preview.locusOffsets.get(uid);
    if (offset !== undefined) {
      chartState.locusOffsets.set(uid, offset);
      chartState.preview.locusOffsets.delete(uid);
    }
    return getCommittedLocusOffset(chartState, uid);
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
    return chartState.preview.loci.get(locus.uid) || chartState.loci.get(locus.uid);
  }

  function getGeneState(chartState, gene) {
    return chartState.genes.get(`${gene.locusUid}:${gene.uid}`);
  }

  function formatLocusText(loci, chartState, hideCoordinates) {
    return loci
      .map((locus) => {
        let start;
        let end;

        const state = getLocusState(chartState, locus);
        if (locus.bio) {
          let startDiff = state.start - locus.start;
          let endDiff = locus.end - state.end;
          if (state.flipped) [startDiff, endDiff] = [endDiff, startDiff];
          start = locus.bio.start + startDiff + 1;
          end = locus.bio.end - endDiff;
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

  /**
   * Synchronize derived display coordinates after a trim, flip, or a change to
   * unscaled-gene mode. This is state work: it deliberately does not depend on
   * a renderer or a D3 scale.
   */
  function synchronizeLocusState(chartState, locus, scaleGenes) {
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

  function boundaryIndex(values, target, edge) {
    let low = 0;
    let high = values.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (values[middle] < target) low = middle + 1;
      else high = middle;
    }
    if (edge === "left") return Math.min(low, values.length - 1);
    if (low === 0) return 0;
    if (low === values.length) return values.length - 1;
    return target - values[low - 1] <= values[low] - target ? low - 1 : low;
  }

  /**
   * Apply a trim at the display boundary under a resize handle. The left handle
   * rounds forward to a gene start; the right handle selects the nearest gene
   * end, matching the drawn gene geometry.
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
      const index = boundaryIndex(boundaries.map(coordinateFor), position, edge);
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
      const index = boundaryIndex(boundaries.map(coordinateFor), position, edge);
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

  function previewLocusTrim(chartState, locus, options) {
    if (!chartState.preview.loci.has(locus.uid)) {
      chartState.preview.loci.set(locus.uid, { ...chartState.loci.get(locus.uid) });
    }
    return trimLocus(chartState, locus, options);
  }

  function commitPreviewLocusState(chartState, locus) {
    const state = chartState.preview.loci.get(locus.uid);
    if (!state) return getLocusState(chartState, locus);
    chartState.loci.set(locus.uid, state);
    chartState.preview.loci.delete(locus.uid);
    return state;
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
      const clusterGenes = anchorsByCluster.get(gene.clusterUid) || [];
      clusterGenes.push(gene);
      anchorsByCluster.set(gene.clusterUid, clusterGenes);
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

  function normalizeGene(gene, locusUid, clusterUid) {
    return {
      ...gene,
      locusUid,
      clusterUid,
      bio: gene.bio || {
        start: gene.start,
        end: gene.end,
        strand: gene.strand,
      },
    };
  }

  function normalizeLocus(locus, clusterUid) {
    const bio = locus.bio || { start: locus.start, end: locus.end };
    return {
      ...locus,
      clusterUid,
      bio,
      start: 0,
      end: bio.end - bio.start,
      genes: locus.genes.map((gene) =>
        normalizeGene(gene, locus.uid, clusterUid)
      ),
    };
  }

  function normalizeChartData(data) {
    return {
      ...data,
      clusters: data.clusters.map((cluster) => ({
        ...cluster,
        loci: cluster.loci.map((locus) => normalizeLocus(locus, cluster.uid)),
      })),
      links: [...data.links],
      groups: data.groups?.map((group) => ({
        ...group,
        genes: group.genes ? [...group.genes] : group.genes,
      })),
    };
  }

  // Browser-only tooltip lifecycle shared by any chart renderer. Menu content is
  // supplied by the caller because those controls may dispatch chart actions.
  function createHtmlOverlay({ tooltip, scales, actions }) {
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

  // Translates renderer-independent pointer coordinates into chart-state actions.
  // Renderers only need to forward pointer events in chart-world coordinates.
  function createInteractionController({
    clusterRows,
    getClusterOrder,
    getClusterPosition,
    getLocusOffset,
    setDragging,
    previewClusterDrag,
    commitClusterOrder,
    previewLocusOffset,
    commitLocusOffset,
    previewLocusTrim,
    commitLocusTrim,
    flipLocus,
  }) {
    let clusterDrag = null;
    let locusDrag = null;

    const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));

    return {
      beginClusterDrag(uid, pointerY) {
        clusterDrag = {
          uid,
          order: [...getClusterOrder()],
          pointerOffset: getClusterPosition(uid) - pointerY,
        };
        setDragging(true);
      },

      moveClusterDrag(pointerY) {
        if (!clusterDrag) return;
        const range = clusterRows();
        const y = clamp(pointerY + clusterDrag.pointerOffset, [range[0], range.at(-1)]);
        const targetIndex = range.reduce(
          (closest, position, index) =>
            Math.abs(position - y) < Math.abs(range[closest] - y) ? index : closest,
          0
        );
        const currentIndex = clusterDrag.order.indexOf(clusterDrag.uid);
        let order = null;
        if (targetIndex !== currentIndex) {
          clusterDrag.order.splice(currentIndex, 1);
          clusterDrag.order.splice(targetIndex, 0, clusterDrag.uid);
          order = clusterDrag.order;
        }
        previewClusterDrag(clusterDrag.uid, y, order);
      },

      endClusterDrag() {
        if (!clusterDrag) return;
        clusterDrag = null;
        setDragging(false);
        commitClusterOrder();
      },

      beginLocusDrag(uid, pointerX) {
        locusDrag = {
          uid,
          pointerStart: pointerX,
          initialOffset: getLocusOffset(uid),
        };
        setDragging(true);
      },

      moveLocusDrag(pointerX) {
        if (!locusDrag) return;
        previewLocusOffset(
          locusDrag.uid,
          locusDrag.initialOffset + pointerX - locusDrag.pointerStart
        );
      },

      endLocusDrag() {
        if (!locusDrag) return;
        const { uid } = locusDrag;
        locusDrag = null;
        setDragging(false);
        commitLocusOffset(uid);
      },

      beginLocusTrim() {
        setDragging(true);
      },

      moveLocusTrim(locus, edge, pointerX) {
        previewLocusTrim(locus, edge, pointerX);
      },

      endLocusTrim(locus) {
        setDragging(false);
        commitLocusTrim(locus);
      },

      flipLocus,
    };
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

  const DEFAULT_CELL_WIDTH = 100;
  const DEFAULT_CELL_HEIGHT = 50;

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function validBounds(bounds) {
    return (
      bounds &&
      Number.isFinite(bounds.minX) &&
      Number.isFinite(bounds.maxX) &&
      Number.isFinite(bounds.minY) &&
      Number.isFinite(bounds.maxY)
    );
  }

  function intersects(one, two) {
    return (
      one.minX <= two.maxX &&
      one.maxX >= two.minX &&
      one.minY <= two.maxY &&
      one.maxY >= two.minY
    );
  }

  /**
   * Index world-space rectangular extents in a uniform grid. The index stores
   * IDs only; callers retain ownership of the scene records and draw order.
   */
  function createSpatialIndex(
    records,
    { cellWidth = DEFAULT_CELL_WIDTH, cellHeight = DEFAULT_CELL_HEIGHT } = {}
  ) {
    const cells = new Map();
    const boundsById = new Map();
    const orderById = new Map();
    let order = 0;
    for (const [id, bounds] of records) {
      if (!validBounds(bounds)) continue;
      boundsById.set(id, bounds);
      orderById.set(id, order);
      order += 1;
      const minColumn = Math.floor(bounds.minX / cellWidth);
      const maxColumn = Math.floor(bounds.maxX / cellWidth);
      const minRow = Math.floor(bounds.minY / cellHeight);
      const maxRow = Math.floor(bounds.maxY / cellHeight);
      for (let column = minColumn; column <= maxColumn; column += 1) {
        for (let row = minRow; row <= maxRow; row += 1) {
          const key = cellKey(column, row);
          if (!cells.has(key)) cells.set(key, new Set());
          cells.get(key).add(id);
        }
      }
    }
    return { cells, boundsById, orderById, cellWidth, cellHeight };
  }

  /** Return candidate IDs whose exact bounds intersect a world-space viewport. */
  function queryViewport(index, viewport) {
    if (!validBounds(viewport)) return new Set();
    const matches = new Set();
    const minColumn = Math.floor(viewport.minX / index.cellWidth);
    const maxColumn = Math.floor(viewport.maxX / index.cellWidth);
    const minRow = Math.floor(viewport.minY / index.cellHeight);
    const maxRow = Math.floor(viewport.maxY / index.cellHeight);
    for (let column = minColumn; column <= maxColumn; column += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        for (const id of index.cells.get(cellKey(column, row)) || []) {
          if (intersects(index.boundsById.get(id), viewport)) matches.add(id);
        }
      }
    }
    return matches;
  }

  /**
   * Return viewport candidates in the order they were added to the index. This
   * preserves deterministic painter order while allowing a renderer to visit
   * only visible records.
   */
  function queryViewportOrdered(index, viewport) {
    return [...queryViewport(index, viewport)].sort(
      (left, right) => index.orderById.get(left) - index.orderById.get(right)
    );
  }

  function pointCandidates(index, point) {
    return [...queryViewport(index, {
      minX: point.x,
      maxX: point.x,
      minY: point.y,
      maxY: point.y,
    })].filter((id) => {
      const bounds = index.boundsById.get(id);
      return (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.y >= bounds.minY &&
        point.y <= bounds.maxY
      );
    });
  }

  /** Return point candidates in the order they were added to the index. */
  function queryPointOrdered(index, point) {
    return pointCandidates(index, point).sort(
      (left, right) => index.orderById.get(left) - index.orderById.get(right)
    );
  }

  function containsRect({ x, y, width, height }, point) {
    return (
      point.x >= x &&
      point.x <= x + width &&
      point.y >= y &&
      point.y <= y + height
    );
  }

  function pointOnSegment(point, start, end) {
    const cross =
      (point.y - start.y) * (end.x - start.x) -
      (point.x - start.x) * (end.y - start.y);
    if (Math.abs(cross) > Number.EPSILON) return false;
    return (
      point.x >= Math.min(start.x, end.x) &&
      point.x <= Math.max(start.x, end.x) &&
      point.y >= Math.min(start.y, end.y) &&
      point.y <= Math.max(start.y, end.y)
    );
  }

  function containsPolygon({ points }, point) {
    let inside = false;
    for (let index = 0, previous = points.length - 2; index < points.length; previous = index, index += 2) {
      const start = { x: points[previous], y: points[previous + 1] };
      const end = { x: points[index], y: points[index + 1] };
      if (pointOnSegment(point, start, end)) return true;
      const crosses = (start.y > point.y) !== (end.y > point.y);
      if (crosses && point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x) {
        inside = !inside;
      }
    }
    return inside;
  }

  function contains(region, point) {
    if (region.type === "rect") return containsRect(region, point);
    if (region.type === "polygon") return containsPolygon(region, point);
    return false;
  }

  /**
   * Returns the topmost semantic interaction target at a chart-world point.
   * The spatial indexes limit precise region tests to records whose extents
   * contain the pointer. Reverse painter order gives genes and trim handles
   * precedence over a locus move region.
   */
  function hitTest(scene, point) {
    if (scene.index?.genes && scene.index?.hitLoci && scene.hitRegions.genes && scene.hitRegions.loci) {
      for (const uid of queryPointOrdered(scene.index.genes, point).reverse()) {
        const region = scene.hitRegions.genes.get(uid);
        if (region && contains(region, point)) return region;
      }
      for (const uid of queryPointOrdered(scene.index.hitLoci, point).reverse()) {
        const regions = scene.hitRegions.loci.get(uid);
        for (const region of [regions?.trimRight, regions?.trimLeft, regions?.move]) {
          if (region && contains(region, point)) return region;
        }
      }
      return null;
    }
    for (let index = scene.hitRegions.all.length - 1; index >= 0; index -= 1) {
      const region = scene.hitRegions.all[index];
      if (contains(region, point)) return region;
    }
    return null;
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

  function getGeneLabelLayout(gene, { scaleX, shape, label }) {
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

    return {
      x,
      y,
      rotation: ["start", "middle"].includes(label.anchor)
        ? -label.rotation
        : label.rotation,
    };
  }

  function getGeneLabelTransform(gene, options) {
    const { x, y, rotation } = getGeneLabelLayout(gene, options);
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

    if (!areClustersAdjacent(query.clusterUid, target.clusterUid)) return null;

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

  function worldPolygon(points, x, y) {
    return points.map((point, index) => point + (index % 2 === 0 ? x : y));
  }

  function boundsFromPoints(points) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < points.length; index += 2) {
      minX = Math.min(minX, points[index]);
      maxX = Math.max(maxX, points[index]);
      minY = Math.min(minY, points[index + 1]);
      maxY = Math.max(maxY, points[index + 1]);
    }
    return { minX, maxX, minY, maxY };
  }

  function boundsFromLinkAnchors(anchors) {
    if (!anchors) return null;
    const [ax1, ax2, ay, bx1, bx2, by] = anchors;
    return {
      minX: Math.min(ax1, ax2, bx1, bx2),
      maxX: Math.max(ax1, ax2, bx1, bx2),
      minY: Math.min(ay, by),
      maxY: Math.max(ay, by),
    };
  }

  function boundsFromRegions(regions) {
    if (!regions.length) return null;
    return {
      minX: Math.min(...regions.map((region) => region.x)),
      maxX: Math.max(...regions.map((region) => region.x + region.width)),
      minY: Math.min(...regions.map((region) => region.y)),
      maxY: Math.max(...regions.map((region) => region.y + region.height)),
    };
  }

  function clusterPairKey(left, right) {
    return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
  }

  function formatKilobases(basePairs) {
    return `${+(basePairs / 1000).toFixed(1)}kb`;
  }

  function buildChrome(bounds, genes, chrome) {
    if (!bounds || !chrome) return null;

    const visibleGroupIds = new Set();
    for (const gene of genes.values()) {
      if (!gene.visible) continue;
      const groupUid = chrome.legend.groupForGene(gene.source.uid);
      if (groupUid !== null) visibleGroupIds.add(groupUid);
    }

    const groups = chrome.legend.groups.filter(
      (group) => !group.hidden && visibleGroupIds.has(group.uid)
    );
    const totalHeight = chrome.legend.entryHeight * groups.length;
    const step = groups.length > 1 ? totalHeight / (groups.length - 0.5) : totalHeight;
    const radius = step / 4;
    const legend = {
      visible: chrome.legend.show,
      position: { x: bounds.maxX + chrome.legend.marginLeft, y: 0 },
      fontSize: chrome.legend.fontSize,
      fontFamily: chrome.legend.fontFamily,
      items: groups.map((group, index) => ({
        uid: group.uid,
        source: group,
        label: group.label,
        colour: chrome.legend.colourForGroup(group.uid),
        x: 0,
        y: index * step,
        radius,
        circleY: radius,
        textX: radius + 6,
        textY: radius + 1,
      })),
    };

    const scaleBarLength = chrome.scaleBar.coordinateFor(chrome.scaleBar.basePair);
    const scaleBar = {
      visible: chrome.scaleBar.show,
      position: {
        x: chrome.scaleBar.x,
        y: bounds.maxY + chrome.scaleBar.marginTop,
      },
      length: scaleBarLength,
      basePair: chrome.scaleBar.basePair,
      height: chrome.scaleBar.height,
      middle: chrome.scaleBar.height / 2,
      label: formatKilobases(chrome.scaleBar.basePair),
      colour: chrome.scaleBar.colour,
      strokeWidth: chrome.scaleBar.strokeWidth,
      fontSize: chrome.scaleBar.fontSize,
      fontFamily: chrome.scaleBar.fontFamily,
    };

    const colourBar = {
      visible: chrome.colourBar.show && !chrome.link.groupColour && chrome.link.show,
      position: {
        x: chrome.colourBar.x,
        y: bounds.maxY + chrome.colourBar.marginTop,
      },
      width: chrome.colourBar.width,
      height: chrome.colourBar.height,
      fontSize: chrome.colourBar.fontSize,
      fontFamily: chrome.colourBar.fontFamily,
      startColour: chrome.colourBar.scoreColour(0),
      endColour: chrome.colourBar.scoreColour(1),
      label: "Identity (%)",
      startLabel: "0",
      endLabel: "100",
    };

    return { legend, scaleBar, colourBar };
  }

  function buildHitRegions(loci, genes) {
    const locusRegions = new Map();
    const geneRegions = new Map();
    const all = [];

    for (const locus of loci.values()) {
      const { source, worldStart, worldEnd, y, hover } = locus;
      const move = {
        type: "rect",
        action: "move-locus",
        locusUid: source.uid,
        x: worldStart,
        y: y + hover.y,
        width: worldEnd - worldStart,
        height: hover.height,
      };
      const trimLeft = {
        type: "rect",
        action: "trim-locus-left",
        locusUid: source.uid,
        x: worldStart + hover.leftHandleX - hover.x,
        y: y + hover.y,
        width: hover.x - hover.leftHandleX,
        height: hover.height,
      };
      const trimRight = {
        type: "rect",
        action: "trim-locus-right",
        locusUid: source.uid,
        x: worldEnd,
        y: y + hover.y,
        width: 8,
        height: hover.height,
      };
      const regions = { move, trimLeft, trimRight };
      locusRegions.set(source.uid, regions);
      all.push(move, trimLeft, trimRight);
    }

    for (const gene of genes.values()) {
      if (!gene.visible) continue;
      const region = {
        type: "polygon",
        action: "gene",
        geneUid: gene.source.uid,
        points: gene.polygon,
      };
      geneRegions.set(gene.source.uid, region);
      all.push(region);
    }

    return { all, loci: locusRegions, genes: geneRegions };
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
      clusterPosition = scaleY,
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
    const linksByClusterPair = new Map();
    const geneMidpoint = shape.tipHeight + shape.bodyHeight / 2;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const cluster of data.clusters) {
      const x = clusterOffset(cluster.uid);
      const y = clusterPosition(cluster.uid);
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
          bounds: {
            minX: worldX + start,
            maxX: worldX + end,
            minY: y - 10,
            maxY: y + shape.tipHeight * 2 + shape.bodyHeight + 10,
          },
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
          genes: [],
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
          const polygon = worldPolygon(localPolygon, worldX, y);
          const geneLayout = {
            source: gene,
            display,
            locus: locusLayout,
            visible,
            localPolygon,
            polygon,
            bounds: boundsFromPoints(polygon),
            label: getGeneLabelLayout(display, { scaleX, shape, label }),
            labelTransform: getGeneLabelTransform(display, { scaleX, shape, label }),
            labelDy: getGeneLabelDy(label.position),
          };
          genes.set(gene.uid, geneLayout);
          locusLayout.genes.push(geneLayout);
        }
      }
      clusterLayout.bounds = clusterLayout.loci.length
        ? {
            minX: Math.min(...clusterLayout.loci.map((locus) => locus.bounds.minX)),
            maxX: Math.max(...clusterLayout.loci.map((locus) => locus.bounds.maxX)),
            minY: Math.min(...clusterLayout.loci.map((locus) => locus.bounds.minY)),
            maxY: Math.max(...clusterLayout.loci.map((locus) => locus.bounds.maxY)),
          }
        : null;
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

    for (const [order, source] of data.links.entries()) {
      const query = genes.get(source.query.uid);
      const target = genes.get(source.target.uid);
      let anchors = null;
      if (query && target) {
        anchors = getLinkAnchors(source, {
          geneForUid: (uid) => genes.get(uid)?.display,
          areClustersAdjacent,
          scaleX,
          horizontalOffset: (gene) => {
            const locus = loci.get(gene.locusUid);
            return locus ? locus.x : 0;
          },
          verticalPosition: (gene) => clusters.get(gene.clusterUid)?.y ?? 0,
          geneMidpoint,
        });
      }
      const linkLayout = {
        source,
        order,
        anchors,
        bounds: boundsFromLinkAnchors(anchors),
        path: getLinkPath(anchors, link),
        labelPosition: anchors
          ? getLinkLabelPosition(anchors, link.labelPosition)
          : null,
        visible:
          Boolean(anchors) &&
          source.identity >= link.threshold &&
          query?.visible &&
          target?.visible,
      };
      links.set(source.uid, linkLayout);
      if (query && target) {
        const key = clusterPairKey(query.locus.cluster.uid, target.locus.cluster.uid);
        const pairLinks = linksByClusterPair.get(key) || [];
        pairLinks.push(source.uid);
        linksByClusterPair.set(key, pairLinks);
      }
    }

    const hitRegions = buildHitRegions(loci, genes);
    return {
      clusters,
      loci,
      genes,
      links,
      linksByClusterPair,
      bounds,
      index: {
        genes: createSpatialIndex([...genes].map(([uid, gene]) => [uid, gene.bounds])),
        loci: createSpatialIndex([...loci].map(([uid, locus]) => [uid, locus.bounds])),
        links: createSpatialIndex([...links].map(([uid, link]) => [uid, link.bounds])),
        hitLoci: createSpatialIndex(
          [...hitRegions.loci].map(([uid, regions]) => [
            uid,
            boundsFromRegions([regions.move, regions.trimLeft, regions.trimRight]),
          ])
        ),
      },
      hitRegions,
      chrome: buildChrome(bounds, genes, chrome),
    };
  }

  /**
   * Describe a transient locus translation relative to an already projected
   * scene. This is deliberately a sparse, renderer-neutral patch: it avoids
   * rebuilding the scene while a drag is in progress.
   */
  function createLocusOffsetPreview(scene, locusUid, offset, { alignLabels }) {
    const locus = scene.loci.get(locusUid);
    if (!locus) return null;
    const offsetX = offset - locus.localX;
    const clusters = [...scene.clusters.values()];
    const minStart = (loci) => Math.min(...loci.map((candidate) => candidate.worldStart));
    const clusterLabelOffsets = new Map();

    if (alignLabels) {
      const oldStart = minStart([...scene.loci.values()]);
      const newStart = Math.min(
        ...[...scene.loci.values()].map((candidate) =>
          candidate.source.uid === locusUid ? candidate.worldStart + offsetX : candidate.worldStart
        )
      );
      const labelOffset = newStart - oldStart;
      for (const cluster of clusters) clusterLabelOffsets.set(cluster.source.uid, labelOffset);
    } else {
      const cluster = scene.clusters.get(locus.cluster.uid);
      const oldStart = minStart(cluster.loci);
      const newStart = Math.min(
        ...cluster.loci.map((candidate) =>
          candidate.source.uid === locusUid ? candidate.worldStart + offsetX : candidate.worldStart
        )
      );
      clusterLabelOffsets.set(cluster.source.uid, newStart - oldStart);
    }

    return {
      type: "locus-offset",
      locusUid,
      offsetX,
      clusterLabelOffsets,
    };
  }

  /**
   * Describe a transient trim using the current scene and updated locus-scale
   * offsets. The controller updates scales (but not the scene) before calling
   * this, so sibling loci retain their correct packed positions without a full
   * data-to-scene projection for every pointer event.
   */
  function createLocusTrimPreview(
    scene,
    locusUid,
    state,
    { localXFor, scaleX, alignLabels }
  ) {
    const locus = scene.loci.get(locusUid);
    if (!locus) return null;

    const locusOffsets = new Map();
    for (const candidate of scene.loci.values()) {
      locusOffsets.set(candidate.source.uid, localXFor(candidate.source.uid) - candidate.localX);
    }
    const offsetFor = (candidate) => locusOffsets.get(candidate.source.uid) || 0;
    const trimmed = {
      worldStart: locus.x + offsetFor(locus) + scaleX(state.start),
      worldEnd: locus.x + offsetFor(locus) + scaleX(state.end),
      track: {
        ...locus.track,
        x1: scaleX(state.start),
        x2: scaleX(state.end),
      },
      hover: {
        ...locus.hover,
        x: scaleX(state.start),
        width: scaleX(state.end) - scaleX(state.start),
        leftHandleX: scaleX(state.start) - 8,
        rightHandleX: scaleX(state.end),
      },
    };
    const locusGeometry = new Map([[locusUid, trimmed]]);
    const startFor = (candidate) =>
      candidate.source.uid === locusUid
        ? trimmed.worldStart
        : candidate.worldStart + offsetFor(candidate);
    const endFor = (candidate) =>
      candidate.source.uid === locusUid
        ? trimmed.worldEnd
        : candidate.worldEnd + offsetFor(candidate);
    const geneVisibility = new Map();
    for (const gene of scene.genes.values()) {
      if (gene.locus.source.uid !== locusUid) continue;
      geneVisibility.set(
        gene.source.uid,
        gene.display.start >= state.start && gene.display.end <= state.end + 1
      );
    }

    const clusterLabelOffsets = new Map();
    const minStart = (loci, start = (candidate) => candidate.worldStart) =>
      Math.min(...loci.map(start));
    if (alignLabels) {
      const oldStart = minStart([...scene.loci.values()]);
      const newStart = minStart([...scene.loci.values()], startFor);
      for (const cluster of scene.clusters.values()) {
        clusterLabelOffsets.set(cluster.source.uid, newStart - oldStart);
      }
    } else {
      for (const cluster of scene.clusters.values()) {
        const oldStart = minStart(cluster.loci);
        const newStart = minStart(cluster.loci, startFor);
        clusterLabelOffsets.set(cluster.source.uid, newStart - oldStart);
      }
    }

    const maxX = Math.max(...[...scene.loci.values()].map(endFor));
    const chrome = scene.chrome
      ? {
          ...scene.chrome,
          legend: {
            ...scene.chrome.legend,
            position: {
              ...scene.chrome.legend.position,
              x: scene.chrome.legend.position.x + maxX - scene.bounds.maxX,
            },
          },
        }
      : null;
    return {
      type: "locus-trim",
      locusUid,
      locusOffsets,
      loci: locusGeometry,
      geneVisibility,
      clusterLabelOffsets,
      chrome,
    };
  }

  /**
   * Describe the temporary rows of a cluster drag relative to an existing
   * scene. The active cluster follows the pointer; every other cluster snaps to
   * its row in the preview order.
   */
  function createClusterDragPreview(scene, { clusterUid, position, order, rows }) {
    const clusterOffsets = new Map();
    const clusterOrder = new Map();
    for (const [index, uid] of order.entries()) {
      const cluster = scene.clusters.get(uid);
      if (!cluster) continue;
      const y = uid === clusterUid ? position : rows[index];
      clusterOffsets.set(uid, y - cluster.y);
      clusterOrder.set(uid, index);
    }
    return { type: "cluster-drag", clusterUid, clusterOffsets, clusterOrder };
  }

  function canvasWorldPoint(canvas, event, camera) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - camera.x) / camera.k,
      y: (event.clientY - bounds.top - camera.y) / camera.k,
    };
  }

  /**
   * Return the portion of chart-world space covered by a Canvas. A small
   * screen-space margin prevents records from popping at its edge while panning.
   */
  function canvasWorldViewport(canvas, camera, overscan = 20) {
    const bounds = canvas.getBoundingClientRect();
    const margin = overscan / camera.k;
    return {
      minX: -camera.x / camera.k - margin,
      maxX: (bounds.width - camera.x) / camera.k + margin,
      minY: -camera.y / camera.k - margin,
      maxY: (bounds.height - camera.y) / camera.k + margin,
    };
  }

  function clusterLabelHit(context, scene, point, config) {
    for (const cluster of [...scene.clusters.values()].reverse()) {
      const anchorX = cluster.x + cluster.info.x;
      const nameFont = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
      const locusFont = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
      context.save();
      context.font = nameFont;
      const nameWidth = context.measureText(cluster.source.name || "").width;
      context.font = locusFont;
      const locusWidth = context.measureText(cluster.info.locusText).width;
      context.restore();
      const width = Math.max(nameWidth, locusWidth);
      if (
        point.x >= anchorX - width &&
        point.x <= anchorX &&
        point.y >= cluster.y - config.cluster.nameFontSize &&
        point.y <= cluster.y + config.cluster.lociFontSize + 12
      ) {
        return { action: "move-cluster", clusterUid: cluster.source.uid };
      }
    }
    return null;
  }

  function chromeHit(context, scene, point) {
    const chrome = scene.chrome;
    if (!chrome) return null;

    const { legend, scaleBar } = chrome;
    if (legend.visible) {
      context.save();
      context.font = `${legend.fontSize}px ${legend.fontFamily}`;
      for (const item of [...legend.items].reverse()) {
        const x = legend.position.x + item.x;
        const y = legend.position.y + item.y;
        const circleX = x;
        const circleY = y + item.circleY;
        if (Math.hypot(point.x - circleX, point.y - circleY) <= item.radius) {
          context.restore();
          return { action: "legend-colour", group: item.source };
        }
        const textX = x + item.textX;
        const textWidth = context.measureText(item.label).width;
        if (
          point.x >= textX &&
          point.x <= textX + textWidth &&
          point.y >= y + item.textY - legend.fontSize / 2 &&
          point.y <= y + item.textY + legend.fontSize / 2
        ) {
          context.restore();
          return { action: "legend-text", group: item.source };
        }
      }
      context.restore();
    }

    if (scaleBar.visible) {
      const x = scaleBar.position.x + scaleBar.length / 2;
      const y = scaleBar.position.y + scaleBar.height + 5;
      context.save();
      context.font = `${scaleBar.fontSize}px ${scaleBar.fontFamily}`;
      const width = context.measureText(scaleBar.label).width;
      context.restore();
      if (
        point.x >= x - width / 2 &&
        point.x <= x + width / 2 &&
        point.y >= y &&
        point.y <= y + scaleBar.fontSize
      ) {
        return { action: "scale-bar" };
      }
    }

    return null;
  }

  function hitTestCanvas({ canvas, scene, camera, config, event }) {
    const point = canvasWorldPoint(canvas, event, camera);
    const context = canvas.getContext("2d");
    return hitTest(scene, point) || clusterLabelHit(context, scene, point, config) || chromeHit(context, scene, point);
  }

  function polygon(context, points) {
    context.beginPath();
    context.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) {
      context.lineTo(points[index], points[index + 1]);
    }
    context.closePath();
  }

  function drawLink(context, layout, source, config, scales, geometry = {}) {
    const visible = geometry.visible ?? layout.visible;
    const anchors = geometry.anchors ?? layout.anchors;
    if (!visible || !anchors) return;
    let [ax1, ax2, ay, bx1, bx2, by] = anchors;
    ax1 += geometry.a || 0;
    ax2 += geometry.a || 0;
    bx1 += geometry.b || 0;
    bx2 += geometry.b || 0;
    const aMid = (ax1 + ax2) / 2;
    const bMid = (bx1 + bx2) / 2;
    const group = scales.group(source.query.uid);
    const colour = scales.colour(group);
    const score = scales.score(source.identity);

    context.beginPath();
    if (config.link.asLine) {
      context.moveTo(aMid, ay);
      if (config.link.straight) context.lineTo(bMid, by);
      else {
        const middle = (ay + by) / 2;
        context.bezierCurveTo(aMid, middle, bMid, middle, bMid, by);
      }
      context.strokeStyle = config.link.groupColour ? rgbaToRgb(colour) : score;
    } else {
      context.moveTo(ax2, ay);
      if (config.link.straight) {
        context.lineTo(bx2, by);
        context.lineTo(bx1, by);
        context.lineTo(ax1, ay);
      } else {
        const middle = ay + Math.abs(by - ay) / 2;
        context.bezierCurveTo(ax2, middle, bx2, middle, bx2, by);
        context.lineTo(bx1, by);
        context.bezierCurveTo(bx1, middle, ax1, middle, ax1, ay);
      }
      context.closePath();
      context.fillStyle = config.link.groupColour ? rgbaToRgb(colour) : score;
      context.fill();
      context.strokeStyle = config.link.groupColour ? colour : "black";
    }
    context.lineWidth = config.link.strokeWidth;
    context.stroke();

    if (config.link.label.show && (geometry.labelPosition || layout.labelPosition)) {
      const labelPosition = geometry.labelPosition || {
        x: aMid + (bMid - aMid) * config.link.label.position,
        y: ay + Math.abs(by - ay) * config.link.label.position,
      };
      context.fillStyle = "white";
      context.font = `${config.link.label.fontSize}px ${config.plot.fontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.fillText(source.identity.toFixed(2), labelPosition.x, labelPosition.y);
    }
  }

  function drawClusterInfo(context, cluster, config, { x: offsetX = 0, y: offsetY = 0 } = {}) {
    const { x, y } = cluster;
    const anchorX = x + cluster.info.x + offsetX;
    context.fillStyle = "black";
    context.textAlign = "end";
    context.font = `bold ${config.cluster.nameFontSize}px ${config.plot.fontFamily}`;
    context.textBaseline = "alphabetic";
    context.fillText(cluster.source.name, anchorX, y + offsetY + 8);
    context.font = `${config.cluster.lociFontSize}px ${config.plot.fontFamily}`;
    context.textBaseline = "top";
    context.fillText(cluster.info.locusText, anchorX, y + offsetY + 12);
  }

  function drawGene(
    context,
    gene,
    config,
    scales,
    { x: offsetX = 0, y: offsetY = 0 } = {},
    visible = gene.visible
  ) {
    if (!visible) return;
    context.save();
    context.translate(offsetX, offsetY);
    polygon(context, gene.polygon);
    const group = scales.group(gene.source.uid);
    context.fillStyle = gene.source.colour || scales.colour(group);
    context.strokeStyle = config.gene.shape.stroke;
    context.lineWidth = config.gene.shape.strokeWidth;
    context.fill();
    context.stroke();

    if (!config.gene.label.show) {
      context.restore();
      return;
    }
    const { x, y, rotation } = gene.label;
    context.save();
    context.translate(gene.locus.x + x, gene.locus.y + y);
    context.rotate((rotation * Math.PI) / 180);
    context.fillStyle = "black";
    context.font = `${config.gene.label.fontSize}px ${config.plot.fontFamily}`;
    context.textAlign = config.gene.label.anchor === "middle" ? "center" : config.gene.label.anchor;
    context.textBaseline = "alphabetic";
    context.fillText(gene.source.label || gene.source.uid, 0, 0);
    context.restore();
    context.restore();
  }

  function drawLocusHover(context, scene, locusUid, geometry = {}) {
    if (!locusUid) return;
    const locus = scene.loci.get(locusUid);
    if (!locus) return;

    geometry ||= {};
    const hover = geometry.hover || locus.hover;
    const offsets = geometry.offsets || {};
    const x = locus.x + hover.x + (offsets.x || 0);
    const y = locus.y + hover.y + (offsets.y || 0);
    context.fillStyle = "rgba(0, 0, 0, 0.4)";
    context.fillRect(x, y, hover.width, hover.height);
    context.fillStyle = "black";
    context.fillRect(locus.x + hover.leftHandleX + (offsets?.x || 0), y, 8, hover.height);
    context.fillRect(locus.x + hover.rightHandleX + (offsets?.x || 0), y, 8, hover.height);
  }

  function drawLocusTrack(context, locus, viewport, config, geometry = {}) {
    const { x: offsetX = 0, y: offsetY = 0 } = geometry.offsets || geometry;
    const track = geometry.track || locus.track;
    const worldStart = geometry.worldStart ?? locus.worldStart + offsetX;
    const worldEnd = geometry.worldEnd ?? locus.worldEnd + offsetX;
    const start = viewport ? Math.max(worldStart, viewport.minX) : worldStart;
    const end = viewport ? Math.min(worldEnd, viewport.maxX) : worldEnd;
    if (end < start) return;
    context.beginPath();
    context.moveTo(start, locus.y + track.y + offsetY);
    context.lineTo(end, locus.y + track.y + offsetY);
    context.strokeStyle = config.locus.trackBar.colour;
    context.lineWidth = config.locus.trackBar.stroke;
    context.stroke();
  }

  function locusOffsetForPreview(preview, locusUid) {
    if (preview?.locusOffsets?.has(locusUid)) return preview.locusOffsets.get(locusUid);
    return preview?.type === "locus-offset" && preview.locusUid === locusUid
      ? preview.offsetX
      : 0;
  }

  function clusterLabelOffsetForPreview(preview, clusterUid) {
    return preview?.clusterLabelOffsets?.get(clusterUid) || 0;
  }

  function clusterOffsetForPreview(preview, clusterUid) {
    return preview?.clusterOffsets?.get(clusterUid) || 0;
  }

  function offsetsForLocus(preview, locus) {
    if (!preview || !locus) return { x: 0, y: 0 };
    return {
      x: locusOffsetForPreview(preview, locus.source?.uid),
      y: clusterOffsetForPreview(preview, locus.cluster?.uid ?? locus.source?.clusterUid),
    };
  }

  function offsetsForGene(preview, gene) {
    return offsetsForLocus(preview, gene.locus);
  }

  function locusGeometryForPreview(preview, locus) {
    const trimmed = preview?.loci?.get(locus.source.uid);
    return {
      offsets: offsetsForLocus(preview, locus),
      ...(trimmed || {}),
    };
  }

  function geneVisibleForPreview(preview, gene) {
    return gene && (preview?.geneVisibility?.get(gene.source.uid) ?? gene.visible);
  }

  function linkOffsetsForPreview(scene, link, preview) {
    const query = scene.genes.get(link.source.query.uid);
    const target = scene.genes.get(link.source.target.uid);
    const offsetForGene = (gene) =>
      locusOffsetForPreview(preview, gene?.locus?.source?.uid ?? gene?.source?.locusUid);
    const queryOffset = offsetForGene(query);
    const targetOffset = offsetForGene(target);
    // Link anchors are ordered from the upper locus to the lower one, not from
    // source.query to source.target.
    return query?.locus?.y <= target?.locus?.y
      ? { a: queryOffset, b: targetOffset }
      : { a: targetOffset, b: queryOffset };
  }

  function previewLinkAnchors(scene, link, preview) {
    const query = scene.genes.get(link.source.query.uid);
    const target = scene.genes.get(link.source.target.uid);
    if (!query || !target) return null;
    const anchorForGene = (gene) => {
      const offsets = offsetsForGene(preview, gene);
      let minX = Infinity;
      let maxX = -Infinity;
      for (let index = 0; index < gene.polygon.length; index += 2) {
        minX = Math.min(minX, gene.polygon[index] + offsets.x);
        maxX = Math.max(maxX, gene.polygon[index] + offsets.x);
      }
      const forward = gene.display.strand === 1;
      return [
        forward ? minX : maxX,
        forward ? maxX : minX,
        gene.locus.y + gene.locus.track.y + offsets.y,
      ];
    };
    const queryAnchor = anchorForGene(query);
    const targetAnchor = anchorForGene(target);
    return queryAnchor[2] <= targetAnchor[2]
      ? [...queryAnchor, ...targetAnchor]
      : [...targetAnchor, ...queryAnchor];
  }

  function linkGeometryForPreview(scene, link, preview, config) {
    if (preview?.type !== "cluster-drag") {
      const query = scene.genes.get(link.source.query.uid);
      const target = scene.genes.get(link.source.target.uid);
      return {
        ...linkOffsetsForPreview(scene, link, preview),
        visible:
          link.visible &&
          geneVisibleForPreview(preview, query) &&
          geneVisibleForPreview(preview, target),
      };
    }
    const query = scene.genes.get(link.source.query.uid);
    const target = scene.genes.get(link.source.target.uid);
    const queryOrder = preview.clusterOrder.get(query?.locus?.cluster?.uid);
    const targetOrder = preview.clusterOrder.get(target?.locus?.cluster?.uid);
    const visible =
      queryOrder !== undefined &&
      targetOrder !== undefined &&
      Math.abs(queryOrder - targetOrder) === 1 &&
      link.source.identity >= config.link.threshold &&
      query?.visible &&
      target?.visible;
    return { visible, anchors: visible ? previewLinkAnchors(scene, link, preview) : null };
  }

  function boundsInViewport(bounds, viewport, { x = 0, y = 0 } = {}) {
    return (
      !viewport ||
      !bounds ||
      (bounds.minX + x <= viewport.maxX &&
        bounds.maxX + x >= viewport.minX &&
        bounds.minY + y <= viewport.maxY &&
        bounds.maxY + y >= viewport.minY)
    );
  }

  function recordsForClusterPreview(scene, preview, viewport) {
    const clusters = [];
    const clusterUidByOrder = new Map(
      [...preview.clusterOrder].map(([uid, order]) => [order, uid])
    );
    for (const cluster of scene.clusters.values()) {
      if (!boundsInViewport(cluster.bounds, viewport, { y: clusterOffsetForPreview(preview, cluster.source.uid) })) {
        continue;
      }
      clusters.push(cluster);
    }

    const loci = [];
    const genes = [];
    for (const cluster of clusters) {
      for (const locus of cluster.loci) {
        const offsets = offsetsForLocus(preview, locus);
        if (!boundsInViewport(locus.bounds, viewport, offsets)) continue;
        loci.push(locus);
        const locusGenes =
          locus.genes ||
          [...scene.genes.values()].filter((gene) => gene.locus.source?.uid === locus.source.uid);
        for (const gene of locusGenes) {
          if (
            geneVisibleForPreview(preview, gene) &&
            boundsInViewport(gene.bounds, viewport, offsetsForGene(preview, gene))
          ) {
            genes.push(gene);
          }
        }
      }
    }

    const linkUids = new Set();
    for (const cluster of clusters) {
      const order = preview.clusterOrder.get(cluster.source.uid);
      for (const neighbourOrder of [order - 1, order + 1]) {
        const neighbourUid = clusterUidByOrder.get(neighbourOrder);
        if (neighbourUid === undefined) continue;
        for (const uid of scene.linksByClusterPair?.get(clusterPairKey(cluster.source.uid, neighbourUid)) || []) {
          linkUids.add(uid);
        }
      }
    }
    const links = [...linkUids]
      .map((uid) => scene.links.get(uid))
      .filter(Boolean)
      .sort((left, right) => left.order - right.order);

    return { clusters, loci, genes, links };
  }

  function drawLegend(context, legend) {
    if (!legend.visible) return;
    context.save();
    context.translate(legend.position.x, legend.position.y);
    context.font = `${legend.fontSize}px ${legend.fontFamily}`;
    context.textAlign = "start";
    context.textBaseline = "middle";
    for (const item of legend.items) {
      context.beginPath();
      context.arc(item.x, item.y + item.circleY, item.radius, 0, 2 * Math.PI);
      context.fillStyle = item.colour;
      context.fill();
      context.fillStyle = "black";
      context.fillText(item.label, item.x + item.textX, item.y + item.textY);
    }
    context.restore();
  }

  function drawScaleBar(context, scaleBar) {
    if (!scaleBar.visible) return;
    const { x, y } = scaleBar.position;
    context.save();
    context.translate(x, y);
    context.strokeStyle = scaleBar.colour;
    context.lineWidth = scaleBar.strokeWidth;
    context.beginPath();
    context.moveTo(0, scaleBar.middle);
    context.lineTo(scaleBar.length, scaleBar.middle);
    context.moveTo(0, 0);
    context.lineTo(0, scaleBar.height);
    context.moveTo(scaleBar.length, 0);
    context.lineTo(scaleBar.length, scaleBar.height);
    context.stroke();
    context.fillStyle = "black";
    context.font = `${scaleBar.fontSize}px ${scaleBar.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(scaleBar.label, scaleBar.length / 2, scaleBar.height + 5);
    context.restore();
  }

  function drawColourBar(context, colourBar) {
    if (!colourBar.visible) return;
    const { x, y } = colourBar.position;
    context.save();
    context.translate(x, y);
    const gradient = context.createLinearGradient(0, 0, colourBar.width, 0);
    gradient.addColorStop(0, colourBar.startColour);
    gradient.addColorStop(1, colourBar.endColour);
    context.fillStyle = gradient;
    context.fillRect(0, 0, colourBar.width, colourBar.height);
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.strokeRect(0, 0, colourBar.width, colourBar.height);
    context.fillStyle = "black";
    context.font = `${colourBar.fontSize}px ${colourBar.fontFamily}`;
    context.textBaseline = "top";
    context.textAlign = "center";
    context.fillText(colourBar.label, colourBar.width / 2, colourBar.height + 5);
    context.textAlign = "start";
    context.fillText(colourBar.startLabel, 0, colourBar.height + 5);
    context.textAlign = "end";
    context.fillText(colourBar.endLabel, colourBar.width, colourBar.height + 5);
    context.restore();
  }

  const interpolateNumber = (from, to, amount) => from + (to - from) * amount;

  function interpolatePosition(from, to, amount) {
    if (!from || !to) return to;
    return {
      ...to,
      x: interpolateNumber(from.x, to.x, amount),
      y: interpolateNumber(from.y, to.y, amount),
    };
  }

  function interpolateArray(from, to, amount) {
    if (!from || !to || from.length !== to.length) return to;
    return to.map((value, index) => interpolateNumber(from[index], value, amount));
  }

  function interpolateLocus(from, to, amount) {
    if (!from) return to;
    return {
      ...to,
      x: interpolateNumber(from.x, to.x, amount),
      y: interpolateNumber(from.y, to.y, amount),
      worldStart: interpolateNumber(from.worldStart, to.worldStart, amount),
      worldEnd: interpolateNumber(from.worldEnd, to.worldEnd, amount),
      transform: interpolatePosition(from.transform, to.transform, amount),
      track: {
        ...to.track,
        y: interpolateNumber(from.track.y, to.track.y, amount),
      },
      hover: from.hover && to.hover
        ? {
            ...to.hover,
            x: interpolateNumber(from.hover.x, to.hover.x, amount),
            y: interpolateNumber(from.hover.y, to.hover.y, amount),
            width: interpolateNumber(from.hover.width, to.hover.width, amount),
            height: interpolateNumber(from.hover.height, to.hover.height, amount),
            leftHandleX: interpolateNumber(from.hover.leftHandleX, to.hover.leftHandleX, amount),
            rightHandleX: interpolateNumber(from.hover.rightHandleX, to.hover.rightHandleX, amount),
          }
        : to.hover,
    };
  }

  /**
   * Interpolate compatible scene geometry for Canvas animation. Sources,
   * hit-regions, and semantic state remain those of the target scene; only the
   * pixels in flight are interpolated.
   */
  function interpolateCanvasScene(previous, scene, amount) {
    if (!previous || amount >= 1) return scene;
    const loci = new Map();
    for (const [uid, locus] of scene.loci) {
      loci.set(uid, interpolateLocus(previous.loci.get(uid), locus, amount));
    }

    const clusters = new Map();
    for (const [uid, cluster] of scene.clusters) {
      const prior = previous.clusters.get(uid);
      clusters.set(uid, {
        ...cluster,
        x: prior ? interpolateNumber(prior.x, cluster.x, amount) : cluster.x,
        y: prior ? interpolateNumber(prior.y, cluster.y, amount) : cluster.y,
        info: interpolatePosition(prior?.info, cluster.info, amount),
        loci: cluster.loci.map((locus) => loci.get(locus.source.uid)),
      });
    }

    const genes = new Map();
    for (const [uid, gene] of scene.genes) {
      const prior = previous.genes.get(uid);
      genes.set(uid, {
        ...gene,
        polygon: interpolateArray(prior?.polygon, gene.polygon, amount),
        locus: interpolatePosition(prior?.locus, gene.locus, amount),
        label: {
          ...gene.label,
          x: interpolateNumber(prior?.label?.x ?? gene.label.x, gene.label.x, amount),
          y: interpolateNumber(prior?.label?.y ?? gene.label.y, gene.label.y, amount),
          rotation: interpolateNumber(
            prior?.label?.rotation ?? gene.label.rotation,
            gene.label.rotation,
            amount
          ),
        },
      });
    }

    const links = new Map();
    for (const [uid, link] of scene.links) {
      const prior = previous.links.get(uid);
      links.set(uid, {
        ...link,
        anchors: interpolateArray(prior?.anchors, link.anchors, amount),
        labelPosition: interpolatePosition(prior?.labelPosition, link.labelPosition, amount),
      });
    }

    return { ...scene, clusters, loci, genes, links };
  }

  /** Draw a renderer-neutral chart scene into a Canvas 2D context. */
  function renderCanvas({
    canvas,
    scene,
    previousScene = null,
    progress = 1,
    camera,
    config,
    scales,
    hoverLocusUid = null,
    preview = null,
  }) {
    const displayScene = interpolateCanvasScene(previousScene, scene, progress);
    const context = canvas.getContext("2d");
    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    const pixelRatio = globalThis.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(camera.x, camera.y);
    context.scale(camera.k, camera.k);

    // During an animation, geometry is between the previous and target scenes,
    // while the index describes only the target scene. Draw the full frame then
    // so an in-flight record cannot be incorrectly culled.
    const viewport = previousScene ? null : canvasWorldViewport(canvas, camera);
    const clusterPreview = preview?.type === "cluster-drag";
    const visible = !clusterPreview && viewport && displayScene.index
      ? {
          links: queryViewportOrdered(displayScene.index.links, viewport),
          loci: queryViewportOrdered(displayScene.index.loci, viewport),
          genes: queryViewportOrdered(displayScene.index.genes, viewport),
        }
      : null;

    const recordsFor = (records, ids) =>
      ids ? ids.map((uid) => records.get(uid)).filter(Boolean) : [...records.values()];
    const previewRecords = clusterPreview
      ? recordsForClusterPreview(displayScene, preview, viewport)
      : null;

    for (const link of previewRecords?.links || recordsFor(displayScene.links, visible?.links)) {
      const geometry = linkGeometryForPreview(displayScene, link, preview, config);
      if (
        clusterPreview &&
        (!geometry.visible || !boundsInViewport({
          minX: Math.min(geometry.anchors[0], geometry.anchors[1], geometry.anchors[3], geometry.anchors[4]),
          maxX: Math.max(geometry.anchors[0], geometry.anchors[1], geometry.anchors[3], geometry.anchors[4]),
          minY: Math.min(geometry.anchors[2], geometry.anchors[5]),
          maxY: Math.max(geometry.anchors[2], geometry.anchors[5]),
        }, viewport))
      ) {
        continue;
      }
      drawLink(
        context,
        link,
        link.source,
        config,
        scales,
        geometry
      );
    }
    const drawnClusterLabels = new Set();
    for (const locus of previewRecords?.loci || recordsFor(displayScene.loci, visible?.loci)) {
      const cluster = displayScene.clusters.get(locus.cluster?.uid ?? locus.source.clusterUid);
      if (!cluster) continue;
      if (!drawnClusterLabels.has(cluster.source.uid)) {
        drawnClusterLabels.add(cluster.source.uid);
        drawClusterInfo(context, cluster, config, {
          x: clusterLabelOffsetForPreview(preview, cluster.source.uid),
          y: clusterOffsetForPreview(preview, cluster.source.uid),
        });
      }
      drawLocusTrack(
        context,
        locus,
        viewport,
        config,
        locusGeometryForPreview(preview, locus)
      );
    }
    const hoveredLocus = hoverLocusUid ? displayScene.loci.get(hoverLocusUid) : null;
    drawLocusHover(
      context,
      displayScene,
      hoverLocusUid,
      hoveredLocus ? locusGeometryForPreview(preview, hoveredLocus) : null
    );
    for (const gene of previewRecords?.genes || recordsFor(displayScene.genes, visible?.genes)) {
      drawGene(
        context,
        gene,
        config,
        scales,
        offsetsForGene(preview, gene),
        geneVisibleForPreview(preview, gene)
      );
    }
    if (displayScene.chrome) {
      const chrome = preview?.chrome || displayScene.chrome;
      drawLegend(context, chrome.legend);
      drawScaleBar(context, chrome.scaleBar);
      drawColourBar(context, chrome.colourBar);
    }
    context.restore();
    return { width, height, pixelRatio };
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
            .call(createClusterDrag({ plot, ids, interactions }));

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
    const updateRender = (selection) =>
      animate ? selection.interrupt().transition(transition) : selection.interrupt();
    const clusterRender = updateRender(clusters);
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
            .call(createLocusPositionDrag({ plot, interactions }));
          hover
            .append("rect")
            .attr("class", "leftHandle")
            .attr("x", -8)
            .call(createLocusResizeDrag({ interactions }));
          hover
            .append("rect")
            .attr("class", "rightHandle")
            .call(createLocusResizeDrag({ interactions }));
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
            updateLoci(updateRender(selection), scene, config)
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
            updateGenes(updateRender(selection), scene, config, scales)
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
          update.call((selection) => {
            selection.classed("hidden", !config.link.show);
            updateRender(selection).call(updateLinks, scene, config, scales, ids);
          }),
        (exit) =>
          exit.call((selection) => {
            if (animate) selection.transition(transition).attr("opacity", 0).remove();
            else selection.remove();
          })
      );

    renderChrome({ plot, chrome: scene.chrome, ids, config, interactions });
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

  function createClusterDrag({ plot, ids, interactions }) {
    const clusterSelection = (uid) => plot.selectAll(`#${ids.cluster({ uid })}`);

    const started = (event, cluster) => {
      const subject = clusterSelection(cluster.uid);
      subject.classed("active", true).attr("cursor", "grabbing");
      interactions.beginClusterDrag(cluster.uid, event.y);
    };

    const dragged = (event) => interactions.moveClusterDrag(event.y);

    const ended = (_, cluster) => {
      clusterSelection(cluster.uid).classed("active", false).attr("cursor", null);
      interactions.endClusterDrag();
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

  function createLocusPositionDrag({ plot, interactions }) {
    const started = (event, locus) => {
      interactions.beginLocusDrag(locus.uid, event.x);
    };

    const dragged = (event) => interactions.moveLocusDrag(event.x);

    const ended = () => interactions.endLocusDrag();

    return d3
      .drag()
      .container(() => plot.node())
      .on("start", started)
      .on("drag", dragged)
      .on("end", ended);
  }

  // Resize changes chart state through the controller, while this renderer-owned
  // adapter supplies immediate SVG feedback until the final redraw.
  function createLocusResizeDrag({ interactions }) {
    const started = () => interactions.beginLocusTrim();

    const dragged = function (event, locus) {
      interactions.moveLocusTrim(
        locus,
        d3.select(this).classed("leftHandle") ? "left" : "right",
        event.x
      );
    };

    const ended = (_, locus) => interactions.endLocusTrim(locus);

    return d3.drag().on("start", started).on("drag", dragged).on("end", ended);
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

  function renderChrome({ plot, chrome, ids, config, interactions }) {
    if (!chrome) return;
    const transform = ({ x, y }) => `translate(${x}, ${y})`;
    renderLegend({ plot, legend: chrome.legend, config, interactions, transform });
    renderScaleBar({ plot, scaleBar: chrome.scaleBar, interactions, transform });
    renderColourBar({ plot, colourBar: chrome.colourBar, ids, transform });
  }

  function renderLegend({ plot, legend, config, interactions, transform }) {
    const key = plot
      .selectAll("g.legend")
      .data([legend])
      .join("g")
      .attr("class", "legend")
      .attr("opacity", legend.visible ? 1 : 0)
      .attr("transform", () => transform(legend.position));

    const items = key
      .selectAll("g.element")
      .data(legend.items, (item) => item.uid)
      .join((enter) => {
        const item = enter.append("g").attr("class", "element");
        item.append("circle");
        item
          .append("text")
          .attr("text-anchor", "start")
          .style("dominant-baseline", "middle");
        return item;
      });

    items.attr("transform", (item) => `translate(${item.x}, ${item.y})`);
    items
      .select("circle")
      .attr("class", (item) => `group-${item.uid}`)
      .attr("cy", (item) => item.circleY)
      .attr("r", (item) => item.radius)
      .attr("fill", (item) => item.colour)
      .attr("cursor", "pointer")
      .on("click", (event, item) => {
        if (config.legend.onClickCircle) config.legend.onClickCircle(event, item.source);
        else interactions.chooseLegendColour(item.source);
      });
    items
      .select("text")
      .text((item) => item.label)
      .attr("x", (item) => item.textX)
      .attr("y", (item) => item.textY)
      .style("font-size", `${legend.fontSize}px`)
      .style("font-family", legend.fontFamily)
      .attr("cursor", "pointer")
      .on(
        "click",
        config.legend.onClickText
          ? (event, item) => config.legend.onClickText(event, item.source)
          : null
      )
      .on("contextmenu", (event, item) => {
        const handler = config.legend.onAltClickText || interactions.showGroupMenu;
        handler(event, item.source);
      });
  }

  function renderScaleBar({ plot, scaleBar, interactions, transform }) {
    const bar = plot
      .selectAll("g.scaleBar")
      .data([scaleBar])
      .join((enter) => {
        const group = enter.append("g").attr("class", "scaleBar");
        group.append("line").attr("class", "flatBar");
        group.append("line").attr("class", "leftBar");
        group.append("line").attr("class", "rightBar");
        group.append("text").attr("class", "barText").attr("text-anchor", "middle");
        return group;
      })
      .attr("opacity", scaleBar.visible ? 1 : 0)
      .attr("transform", () => transform(scaleBar.position));

    bar
      .select("line.flatBar")
      .attr("x2", scaleBar.length)
      .attr("y1", scaleBar.middle)
      .attr("y2", scaleBar.middle);
    bar.select("line.leftBar").attr("y2", scaleBar.height);
    bar
      .select("line.rightBar")
      .attr("x1", scaleBar.length)
      .attr("x2", scaleBar.length)
      .attr("y2", scaleBar.height);
    bar
      .select("text.barText")
      .text(scaleBar.label)
      .attr("x", scaleBar.length / 2)
      .attr("y", scaleBar.height + 5)
      .style("dominant-baseline", "hanging")
      .style("font-size", `${scaleBar.fontSize}pt`)
      .style("font-family", scaleBar.fontFamily)
      .attr("cursor", "pointer")
      .on("click", () => {
        const value = prompt("Enter new length (bp):", scaleBar.basePair);
        if (value) interactions.setScaleBarLength(value);
      });
    bar
      .selectAll("line")
      .style("stroke", scaleBar.colour)
      .style("stroke-width", scaleBar.strokeWidth);
  }

  function renderColourBar({ plot, colourBar, ids, transform }) {
    const bar = plot
      .selectAll("g.colourBar")
      .data([colourBar])
      .join((enter) => {
        const group = enter.append("g").attr("class", "colourBar");
        const gradient = group
          .append("defs")
          .append("linearGradient")
          .attr("id", ids.colourGradient)
          .attr("x1", "0%")
          .attr("x2", "100%");
        gradient.append("stop").attr("class", "startStop").attr("offset", "0%");
        gradient.append("stop").attr("class", "endStop").attr("offset", "100%");
        const parts = group.append("g").attr("class", "cbarParts");
        parts.append("rect").attr("class", "colourBarBG");
        parts.append("rect").attr("class", "colourBarFill");
        parts.append("text").attr("class", "labelText").attr("text-anchor", "middle");
        parts.append("text").attr("class", "startText").attr("text-anchor", "start");
        parts.append("text").attr("class", "endText").attr("text-anchor", "end");
        return group;
      })
      .attr("opacity", colourBar.visible ? 1 : 0)
      .attr("transform", () => transform(colourBar.position));

    bar.select(".startStop").attr("stop-color", colourBar.startColour);
    bar.select(".endStop").attr("stop-color", colourBar.endColour);
    bar
      .select(".colourBarBG")
      .attr("width", colourBar.width)
      .attr("height", colourBar.height)
      .style("fill", "white")
      .style("stroke", "black")
      .style("stroke-width", "1px");
    bar
      .select(".colourBarFill")
      .attr("width", colourBar.width)
      .attr("height", colourBar.height)
      .style("fill", `url(#${ids.colourGradient})`);
    bar
      .select(".labelText")
      .text(colourBar.label)
      .attr("x", colourBar.width / 2)
      .attr("y", colourBar.height + 5);
    bar
      .select(".startText")
      .text(colourBar.startLabel)
      .attr("y", colourBar.height + 5);
    bar
      .select(".endText")
      .text(colourBar.endLabel)
      .attr("x", colourBar.width)
      .attr("y", colourBar.height + 5);
    bar
      .selectAll("text")
      .style("font-family", colourBar.fontFamily)
      .style("font-size", `${colourBar.fontSize}pt`)
      .style("dominant-baseline", "hanging");
  }

  var defaultConfig = {
    plot: {
      transitionDuration: 250,
      renderer: "svg",
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
      start = scaleX(state.start ?? locus.start);
      end = scaleX(state.end ?? locus.end);
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

  const config = Object.assign({}, defaultConfig);
  let chartIndex = null;
  let chartState = null;
  let currentScene = null;

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
    get: () => currentScene,
  };

  const gene = {
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
        onLocusFlipped: synchronizeLocusLayoutState,
      });

      refreshClusterOffsetScale();
      plot.update();
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

  let nextChartInstance = 0;

  function clusterMap() {
    /* A ClusterMap plot. */

    let container = null;
    let transition = d3.transition();
    let zoom = null;
    let canvasZoom = null;
    let hasInitialView = false;
    let chartState = null;
    let canvasGesture = null;
    let canvasHoverLocusUid = null;
    let canvasPanMode = false;
    let canvasScene = null;
    let canvasAnimation = null;
    let canvasPreview = null;
    let canvasPreviewFrame = null;
    let paintCanvasPreview = null;
    let currentData = null;
    const runtime = createChartRuntime({ idPrefix: `chart-${nextChartInstance++}-` });
    const interactionController = createInteractionController({
      clusterRows: () => runtime.scales.y.range(),
      getClusterOrder: () => getClusterOrder(chartState),
      getClusterPosition: (uid) => runtime.scene.get().clusters.get(uid).y,
      getLocusOffset: (uid) => getLocusOffset(chartState, uid),
      setDragging: (dragging) => setDragging(chartState, dragging),
      previewClusterDrag: (uid, position, order) => {
        setPreviewClusterPosition(chartState, uid, position);
        if (order) setPreviewClusterOrder(chartState, order);
        if (runtime.config.plot.renderer === "canvas" && runtime.scene.get()) {
          canvasPreview = createClusterDragPreview(runtime.scene.get(), {
            clusterUid: uid,
            position,
            order: getClusterOrder(chartState),
            rows: runtime.scales.y.range(),
          });
          scheduleCanvasPreview();
          return;
        }
        runtime.plot.update({ animate: false });
      },
      commitClusterOrder: () => {
        commitPreviewClusterOrder(chartState);
        clearCanvasPreview();
        runtime.plot.update({ animate: false });
      },
      previewLocusOffset: (uid, offset) => {
        setPreviewLocusOffset(chartState, uid, offset);
        if (runtime.config.plot.renderer === "canvas" && runtime.scene.get()) {
          canvasPreview = createLocusOffsetPreview(runtime.scene.get(), uid, offset, {
            alignLabels: runtime.config.cluster.alignLabels,
          });
          scheduleCanvasPreview();
          return;
        }
        runtime.plot.update({ animate: false });
      },
      commitLocusOffset: (uid) => {
        commitPreviewLocusOffset(chartState, uid);
        clearCanvasPreview();
        runtime.plot.update({ animate: false });
      },
      previewLocusTrim: (locus, edge, position) => {
        const result = previewLocusTrim(chartState, locus, {
          edge,
          position,
          coordinateFor: runtime.scales.x,
          scaleGenes: runtime.config.plot.scaleGenes,
        });
        if (runtime.config.plot.renderer === "canvas" && runtime.scene.get()) {
          // Updating scales is inexpensive and gives the sparse projection the
          // packed x offsets for this temporary locus state. Deliberately avoid
          // rebuilding data, indexes, or the complete scene until release.
          runtime.scale.update(currentData);
          canvasPreview = createLocusTrimPreview(runtime.scene.get(), locus.uid, result.state, {
            localXFor: runtime.scales.locus,
            scaleX: runtime.scales.x,
            alignLabels: runtime.config.cluster.alignLabels,
          });
          scheduleCanvasPreview();
          return result;
        }
        runtime.plot.update({ animate: false, synchronize: false });
        return result;
      },
      commitLocusTrim: (locus) => {
        finalizeLocusTrim(chartState, locus);
        commitPreviewLocusState(chartState, locus);
        clearCanvasPreview();
        runtime.plot.update({ animate: false });
      },
      flipLocus: (locus) => {
        flipLocus(chartState, locus);
        runtime.plot.update();
      },
    });

    runtime.plot.update = (options) => container.call(my, options);
    runtime.plot.data = (data) => my.data(data);

    function clearCanvasPreview() {
      if (canvasPreviewFrame !== null) cancelAnimationFrame(canvasPreviewFrame);
      canvasPreview = null;
      canvasPreviewFrame = null;
    }

    function scheduleCanvasPreview() {
      if (canvasPreviewFrame !== null || !paintCanvasPreview) return;
      canvasPreviewFrame = requestAnimationFrame(() => {
        canvasPreviewFrame = null;
        paintCanvasPreview();
      });
    }

    function my(selection, options) {
      selection.each(function (data) {
        update.call(this, data, options);
      });
    }

    function update(data, { animate = true, synchronize = true } = {}) {
      data = normalizeChartData(data);
      currentData = data;
      const chartIndex = createChartIndex(data);
      chartState = createChartState(data, chartState);
      runtime.setChartIndex(chartIndex);
      runtime.setChartState(chartState);

      // Save the container for later updates
      container = d3.select(this).attr("width", "100%").attr("height", "100%");

      // Set up the shared transition
      transition = d3.transition().duration(runtime.config.plot.transitionDuration);
      const useCanvas = runtime.config.plot.renderer === "canvas";
      if (!useCanvas) clearCanvasPreview();

      // Build the figure
      const svg = container
        .selectAll("svg.clusterMap")
        .data([data])
        .join(
          (enter) => {
            // Add HTML colour picker input
            enter
              .append("input")
              .attr("id", runtime.ids.picker)
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
              .style("font-family", runtime.config.plot.fontFamily);

            // Add root SVG element
            let svg = enter
              .append("svg")
              .attr("class", "clusterMap")
              .attr("id", runtime.ids.root)
              .attr("cursor", "grab")
              .attr("width", "100%")
              .attr("height", "100%")
              .attr("xmlns", "http://www.w3.org/2000/svg")
              .attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml");

            let defs = svg.append("defs");
            let filter = defs
              .append("filter")
              .attr("id", runtime.ids.filter)
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
      const canvas = container
        .selectAll("canvas.clusterMapCanvas")
        .data(useCanvas ? [data] : [])
        .join((enter) => {
          const surface = enter
            .append("canvas")
            .attr("class", "clusterMapCanvas")
            .attr("cursor", "grab")
            .attr("tabindex", 0)
            .attr("aria-label", "Cluster map")
            .style("display", "block")
            .style("width", "100%")
            .style("height", "100%")
            .style("outline", "none");
          canvasZoom = d3
            .zoom()
            .scaleExtent([0, 8])
            .on("zoom", function (event) {
              setCamera(chartState, event.transform);
              paintCanvas(this);
            })
            .on("start", function () {
              d3.select(this).style("cursor", "grabbing");
            })
            .on("end", function () {
              d3.select(this).style("cursor", "grab");
            });
          surface.call(canvasZoom).on("dblclick.zoom", null);
          return surface;
        });
      svg.style("display", useCanvas ? "none" : null);
      const overlay = createHtmlOverlay({
        tooltip: container.select("div.tooltip"),
        scales: runtime.scales,
        actions: {
          redraw: (options) => runtime.plot.update(options),
          anchorGene: (gene) => runtime.gene.anchor(null, gene, true),
          getGroups: () => data.groups,
          setGroups: (groups) => {
            data.groups = groups;
            runtime.plot.update();
          },
        },
      });
      container
        .select("div.tooltip")
        .on("mouseenter", overlay.enter)
        .on("mouseleave", overlay.leave);
      const paintCanvas = (canvasNode) =>
        renderCanvas({
          canvas: canvasNode,
          scene: canvasAnimation?.scene || runtime.scene.get(),
          previousScene: canvasAnimation?.previousScene,
          progress: canvasAnimation?.progress,
          camera: getCamera(chartState),
          config: runtime.config,
          scales: runtime.scales,
          hoverLocusUid: canvasHoverLocusUid,
          preview: canvasPreview,
        });
      paintCanvasPreview = useCanvas ? () => paintCanvas(canvas.node()) : null;
      const stopCanvasAnimation = () => {
        if (canvasAnimation?.frame) cancelAnimationFrame(canvasAnimation.frame);
        canvasAnimation = null;
      };
      const animateCanvas = (canvasNode, scene, animate) => {
        stopCanvasAnimation();
        if (!animate || !canvasScene || !runtime.config.plot.transitionDuration) {
          canvasScene = scene;
          paintCanvas(canvasNode);
          return;
        }
        const previousScene = canvasScene;
        const duration = runtime.config.plot.transitionDuration;
        const startedAt = performance.now();
        const frame = (now) => {
          const elapsed = Math.min(1, (now - startedAt) / duration);
          // Matches D3's default cubic-in-out transition closely enough that
          // the two renderers retain the same interaction feel.
          const progress =
            elapsed < 0.5
              ? 4 * elapsed * elapsed * elapsed
              : 1 - Math.pow(-2 * elapsed + 2, 3) / 2;
          canvasAnimation = { previousScene, scene, progress, frame: null };
          paintCanvas(canvasNode);
          if (elapsed < 1) {
            canvasAnimation.frame = requestAnimationFrame(frame);
          } else {
            canvasAnimation = null;
            canvasScene = scene;
          }
        };
        canvasAnimation = { previousScene, scene, progress: 0, frame: requestAnimationFrame(frame) };
      };
      const chooseLegendColour = (group) => {
        const picker = container.select("input.colourPicker");
        picker.on("change", () => {
          group.colour = picker.node().value;
          runtime.plot.update();
        });
        picker.node().click();
      };
      const setScaleBarLength = (providedValue) => {
        const value =
          providedValue ?? prompt("Enter new length (bp):", runtime.config.scaleBar.basePair);
        if (!value) return;
        runtime.config.scaleBar.basePair = value;
        runtime.plot.update();
      };
      if (useCanvas) {
        const targetForEvent = (canvasNode, event) =>
          hitTestCanvas({
            canvas: canvasNode,
            scene: runtime.scene.get(),
            camera: getCamera(chartState),
            config: runtime.config,
            event,
          });
        const locusForTarget = (target) =>
          target?.locusUid || runtime.get.geneData(target?.geneUid)?.locusUid || null;
        const cursorForTarget = (target) => {
          if (!target) return "grab";
          if (target.action === "move-cluster") return "grab";
          if (target.action === "move-locus") return "move";
          if (target.action.startsWith("trim-locus")) return "ew-resize";
          return "pointer";
        };
        const updateCanvasAffordance = (canvasNode, target) => {
          const locusUid = locusForTarget(target);
          if (canvasHoverLocusUid !== locusUid) {
            canvasHoverLocusUid = locusUid;
            paintCanvas(canvasNode);
          }
          d3.select(canvasNode).style("cursor", cursorForTarget(target));
        };
        canvasZoom.filter(function (event) {
          if (canvasPanMode) return event.type === "wheel" || event.button === 0;
          if (event.type === "wheel") return true;
          if (event.ctrlKey || event.button) return false;
          return !targetForEvent(this, event);
        });
        canvas
          .on("pointerenter.canvasKeyboard", function () {
            this.focus({ preventScroll: true });
          })
          .on("keydown.canvasKeyboard", function (event) {
            if (event.code !== "Space") return;
            canvasPanMode = true;
            event.preventDefault();
            d3.select(this).style("cursor", "grab");
          })
          .on("keyup.canvasKeyboard", function (event) {
            if (event.code !== "Space") return;
            canvasPanMode = false;
            d3.select(this).style("cursor", "grab");
          })
          .on("blur.canvasKeyboard", function () {
            canvasPanMode = false;
          })
          .on("pointerdown.canvasInteraction", function (event) {
            if (canvasPanMode || event.button) return;
            const target = targetForEvent(this, event);
            if (!target) return;
            const point = canvasWorldPoint(this, event, getCamera(chartState));
            this.setPointerCapture(event.pointerId);
            updateCanvasAffordance(this, target);
            if (target.action === "move-cluster") {
              canvasGesture = { action: target.action, clusterUid: target.clusterUid };
              interactionController.beginClusterDrag(target.clusterUid, point.y);
            } else if (target.action === "move-locus") {
              canvasGesture = { action: target.action, locusUid: target.locusUid };
              interactionController.beginLocusDrag(target.locusUid, point.x);
            } else if (target.action.startsWith("trim-locus")) {
              canvasGesture = {
                action: target.action,
                locusUid: target.locusUid,
                edge: target.action.endsWith("left") ? "left" : "right",
              };
              interactionController.beginLocusTrim();
            } else if (target.action === "gene") {
              canvasGesture = { action: target.action, geneUid: target.geneUid };
            } else if (target.action === "legend-colour") {
              if (runtime.config.legend.onClickCircle) {
                runtime.config.legend.onClickCircle(event, target.group);
              } else {
                chooseLegendColour(target.group);
              }
            } else if (target.action === "legend-text") {
              runtime.config.legend.onClickText?.(event, target.group);
            } else if (target.action === "scale-bar") {
              setScaleBarLength();
            }
            event.preventDefault();
          })
          .on("pointermove.canvasInteraction", function (event) {
            if (canvasPanMode) return;
            if (!canvasGesture) {
              updateCanvasAffordance(this, targetForEvent(this, event));
              return;
            }
            const point = canvasWorldPoint(this, event, getCamera(chartState));
            if (canvasGesture.action === "move-cluster") {
              interactionController.moveClusterDrag(point.y);
            } else if (canvasGesture.action === "move-locus") {
              interactionController.moveLocusDrag(point.x);
            } else if (canvasGesture.edge) {
              interactionController.moveLocusTrim(
                runtime.get.locusData(canvasGesture.locusUid),
                canvasGesture.edge,
                point.x
              );
            }
          })
          .on("pointerleave.canvasInteraction", function () {
            if (!canvasGesture && !canvasPanMode) updateCanvasAffordance(this, null);
          })
          .on("pointerup.canvasInteraction pointercancel.canvasInteraction", function (event) {
            if (!canvasGesture) return;
            const gesture = canvasGesture;
            canvasGesture = null;
            if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId);
            if (gesture.action === "move-cluster") interactionController.endClusterDrag();
            else if (gesture.action === "move-locus") interactionController.endLocusDrag();
            else if (gesture.edge) {
              interactionController.endLocusTrim(runtime.get.locusData(gesture.locusUid));
            } else if (gesture.action === "gene" && runtime.config.gene.shape.onClick) {
              runtime.config.gene.shape.onClick(event, runtime.get.geneData(gesture.geneUid));
            }
            updateCanvasAffordance(this, targetForEvent(this, event));
          })
          .on("dblclick.canvasInteraction", function (event) {
            const target = targetForEvent(this, event);
            const locusUid = target?.locusUid || runtime.get.geneData(target?.geneUid)?.locusUid;
            if (locusUid) interactionController.flipLocus(runtime.get.locusData(locusUid));
          })
          .on("contextmenu.canvasInteraction", function (event) {
            const target = targetForEvent(this, event);
            if (target?.action === "gene") {
              event.preventDefault();
              overlay.showGeneMenu(event, runtime.get.geneData(target.geneUid));
            } else if (target?.action === "legend-text") {
              event.preventDefault();
              const handler = runtime.config.legend.onAltClickText || overlay.showGroupMenu;
              handler(event, target.group);
            }
          });
      }
      applyCamera(svg.select("g.clusterMapViewport"));

      runtime.scale.update(data);
      if (synchronize) runtime.synchronizeLocusLayoutStates(data);

      // Only disable grouping if explicitly defined false
      if (data.config && data.config.updateGroups === false) {
        if (!data.groups) data.groups = [];
      } else {
        data.groups = createLinkGroups(data.links, data.groups);
      }

      runtime.link.updateGroups(data.groups);

      const scene = runtime.scene.build(data);

      if (useCanvas) {
        if (!hasInitialView) fitInitialCanvasView(canvas.node(), scene);
        animateCanvas(canvas.node(), scene, hasInitialView && animate);
      } else {
        renderSvg({
          plot,
          data,
          scene,
          transition,
          animate: hasInitialView && animate,
          config: runtime.config,
          scales: runtime.scales,
          ids: runtime.ids,
          lookup: { gene: runtime.get.geneData },
          interactions: {
            isDragging: () => isDragging(chartState),
            beginClusterDrag: interactionController.beginClusterDrag,
            moveClusterDrag: interactionController.moveClusterDrag,
            endClusterDrag: interactionController.endClusterDrag,
            beginLocusDrag: interactionController.beginLocusDrag,
            moveLocusDrag: interactionController.moveLocusDrag,
            endLocusDrag: interactionController.endLocusDrag,
            beginLocusTrim: interactionController.beginLocusTrim,
            moveLocusTrim: interactionController.moveLocusTrim,
            endLocusTrim: interactionController.endLocusTrim,
            flipLocus: interactionController.flipLocus,
            onGeneClick: runtime.config.gene.shape.onClick,
            showGeneMenu: overlay.showGeneMenu,
            showGroupMenu: overlay.showGroupMenu,
            setScaleBarLength,
            chooseLegendColour,
          },
        });

        if (!hasInitialView) fitInitialView(svg, plot);
      }
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

    function fitInitialCanvasView(canvas, scene) {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height || !scene.bounds) return;

      const context = canvas.getContext("2d");
      const bounds = { ...scene.bounds };
      const include = (x, y) => {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
      };
      const textWidth = (text, font) => {
        context.save();
        context.font = font;
        const measured = context.measureText(text).width;
        context.restore();
        return measured;
      };

      for (const cluster of scene.clusters.values()) {
        const anchorX = cluster.x + cluster.info.x;
        include(
          anchorX - textWidth(
            cluster.source.name,
            `bold ${runtime.config.cluster.nameFontSize}px ${runtime.config.plot.fontFamily}`
          ),
          cluster.y + 8
        );
        include(
          anchorX - textWidth(
            cluster.info.locusText,
            `${runtime.config.cluster.lociFontSize}px ${runtime.config.plot.fontFamily}`
          ),
          cluster.y + 24
        );
      }
      if (scene.chrome?.legend.visible) {
        const { legend } = scene.chrome;
        for (const item of legend.items) {
          include(
            legend.position.x + item.textX + textWidth(item.label, `${legend.fontSize}px ${legend.fontFamily}`),
            legend.position.y + item.y + legend.fontSize
          );
        }
      }
      if (scene.chrome?.scaleBar.visible) {
        const { scaleBar } = scene.chrome;
        include(scaleBar.position.x + scaleBar.length, scaleBar.position.y + scaleBar.height + 20);
      }
      if (scene.chrome?.colourBar.visible) {
        const { colourBar } = scene.chrome;
        include(colourBar.position.x + colourBar.width, colourBar.position.y + colourBar.height + 20);
      }

      const padding = 20;
      const fitScale = Math.min(
        1.2,
        (width - padding * 2) / (bounds.maxX - bounds.minX),
        (height - padding * 2) / (bounds.maxY - bounds.minY)
      );
      // A fit smaller than the default camera scale defeats Canvas culling and
      // leaves an impractically dense interaction surface. Keep a readable
      // scale in that case, showing the top-left of the figure (including the
      // cluster labels). Ordinary figures retain the existing fit-to-view.
      const cropped = fitScale < 1;
      const scale = cropped ? 1 : fitScale;
      const camera = {
        x: cropped
          ? padding - bounds.minX * scale
          : (width - (bounds.maxX - bounds.minX) * scale) / 2 - bounds.minX * scale,
        y: cropped
          ? padding - bounds.minY * scale
          : (height - (bounds.maxY - bounds.minY) * scale) / 2 - bounds.minY * scale,
        k: scale,
      };
      if (canvasZoom) {
        d3.select(canvas).call(
          canvasZoom.transform,
          d3.zoomIdentity.translate(camera.x, camera.y).scale(camera.k)
        );
      } else {
        setCamera(chartState, camera);
      }
      hasInitialView = true;
    }

    function applyCamera(selection) {
      const { x, y, k } = getCamera(chartState);
      selection.attr("transform", `translate(${x}, ${y}) scale(${k})`);
    }

    my.config = function (_) {
      if (!arguments.length) return runtime.config;
      runtime.plot.updateConfig(_);
      return my;
    };
    my.data = (data) => {
      if (!data) return container.select("svg.clusterMap").datum();
      container.datum(data).call(my);
      return my;
    };
    my.exportSvg = ({ padding = 20 } = {}) => {
      const scene = runtime.scene.get();
      if (!scene) throw new Error("Cannot export an SVG before the chart has rendered.");
      const namespace = "http://www.w3.org/2000/svg";
      const svgNode = document.createElementNS(namespace, "svg");
      const defs = d3.select(svgNode).append("defs");
      const filter = defs
        .append("filter")
        .attr("id", "filter_solid")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 1)
        .attr("height", 1);
      filter.append("feFlood").attr("flood-color", "rgba(0, 0, 0, 0.8)");
      filter.append("feComposite").attr("in", "SourceGraphic").attr("in2", "");
      const plot = d3.select(svgNode).append("g").attr("class", "clusterMapG");
      const exportIds = { ...runtime.ids, filter: "filter_solid", colourGradient: "colour-gradient" };
      const noop = () => {};
      renderSvg({
        plot,
        data: currentData,
        scene,
        transition: d3.transition().duration(0),
        animate: false,
        config: runtime.config,
        scales: runtime.scales,
        ids: exportIds,
        lookup: { gene: runtime.get.geneData },
        interactions: {
          isDragging: () => false,
          beginClusterDrag: noop,
          moveClusterDrag: noop,
          endClusterDrag: noop,
          beginLocusDrag: noop,
          moveLocusDrag: noop,
          endLocusDrag: noop,
          beginLocusTrim: noop,
          moveLocusTrim: noop,
          endLocusTrim: noop,
          flipLocus: noop,
          onGeneClick: null,
          showGeneMenu: noop,
          showGroupMenu: noop,
          setScaleBarLength: noop,
          chooseLegendColour: noop,
        },
      });
      // Event listeners are not serialized, and interaction-only hover handles
      // should not be included in a publication figure.
      plot.selectAll("g.hover").remove();

      d3.select(document.body)
        .append(() => svgNode)
        .style("position", "fixed")
        .style("visibility", "hidden")
        .style("pointer-events", "none");
      const bounds = plot.node().getBBox();
      svgNode.remove();
      svgNode.removeAttribute("style");
      svgNode.setAttribute(
        "viewBox",
        `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`
      );
      svgNode.setAttribute("width", bounds.width + padding * 2);
      svgNode.setAttribute("height", bounds.height + padding * 2);
      svgNode.setAttribute("xmlns", namespace);
      return new XMLSerializer().serializeToString(svgNode);
    };

    return my;
  }

  exports.ClusterMap = clusterMap;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
