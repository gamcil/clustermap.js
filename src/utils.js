// Changes value of a text node to a prompted value
export function renameText(event) {
  if (event.defaultPrevented) return;
  let text = d3.select(event.target);
  let result = prompt("Enter new value:", text.text());
  if (result) text.text(result);
}

function isObject(a) {
  return !!a && a.constructor === Object;
}

export function updateConfig(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (!target.hasOwnProperty(key)) continue;
    if (isObject(value)) {
      updateConfig(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

export function rgbaToRgb(rgba, opacity = 0.6) {
  let colour = d3.color(rgba).rgb();
  return d3.rgb(
    (1 - opacity) * 255 + opacity * colour.r,
    (1 - opacity) * 255 + opacity * colour.g,
    (1 - opacity) * 255 + opacity * colour.b
  );
}
