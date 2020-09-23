# clustermap.js
A D3 chart for generating gene cluster comparison figures

## Input data
The clustermap chart expects data in the following format:
```
{
	clusters: [
		uid: 1234,
		name: "Cluster 1",
		loci: [
			{
				uid: 2345,
				name: "Locus 1",
				start: 1,
				end: 20000,
				genes: [
					{
						uid: 3456,
						name: "Gene 1",
						start: 2300,
						end: 5000,
						strand: 1,
					},
					...
				]
			},
			...
		]
	],
	links: [
		{
			query: {
				uid: 3456,
				name: "Gene 1"
			},
			target: {
				uid: 4567,
				name: "Gene 2"
			},
			identity: 0.5
		}
	],
}
```

## Example usage
1. Import d3 v6
2. Import clustermap.js
3. Style container \<div\> element to take up entire viewport
4. Create and configure clustermap.js ClusterMap function
5. Bind data to container \<div\>, call ClusterMap
```
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
		<div id='plot'></div>
		<script>
			// Create and configure the ClusterMap function.
			let chart = ClusterMap.ClusterMap()
				.config({
					cluster: {
						spacing: 30,
						alignLabels: true,
					}
				})

			// Load in data via d3.json, select <div> elements and call the
			// chart function on the selection.
			d3.json("data.json")
				.then(data => {
					d3.select("#plot")
						.datum(data)
						.call(chart)
				})
		</script>
	</body>
</html>
```
