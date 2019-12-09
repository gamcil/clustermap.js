var data = [
  {
    text: "Cluster 1",
    loci: [
      {
        index: 1,
        text: "Locus 1",
        start: 1,
        end: 5000,
        genes: [
          {
            text: "Gene 1",
            start: 20,
            end: 1500,
            strand: 1
          },
          {
            text: "Gene 2",
            start: 2000,
            end: 3100,
            strand: 1
          },
          {
            text: "Gene 3",
            start: 4000,
            end: 4600,
            strand: -1
          }
        ]
      },
      {
        index: 2,
        text: "Locus 2",
        start: 1,
        end: 1300,
        genes: [
          {
            text: "Gene 4",
            start: 100,
            end: 1200,
            strand: -1
          }
        ]
      }
    ]
  },
  {
    text: "Cluster 2",
    loci: [
      {
        index: 1,
        text: "Locus 1",
        start: 1,
        end: 5000,
        genes: [
          {
            text: "Gene 5",
            start: 20,
            end: 1500,
            strand: 1
          },
          {
            text: "Gene 6",
            start: 2000,
            end: 3100,
            strand: 1
          },
          {
            text: "Gene 7",
            start: 4000,
            end: 4600,
            strand: -1
          }
        ]
      },
      {
        index: 2,
        text: "Locus 2",
        start: 1,
        end: 1300,
        genes: [
          {
            text: "Gene 8",
            start: 100,
            end: 1200,
            strand: -1
          }
        ]
      }
    ]
  },
  {
    text: "Cluster 3",
    loci: [
      {
        index: 1,
        text: "Locus 1",
        start: 1,
        end: 3500,
        genes: [
          {
            text: "Gene 9",
            start: 100,
            end: 1200,
            strand: -1
          },
          {
            text: "Gene 10",
            start: 2000,
            end: 3100,
            strand: 1
          }
        ]
      },
      {
        index: 2,
        text: "Locus 2",
        start: 1,
        end: 2500,
        genes: [
          {
            text: "Gene 11",
            start: 50,
            end: 1200,
            strand: 1
          },
          {
            text: "Gene 12",
            start: 1500,
            end: 2340,
            strand: 1
          }
        ]
      }
    ]
  }
];

var geneLinks = [
  { source: "Gene 1", target: "Gene 5", identity: 0.4 },
  { source: "Gene 2", target: "Gene 6", identity: 0.2 },
  { source: "Gene 2", target: "Gene 10", identity: 0.4 },
  { source: "Gene 3", target: "Gene 7", identity: 0.4 },
  { source: "Gene 3", target: "Gene 11", identity: 0.5 },
  { source: "Gene 4", target: "Gene 8", identity: 0.5 },
  { source: "Gene 4", target: "Gene 12", identity: 0.5 },
  { source: "Gene 6", target: "Gene 10", identity: 0.6 },
  { source: "Gene 7", target: "Gene 11", identity: 0.8 },
  { source: "Gene 8", target: "Gene 12", identity: 0.7 }
];

var chartConfig = {
  bodyHeight: 10,
  clusterSpacing: 50,
  locusSpacing: 40,
  scaleFactor: 10,
  tipHeight: 5,
  tipLength: 12
};

var svg = d3
  .select("#testpoly")
  .append("svg")
  .attr("id", "rootSVG")
  .attr("width", "100%")
  .attr("height", "100%")
  .call(
    d3
      .zoom()
      .extent([[0, 0], [800, 850]])
      .scaleExtent([1, 8])
      .on("zoom", function() {
        svg.attr("transform", d3.event.transform);
      })
  )
  .style("display", "block")
  .append("g")
  .attr("class", "rootGroup");

/* Build groups of related genes from geneLinks.
 */
function gatherLikeGroups() {
  var groups = [];

  geneLinks.forEach(function(link) {
    // First group; just add new

    var found = false;

    for (i = 0; i < groups.length; i++) {
      var group = groups[i];

      // If the current group contains either source/target, flag it
      if (
        group.genes.includes(link.source) | group.genes.includes(link.target)
      ) {
        found = true;
      }

      // Found a group with source/target; add new element
      if (found) {
        if (!group.genes.includes(link.source)) group.genes.push(link.source);
        if (!group.genes.includes(link.target)) group.genes.push(link.target);
        break;
      }
    }

    // If first group, or genes not found in any group, add new
    if (!found) {
      groups.push({
        genes: [link.source, link.target],
        colour: "#fff",
        text: `Group ${groups.length + 1}`,
        column: null,
        row: null
      });
    }
  });

  return groups;
}

/* Set colours for related genes.
 */
function colourGeneGroups() {
  var colours = d3
    .scaleOrdinal()
    .domain([0, geneGroups.length])
    .range(d3.schemePaired);

  for (i = 0; i < geneGroups.length; i++) {
    d3.selectAll("polygon[class='genePolygon']")
      .filter(function(d) {
        return geneGroups[i].genes.includes(d.text);
      })
      .style("fill", colours(i));

    geneGroups[i].colour = colours(i);
  }
}

var geneGroups = gatherLikeGroups();

// Border outline
svg
  .append("g")
  .attr("id", "borderGroup")
  .append("rect")
  .attr("id", "borderRect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", "100%")
  .attr("height", "100%")
  .style("stroke", "red")
  .style("fill", "white")
  .style("fill-opacity", "0")
  .style("stroke-width", 1)
  .on("click", function() {
    deselectAll();
  });

// Background group for clusterHover backgrounds
svg.append("g").attr("class", "clusterHovers");

// Arrow drawing parameters
var bodyHeight = 10;
var tipHeight = 5;
var tipLength = 12;
var clusterSpacing = 20;
var scaleFactor = 10;
var locusSpacing = 40;
var legendColumns = 2;
var legendBorder = false;

var geneLinksGroup = svg.append("g").attr("class", "geneLinks");

function calculateYRange() {
  return [0, tipHeight * 2 + bodyHeight + clusterSpacing];
}

function assignLegendPositions() {
  var column = 0;
  var row = 0;
  geneGroups.forEach(function(group) {
    // Set current X, Y coordinates
    group.column = column;
    group.row = row;

    // Reset column at end of row
    if (column === legendColumns - 1) {
      column = 0;
      row += 1;
    } else {
      column += 1;
    }
  });
}

function measureColumns() {
  var widths = Array(legendColumns).fill(0);
  for (i = 0; i < legendColumns; i++) {
    widths[i] = d3.max(
      d3
        .selectAll("svg[class='geneGroup']")
        .filter(d => d.column === i)
        .nodes(),
      n => n.getBBox().width
    );
  }
  return widths;
}

function drawLegend() {
  // Assign column indexes to each entry
  assignLegendPositions();

  var groupSVGs = legend
    .selectAll("svg[class='geneGroup']")
    .data(geneGroups)
    .enter()
    .append("svg")
    .attr("class", "geneGroup");

  groupSVGs
    .append("circle")
    .attr("cx", 7)
    .attr("cy", 10)
    .attr("r", 4)
    .style("fill", d => d.colour);

  groupSVGs
    .append("text")
    .text(d => d.text)
    .attr("x", 14)
    .attr("y", 14)
    .style("font-family", "Arial, Helvetica, sans-serif")
    .style("font-size", "0.8em")
    .on("click", function(d) {
      var input = prompt("Enter new text for this group", d.text);
      if (!input) return null;
      d.text = input;
      d3.select(this).text(input);
      d3.select(this.ownerSVGElement.ownerSVGElement)
        .select("rect")
        .remove();
      drawLegend();
    });

  repositionLegendGroups();

  var background = legend
    .append("rect")
    .lower()
    .attr("class", "legendBackground")
    .attr("x", 2)
    .attr("y", 2)
    .attr("width", (_, i, n) => n[i].ownerSVGElement.getBBox().width + 14)
    .attr("height", (_, i, n) => n[i].ownerSVGElement.getBBox().height + 10)
    .style("rx", "3px")
    .style("fill", "white")
    .style("stroke", function() {
      return d3.select("#legendborder").node().checked === true
        ? "black"
        : null;
    })
    .style("cursor", "pointer")
    .call(dragLegend);
}

function repositionLegendGroups() {
  var widths = measureColumns();
  d3.selectAll("svg[class='geneGroup']")
    .attr("x", function(d) {
      if (d.column === 0) return 3;
      return widths.slice(0, d.column).reduce((a, b) => a + b + 13, 0);
    })
    .attr("y", function(d) {
      if (d.row === 0) return 4;
      return d.row * 15 + 4;
    });

  d3.select("svg[id='legend']").attr(
    "width",
    (_, i, n) => n[i].getBBox().width + 20
  );
}

/* Defines drag behaviour for the legend.
 */
function dragLegend(g) {
  function subject(d, i, n) {
    var bbox = n[i].ownerSVGElement.getBBox();
    bbox.x = +n[i].ownerSVGElement.getAttribute("x");
    bbox.y = +n[i].ownerSVGElement.getAttribute("y");
    return bbox;
  }

  function started(d, i, n) {
    d3.select(n[i]).style("fill", "#d3d3d3");
  }

  function dragged(d, i, n) {
    var me = d3.select(n[i].ownerSVGElement);
    me.attr("x", d3.event.x);
    me.attr("y", d3.event.y);
  }

  function ended(d, i, n) {
    d3.select(n[i]).style("fill", "white");
  }

  var drag = d3
    .drag()
    .subject(subject)
    .on("start", started)
    .on("drag", dragged)
    .on("end", ended);

  return drag(g);
}

var yScale = d3
  .scaleLinear()
  .domain(d3.range(data.length - 1))
  .range(calculateYRange());

var isDragging = false;

// Bind the data, draw all the clusters
var clusters = svg
  .append("g")
  .attr("class", "clusters")
  .selectAll("svg")
  .data(data)
  .enter()
  .append("svg") // cluster
  .attr("y", (_, i) => calculateClusterY(yScale, i))
  .attr("class", "clusterGroup");

var legend = svg.append("svg").attr("id", "legend");

// Create invisible box for accepting drag mouse events
clusters.each(function() {
  this.backgroundBox = d3
    .select("g[class='clusterHovers']")
    .append("rect")
    .attr("class", "clusterHoverBG")
    .attr("width", "100%")
    .attr("height", tipHeight * 2 + bodyHeight)
    .attr("y", this.getAttribute("y"))
    .style("fill", "#d3d3d3")
    .style("opacity", "0")
    .on("mousedown", function() {
      d3.select(this).style("fill", "#d4d4d4");
    });
});

clusters
  .append("rect")
  .attr("width", "100%")
  .attr("height", tipHeight * 2 + bodyHeight)
  .attr("class", "clusterHover")
  .attr("cursor", "pointer")
  .style("opacity", "0")
  .on("mouseover", clusterHoverShow)
  .on("mouseout mouseleave", clusterHoverHide)
  .attr("slot", (d, i) => (d.slot = i))
  .call(dragCluster, svg);

/* Defines vertical drag-sort behaviour for clusters.
 */
function dragCluster(g) {
  var y, free;

  // Assign initial slot to each cluster
  g.each((d, i) => {
    d.slot = i;
  });

  // Calculate total gene height and total spacing between clusters
  var geneHeight = 2 * tipHeight + bodyHeight;
  var clusterSpace = (data.length - 1) * clusterSpacing;

  // Raise clusterGroup <svg> container, get initial y position and free slot
  function started(d, i, n) {
    var me = d3
      .select(n[i].ownerSVGElement)
      .attr("cursor", "grabbing")
      .classed("active", true)
      .raise();

    me.node().backgroundBox.style("fill", "#a9a9a9");

    y = +me.node().getAttribute("y") - d3.event.y;
    free = d.slot;
  }

  function dragged(d, i, n) {
    // Calculate y position from mouse relative to svg bounds
    // i.e. 0 < mouse < total document height
    var yy = Math.min(
      Math.max(0, y + d3.event.y),
      document.getElementById("testpoly").clientHeight
    );
    var me = d3.select(n[i].ownerSVGElement);

    me.attr("y", e => (e.y = yy));
    me.node().backgroundBox.attr("y", me.attr("y"));

    updateGeneLinks();

    // Determine cluster slot from the y position
    var p = Math.min(
      Math.round(yy / (geneHeight + clusterSpacing)),
      data.length
    );

    if (p === d.slot) return;

    // Set new slots for each element, changing y positions
    g.each(function(e) {
      if (e !== d && e.slot === p) {
        e.slot = free;
        d.slot = free = p;

        var newY = yScale(e.slot);
        d3.select(this.ownerSVGElement).attr("y", newY);
        this.ownerSVGElement.backgroundBox.attr("y", newY);
      }
    });
  }

  function ended(d, i, n) {
    // Assign free slot to the dragged cluster
    d.slot = free;

    // Declassify as active, and change its y position based on the new slot
    d3.select(n[i].ownerSVGElement)
      .attr("cursor", "grab")
      .classed("active", false)
      .attr("y", d => yScale(d.slot));

    // Adjust underlying shaded box
    n[i].ownerSVGElement.backgroundBox
      .attr("y", d3.select(n[i].ownerSVGElement).attr("y"))
      .style("fill", "#d3d3d3");

    // Update geneLink polygons
    updateGeneLinks();
  }

  const drag = d3
    .drag()
    .on("start", started)
    .on("drag", dragged)
    .on("end", ended);

  return drag(g);
}

/* Defines drag behaviour for individual cluster loci.
 */
function dragLocus(g) {
  function subject(_, i, n) {
    var bbox = n[i].ownerSVGElement.getBBox();
    bbox.x = +n[i].ownerSVGElement.getAttribute("x");
    return bbox;
  }

  function started(_, i, n) {
    isDragging = true;
    d3.select(n[i])
      .style("fill", "grey")
      .style("stroke", "blue")
      .style("cursor", "grabbing");
    d3.select(n[i].ownerSVGElement).raise();
  }

  function dragged(d, i, n) {
    d3.select(n[i].ownerSVGElement).attr(
      "x",
      (d.x = n[i].ownerSVGElement.flipped ? d3.event.x : d3.event.x)
    );
    updateGeneLinks();
  }

  function ended(d, i, n) {
    isDragging = false;
    d3.select(n[i])
      .style("fill", "white")
      .style("stroke", "black")
      .style("cursor", "pointer");
    if (!n[i].active) {
      d3.select(n[i]).style("opacity", "0");
    }
    d3.select(n[i].ownerSVGElement).order();
  }

  var drag = d3
    .drag()
    .subject(subject)
    .on("start", started)
    .on("drag", dragged)
    .on("end", ended);

  return drag(g);
}

// Toggle opacity of a clusterHover box to 1
function clusterHoverShow(_, i, n) {
  if (!isDragging) n[i].ownerSVGElement.backgroundBox.style("opacity", "1");
}

// Toggle opacity of a clusterHover box to 0
function clusterHoverHide(_, i, n) {
  if (!isDragging) n[i].ownerSVGElement.backgroundBox.style("opacity", "0");
}

function locusMouseOver(_, i, n) {
  if (!isDragging) {
    d3.select(n[i])
      .style("fill", "white")
      .style("opacity", "1");
  }
  toolTipShow();
  n[i].active = true;
}

function locusMouseOut(_, i, n) {
  if (!isDragging) {
    d3.select(n[i])
      .style("fill", "white")
      .style("opacity", "0");
  }
  toolTipHide();
  n[i].active = false;
}

function locusDblClick(_, i, n) {
  if (!isDragging) {
    d3.event.stopPropagation();
    flipElement(this.ownerSVGElement);
    updateGeneLinks();
  }
}

// Create the loci in each cluster
var loci = clusters
  .selectAll("svg")
  .data(d => d.loci)
  .enter()
  .append("svg")
  .attr("class", "clusterLocus")
  .each(d => (d.flipped = false));

// Add locus hover
loci
  .append("rect")
  .attr("class", "locusBox")
  .style("fill", "white")
  .style("fill-opacity", "0.4")
  .style("padding", 10)
  .style("opacity", "0")
  .style("stroke", "grey")
  .style("stroke-width", 1)
  .style("stroke-dasharray", "10 5")
  .style("cursor", "pointer")
  .attr("rx", 4)
  .on("mouseover", locusMouseOver)
  .on("mousemove", d => toolTipMouseMove(d, locusToolTipText))
  .on("mouseout", locusMouseOut)
  .on("dblclick", locusDblClick)
  .call(dragLocus);

// Add track line
loci
  .append("rect")
  .attr("class", "clusterTrack")
  .style("fill", "grey")
  .attr("y", tipHeight + bodyHeight / 2 - 1)
  .attr("height", "2")
  .attr("width", d => (d.end - d.start) / scaleFactor)
  .on("click", (_, i, n) => flipElement(n[i].parentElement));

// Adjust x position of each locus
var locusOffset = 0;
loci.attr("x", function(d, i) {
  var x = locusOffset;
  var width = (d.end - d.start) / scaleFactor;
  locusOffset += width + locusSpacing;

  // Reset locus offset when at a new cluster
  if (i == this.parentElement.__data__.loci.length - 1) {
    locusOffset = 0;
  }
  return x;
});

// Setup tooltip
var toolTip = d3
  .select("#testpoly")
  .append("div")
  .attr("class", "toolTip")
  .style("position", "absolute")
  .style("text-align", "left")
  .style("font-family", "Arial, Helvetica, sans-serif")
  .style("font-size", "0.8em")
  .style("visibility", "hidden")
  .style("background-color", "white")
  .style("border", "solid")
  .style("border-width", "1px")
  .style("border-radius", "5px")
  .style("padding", "5px");

// Draw gene polygons
loci
  .selectAll("polygon[class='genePolygon']")
  .data(d => d.genes)
  .enter()
  .append("polygon")
  .attr("class", "genePolygon")
  .attr("id", d => d.text)
  .attr("points", d => calculateGenePolygonPoints(d))
  .style("stroke", "black")
  .style("fill", "red")
  .style("cursor", "pointer")
  .on("click", selectGene)
  .on("contextmenu", function() {
    d3.event.preventDefault();
    console.log("asd");
  })
  .on("mouseover", toolTipShow)
  .on("mousemove", d => toolTipMouseMove(d, geneToolTipText))
  .on("mouseleave", toolTipHide);

// Change genePolygon fill when selected
function selectGene(_, i, n) {
  n[i].selected = !n[i].selected;
  if (n[i].selected == true) {
    d3.select(n[i]).style("fill", "blue");
  } else {
    colourGeneGroups();
  }
}

function toolTipShow() {
  toolTip.style("visibility", "visible");
}

function toolTipHide() {
  toolTip.style("visibility", "hidden");
}

function toolTipMouseMove(d, htmlFunc) {
  var chartRect = d3
    .select("svg[id='rootSVG']")
    .node()
    .getBoundingClientRect();

  var newX = d3.event.pageX - chartRect.x - window.pageXOffset + 20;
  var newY = d3.event.pageY - chartRect.y - window.pageYOffset + 20;

  toolTip
    .html(htmlFunc(d))
    .style("left", newX + "px")
    .style("top", newY + "px");
}

// Generate tooltip HTML for a gene.
function geneToolTipText(d) {
  return (
    `<b>Gene</b>: ${d.text}<br>` +
    `<b>Start</b>: ${d.start}<br>` +
    `<b>End</b>: ${d.end}<br> ` +
    `<b>Strand</b>: ${d.strand}`
  );
}

// Generate tooltip HTML for a gene link.
function geneLinkToolTipText(d) {
  return (
    `<b>Source</b>: ${d.source}<br>` +
    `<b>Target</b>: ${d.target}<br>` +
    `<b>Identity</b>: ${d.identity}`
  );
}

// Generate tooltip HTML for a cluster locus.
function locusToolTipText(d) {
  return (
    `<b>Locus</b>: ${d.text}<br>` +
    `<b>Genes</b>: ${d.genes.length}<br>` +
    `<b>Start</b>: ${d.start}<br>` +
    `<b>End</b>: ${d.end}<br>` +
    `<b>Reversed</b>: ${d.flipped ? "Yes" : "No"}<br>`
  );
}

function geneLinkClick(d, i, n) {
  if (d3.event.ctrlKey) {
    n[i].remove();
    return;
  }
  promptOpacity(n[i]);
}

// Draw geneLinks
geneLinksGroup
  .selectAll("polygon")
  .data(geneLinks)
  .enter()
  .append("polygon")
  .attr("class", "geneLink")
  .attr("points", d => calculateLinkPoints(d))
  .style("fill", "black")
  .style("fill-opacity", d => d.identity)
  .style("cursor", "pointer")
  .on("click", geneLinkClick)
  .on("mouseover", toolTipShow)
  .on("mousemove", d => toolTipMouseMove(d, geneLinkToolTipText))
  .on("mouseleave", toolTipHide);

function updateHoverBoxes() {
  d3.selectAll(".locusBox")
    .attr("width", d => (d.end - d.start) / scaleFactor)
    .attr("height", tipHeight * 2 + bodyHeight);
}

colourGeneGroups();
drawLegend();
updateHoverBoxes();

// Change scaleFactor and update all element width/position
// TODO: alter x pos of loci?
function changeScaleFactor(value) {
  scaleFactor = value;

  d3.selectAll(".clusterTrack,.locusBox").attr(
    "width",
    d => (d.end - d.start) / scaleFactor
  );

  d3.selectAll("polygon[class='genePolygon']").attr("points", d =>
    calculateGenePolygonPoints(d)
  );
}

// Get X and Y coordinates of an SVG element, relative to its SVG container
function getRelativeXY(x, y, container, element) {
  var p = container.createSVGPoint();
  var ctm = element.getCTM();
  p.x = x;
  p.y = y;
  return p.matrixTransform(ctm);
}

// Calculate geneLink attachment points on a given genePolygon
function calculateAttachmentPoints(gene) {
  // Get DOM element of the gene, as well as its locus/cluster <svg> elements
  var node = gene.node();
  var bbox = node.getBBox();
  var locus = node.ownerSVGElement;
  var cluster = locus.ownerSVGElement;

  // Calculate relative X and Y coordinates of the genePolygon
  // We define a multiplier flip, which determines which side of x1 we should go with
  // width to determine x2 (i.e. to account for flipped loci)
  var flip = locus.flipped ? -1 : 1;
  var yPos = +cluster.getAttribute("y") + bbox.height / 2;
  var point = getRelativeXY(bbox.x, bbox.y, cluster, node);

  // Return as array of [X, Y] coordinate arrays
  return [[point.x, yPos], [point.x + flip * bbox.width, yPos]];
}

// Check if two genePolgons are in vertically adjacent clusters
function clustersAreAdjacent(one, two) {
  var oneSlot = d3
    .select(one.node().ownerSVGElement.ownerSVGElement.firstChild)
    .datum().slot;
  var twoSlot = d3
    .select(two.node().ownerSVGElement.ownerSVGElement.firstChild)
    .datum().slot;
  return Math.abs(oneSlot - twoSlot) === 1 ? true : false;
}

function calculateLinkPoints(data) {
  // Get corresponding genePolygon elements
  var one = d3.select(`polygon[class='genePolygon'][id='${data.source}']`);
  var two = d3.select(`polygon[class='genePolygon'][id='${data.target}']`);

  // Ensure clusters are vertically adjacent
  if (!clustersAreAdjacent(one, two)) return null;

  // Calculate their attachment points
  var onePoints = calculateAttachmentPoints(one);
  var twoPoints = calculateAttachmentPoints(two);

  // Since attachment points are always given in one direction, make sure we reverse
  // them when drawing links between genes with different strands
  if (one.datum().strand == two.datum().strand) {
    onePoints = onePoints.reverse();
  }

  // Concatenate the point arrays, and join them by whitespace
  return onePoints.concat(twoPoints).join(" ");
}

function promptOpacity(element) {
  var thisElement = d3.select(element);
  var input = prompt(
    "Please enter a value between 0 and 1",
    thisElement.style("fill-opacity")
  );
  if (input > 0 && input < 1) {
    thisElement.style("fill-opacity", input);
  } else {
    console.log("Invalid value supplied: " + input);
  }
}

function updateGenePoints() {
  d3.selectAll("polygon")
    .filter("[class='genePolygon']")
    .attr("points", function(d) {
      return calculateGenePolygonPoints(d);
    });
}

function updateClusterTracks() {
  d3.selectAll("rect")
    .filter("[class='clusterTrack']")
    .attr("y", function() {
      return tipHeight + bodyHeight / 2 - 1;
    });
}

function flipElement(element) {
  d3.select(element).each(flipLocusGenePolygons);
}

function flipLocusGenePolygons(d, i, n) {
  var locusLength = d.end - d.start;

  d3.select(n[i])
    .selectAll("polygon[class='genePolygon']")
    .transition()
    .duration(0)
    .attr("points", function(e) {
      // Invert start, end and strand relative to locusLength
      var tmp = e.start;
      e.start = locusLength - e.end;
      e.end = locusLength - tmp;
      e.strand = e.strand === 1 ? -1 : 1;

      // Recompute points and return
      return calculateGenePolygonPoints(e);
    })
    .on("end", () => updateGeneLinks());

  d.flipped = !d.flipped;
}

function updateGeneLinks() {
  d3.selectAll("polygon[class='geneLink']").attr("points", function(d) {
    return calculateLinkPoints(d);
  });
}

function calculateGenePolygonPoints(gene) {
  /* Render a Gene object to SVG.
   *
   *              C         C
   *              |\       /|
   * A------------B \     / B------------A
   * |               D   D               |
   * G------------F /     \ F------------G
   *              |/       \|
   *              E         E
   *
   * 'shaft' attribute refers to X values of C, B, F and E, which is the length of the
   * gene before the tip, if one exists.
   */

  var inverse = false;

  // Get start and end of Gene as percentages of Locus length
  const scaledStart = gene.start / scaleFactor;
  const scaledStop = gene.end / scaleFactor;
  const gene_length = scaledStop - scaledStart;

  // Calculate scaled constants based on scaled coordinates
  const bottom = tipHeight * 2 + bodyHeight;
  const midpoint = bottom / 2;
  const third = tipHeight + bodyHeight;

  // Determine polygon points for the Gene
  if ((gene.strand == 1) | ((gene.strand == -1) & (inverse == true))) {
    // Draw gene 5' to 3'
    var shaft = scaledStop - tipLength;
    var points = [
      scaledStart,
      tipHeight, // A
      shaft,
      tipHeight, // B
      shaft,
      0, // C
      scaledStop,
      midpoint, // D
      shaft,
      bottom, // E
      shaft,
      third, // F
      scaledStart,
      third // G
    ];

    // Squeeze arrow when total length is less than tip length
    if (gene_length < tipLength) {
      [2, 4, 8, 10].forEach(item => (points[item] = scaledStart));
    }
  } else if ((gene.strand == -1) | ((gene.strand == 1) & (inverse == true))) {
    // Draw gene 3' to 5'
    var shaft = scaledStart + tipLength;
    var points = [
      scaledStop,
      tipHeight, // A
      shaft,
      tipHeight, // B
      shaft,
      0, // C
      scaledStart,
      midpoint, // D
      shaft,
      bottom, // E
      shaft,
      third, // F
      scaledStop,
      third // G
    ];

    if (gene_length < tipLength) {
      [2, 4, 8, 10].forEach(item => (points[item] = scaledStop));
    }
  }

  return flattenArray(points).join(" ");
}

function flattenArray(array) {
  var flat = [];
  for (i = 0; i < array.length; i += 2) {
    flat.push(array.slice(i, i + 2));
  }
  return flat;
}

function deselectAll() {
  // Deselect selected polygons
  d3.selectAll("polygon")
    .filter(function() {
      return this.selected === true;
    })
    .property("selected", false);
  colourGeneGroups();
}

function calculateClusterY(yScale, index) {
  if (index == 0) return 0;
  return yScale(index);
}

/* Mappings to HTML input elements.
 *
 * Controls for changing arrow dimensions (tip height or width, body height), as well as
 * shrinkage factor and legend parameters.
 */
d3.select("#drawlink").on("click", function() {
  drawGeneLinks();
});

d3.select("#clusterspacing").on("input", function() {
  clusterSpacing = +this.value;
  yScale.range(calculateYRange());
  d3.selectAll(".clusterGroup").attr("y", (_, i) =>
    calculateClusterY(yScale, i)
  );
  d3.selectAll(".clusterHoverBG").attr("y", (_, i) =>
    calculateClusterY(yScale, i)
  );
  updateGeneLinks();
});

d3.select("#scalingfactor").on("input", function() {
  changeScaleFactor(+this.value);
  updateGeneLinks();
});

d3.select("#tipheight").on("input", function() {
  tipHeight = +this.value;
  d3.selectAll(".clusterHoverBG").attr("height", tipHeight * 2 + bodyHeight);
  updateGenePoints();
  updateClusterTracks();
  updateGeneLinks();
  updateHoverBoxes();
});

d3.select("#tiplength").on("input", function() {
  tipLength = +this.value;
  updateGenePoints();
  updateClusterTracks();
  updateGeneLinks();
});

d3.select("#bodyheight").on("input", function() {
  bodyHeight = +this.value;
  d3.selectAll(".clusterHoverBG").attr("height", tipHeight * 2 + bodyHeight);
  updateGenePoints();
  updateClusterTracks();
  updateGeneLinks();
  updateHoverBoxes();
});

d3.select("#legendcolumns").on("input", function() {
  legendColumns = +this.value;
  d3.select("svg[id='legend']")
    .selectAll("*")
    .remove();
  drawLegend();
});

d3.select("#legendborder").on("input", function() {
  if (this.checked === true) {
    d3.select("rect[class='legendBackground']")
      .style("stroke", "black")
      .style("stroke-width", 1);
  } else {
    d3.select("rect[class='legendBackground']").style("stroke", null);
  }
});
