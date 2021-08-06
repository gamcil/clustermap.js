# clustermap.js

A d3 chart for generating gene cluster comparison figures

## What is it?

clustermap.js is an interactive, reusable d3 chart designed to visualise homology between
multiple gene clusters.

## Input data

The clustermap chart expects data in the following format:

```
{
  "clusters": [
    {
      "uid":  <str: Unique ID>,
      "name": <str: Cluster name>,
      "loci": [
        {
          "uid":   <str: Unique ID>,
          "name":  <str: Locus name>,
          "start": <int: Locus start position>,
          "end":   <int: Locus end position>,
          "genes": [
            {
              "uid":    <str: Unique ID>,
              "name":   <str: Gene name>,
              "start":  <int: Gene start position>,
              "end":    <int: Gene end position>,
              "strand": <int: Gene strand (0 or 1)>,
            }
          ]}
      ]}
  ],
  "links": [
    {
      "query": {
      	"uid":  <str: Unique ID of query gene>,
      	"name": <str: Name of query gene>
      },
      "target": {
      	"uid":  <str: Unique ID of target gene>,
      	"name": <str: Name of target gene>
      },
      "identity": <float: Percent identity query-target alignment>
    }
  ],
  "groups": [
    {
      "uid":     <str: Unique ID of group>,
      "label":   <str: Group label>,
      "genes":  [<str: Gene UID>],
      "colour":  <str: Colour code for gene fill>,
      "hidden":  <bool: Hide group in the plot>
    }
  ]
}
```

## Example usage

1. Import d3 v6
2. Import clustermap.js
3. Style container div element to take up entire viewport
4. Create and configure clustermap.js ClusterMap function
5. Bind data to container div, call ClusterMap

```html
<html>
  <head>
    <!-- Import d3 v6 and clustermap.js -->
    <script src="http://d3js.org/d3.v6.min.js"></script>
    <script src="clustermap.min.js"></script>

    <!-- Make div take up entire viewport -->
    <!-- clustermap.js <svg> element has 100% width/height -->
    <style>
      div#plot {
        width: 100vw;
        height: 100vh;
      }
      #plot div {
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <!-- Create a <div> container for the clustermap.js plot -->
    <!-- clustermap.js will create child <svg> (plot) and <input> (colour picker) elements -->
    <div id="plot"></div>
    <script>
      // Create and configure the ClusterMap function.
      let chart = ClusterMap.ClusterMap().config({
        cluster: {
          spacing: 30,
          alignLabels: true,
        },
      });

      // Load in data via d3.json, select <div> elements and call the
      // chart function on the selection.
      d3.json("data.json").then((data) => {
        d3.select("#plot").datum(data).call(chart);
      });
    </script>
  </body>
</html>
```
