export default {
	plot: {
		transitionDuration: 250,
		scaleFactor: 15,
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
		threshold: 0,
    bestOnly: false,
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
			show: false,
			start: 0.5,
      name: "uid",
		},
	},
}
