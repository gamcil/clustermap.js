export default {
	plot: {
		transitionDuration: 250,
		scaleFactor: 15,
		scaleGenes: true,
		fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Oxygen, Cantarell, sans-serif'
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
		}
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
}
