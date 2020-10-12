export default {
	plot: {
		transitionDuration: 250,
		scaleFactor: 15,
	},
	legend: {
		entryHeight: 18,
		fontSize: 14,
		onClickRect: null,
		onClickText: null,
		show: true,
	},
	colourBar: {
		fontSize: 12,
		height: 15,
		show: true,
		width: 150,
	},
	scaleBar: {
		colour: "black",
		fontSize: 12,
		height: 15,
		basePair: 2500,
		show: true,
		stroke: 1,
	},
	link: {
		threshold: 0,
	},
	cluster: {
		nameFontSize: 12,
		lociFontSize: 10,
		spacing: 50,
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
			show: true,
			start: 0.5,
		},
	},
}
