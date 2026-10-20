function define(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}

function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

function Color() {}

var darker = 0.7;
var brighter = 1 / darker;

var reI = "\\s*([+-]?\\d+)\\s*",
    reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*",
    reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
    reHex = /^#([0-9a-f]{3,8})$/,
    reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`),
    reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`),
    reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`),
    reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`),
    reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`),
    reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);

var named = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkgrey: 0xa9a9a9,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkslategrey: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgray: 0x696969,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategray: 0x708090,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32
};

define(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor, this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex, // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});

function color_formatHex() {
  return this.rgb().formatHex();
}

function color_formatHex8() {
  return this.rgb().formatHex8();
}

function color_formatHsl() {
  return hslConvert(this).formatHsl();
}

function color_formatRgb() {
  return this.rgb().formatRgb();
}

function color(format) {
  var m, l;
  format = (format + "").trim().toLowerCase();
  return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) // #ff0000
      : l === 3 ? new Rgb((m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1) // #f00
      : l === 8 ? rgba(m >> 24 & 0xff, m >> 16 & 0xff, m >> 8 & 0xff, (m & 0xff) / 0xff) // #ff000000
      : l === 4 ? rgba((m >> 12 & 0xf) | (m >> 8 & 0xf0), (m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), (((m & 0xf) << 4) | (m & 0xf)) / 0xff) // #f000
      : null) // invalid hex
      : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
      : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
      : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
      : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
      : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
      : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
      : named.hasOwnProperty(format) ? rgbn(named[format]) // eslint-disable-line no-prototype-builtins
      : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
      : null;
}

function rgbn(n) {
  return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
}

function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}

function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb;
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}

function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}

function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}

define(Rgb, rgb, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return (-0.5 <= this.r && this.r < 255.5)
        && (-0.5 <= this.g && this.g < 255.5)
        && (-0.5 <= this.b && this.b < 255.5)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex, // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));

function rgb_formatHex() {
  return `#${hex$1(this.r)}${hex$1(this.g)}${hex$1(this.b)}`;
}

function rgb_formatHex8() {
  return `#${hex$1(this.r)}${hex$1(this.g)}${hex$1(this.b)}${hex$1((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}

function rgb_formatRgb() {
  const a = clampa(this.opacity);
  return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
}

function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}

function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}

function hex$1(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}

function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}

function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl;
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      h = NaN,
      s = max - min,
      l = (max + min) / 2;
  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;
    else if (g === max) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}

function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}

function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hsl, hsl, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360,
        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
        l = this.l,
        m2 = l + (l < 0.5 ? l : 1 - l) * s,
        m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s))
        && (0 <= this.l && this.l <= 1)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
  }
}));

function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}

function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}

/* From FvD 13.37, CSS Color Module Level 3 */
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60
      : h < 180 ? m2
      : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
      : m1) * 255;
}

const hex = (value) => color(value)?.formatHex() || "#888888";

/** A compact editor for JSON-backed panel presentation, with no private data copy. */
function createAnnotationControls({ getPanels, patch, document, panelUid, annotationApi }) {
  const { ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, resolveAnnotationScale } = annotationApi;
  const node = document.createElement("fieldset");
  node.className = "cm-annotation-controls";
  let applying = false;
  const current = () => getPanels().find((panel) => panel.uid === panelUid);
  const element = (tag, text) => {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const row = (parent, label, control) => {
    const item = element("label"); item.append(element("span", label), control); parent.append(item);
    return control;
  };
  const input = (parent, label, field, value, type = "text", options = {}) => {
    const control = element("input");
    Object.assign(control, { type, ...options });
    control.dataset.annotationField = field;
    if (type === "checkbox") control.checked = value;
    else control.value = type === "color" ? hex(value) : value;
    if (type === "number") control.step = "any";
    return row(parent, label, control);
  };
  const select = (parent, label, field, value, options) => {
    const control = element("select"); control.dataset.annotationField = field;
    for (const [key, title] of options) {
      const option = element("option", title); option.value = key; control.append(option);
    }
    control.value = value;
    return row(parent, label, control);
  };
  const render = () => {
    const panel = current();
    const labelsOpen = node.querySelector("details")?.open || false;
    node.replaceChildren(element("legend", "Appearance"));
    if (!panel) return;
    const isBar = panel.type === "bar";
    input(node, "Show panel", "show", panel.show !== false, "checkbox");
    input(node, "Title", "title", panel.title ?? panel.uid);
    const sizes = isBar ? [["width", "Panel width"], ["cellHeight", "Bar height"]]
      : [["cellWidth", "Cell width"], ["cellHeight", "Cell height"], ["cellGap", "Cell gap"]];
    for (const [field, label] of [...sizes, ["cellBorderWidth", "Border width"], ["gap", "Panel gap"]]) {
      input(node, label, field, panel[field] ?? ANNOTATION_DEFAULTS[field], "number",
        { min: ["cellWidth", "cellHeight", "width"].includes(field) ? "0.1" : "0" });
    }
    node.querySelector('[data-annotation-field="gap"]').title = "Distance from the preceding panel's grid edge (or the cluster area, including scales, for the first panel).";
    input(node, "Border colour", "cellBorderColour", panel.cellBorderColour ?? ANNOTATION_DEFAULTS.cellBorderColour, "color");
    const resolved = resolveAnnotationScale(panel);
    if (resolved.type === "continuous") {
      const auto = !panel.scale?.domain;
      input(node, "Automatic domain", "autoDomain", auto, "checkbox");
      input(node, "Minimum", "domainMin", resolved.domain[0], "number", { disabled: auto });
      input(node, "Maximum", "domainMax", resolved.domain[1], "number", { disabled: auto });
    }
    if (isBar) input(node, "Bar colour", "colour", panel.colour ?? ANNOTATION_DEFAULTS.colour, "color");
    else {
      const paletteName = Object.entries(ANNOTATION_PALETTES).find(([, colours]) =>
        colours.length === resolved.colours.length && colours.every((value, i) => hex(value) === hex(resolved.colours[i])))?.[0] || "custom";
      select(node, "Palette", "palette", paletteName,
        [["custom", "Custom"], ...Object.keys(ANNOTATION_PALETTES).map((name) => [name, name])]);
      const swatches = resolved.type === "categorical" ? resolved.domain.map(resolved.colour) : resolved.colours;
      swatches.forEach((value, i) => input(node,
        resolved.type === "categorical" ? resolved.domain[i] : `Colour ${i + 1}`, `colour:${i}`, value, "color"));
    }
    input(node, "Missing colour", "missingColour", panel.missingColour ?? ANNOTATION_DEFAULTS.missingColour, "color");
    input(node, isBar ? "Show axis" : "Show colour key", "showKey", panel.showKey !== false, "checkbox");
    const advanced = element("details"); advanced.append(element("summary", "Labels")); node.append(advanced);
    advanced.open = labelsOpen;
    input(advanced, "Font size", "fontSize", panel.fontSize ?? ANNOTATION_DEFAULTS.fontSize, "number", { min: "0.1" });
    input(advanced, "Show column labels", "showColumnLabels", panel.showColumnLabels !== false, "checkbox");
    input(advanced, "Heading angle", "headingRotation", panel.headingRotation ?? (isBar ? 0 : ANNOTATION_DEFAULTS.headingRotation), "number", { min: "-90", max: "0" });
    panel.columns.forEach((value, i) => input(advanced, `Column ${i + 1}`, `column:${i}`, value));
    const error = element("div"); error.dataset.annotationError = ""; error.setAttribute("role", "alert"); node.append(error);
  };
  const edit = (event) => {
    const control = event.target, field = control.dataset.annotationField;
    if (!field) return;
    // Text commits on change, consistent with the editor's other label fields.
    if ((control.type === "text") !== (event.type === "change")) return;
    control.setCustomValidity("");
    if (!control.checkValidity() || control.type === "number" && control.value === "") return;
    const panel = current(), resolved = resolveAnnotationScale(panel);
    const value = control.type === "checkbox" ? control.checked : control.type === "number" ? control.valueAsNumber : control.value;
    let changes, refresh = false;
    const scale = { ...panel.scale };
    if (field === "autoDomain") {
      if (value) delete scale.domain;
      else scale.domain = resolved.domain;
      changes = { scale }; refresh = true;
    } else if (field === "domainMin" || field === "domainMax") {
      const min = node.querySelector('[data-annotation-field="domainMin"]').valueAsNumber;
      const max = node.querySelector('[data-annotation-field="domainMax"]').valueAsNumber;
      changes = { scale: { ...scale, domain: [min, max] } };
    } else if (field === "palette") {
      if (value === "custom") return;
      changes = { scale: { ...scale, colours: [...ANNOTATION_PALETTES[value]] } }; refresh = true;
    } else if (field.startsWith("colour:")) {
      const colours = resolved.type === "categorical" ? resolved.domain.map(resolved.colour) : [...resolved.colours];
      colours[Number(field.split(":")[1])] = value;
      changes = { scale: { ...scale, colours } };
    } else if (field.startsWith("column:")) {
      const columns = [...panel.columns]; columns[Number(field.split(":")[1])] = value;
      changes = { columns };
    } else changes = { [field]: value };
    try {
      applying = true;
      patch([{ type: "annotationPanels.update", ids: [panel.uid], changes }]);
      node.querySelector("[data-annotation-error]").textContent = "";
      node.querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
      if (refresh) render();
      else if (field.startsWith("colour:")) node.querySelector('[data-annotation-field="palette"]').value = "custom";
    } catch (error) {
      node.querySelector("[data-annotation-error]").textContent = error.message;
      control.setCustomValidity(error.message);
    } finally { applying = false; }
  };
  node.addEventListener("input", edit);
  node.addEventListener("change", edit);
  render();
  return { node, update() { if (!applying) render(); } };
}

var EOL = {},
    EOF = {},
    QUOTE = 34,
    NEWLINE = 10,
    RETURN = 13;

function objectConverter(columns) {
  return new Function("d", "return {" + columns.map(function(name, i) {
    return JSON.stringify(name) + ": d[" + i + "] || \"\"";
  }).join(",") + "}");
}

function customConverter(columns, f) {
  var object = objectConverter(columns);
  return function(row, i) {
    return f(object(row), i, columns);
  };
}

// Compute unique columns in order of discovery.
function inferColumns(rows) {
  var columnSet = Object.create(null),
      columns = [];

  rows.forEach(function(row) {
    for (var column in row) {
      if (!(column in columnSet)) {
        columns.push(columnSet[column] = column);
      }
    }
  });

  return columns;
}

function pad(value, width) {
  var s = value + "", length = s.length;
  return length < width ? new Array(width - length + 1).join(0) + s : s;
}

function formatYear(year) {
  return year < 0 ? "-" + pad(-year, 6)
    : year > 9999 ? "+" + pad(year, 6)
    : pad(year, 4);
}

function formatDate(date) {
  var hours = date.getUTCHours(),
      minutes = date.getUTCMinutes(),
      seconds = date.getUTCSeconds(),
      milliseconds = date.getUTCMilliseconds();
  return isNaN(date) ? "Invalid Date"
      : formatYear(date.getUTCFullYear()) + "-" + pad(date.getUTCMonth() + 1, 2) + "-" + pad(date.getUTCDate(), 2)
      + (milliseconds ? "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "." + pad(milliseconds, 3) + "Z"
      : seconds ? "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "Z"
      : minutes || hours ? "T" + pad(hours, 2) + ":" + pad(minutes, 2) + "Z"
      : "");
}

function dsv(delimiter) {
  var reFormat = new RegExp("[\"" + delimiter + "\n\r]"),
      DELIMITER = delimiter.charCodeAt(0);

  function parse(text, f) {
    var convert, columns, rows = parseRows(text, function(row, i) {
      if (convert) return convert(row, i - 1);
      columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
    });
    rows.columns = columns || [];
    return rows;
  }

  function parseRows(text, f) {
    var rows = [], // output rows
        N = text.length,
        I = 0, // current character index
        n = 0, // current line number
        t, // current token
        eof = N <= 0, // current token followed by EOF?
        eol = false; // current token followed by EOL?

    // Strip the trailing newline.
    if (text.charCodeAt(N - 1) === NEWLINE) --N;
    if (text.charCodeAt(N - 1) === RETURN) --N;

    function token() {
      if (eof) return EOF;
      if (eol) return eol = false, EOL;

      // Unescape quotes.
      var i, j = I, c;
      if (text.charCodeAt(j) === QUOTE) {
        while (I++ < N && text.charCodeAt(I) !== QUOTE || text.charCodeAt(++I) === QUOTE);
        if ((i = I) >= N) eof = true;
        else if ((c = text.charCodeAt(I++)) === NEWLINE) eol = true;
        else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
        return text.slice(j + 1, i - 1).replace(/""/g, "\"");
      }

      // Find next delimiter or newline.
      while (I < N) {
        if ((c = text.charCodeAt(i = I++)) === NEWLINE) eol = true;
        else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
        else if (c !== DELIMITER) continue;
        return text.slice(j, i);
      }

      // Return last token before EOF.
      return eof = true, text.slice(j, N);
    }

    while ((t = token()) !== EOF) {
      var row = [];
      while (t !== EOL && t !== EOF) row.push(t), t = token();
      if (f && (row = f(row, n++)) == null) continue;
      rows.push(row);
    }

    return rows;
  }

  function preformatBody(rows, columns) {
    return rows.map(function(row) {
      return columns.map(function(column) {
        return formatValue(row[column]);
      }).join(delimiter);
    });
  }

  function format(rows, columns) {
    if (columns == null) columns = inferColumns(rows);
    return [columns.map(formatValue).join(delimiter)].concat(preformatBody(rows, columns)).join("\n");
  }

  function formatBody(rows, columns) {
    if (columns == null) columns = inferColumns(rows);
    return preformatBody(rows, columns).join("\n");
  }

  function formatRows(rows) {
    return rows.map(formatRow).join("\n");
  }

  function formatRow(row) {
    return row.map(formatValue).join(delimiter);
  }

  function formatValue(value) {
    return value == null ? ""
        : value instanceof Date ? formatDate(value)
        : reFormat.test(value += "") ? "\"" + value.replace(/"/g, "\"\"") + "\""
        : value;
  }

  return {
    parse: parse,
    parseRows: parseRows,
    format: format,
    formatBody: formatBody,
    formatRows: formatRows,
    formatRow: formatRow,
    formatValue: formatValue
  };
}

var csv = dsv(",");
var csvParseRows = csv.parseRows;
var csvFormatRows = csv.formatRows;

var tsv = dsv("\t");
var tsvParseRows = tsv.parseRows;

// Detect the header separator outside quoted fields. Tabs inside a CSV value
// must not turn the entire table into TSV.
function parseTable(text) {
  for (const token of text.matchAll(/"(?:[^"]|"")*"|([,\t\r\n])/g)) {
    if (token[1]) return (token[1] === "\t" ? tsvParseRows : csvParseRows)(text);
  }
  return csvParseRows(text);
}

/** Small data-entry form; panel validation and history remain in the patch API. */
function createAnnotationCreateControls({ document, getClusters, getPanels, patch, onCreate, annotationApi }) {
  const { validateAnnotationPanels } = annotationApi;
  const node = document.createElement("form");
  const field = (title, tag) => {
    const label = document.createElement("label"), caption = document.createElement("span");
    caption.textContent = title;
    const input = document.createElement(tag); label.append(caption, input); node.append(label);
    return input;
  };
  const options = (select, entries) => {
    for (const [value, label] of entries) {
      const option = document.createElement("option"); option.value = value; option.textContent = label; select.append(option);
    }
  };
  const type = field("Type", "select");
  options(type, [["heatmap", "Heatmap"], ["bar", "Bar chart"]]);
  const title = field("Title", "input"); title.type = "text";
  const scale = field("Values", "select");
  options(scale, [["continuous", "Numeric"], ["categorical", "Categories"]]);
  type.onchange = () => { scale.disabled = type.value === "bar"; if (scale.disabled) scale.value = "continuous"; };
  const help = document.createElement("p");
  help.textContent = "Paste CSV or a tab-separated table. First column: cluster ID; remaining headings: data columns. Blank cells are missing. Bars use one data column. JSON {columns, values} is also accepted.";
  node.append(help);
  const data = field("Data", "textarea"); data.rows = 8; data.spellcheck = false;
  data.parentElement.className = "cm-annotation-data";
  data.value = csvFormatRows([["cluster", "Value"], ...getClusters().map((cluster) => [cluster.uid, ""])]);
  const error = document.createElement("p"); error.dataset.annotationError = ""; error.setAttribute("role", "alert"); node.append(error);
  const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Add panel"; node.append(submit);
  node.onsubmit = (event) => {
    event.preventDefault(); error.textContent = "";
    try {
      const raw = data.value.trim();
      let columns, values;
      if (raw.startsWith("{")) ({ columns, values } = JSON.parse(raw));
      else {
        const rows = parseTable(raw);
        if (rows.length < 2 || rows[0].length < 2) throw new Error("Include a header and at least one cluster row.");
        columns = rows.shift().slice(1).map((label) => label.trim());
        values = Object.create(null);
        for (const row of rows) {
          if (row.every((cell) => !cell.trim())) continue;
          const uid = row[0].trim();
          if (Object.hasOwn(values, uid)) throw new Error(`Duplicate cluster ID '${uid}'.`);
          if (row.length > columns.length + 1) throw new Error(`Too many values for '${uid}'.`);
          values[uid] = columns.map((_, index) => {
            const value = (row[index + 1] ?? "").trim();
            if (!value) return null;
            if (scale.value === "categorical") return value;
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) throw new Error(`Expected a numeric value for '${uid}'.`);
            return numeric;
          });
        }
      }
      const ids = new Set(getPanels().map((panel) => panel.uid));
      let serial = 1;
      while (ids.has(`${type.value}-${serial}`)) serial++;
      const panel = { uid: `${type.value}-${serial}`, type: type.value,
        title: title.value.trim() || (type.value === "bar" ? "Bar chart" : "Heatmap"),
        columns, values, scale: { type: scale.value } };
      validateAnnotationPanels([panel], getClusters());
      patch([{ type: "annotationPanels.create", panel }]);
      onCreate(panel.uid);
    } catch (exception) { error.textContent = exception.message; }
  };
  return { node };
}

/** One read-only HTML tooltip and one hit-test path for all three renderers. */
function createAnnotationTooltip({ container, surfaces, getScene, getPreview, getCamera, isBusy, fontFamily, annotationApi }) {
  const { hitTestAnnotationCell } = annotationApi;
  const document = container.ownerDocument, window = document.defaultView;
  const tooltip = document.createElement("div");
  tooltip.className = "annotation-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  Object.assign(tooltip.style, { position: "fixed", pointerEvents: "none", zIndex: "4",
    maxWidth: "300px", padding: "8px 10px", border: "1px solid #cbd3de", borderRadius: "4px",
    background: "white", boxShadow: "0 2px 8px rgba(0,0,0,.15)", color: "#273444",
    fontFamily, fontSize: "12px", lineHeight: "1.5", overflowWrap: "anywhere" });
  container.append(tooltip);
  let key = null;
  const hide = () => { tooltip.hidden = true; key = null; };
  const move = (event) => {
    if (event.buttons || isBusy()) { hide(); return; }
    const rect = event.currentTarget.getBoundingClientRect(), camera = getCamera();
    const cell = hitTestAnnotationCell(getScene(), {
      x: (event.clientX - rect.left - camera.x) / camera.k,
      y: (event.clientY - rect.top - camera.y) / camera.k,
    }, getPreview());
    if (!cell) { hide(); return; }
    const nextKey = JSON.stringify([cell.panelUid, cell.clusterUid, cell.column, cell.value]);
    if (key !== nextKey) {
      key = nextKey;
      tooltip.replaceChildren();
      const title = document.createElement("strong");
      title.textContent = cell.title || cell.panelUid;
      tooltip.append(title);
      for (const value of [cell.clusterName, `${cell.column}: ${cell.value === null ? "Missing" : cell.value}`]) {
        const line = document.createElement("div"); line.textContent = value; tooltip.append(line);
      }
    }
    tooltip.hidden = false;
    const bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(event.clientX + 12, window.innerWidth - bounds.width - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(event.clientY + 12, window.innerHeight - bounds.height - 8))}px`;
  };
  const escape = (event) => { if (event.key === "Escape") hide(); };
  for (const surface of surfaces.filter(Boolean)) {
    surface.addEventListener("pointermove", move);
    for (const event of ["pointerleave", "pointerdown", "wheel"]) surface.addEventListener(event, hide);
  }
  window.addEventListener("keydown", escape);
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  return { hide, dispose() {
    for (const surface of surfaces.filter(Boolean)) {
      surface.removeEventListener("pointermove", move);
      for (const event of ["pointerleave", "pointerdown", "wheel"]) surface.removeEventListener(event, hide);
    }
    window.removeEventListener("keydown", escape);
    window.removeEventListener("scroll", hide, true);
    window.removeEventListener("resize", hide);
    tooltip.remove();
  } };
}

function installStyle(document) {
  if (document.getElementById("clustermap-annotation-ui-style")) return;
  const style = document.createElement("style");
  style.id = "clustermap-annotation-ui-style";
  style.textContent = `
.cm-annotation-ui { position:fixed; z-index:4; box-sizing:border-box; color:#273444; font-size:12px; line-height:1.3; }
.cm-annotation-ui[hidden] { display:none!important; }
.cm-annotation-ui button,.cm-annotation-ui input,.cm-annotation-ui select,.cm-annotation-ui textarea { font:inherit; color:inherit; box-sizing:border-box; }
.cm-annotation-ui button,.cm-annotation-ui select,.cm-annotation-ui input:not([type=checkbox]):not([type=color]) { min-height:24px; border:1px solid #cbd3de; border-radius:4px; padding:2px 5px; background:#fff; }
.cm-annotation-ui button { cursor:pointer; }
.cm-annotation-ui button:hover { border-color:#78a9ed; background:#f4f8ff; }
.cm-annotation-frame { pointer-events:none; border:1px solid #78a9ed; border-radius:4px; background:rgba(22,119,255,.025); }
.cm-annotation-frame button { position:absolute; right:0; top:-28px; pointer-events:auto; }
.cm-annotation-frame:not(.cm-annotation-add)::before { content:""; position:absolute; top:-28px; right:0; width:48px; height:28px; pointer-events:auto; }
.cm-annotation-add { border-style:dashed; background:transparent; }
.cm-annotation-add button { top:50%; right:50%; transform:translate(50%,-50%); font-size:22px; width:32px; height:32px; }
.cm-annotation-actions { display:flex; gap:5px; border-top:1px solid #e5e9ef; margin-top:8px; padding-top:8px; }
.cm-annotation-ui button:disabled { opacity:.45; cursor:default; }
.cm-annotation-menu p { font-size:11px; color:#607086; }
.cm-annotation-menu .cm-annotation-data { display:block; }
.cm-annotation-menu textarea { display:block; width:100%; margin-top:4px; resize:vertical; border:1px solid #cbd3de; border-radius:4px; padding:5px; }
.cm-annotation-menu { width:280px; max-width:calc(100vw - 16px); max-height:calc(100vh - 16px); overflow:auto; padding:8px; border:1px solid #cbd3de; border-radius:4px; background:white; box-shadow:0 2px 8px rgba(0,0,0,.2); }
.cm-annotation-menu header { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.cm-annotation-menu header strong { flex:1; min-width:0; overflow-wrap:anywhere; }
.cm-annotation-menu header button { min-width:24px; padding:0; }
.cm-annotation-menu fieldset { margin:0; padding:0; border:0; min-width:0; }
.cm-annotation-menu legend { display:none; }
.cm-annotation-menu label { display:flex; gap:6px; align-items:center; margin:5px 0; }
.cm-annotation-menu label > span { flex:1; min-width:0; overflow-wrap:anywhere; }
.cm-annotation-menu input[type=number] { width:72px; }
.cm-annotation-menu input[type=text],.cm-annotation-menu select { width:132px; }
.cm-annotation-menu input[type=color] { width:28px; height:22px; padding:0; border:0; background:transparent; }
.cm-annotation-menu input[type=checkbox] { width:13px; height:13px; margin:0; }
.cm-annotation-menu details { border-top:1px solid #e5e9ef; margin-top:8px; }
.cm-annotation-menu summary { color:#4f6d95; font-weight:600; padding-top:6px; cursor:pointer; }
.cm-annotation-menu [data-annotation-error] { color:#b42318; }
.cm-annotation-hidden { border:1px solid #cbd3de; border-radius:4px; padding:3px 6px; background:white; cursor:pointer; }
.cm-annotation-menu .cm-annotation-restore { display:block; width:100%; margin:5px 0; text-align:left; }
`;
  document.head.append(style);
}

/** Renderer-independent editing affordances, kept outside the exported scene. */
function createAnnotationOverlay({ container, getPanels, getClusters, patch, annotationApi }) {
  const { annotationPanelsForFrame, annotationPanelBounds } = annotationApi;
  const document = container.ownerDocument, window = document.defaultView;
  installStyle(document);
  const element = (tag, className, parent = container) => {
    const node = document.createElement(tag); node.className = className; parent.append(node); return node;
  };
  const frame = element("div", "cm-annotation-ui cm-annotation-frame"); frame.hidden = true;
  const edit = element("button", "", frame); edit.type = "button"; edit.textContent = "Edit";
  edit.setAttribute("aria-haspopup", "dialog"); edit.setAttribute("aria-expanded", "false");
  const addFrame = element("div", "cm-annotation-ui cm-annotation-frame cm-annotation-add"); addFrame.hidden = true;
  const add = element("button", "", addFrame); add.type = "button"; add.textContent = "+";
  add.setAttribute("aria-label", "Add annotation panel"); add.setAttribute("aria-haspopup", "dialog");
  const hiddenButton = element("button", "cm-annotation-ui cm-annotation-hidden");
  hiddenButton.type = "button"; hiddenButton.hidden = true; hiddenButton.setAttribute("aria-haspopup", "dialog");
  const menu = element("div", "cm-annotation-ui cm-annotation-menu"); menu.hidden = true;
  menu.setAttribute("role", "dialog"); menu.setAttribute("aria-label", "Annotation panel settings");
  let context = null, surfaces = [], hovered = null, menuState = null;
  let tooltip = null;
  let panelAreas = [], addArea = null;
  let areaScene = null, areaPreview = null;
  const contains = (bounds, point) => point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
  const hideFrame = () => { if (!menuState) { hovered = null; frame.hidden = true; addFrame.hidden = true; } };
  const positionMenu = () => {
    if (!menuState?.anchor) return;
    const { anchor } = menuState;
    const bounds = menu.getBoundingClientRect();
    const right = anchor.right + 8;
    const x = right + bounds.width <= window.innerWidth - 8 ? right : anchor.left - bounds.width - 8;
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(anchor.top, window.innerHeight - bounds.height - 8))}px`;
  };
  const close = (returnFocus = false) => {
    if (!menuState && !hovered && frame.hidden && addFrame.hidden) return;
    const opener = menuState?.opener;
    menuState = null; hovered = null; menu.hidden = true; frame.hidden = true; addFrame.hidden = true;
    menu.replaceChildren();
    for (const button of [edit, hiddenButton, add]) button.setAttribute("aria-expanded", "false");
    if (returnFocus && opener?.isConnected && !opener.hidden && !opener.closest("[hidden]")) opener.focus({ preventScroll: true });
    else if (returnFocus) surfaces[0]?.focus?.({ preventScroll: true });
  };
  const beginMenu = (kind, title, button, uid = null) => {
    // Keep the menu anchored when creating a panel moves its opener offscreen.
    const anchor = button.closest("[hidden]") ? menuState?.anchor : button.getBoundingClientRect();
    menuState = { kind, uid, anchor, opener: button };
    hovered = null; frame.hidden = true; addFrame.hidden = true;
    for (const opener of [edit, hiddenButton, add]) opener.setAttribute("aria-expanded", String(opener === button));
    menu.replaceChildren();
    const row = element("header", "", menu), heading = element("strong", "", row);
    heading.textContent = title;
    const closeButton = element("button", "", row); closeButton.type = "button";
    closeButton.textContent = "×"; closeButton.setAttribute("aria-label", "Close annotation settings");
    closeButton.onclick = () => close(true);
    menu.hidden = false;
    return menuState;
  };
  const screenArea = (area, surface) => {
    const camera = context.getCamera(), rect = surface.getBoundingClientRect();
    const left = Math.max(rect.left + 2, rect.left + camera.x + area.minX * camera.k - 10, 0);
    const top = Math.max(rect.top + 30, rect.top + camera.y + area.minY * camera.k - 12, 30);
    const right = Math.min(rect.right - 2, rect.left + camera.x + area.maxX * camera.k + 10, window.innerWidth);
    const bottom = Math.min(rect.bottom - 2, rect.top + camera.y + area.maxY * camera.k + 12, window.innerHeight);
    return right > left && bottom > top ? { left, top, right, bottom, width: right - left, height: bottom - top } : null;
  };
  const showAddFrame = () => {
    const rect = addScreenArea();
    addFrame.hidden = !rect;
    if (rect) Object.assign(addFrame.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  };
  const addScreenArea = () => {
    if (!addArea || !surfaces[0]) return null;
    const surface = surfaces[0].getBoundingClientRect(), camera = context.getCamera();
    const edge = surface.left + camera.x + (addArea.minX - 24) * camera.k;
    // A fitted figure can leave less room than the empty slot needs. Keep a
    // small hover target at its visible right edge without changing export bounds.
    const right = Math.min(surface.right - 2, window.innerWidth - 2);
    if (edge > right || edge < surface.left) return screenArea(addArea, surfaces[0]);
    const rect = screenArea(addArea, surfaces[0]);
    if (rect && rect.width >= 44) return rect;
    const vertical = screenArea({ ...addArea, minX: (right - 44 - surface.left - camera.x) / camera.k,
      maxX: (right - surface.left - camera.x) / camera.k }, surfaces[0]);
    return vertical ? { ...vertical, left: Math.max(surface.left + 2, right - 44), right,
      width: Math.min(44, right - surface.left - 2) } : null;
  };
  const showFrame = (uid) => {
    const area = panelAreas.find((area) => area.uid === uid);
    const rect = area && surfaces[0] && screenArea(area.bounds, surfaces[0]);
    frame.hidden = !rect;
    if (!rect) return;
    Object.assign(frame.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    edit.setAttribute("aria-label", `Edit annotation panel ${area.title || uid}`);
  };
  const openPanel = (uid, button) => {
    const panel = getPanels().find((panel) => panel.uid === uid);
    if (!panel) return;
    const state = beginMenu("panel", panel.title || uid, button, uid);
    state.controls = createAnnotationControls({ getPanels, patch, document, panelUid: uid, annotationApi });
    menu.append(state.controls.node);
    const actions = element("div", "cm-annotation-actions", menu);
    const movePanel = (direction) => {
      const ids = getPanels().map((panel) => panel.uid), index = ids.indexOf(uid), target = index + direction;
      if (index < 0 || target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      patch([{ type: "annotationPanels.reorder", ids }]);
    };
    const action = (label, callback) => {
      const button = element("button", "", actions); button.type = "button"; button.textContent = label; button.onclick = callback; return button;
    };
    state.actions = { left: action("Move left", () => movePanel(-1)), right: action("Move right", () => movePanel(1)) };
    action("Remove", () => patch([{ type: "annotationPanels.delete", ids: [uid] }]));
    refresh();
    positionMenu();
    menu.querySelector("input, select")?.focus({ preventScroll: true });
  };
  edit.onclick = () => { if (hovered) openPanel(hovered, edit); };
  add.onclick = () => {
    beginMenu("add", "Add annotation panel", add);
    const form = createAnnotationCreateControls({ document, getPanels, getClusters, patch, annotationApi,
      onCreate: (uid) => openPanel(uid, add) });
    menu.append(form.node); showAddFrame(); positionMenu();
    form.node.querySelector("select")?.focus({ preventScroll: true });
  };
  hiddenButton.onclick = () => {
    beginMenu("hidden", "Hidden annotation panels", hiddenButton);
    for (const panel of getPanels().filter((panel) => panel.show === false)) {
      const button = element("button", "cm-annotation-restore", menu); button.type = "button";
      button.textContent = `Edit ${panel.title || panel.uid}`;
      button.onclick = () => openPanel(panel.uid, hiddenButton);
    }
    positionMenu();
    menu.querySelector("button")?.focus({ preventScroll: true });
  };
  const refresh = () => {
    if (!context) return;
    const scene = context.getScene();
    const preview = context.getPreview();
    if (scene !== areaScene || preview !== areaPreview) {
      areaScene = scene; areaPreview = preview;
      panelAreas = scene ? annotationPanelsForFrame(scene, preview).map((panel) =>
        ({ uid: panel.uid, title: panel.title, bounds: annotationPanelBounds(panel) })) : [];
      const bounds = scene?.figureBounds || scene?.bounds;
      addArea = bounds ? { minX: bounds.maxX + 24, maxX: bounds.maxX + 120,
        minY: panelAreas.length ? Math.min(...panelAreas.map((area) => area.bounds.minY)) : bounds.minY,
        maxY: panelAreas.length ? Math.max(...panelAreas.map((area) => area.bounds.maxY)) : bounds.maxY } : null;
    }
    const panels = getPanels();
    if (menuState?.kind === "panel" && !panels.some((panel) => panel.uid === menuState.uid)) close();
    const active = menuState?.kind === "panel" ? menuState.uid : null;
    if (active || hovered) showFrame(active || hovered);
    if (menuState?.kind === "add") showAddFrame();
    if (active) {
      menu.querySelector("header strong").textContent = panels.find((panel) => panel.uid === active)?.title || active;
      const index = panels.findIndex((panel) => panel.uid === active);
      menuState.actions.left.disabled = index <= 0; menuState.actions.right.disabled = index >= panels.length - 1;
    }
    const hidden = panels.filter((panel) => panel.show === false);
    hiddenButton.hidden = !hidden.length || !surfaces[0];
    hiddenButton.textContent = `Hidden panels (${hidden.length})`;
    if (!hiddenButton.hidden && scene?.bounds) {
      const surface = surfaces[0].getBoundingClientRect(), camera = context.getCamera();
      const top = panelAreas.length ? Math.min(...panelAreas.map((area) => area.bounds.minY)) : scene.bounds.minY;
      const x = surface.left + camera.x + ((scene.annotationAnchorX ?? scene.bounds.maxX) + 24) * camera.k;
      const y = surface.top + camera.y + top * camera.k - 30;
      hiddenButton.style.left = `${Math.max(surface.left + 8, Math.min(x, surface.right - hiddenButton.offsetWidth - 8))}px`;
      hiddenButton.style.top = `${Math.max(surface.top + 8, Math.min(y, surface.bottom - 32))}px`;
    }
    positionMenu();
  };
  const move = (event) => {
    if (menuState) return;
    if (event.buttons || context.isBusy()) { hideFrame(); return; }
    refresh();
    const surface = event.currentTarget.getBoundingClientRect(), camera = context.getCamera();
    const point = { x: (event.clientX - surface.left - camera.x) / camera.k,
      y: (event.clientY - surface.top - camera.y) / camera.k };
    const padded = (bounds) => ({ minX: bounds.minX - 10 / camera.k, maxX: bounds.maxX + 10 / camera.k,
      minY: bounds.minY - 12 / camera.k, maxY: bounds.maxY + 12 / camera.k });
    const area = [...panelAreas].reverse().find((area) => contains(padded(area.bounds), point));
    hovered = area?.uid || null;
    if (hovered) { showFrame(hovered); addFrame.hidden = true; }
    else {
      const slot = addScreenArea();
      if (slot && event.clientX >= slot.left && event.clientX <= slot.right && event.clientY >= slot.top && event.clientY <= slot.bottom) {
        frame.hidden = true; showAddFrame();
      } else hideFrame();
    }
  };
  const leave = (event) => {
    if (frame.contains(event.relatedTarget) || addFrame.contains(event.relatedTarget) || menu.contains(event.relatedTarget)) return;
    hideFrame();
  };
  const outside = (event) => {
    const path = event.composedPath();
    if (menuState && !path.includes(menu) && !path.includes(frame) && !path.includes(addFrame) && event.target !== hiddenButton) close();
  };
  const dismissForGesture = () => {
    if (menu.contains(document.activeElement)) document.activeElement.blur();
    close();
  };
  const escape = (event) => { if (event.key === "Escape") { const open = Boolean(menuState); close(open); if (open) event.preventDefault(); } };
  const detach = () => {
    for (const surface of surfaces) {
      surface.removeEventListener("pointermove", move); surface.removeEventListener("pointerleave", leave);
      surface.removeEventListener("pointerdown", dismissForGesture); surface.removeEventListener("wheel", dismissForGesture);
    }
  };
  frame.addEventListener("pointerleave", leave);
  addFrame.addEventListener("pointerleave", leave);
  menu.addEventListener("toggle", positionMenu, true);
  window.addEventListener("click", outside); window.addEventListener("keydown", escape);
  window.addEventListener("resize", refresh); window.addEventListener("scroll", refresh, true);
  return {
    get isOpen() { return Boolean(menuState); },
    refresh,
    update(next) {
      const nextSurfaces = next.surfaces.filter(Boolean);
      const surfacesChanged = surfaces.length !== nextSurfaces.length || surfaces.some((surface, i) => surface !== nextSurfaces[i]);
      const fontChanged = context?.fontFamily !== next.fontFamily;
      if (surfacesChanged) detach();
      context = next; surfaces = nextSurfaces;
      for (const item of [frame, addFrame, menu, hiddenButton]) item.style.fontFamily = next.fontFamily;
      if (surfacesChanged) for (const surface of surfaces) {
        surface.addEventListener("pointermove", move); surface.addEventListener("pointerleave", leave);
        surface.addEventListener("pointerdown", dismissForGesture); surface.addEventListener("wheel", dismissForGesture);
      }
      const showTooltip = Boolean(context.getScene()?.annotationPanels?.length);
      if (surfacesChanged || fontChanged || Boolean(tooltip) !== showTooltip) {
        tooltip?.dispose();
        tooltip = showTooltip ? createAnnotationTooltip({ container, surfaces, annotationApi,
          getScene: () => context.getScene(), getPreview: () => context.getPreview(),
          getCamera: () => context.getCamera(), isBusy: () => context.isBusy() || Boolean(menuState),
          fontFamily: next.fontFamily }) : null;
      }
      tooltip?.hide();
      menuState?.controls?.update();
      refresh();
    },
    dispose() {
      tooltip?.dispose();
      detach(); window.removeEventListener("click", outside); window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", refresh); window.removeEventListener("scroll", refresh, true);
      frame.remove(); addFrame.remove(); menu.remove(); hiddenButton.remove();
    },
  };
}

export { createAnnotationOverlay };
