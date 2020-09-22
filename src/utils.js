export function renameText() {
	// Changes value of a text node to a prompted value
	let text = d3.select(this)
	let result = prompt("Enter new value:", text.text())
	if (result) text.text(result)
}

function isObject(a) {
	return (!!a) && (a.constructor === Object)
}

export function updateConfig(target, source) {
	for (const [key, value] of Object.entries(source)) {
		if (!target.hasOwnProperty(key))
			continue
		if (isObject(value)) {
			updateConfig(target[key], value)
		} else {
			target[key] = value
		}
	}
}
