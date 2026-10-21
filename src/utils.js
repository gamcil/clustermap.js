import { color, rgb } from "d3-color";

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
  let colour = color(rgba).rgb();
  return rgb(
    (1 - opacity) * 255 + opacity * colour.r,
    (1 - opacity) * 255 + opacity * colour.g,
    (1 - opacity) * 255 + opacity * colour.b
  );
}
