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

function rgb$1(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}

function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}

define(Rgb, rgb$1, extend(Color, {
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
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}

function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
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

function hex(value) {
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

const colourHex = (value, fallback = "#888888") => color(value)?.formatHex() || fallback;

/** Native controls with consistent labels, values and validity handling. */
function createControls(document) {
  const el = (tag, text, parent, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    parent?.append(node); return node;
  };
  const row = (parent, label) => {
    const node = el("label", undefined, parent); el("span", label, node); return node;
  };
  const button = (parent, label, action, className) => {
    const node = el("button", label, parent, className); node.type = "button"; node.onclick = action; return node;
  };
  const input = (parent, label, value, type = "text", onChange, options = {}) => {
    const node = el("input", undefined, parent); Object.assign(node, { type, ...options });
    node.setAttribute("aria-label", label);
    if (type === "checkbox") node.checked = Boolean(value);
    else node.value = type === "color" ? colourHex(value) : value ?? "";
    if (type === "number" && options.step === undefined) node.step = "any";
    if (onChange) node.onchange = () => { if (node.checkValidity()) onChange(type === "checkbox" ? node.checked : node.value); };
    return node;
  };
  const select = (parent, label, value, entries, onChange) => {
    const node = el("select", undefined, parent); node.setAttribute("aria-label", label);
    for (const entry of entries) {
      const [key, title] = Array.isArray(entry) ? entry : [entry, entry];
      el("option", title, node).value = key;
    }
    node.value = value;
    if (onChange) node.onchange = () => onChange(node.value);
    return node;
  };
  return { el, row, button, input, select };
}

/** Report rejected UI edits consistently while leaving validation in the model. */
function createActionRunner(report) {
  return (action, control) => {
    control?.setCustomValidity("");
    try { action(); report(""); return true; }
    catch (error) { report(error.message); control?.setCustomValidity(error.message); return false; }
  };
}

const lastMarkup = new WeakMap();
/** Preserve focused controls when a header or action bar has not changed. */
function setMarkup(node, html) {
  if (lastMarkup.get(node) === html) return;
  node.innerHTML = html; lastMarkup.set(node, html);
}

/** Shared controls and table primitives for the packaged and inline data editors. */
function createDataSearch(document, { placeholder = "Search names, labels, loci, or clusters", onInput } = {}) {
  const node = document.createElement("label"); node.className = "cm-data-search";
  const input = document.createElement("input"); input.type = "search";
  input.placeholder = placeholder; input.setAttribute("aria-label", "Filter records");
  if (onInput) input.oninput = () => onInput(input.value);
  node.append(input);
  return { node, input };
}

/** Shared content layout for every data view, including the standalone editor. */
function createDataPanel(document, { label = "Editable chart data" } = {}) {
  installDataEditorStyle(document);
  const ui = createControls(document), node = ui.el("div", undefined, null, "cm-data-panel");
  const tools = ui.el("div", undefined, node, "cm-data-tools"); tools.hidden = true;
  const meta = ui.el("div", undefined, node, "cm-data-meta");
  const summary = ui.el("span", undefined, meta);
  const selectVisible = ui.button(meta, "Select all visible", null);
  const actions = ui.el("div", undefined, node, "cm-data-actions"); actions.hidden = true;
  const viewport = ui.el("div", undefined, node, "cm-data-table");
  viewport.setAttribute("role", "region"); viewport.setAttribute("aria-label", label);
  return { node, tools, meta, summary, selectVisible, actions, viewport,
    sync() { tools.hidden = ![...tools.children].some((child) => !child.hidden); } };
}

/** Keep selection controls independent of the table's row and action rendering. */
function createSelectionControls(panel, { selection, onChange, checkbox } = {}) {
  const ui = createControls(panel.node.ownerDocument);
  const count = ui.el("strong", undefined, panel.actions);
  const actions = ui.el("span", undefined, panel.actions, "cm-data-selection-actions");
  const clear = ui.button(panel.actions, "Clear selection", () => { selection.clear(); onChange(); });
  let visibleIds = [];
  panel.selectVisible.onclick = () => { selection.setMany(visibleIds); onChange(); };
  if (checkbox) checkbox.onchange = () => { selection.setMany(visibleIds, checkbox.checked); onChange(); };
  return { actions,
    update({ ids, summary, noun, selectSuffix = "" }) {
      visibleIds = ids;
      const selectedVisible = ids.reduce((total, id) => total + Number(selection.has(id)), 0);
      const all = ids.length > 0 && selectedVisible === ids.length;
      panel.summary.textContent = summary;
      panel.selectVisible.hidden = !ids.length;
      panel.selectVisible.disabled = all;
      panel.selectVisible.textContent = `Select all ${ids.length.toLocaleString()} visible${selectSuffix}`;
      panel.actions.hidden = !selection.size;
      count.textContent = `${selection.size.toLocaleString()} ${noun}${selection.size === 1 ? "" : "s"} selected`;
      clear.disabled = !selection.size;
      if (checkbox) {
        checkbox.checked = all;
        checkbox.indeterminate = selectedVisible > 0 && !all;
        checkbox.disabled = !ids.length;
      }
    },
  };
}

const cellClass = (selection) => `cm-data-cell${selection ? " cm-data-cell--select" : ""}`;
function createDataCell(document, tag = "td", selection = false) {
  const node = document.createElement(tag); node.className = cellClass(selection); return node;
}
function dataCell(content, selection = false) {
  return `<span class="${cellClass(selection)}">${content}</span>`;
}

function installDataEditorStyle(document) {
  if (document.getElementById("cm-data-editor-style")) return;
  const style = document.createElement("style"); style.id = "cm-data-editor-style";
  style.textContent = `
@layer clinker-editor {
.cm-data-ui { color:var(--cm-foreground,#273444); font:13px/1.4 system-ui,sans-serif; }
.cm-data-ui [hidden] { display:none!important; }
.cm-data-ui :is(button,input,select,textarea) { font:inherit; color:inherit; box-sizing:border-box; }
.cm-data-ui :where(button,select,input:not([type=color]):not([type=checkbox]):not([type=range]),textarea) { min-height:var(--cm-control-height,30px); padding:var(--cm-control-padding,4px 8px); border:1px solid var(--cm-border,#cbd3de); border-radius:var(--cm-control-radius,6px); background:var(--cm-surface,#fff); }
.cm-data-ui input[type=checkbox] { cursor:pointer; }
.cm-data-ui input[type=color] { width:30px; height:22px; padding:0; border:0; background:transparent; }
.cm-data-ui button { cursor:pointer; }
.cm-data-ui button:hover:not(:disabled) { border-color:var(--cm-accent,#78a9ed); background:var(--cm-hover,#f4f8ff); }
.cm-data-ui :where(button,summary):focus-visible { outline:2px solid var(--cm-accent,#1677ff); outline-offset:2px; }
.cm-data-ui summary { cursor:pointer; }
.cm-data-ui summary:hover { color:var(--cm-accent,#1677ff); }
.cm-data-ui button:disabled { color:var(--cm-muted,#8993a1); opacity:.45; cursor:default; }
.cm-data-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; flex-shrink:0; }
.cm-data-search { display:flex; flex:1; min-width:140px; }
.cm-data-search input { width:100%; }
.cm-data-error { color:var(--cm-danger,#b42318); font-size:12px; margin:6px 0; }
.cm-data-error:empty { display:none; }
.cm-data-panel { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; gap:8px; }
.cm-data-tools { flex-shrink:0; }
.cm-data-meta { display:flex; align-items:center; justify-content:space-between; min-height:30px; flex-shrink:0; color:var(--cm-muted,#687586); font-size:12px; }
.cm-data-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; flex-shrink:0; padding:8px 10px; border:1px solid var(--cm-border,#cbd3de); border-radius:8px; background:var(--cm-subtle,#f3f6fa); }
.cm-data-actions strong { padding:4px 7px; border-radius:5px; background:var(--cm-selection,#d6e6fc); color:var(--cm-foreground,#273444); }
.cm-data-selection-actions { display:contents; }
.cm-data-table { flex:1; min-height:120px; overflow:auto; overflow-anchor:none; }
.cm-data-head { box-sizing:border-box; height:32px; border-bottom:1px solid var(--cm-border,#dbe2eb); background:var(--cm-subtle,#f3f6fa); color:var(--cm-muted,#556274); font-size:11px; font-weight:650; text-align:left; }
.cm-data-row { --cm-row-background:var(--cm-surface,#fff); box-sizing:border-box; height:34px; border-bottom:1px solid var(--cm-border,#eee); background:var(--cm-row-background); font-size:13px; }
.cm-data-row > :is(th,td) { height:34px; box-sizing:border-box; background:var(--cm-row-background); border-bottom:1px solid var(--cm-border,#eee); }
.cm-data-row:is(:hover,:focus-within) { --cm-row-background:var(--cm-hover,#e3ecf8); }
.cm-data-row.is-selected { --cm-row-background:var(--cm-selection,#d6e6fc); }
.cm-data-cell { box-sizing:border-box; padding:0 8px; text-align:left; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-data-cell--select { width:32px; min-width:32px; padding:0; text-align:center; }
span.cm-data-cell--select { display:flex; align-items:center; justify-content:center; }
.cm-data-cell--select input { margin:0; }
.cm-data-ui .cm-data-cell .cm-data-field { padding-inline:0; margin-inline:-1px; }
.cm-data-ui input.cm-data-field.cm-data-cell { padding-inline:7px; }
.cm-data-placeholder { color:var(--cm-muted,#687586); font-style:normal; }
.cm-data-ui .cm-data-field { min-width:0; border-color:transparent!important; background:transparent!important; }
.cm-data-ui .cm-data-row .cm-data-field { height:28px; min-height:28px; padding-block:2px; line-height:20px; }
.cm-data-ui .cm-data-field:is(:hover,:focus) { border-color:var(--cm-accent,#c6d8f0)!important; background:var(--cm-surface,#fff)!important; }
.cm-data-ui .cm-data-field:focus-visible { outline:2px solid var(--cm-accent,#1677ff); outline-offset:-2px; }
.cm-data-field::placeholder { color:var(--cm-muted,#7b8796); }
.cm-data-field[type=number]:not(:hover):not(:focus) { appearance:textfield; -moz-appearance:textfield; }
.cm-data-field[type=number]:not(:hover):not(:focus)::-webkit-inner-spin-button { appearance:none; }
select.cm-data-field:not(:hover):not(:focus) { appearance:none; }
}
`;
  document.head.append(style);
}

/** Selection shared by flat rows, tree leaves and annotation matrices. */
class RowSelection extends Set {
  #anchor = null;

  select(id, checked, { orderedIds = [], range = false } = {}) {
    const start = orderedIds.indexOf(this.#anchor), end = orderedIds.indexOf(id);
    const ids = range && start >= 0 && end >= 0
      ? orderedIds.slice(Math.min(start, end), Math.max(start, end) + 1) : [id];
    this.setMany(ids, checked);
    this.#anchor = id;
  }

  setMany(ids, checked = true) {
    for (const id of ids) { if (checked) this.add(id); else this.delete(id); }
    this.#anchor = null;
  }

  prune(ids) {
    const valid = ids instanceof Set ? ids : new Set(ids);
    for (const id of this) if (!valid.has(id)) this.delete(id);
    if (!valid.has(this.#anchor)) this.#anchor = null;
  }

  clear() { super.clear(); this.#anchor = null; }
}

/** Shared fixed-height row window for scrollable data editors. */
function virtualRowWindow(count, scrollTop, height, { rowHeight = 34, overscan = 8, threshold = 200 } = {}) {
  const virtual = count > threshold;
  const first = virtual ? Math.min(Math.max(0, count - 1), Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)) : 0;
  const last = virtual ? Math.min(count, first + Math.ceil((height || 320) / rowHeight) + overscan * 2) : count;
  return { first, last, before: first * rowHeight, after: (count - last) * rowHeight };
}

/** Own scrolling, resizing and keyed DOM rows; callers supply row/spacer elements. */
function createVirtualRows({ viewport, container, key, createRow, updateRow,
  createSpacer, createEmpty, headerHeight = () => 0, onRender = () => {} }) {
  const document = container.ownerDocument, view = document.defaultView;
  if (!viewport.hasAttribute("tabindex")) viewport.tabIndex = -1;
  const spacer = () => {
    const node = createSpacer ? createSpacer() : document.createElement("div");
    node.setAttribute("aria-hidden", "true"); container.append(node); return node;
  };
  const top = spacer(), bottom = spacer(), mounted = new Map();
  const empty = createEmpty?.();
  if (empty) container.insertBefore(empty, bottom);
  let rows = [], first = -1, last = -1, frame = null, destroyed = false, rendering = false, pending = false;
  const render = (force = false) => {
    if (destroyed) return;
    if (rendering) { pending = true; return; }
    const window = virtualRowWindow(rows.length, Math.max(0, viewport.scrollTop - headerHeight()), viewport.clientHeight);
    if (!force && first === window.first && last === window.last) return;
    rendering = true;
    try {
      first = window.first; last = window.last;
      const visible = rows.slice(first, last), ids = new Set(visible.map(key));
      const remove = (node) => {
        if (node.contains(document.activeElement)) { document.activeElement.blur(); viewport.focus({ preventScroll: true }); }
        node.remove();
      };
      for (const [id, entry] of mounted) if (!ids.has(id)) { remove(entry.node); mounted.delete(id); }
      if (empty) empty.hidden = rows.length > 0;
      let next = empty || bottom, restoreFocus = null;
      for (let index = visible.length - 1; index >= 0; index--) {
        const row = visible[index], id = key(row);
        let entry = mounted.get(id);
        if (!entry) { entry = { node: createRow(row) }; mounted.set(id, entry); }
        else if (updateRow) {
          const updated = updateRow(entry.node, row);
          if (updated && updated !== entry.node) {
            const active = document.activeElement, label = active?.getAttribute("aria-label");
            if (label && entry.node.contains(active)) restoreFocus = [...updated.querySelectorAll("[aria-label]")]
              .find((control) => control.tagName === active.tagName && control.type === active.type && control.getAttribute("aria-label") === label);
            remove(entry.node); entry.node = updated;
          }
        }
        entry.node.setAttribute("aria-rowindex", first + index + 2);
        if (entry.node.nextSibling !== next) container.insertBefore(entry.node, next);
        next = entry.node;
      }
      // A table spacer uses its cell for height; a list spacer uses the element.
      (top.firstElementChild || top).style.height = `${window.before}px`;
      (bottom.firstElementChild || bottom).style.height = `${window.after}px`;
      onRender([...mounted.values()].map((entry) => entry.node));
      restoreFocus?.focus({ preventScroll: true });
    } finally {
      rendering = false;
      if (pending && !destroyed) { pending = false; view.queueMicrotask(() => render(true)); }
    }
  };
  const schedule = () => { if (frame === null) frame = view.requestAnimationFrame(() => { frame = null; render(); }); };
  viewport.addEventListener("scroll", schedule);
  const observer = new view.ResizeObserver(schedule); observer.observe(viewport);
  return {
    setRows(next) { rows = next; render(true); },
    refresh() { render(true); },
    destroy() {
      destroyed = true; observer.disconnect(); viewport.removeEventListener("scroll", schedule);
      if (frame !== null) view.cancelAnimationFrame(frame);
      for (const { node } of mounted.values()) node.remove();
      top.remove(); bottom.remove(); empty?.remove(); mounted.clear();
    },
  };
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

/** Shared CSV/TSV/JSON boundary for creation and replacement. */
function parseAnnotationTable(text, categorical = false) {
  const raw = text.trim();
  if (raw.startsWith("{")) {
    const { columns, values } = JSON.parse(raw);
    return { columns, values };
  }
  let parse = csvParseRows;
  for (const token of raw.matchAll(/"(?:[^"]|"")*"|([,\t\r\n])/g)) {
    if (token[1]) { parse = token[1] === "\t" ? tsvParseRows : csvParseRows; break; }
  }
  const rows = parse(raw);
  if (rows.length < 2 || rows[0].length < 2) throw new Error("Include a header and at least one cluster row.");
  const columns = rows.shift().slice(1).map((label) => label.trim()), values = Object.create(null);
  for (const row of rows) {
    if (row.every((cell) => !cell.trim())) continue;
    const uid = row[0].trim();
    if (Object.hasOwn(values, uid)) throw new Error(`Duplicate cluster ID '${uid}'.`);
    if (row.length > columns.length + 1) throw new Error(`Too many values for '${uid}'.`);
    values[uid] = columns.map((_, index) => {
      const value = (row[index + 1] ?? "").trim();
      if (!value) return null;
      if (categorical) return value;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new Error(`Expected a numeric value for '${uid}'.`);
      return numeric;
    });
  }
  return { columns, values };
}

function annotationTableText(panel, clusters) {
  return csvFormatRows([["cluster", ...panel.columns], ...clusters.map((cluster) =>
    [cluster.uid, ...(panel.values[cluster.uid] ?? panel.columns.map(() => null))])]);
}

function mapAnnotationValues(values, map) {
  return Object.fromEntries(Object.entries(values).map(([uid, row]) => [uid, row.map(map)]));
}

/** Small data-entry form; panel validation and history remain in the patch API. */
function createAnnotationCreateControls({ document, getClusters, getPanels, getTree, patch, onCreate, annotationApi }) {
  const { validateAnnotationPanels } = annotationApi;
  const node = document.createElement("form");
  const ui = createControls(document);
  const type = ui.select(ui.row(node, "Type"), "Type", "heatmap", [["heatmap", "Heatmap"], ["bar", "Bar chart"], ["groups", "Group markers"]]);
  const title = ui.input(ui.row(node, "Title"), "Title", "");
  const scale = ui.select(ui.row(node, "Values"), "Values", "continuous", [["continuous", "Numeric"], ["categorical", "Categories"]]);
  type.onchange = () => {
    const groups = type.value === "groups";
    scale.parentElement.hidden = groups;
    scale.disabled = type.value === "bar";
    if (scale.disabled) scale.value = "continuous";
    help.textContent = groups ? "Define groups as JSON. Each needs a uid, a label, and either clusterIds or a tree nodeUid. Colours are optional."
      : tableHelp;
    data.value = groups ? JSON.stringify({ groups: [{ uid: "group-1", label: "Example group",
      clusterIds: getClusters().slice(0, 2).map((cluster) => cluster.uid) }] }, null, 2) : tableTemplate;
  };
  const help = document.createElement("p");
  const tableHelp = "Paste CSV or a tab-separated table. First column: cluster ID; remaining headings: data columns. Blank cells are missing. Bars use one data column. JSON {columns, values} is also accepted.";
  help.textContent = tableHelp;
  node.append(help);
  const data = ui.el("textarea", undefined, ui.row(node, "Data")); data.setAttribute("aria-label", "Data"); data.rows = 8; data.spellcheck = false;
  data.parentElement.className = "cm-annotation-data";
  const tableTemplate = csvFormatRows([["cluster", "Value"], ...getClusters().map((cluster) => [cluster.uid, ""])]);
  data.value = tableTemplate;
  const error = document.createElement("p"); error.dataset.annotationError = ""; error.setAttribute("role", "alert"); node.append(error);
  const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Add panel"; node.append(submit);
  const run = createActionRunner((message) => { error.textContent = message; });
  node.onsubmit = (event) => {
    event.preventDefault(); error.textContent = "";
    run(() => {
      const raw = data.value.trim();
      let columns, values, groups;
      if (type.value === "groups") ({ groups } = JSON.parse(raw));
      else ({ columns, values } = parseAnnotationTable(raw, scale.value === "categorical"));
      const ids = new Set(getPanels().map((panel) => panel.uid));
      let serial = 1;
      while (ids.has(`${type.value}-${serial}`)) serial++;
      const panel = { uid: `${type.value}-${serial}`, type: type.value,
        title: title.value.trim() || (type.value === "groups" ? "Groups" : type.value === "bar" ? "Bar chart" : "Heatmap"),
        ...(type.value === "groups" ? { groups } : { columns, values, scale: { type: scale.value } }) };
      validateAnnotationPanels([panel], getClusters(), { tree: getTree?.() });
      patch([{ type: "annotationPanels.create", panel }]);
      onCreate(panel.uid);
    });
  };
  return { node };
}

/** Data editing is optional UI; every change goes through the chart's patch API. */
function createAnnotationDataControls({ document, getPanels, getClusters, getTree, patch, annotationApi, embedded = false }) {
  installDataEditorStyle(document);
  installStyle(document);
  const { resolveAnnotationScale, ANNOTATION_PALETTES } = annotationApi;
  const toolbar = document.createElement("div"); toolbar.className = "cm-data-toolbar";
  const node = document.createElement("div"); node.className = "cm-data-ui cm-annotation-data-editor"; node.tabIndex = -1;
  let selected = null, applying = false, renderedPanel = null, renderedPanels = null, renderedClusters = null, filter = "", deleting = null, creating = false;
  let disposeView = () => {}, filterRows = () => {}, filterSelection = () => {};
  const selection = new RowSelection();
  let selectionPanel = null, batchColumn = "0", batchValue = "";
  const current = () => getPanels().find((panel) => panel.uid === selected);
  const { el, button, input, select } = createControls(document);
  const error = (message) => { node.querySelector('[data-data-error]').textContent = message; };
  const run = createActionRunner(error);
  const commit = (operations, refresh = true) => {
    applying = true;
    try { run(() => {
      patch(operations);
      if (refresh) render(); else { renderedPanel = current(); renderedPanels = getPanels(); }
    }); } finally { applying = false; }
  };
  const update = (changes, refresh = true) => commit([{ type: "annotationPanels.update", ids: [selected], changes }], refresh);
  const categoryScale = (panel, domain, colours) => ({ ...panel.scale, type: "categorical", domain,
    colours: colours.length ? colours : [...ANNOTATION_PALETTES.Qualitative] });
  const renderCategories = (parent, panel) => {
    const { domain, colour } = resolveAnnotationScale(panel), colours = domain.map(colour);

    domain.forEach((name, index) => {
      const row = el("div", undefined, parent); row.className = "cm-annotation-category";
      input(row, `Colour for ${name}`, colour(name), "color", (value) => {
        const next = [...colours]; next[index] = value; update({ scale: categoryScale(current(), domain, next) });
      });
      input(row, `Rename category ${name}`, name, "text", (value) => {
        if (!value.trim()) { error("Category names cannot be empty."); return; }
        update({ values: mapAnnotationValues(current().values, (item) => item === name ? value : item),
          scale: categoryScale(panel, domain.map((item) => item === name ? value : item), colours) });
      });
      button(row, "×", () => { deleting = name; render(); }).setAttribute("aria-label", `Remove category ${name}`);
      if (deleting === name) {
        const remove = el("div", undefined, parent); remove.className = "cm-annotation-category-remove";
        el("span", `Replace “${name}” with`, remove);
        // Index values keep the missing option distinct from arbitrary category names.
        const replacement = select(remove, "Replacement category", "missing", [["missing", "Missing"],
          ...domain.flatMap((item, i) => item === name ? [] : [[String(i), item]])], () => {});
        button(remove, "Remove", () => {
          const value = replacement.value === "missing" ? null : domain[Number(replacement.value)];
          deleting = null;
          update({ values: mapAnnotationValues(current().values, (item) => item === name ? value : item),
            scale: categoryScale(panel, domain.filter((item) => item !== name), colours.filter((_, i) => i !== index)) });
        });
        button(remove, "Cancel", () => { deleting = null; render(); });
      }
    });
    const row = el("div", undefined, parent); row.className = "cm-annotation-category";
    const used = new Set(colours.map((value) => colourHex(value)));
    const nextColour = ANNOTATION_PALETTES.Qualitative.find((value) => !used.has(colourHex(value))) ??
      ANNOTATION_PALETTES.Qualitative[domain.length % ANNOTATION_PALETTES.Qualitative.length];
    const swatch = input(row, "New category colour", nextColour, "color", () => {});
    const name = input(row, "New category name", "", "text", () => {}); name.placeholder = "New category";
    button(row, "+", () => {
      if (!name.value.trim()) { name.focus(); return; }
      update({ scale: categoryScale(panel, [...domain, name.value.trim()], [...colours, swatch.value]) });
    }).setAttribute("aria-label", "Add category");
  };
  const renderMatrix = (layout, panel) => {
    const categorical = panel.scale?.type === "categorical", resolved = resolveAnnotationScale(panel);
    if (categorical && batchValue !== "" && !resolved.domain[Number(batchValue)]) batchValue = "";
    const { viewport: tableArea } = layout;
    const all = input(null, "Select all filtered clusters", "", "checkbox", () => {});
    const selectionControls = createSelectionControls(layout, { selection, checkbox: all, onChange: () => syncSelection() });
    const batch = selectionControls.actions;
    const columns = select(batch, "Columns to edit", batchColumn,
      [["all", "All columns"], ...panel.columns.map((name, index) => [String(index), name])], (value) => { batchColumn = value; });
    const value = categorical
      ? select(batch, "Batch value", batchValue, [["", "Missing"], ...resolved.domain.map((name, index) => [String(index), name])], (value) => { batchValue = value; })
      : input(batch, "Batch value", batchValue, "number", (value) => { batchValue = value; });
    if (!categorical) value.placeholder = "Value";
    const applyValues = (clear) => {
      if (!clear && !value.checkValidity()) { value.reportValidity(); return; }
      const source = current(), values = { ...source.values };
      const next = clear || value.value === "" ? null : categorical ? resolved.domain[Number(value.value)] : Number(value.value);
      for (const uid of selection) {
        const row = [...(values[uid] || source.columns.map(() => null))];
        source.columns.forEach((_, index) => { if (columns.value === "all" || index === Number(columns.value)) row[index] = next; });
        values[uid] = row;
      }
      update({ values, ...(categorical && !source.scale?.domain ? { scale: categoryScale(source, resolved.domain, resolved.domain.map(resolved.colour)) } : {}) });
    };
    button(batch, "Set values", () => applyValues(false));
    button(batch, "Clear values", () => applyValues(true));
    tableArea.classList.add("cm-annotation-matrix");
    const table = el("table", undefined, tableArea), head = el("tr", undefined, el("thead", undefined, table));
    const cell = (tag, parent, selection = false) => { const node = createDataCell(document, tag, selection); parent.append(node); return node; };
    const selectionHead = cell("th", head, true);
    selectionHead.append(all);
    cell("th", head).textContent = "Cluster";
    panel.columns.forEach((column, index) => {
      const heading = cell("th", head), row = el("div", undefined, heading); row.className = "cm-annotation-column";
      input(row, `Column ${index + 1} name`, column, "text", (value) => {
        const columns = [...current().columns]; columns[index] = value; update({ columns });
      }).classList.add("cm-data-field");
      if (panel.type === "heatmap") {
        const remove = button(row, "×", () => update({ columns: panel.columns.filter((_, i) => i !== index),
          values: Object.fromEntries(Object.entries(current().values).map(([uid, values]) => [uid, values.filter((_, i) => i !== index)])) }));
        remove.disabled = panel.columns.length === 1; remove.setAttribute("aria-label", `Remove column ${column}`);
      }
    });
    for (const cell of head.children) cell.classList.add("cm-data-head");
    const extra = panel.type === "heatmap";
    if (extra) {
      const heading = cell("th", head); heading.classList.add("cm-data-head", "cm-annotation-add-column");
      const form = el("form", undefined, heading);
      const add = button(form, "+", () => { add.hidden = true; name.hidden = save.hidden = false; name.focus(); });
      add.setAttribute("aria-label", "Add column");
      const name = input(form, "New column name", "", "text", () => {}); name.placeholder = "Column name"; name.hidden = true;
      const save = button(form, "Add", () => {}); save.type = "submit"; save.hidden = true;
      form.onsubmit = (event) => {
        event.preventDefault();
        if (!name.value.trim()) return;
        update({ columns: [...panel.columns, name.value.trim()], values: Object.fromEntries(
          Object.entries(current().values).map(([uid, values]) => [uid, [...values, null]])) });
      };
      name.onkeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); name.hidden = save.hidden = true; add.hidden = false; add.focus(); } };
    }
    const body = el("tbody", undefined, table);
    let mounted = [];
    const rowIds = new WeakMap();
    const spacer = () => {
      const row = el("tr"), cell = el("td", undefined, row);
      row.className = "cm-annotation-spacer"; row.setAttribute("aria-hidden", "true");
      cell.colSpan = panel.columns.length + 2 + Number(extra); return row;
    };
    let clusters = [];
    const syncSelection = () => {
      selectionControls.update({ ids: clusters.map((cluster) => cluster.uid),
        summary: `${clusters.length.toLocaleString()} visible clusters`, noun: "cluster" });
      for (const row of mounted) {
        const checked = selection.has(rowIds.get(row));
        row.classList.toggle("is-selected", checked); row.setAttribute("aria-selected", String(checked));
        row.querySelector('input[type="checkbox"]').checked = checked;
      }
    };
    filterSelection = syncSelection;
    const toggleRow = (uid, checked, shift) => {
      selection.select(uid, checked, { range: shift, orderedIds: clusters.map((cluster) => cluster.uid) });
      syncSelection();
    };
    const createRow = (cluster) => {
      const row = el("tr"), selectionCell = cell("td", row, true);
      const check = input(selectionCell, `Select ${cluster.name || cluster.uid}`, "", "checkbox", () => {});
      check.onclick = (event) => toggleRow(cluster.uid, check.checked, event.shiftKey);
      const name = cell("th", row); name.textContent = cluster.name || cluster.uid;
      name.onclick = (event) => toggleRow(cluster.uid, !selection.has(cluster.uid), event.shiftKey);
      row.className = "cm-data-row"; rowIds.set(row, cluster.uid);
      name.scope = "row"; name.title = cluster.uid;
      panel.columns.forEach((column, index) => {
        const valueCell = cell("td", row), label = `${cluster.name || cluster.uid}: ${column}`;
        const value = current().values[cluster.uid]?.[index] ?? null;
        const change = (value) => {
          const source = current(), values = [...(source.values[cluster.uid] ?? source.columns.map(() => null))];
          values[index] = value;
          update({ values: { ...source.values, [cluster.uid]: values },
            ...(categorical && !source.scale?.domain ? { scale: categoryScale(source, resolved.domain, resolved.domain.map(resolved.colour)) } : {}),
          }, false);
        };
        if (categorical) select(valueCell, label, value === null ? "missing" : String(resolved.domain.indexOf(value)),
          [["missing", "Missing"], ...resolved.domain.map((item, i) => [String(i), item])],
          (key) => change(key === "missing" ? null : resolved.domain[Number(key)]));
        else {
          const field = input(valueCell, label, value, "number", (value) => change(value === "" ? null : Number(value)));
          field.placeholder = "—";
        }
      });
      for (const field of row.querySelectorAll("input:not([type=checkbox]),select")) field.classList.add("cm-data-field");
      if (extra) cell("td", row);
      return row;
    };
    const list = createVirtualRows({ viewport: tableArea, container: body, key: (cluster) => cluster.uid,
      createRow, createSpacer: spacer, headerHeight: () => head.offsetHeight,
      onRender: (nodes) => { mounted = nodes; table.setAttribute("aria-rowcount", clusters.length + 1); syncSelection(); } });
    disposeView = () => list.destroy();
    filterRows = () => {
      const needle = filter.trim().toLowerCase();
      clusters = getClusters().filter((cluster) => `${cluster.name} ${cluster.uid}`.toLowerCase().includes(needle));
      tableArea.scrollTop = 0; list.setRows(clusters);
    };
    filterRows();
  };
  const renderReplacement = (layout, panel) => {
    const parent = layout.tools;
    const categorical = panel.scale?.type === "categorical";
    const box = el("div", undefined, parent); box.className = "cm-annotation-replacement"; box.hidden = true;
    const data = el("textarea", undefined, box); data.rows = 5;
    data.setAttribute("aria-label", "Replacement annotation data (CSV, TSV or JSON)"); data.spellcheck = false;
    const actions = el("div", undefined, box); actions.className = "cm-data-toolbar";
    button(actions, "Replace data", () => {
      try {
        const changes = parseAnnotationTable(data.value, categorical);
        if (categorical) {
          const source = current(), scale = resolveAnnotationScale(source), domain = new Set(scale.domain);
          for (const row of Object.values(changes.values)) for (const value of row) if (value !== null) domain.add(value);
          const categories = [...domain];
          changes.scale = categoryScale(source, categories, categories.map((value, i) =>
            scale.domain.includes(value) ? scale.colour(value) : ANNOTATION_PALETTES.Qualitative[i % ANNOTATION_PALETTES.Qualitative.length]));
        }
        update(changes);
      } catch (exception) { error(exception.message); }
    });
    button(actions, "Cancel", () => { box.hidden = true; layout.sync(); });
    return () => {
      box.hidden = !box.hidden; layout.sync();
      if (!box.hidden) { data.value = annotationTableText(current(), getClusters()); data.focus(); }
    };
  };
  const renderGroups = (parent, panel) => {
    const editGroup = (index, changes) => update({ groups: current().groups.map((group, i) => i === index ? { ...group, ...changes } : group) });
    panel.groups.forEach((group, index) => {
      const box = el("fieldset", undefined, parent); el("legend", group.label || group.uid, box);
      const row = el("div", undefined, box); row.className = "cm-data-toolbar cm-annotation-data-toolbar";
      input(row, "Group label", group.label ?? group.uid, "text", (label) => editGroup(index, { label }));
      input(row, "Group colour", group.colour ?? panel.colour ?? "#267c9e", "color", (colour) => editGroup(index, { colour }));
      const remove = button(row, "Remove group", () => update({ groups: panel.groups.filter((_, i) => i !== index) }));
      remove.disabled = panel.groups.length === 1;
      const tree = getTree?.();
      select(row, "Membership", group.nodeUid === undefined ? "clusters" : "tree",
        [["clusters", "Selected clusters"], ...(tree ? [["tree", "Tree clade"]] : [])], (mode) => {
          const groups = [...current().groups];
          const { nodeUid, clusterIds, ...style } = groups[index];
          groups[index] = mode === "tree" ? { ...style, nodeUid: tree.root } : { ...style, clusterIds: [getClusters()[0].uid] };
          update({ groups });
        });
      if (group.nodeUid !== undefined) select(box, "Tree node", group.nodeUid,
        tree.nodes.map((node) => [node.uid, node.label || node.uid]), (nodeUid) => editGroup(index, { nodeUid }));
      else {
        const members = el("select", undefined, box); members.multiple = true; members.size = Math.min(5, getClusters().length);
        members.setAttribute("aria-label", `Clusters in ${group.label || group.uid}`);
        for (const cluster of getClusters()) {
          const option = el("option", `${cluster.name || cluster.uid} (${cluster.uid})`, members);
          option.value = cluster.uid; option.selected = group.clusterIds.includes(cluster.uid);
        }
        members.onchange = () => editGroup(index, { clusterIds: [...members.selectedOptions].map((option) => option.value) });
      }
    });
    button(parent, "Add group", () => {
      let serial = 1; while (panel.groups.some((group) => group.uid === `group-${serial}`)) serial++;
      update({ groups: [...panel.groups, { uid: `group-${serial}`, label: `Group ${serial}`, clusterIds: [getClusters()[0].uid] }] });
    });
  };
  function render() {
    const active = document.activeElement, restoreFocus = node.contains(active) || toolbar.contains(active);
    const samePanel = renderedPanel?.uid === selected;
    const scroll = samePanel ? node.querySelector(".cm-annotation-matrix")?.scrollTop || 0 : 0;
    const categoriesOpen = samePanel && node.querySelector(".cm-annotation-categories")?.open;
    disposeView(); disposeView = () => {}; filterRows = () => {}; filterSelection = () => {};
    node.replaceChildren();
    toolbar.replaceChildren();
    if (!embedded) node.append(toolbar);
    const panels = getPanels(); renderedPanels = panels; renderedClusters = getClusters();
    if (!panels.some((panel) => panel.uid === selected)) selected = panels[0]?.uid ?? null;
    if (panels.length) select(toolbar, "Annotation panel", selected, panels.map((panel) => [panel.uid, panel.title || panel.uid]),
      (uid) => { selected = uid; deleting = null; creating = false; render(); });
    button(toolbar, creating ? "Cancel" : "Add panel", () => { creating = !creating; render(); });
    const status = el("div", undefined, node); status.className = "cm-data-error"; status.dataset.dataError = ""; status.setAttribute("role", "alert");
    const body = el("div", undefined, node); body.className = "cm-annotation-data-body";
    if (creating) {
      const form = createAnnotationCreateControls({ document, getPanels, getClusters, getTree, patch, annotationApi,
        onCreate: (uid) => { selected = uid; creating = false; render(); } });
      body.append(form.node); return;
    }
    const panel = current(); renderedPanel = panel;
    if (selectionPanel !== panel?.uid) {
      selection.clear(); selectionPanel = panel?.uid; batchColumn = "0"; batchValue = "";
    }
    const validRows = new Set(getClusters().map((cluster) => cluster.uid));
    selection.prune(validRows);
    if (batchColumn !== "all" && Number(batchColumn) >= (panel?.columns?.length || 0)) batchColumn = "0";
    if (!panel) { el("p", "No annotation panels. Add a panel to attach data to cluster rows.", body); return; }
    const layout = createDataPanel(document, { label: "Editable annotation data" }); body.append(layout.node);
    if (panel.type !== "groups") button(toolbar, "Replace data…", renderReplacement(layout, panel));
    button(toolbar, panel.show === false ? "Show" : "Hide", () => update({ show: panel.show === false }));
    const index = panels.indexOf(panel);
    for (const [label, symbol, direction] of [["Move left", "←", -1], ["Move right", "→", 1]]) {
      const move = button(toolbar, symbol, () => {
        const ids = panels.map((item) => item.uid); [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
        commit([{ type: "annotationPanels.reorder", ids }]);
      });
      move.title = label; move.setAttribute("aria-label", label);
      move.disabled = index + direction < 0 || index + direction >= panels.length;
    }
    button(toolbar, "Remove", () => commit([{ type: "annotationPanels.delete", ids: [selected] }])).setAttribute("aria-label", "Remove panel");
    if (panel.type === "groups") { layout.meta.hidden = true; renderGroups(layout.viewport, panel); }
    else {
      if (panel.scale?.type === "categorical") {
        const categories = el("details", undefined, layout.tools); categories.className = "cm-annotation-categories";
        categories.open = categoriesOpen || deleting !== null;
        const summary = el("summary", "Categories", categories);
        const scale = resolveAnnotationScale(panel);
        for (const category of scale.domain) {
          const chip = el("span", category, summary); chip.className = "cm-annotation-category-chip";
          chip.style.setProperty("--category-colour", scale.colour(category));
        }
        renderCategories(el("div", undefined, categories), panel);
      }
      renderMatrix(layout, panel);
    }
    layout.sync();
    if (!embedded && panel.type !== "groups") {
      const search = createDataSearch(document, { placeholder: "Find a cluster", onInput: (value) => { filter = value; filterRows(); } });
      search.input.value = filter; toolbar.append(search.node);
    }
    const matrix = node.querySelector(".cm-annotation-matrix"); if (matrix) matrix.scrollTop = scroll;
    if (restoreFocus && !active.isConnected) node.focus({ preventScroll: true });
  }
  const clearSelection = () => { selection.clear(); filterSelection(); };
  node.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && selection.size) { event.preventDefault(); clearSelection(); }
  });
  render();
  return { node, toolbar, select(uid) { selected = uid; creating = false; deleting = null; render(); },
    clearSelection,
    get filter() { return filter; },
    setFilter(value) { filter = value; filterRows(); },
    destroy() { disposeView(); toolbar.remove(); },
    update() { if (!applying && (current() !== renderedPanel || getPanels() !== renderedPanels || getClusters() !== renderedClusters || !node.childElementCount)) render(); } };
}

function installStyle(document) {
  if (document.getElementById("cm-annotation-data-style")) return;
  const style = document.createElement("style"); style.id = "cm-annotation-data-style";
  style.textContent = `
@layer clinker-editor {
.cm-annotation-data-editor { --cm-control-height:30px; --cm-control-padding:4px 8px; --cm-control-radius:6px; outline:none; display:flex; flex-direction:column; gap:8px; min-height:0; }
.cm-annotation-data-toolbar { flex-wrap:wrap; }
.cm-annotation-data-toolbar > input { width:140px; }
.cm-annotation-data-editor .cm-data-toolbar > select { max-width:260px; }
.cm-annotation-data-toolbar label { display:flex; gap:4px; align-items:center; }
.cm-annotation-data-body { display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden; }
.cm-annotation-data-editor details { flex-shrink:0; }
.cm-annotation-data-editor summary { cursor:pointer; color:var(--cm-muted,#687586); }
.cm-annotation-categories { padding:0; }
.cm-annotation-categories > div { display:flex; flex-wrap:wrap; gap:6px 16px; padding:8px 0 2px; }
.cm-annotation-category-chip { display:inline-flex; align-items:center; gap:4px; margin-left:12px; font-size:12px; }
.cm-annotation-category-chip::before { content:""; width:9px; height:9px; border-radius:2px; background:var(--category-colour); }
.cm-annotation-category { display:flex; align-items:center; gap:5px; }
.cm-annotation-category input[type=text] { min-width:0; width:140px; }
.cm-annotation-category-remove { display:flex; flex-wrap:wrap; align-items:center; gap:5px; padding:6px; border:1px solid var(--cm-border,#cbd3de); border-radius:4px; }
.cm-annotation-matrix { position:relative; }
.cm-annotation-data-editor .cm-data-actions input[type=number] { width:112px; }
.cm-annotation-matrix table { border-collapse:separate; border-spacing:0; font-size:13px; width:max-content; min-width:100%; }

.cm-annotation-matrix thead th { position:sticky; top:0; z-index:2; background:var(--cm-subtle,#f3f6fa); }
.cm-annotation-matrix tr > :first-child { position:sticky; left:0; z-index:1; width:32px; min-width:32px; background:var(--cm-row-background,var(--cm-subtle,#f3f6fa)); }
.cm-annotation-matrix tr > :nth-child(2) { position:sticky; left:32px; z-index:1; }
.cm-annotation-matrix tbody th { background:var(--cm-row-background); }
.cm-annotation-matrix thead th:nth-child(-n+2) { z-index:3; background:var(--cm-subtle,#f3f6fa); }
.cm-annotation-matrix tbody th { cursor:pointer; min-width:200px; max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:400; }
.cm-annotation-matrix :is(input:not([type=checkbox]),select) { width:140px; }
.cm-annotation-column { display:flex; align-items:center; }
.cm-annotation-column input { font-weight:inherit; }
.cm-annotation-column button { visibility:hidden; border:0; padding:0 4px; min-height:24px; }
.cm-annotation-column:is(:hover,:focus-within) button { visibility:visible; }
.cm-annotation-add-column { width:36px; }
.cm-annotation-add-column form { display:flex; gap:4px; }
.cm-annotation-spacer > td { height:0; border:0; padding:0; }
.cm-annotation-data-editor fieldset { flex-shrink:0; border:1px solid var(--cm-border,#cbd3de); border-radius:4px; padding:8px; margin:0 0 8px; }
.cm-annotation-data-editor fieldset > select { margin-top:6px; max-width:100%; }
.cm-annotation-replacement { flex-shrink:0; }
.cm-annotation-data-editor textarea { display:block; width:100%; margin:6px 0; resize:vertical; }
.cm-annotation-data-editor [data-data-error] { color:var(--cm-danger,#b42318); }
.cm-annotation-data-editor [data-data-error]:empty { display:none; }

}
`;
  document.head.append(style);
}

function validateGroupPanel(panel, clusterIds, tree, fail) {
  if (!Array.isArray(panel.groups) || !panel.groups.length) fail("group panels require a non-empty groups array.");
  for (const key of ["markerWidth", "laneGap"]) {
    if (panel[key] !== undefined && (!Number.isFinite(panel[key]) || panel[key] <= 0)) fail(`${key} must be positive.`);
  }
  const ids = new Set(), nodes = new Set(tree?.nodes.map((node) => node.uid));
  for (const group of panel.groups) {
    if (!group || typeof group.uid !== "string" || !group.uid.trim() || ids.has(group.uid)) fail("groups require unique, non-empty uid strings.");
    ids.add(group.uid);
    if (group.label !== undefined && typeof group.label !== "string") fail("group label must be text.");
    if (group.colour !== undefined && (typeof group.colour !== "string" || !color(group.colour))) fail("group colour must be a CSS colour.");
    if ((group.nodeUid !== undefined) === (group.clusterIds !== undefined)) fail("each group requires either nodeUid or clusterIds.");
    if (group.nodeUid !== undefined) {
      if (!nodes.has(group.nodeUid)) fail(`unknown tree node '${group.nodeUid}'.`);
    } else if (!Array.isArray(group.clusterIds) || !group.clusterIds.length ||
        new Set(group.clusterIds).size !== group.clusterIds.length || group.clusterIds.some((uid) => !clusterIds.has(uid))) {
      fail("group clusterIds must contain unique, existing cluster IDs.");
    }
  }
}

function ascending(a, b) {
  return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function descending(a, b) {
  return a == null || b == null ? NaN
    : b < a ? -1
    : b > a ? 1
    : b >= a ? 0
    : NaN;
}

function bisector(f) {
  let compare1, compare2, delta;

  // If an accessor is specified, promote it to a comparator. In this case we
  // can test whether the search value is (self-) comparable. We can’t do this
  // for a comparator (except for specific, known comparators) because we can’t
  // tell if the comparator is symmetric, and an asymmetric comparator can’t be
  // used to test whether a single value is comparable.
  if (f.length !== 2) {
    compare1 = ascending;
    compare2 = (d, x) => ascending(f(d), x);
    delta = (d, x) => f(d) - x;
  } else {
    compare1 = f === ascending || f === descending ? f : zero$1;
    compare2 = f;
    delta = f;
  }

  function left(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) < 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function right(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) <= 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function center(a, x, lo = 0, hi = a.length) {
    const i = left(a, x, lo, hi - 1);
    return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
  }

  return {left, center, right};
}

function zero$1() {
  return 0;
}

function number$1(x) {
  return x === null ? NaN : +x;
}

const ascendingBisect = bisector(ascending);
const bisectRight = ascendingBisect.right;
bisector(number$1).center;
var bisect = bisectRight;

class InternMap extends Map {
  constructor(entries, key = keyof) {
    super();
    Object.defineProperties(this, {_intern: {value: new Map()}, _key: {value: key}});
    if (entries != null) for (const [key, value] of entries) this.set(key, value);
  }
  get(key) {
    return super.get(intern_get(this, key));
  }
  has(key) {
    return super.has(intern_get(this, key));
  }
  set(key, value) {
    return super.set(intern_set(this, key), value);
  }
  delete(key) {
    return super.delete(intern_delete(this, key));
  }
}

function intern_get({_intern, _key}, value) {
  const key = _key(value);
  return _intern.has(key) ? _intern.get(key) : value;
}

function intern_set({_intern, _key}, value) {
  const key = _key(value);
  if (_intern.has(key)) return _intern.get(key);
  _intern.set(key, value);
  return value;
}

function intern_delete({_intern, _key}, value) {
  const key = _key(value);
  if (_intern.has(key)) {
    value = _intern.get(key);
    _intern.delete(key);
  }
  return value;
}

function keyof(value) {
  return value !== null && typeof value === "object" ? value.valueOf() : value;
}

const e10 = Math.sqrt(50),
    e5 = Math.sqrt(10),
    e2 = Math.sqrt(2);

function tickSpec(start, stop, count) {
  const step = (stop - start) / Math.max(0, count),
      power = Math.floor(Math.log10(step)),
      error = step / Math.pow(10, power),
      factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
  let i1, i2, inc;
  if (power < 0) {
    inc = Math.pow(10, -power) / factor;
    i1 = Math.round(start * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = Math.pow(10, power) * factor;
    i1 = Math.round(start / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start, stop, count * 2);
  return [i1, i2, inc];
}

function ticks(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const reverse = stop < start, [i1, i2, inc] = reverse ? tickSpec(stop, start, count) : tickSpec(start, stop, count);
  if (!(i2 >= i1)) return [];
  const n = i2 - i1 + 1, ticks = new Array(n);
  if (reverse) {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) / -inc;
    else for (let i = 0; i < n; ++i) ticks[i] = (i2 - i) * inc;
  } else {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) / -inc;
    else for (let i = 0; i < n; ++i) ticks[i] = (i1 + i) * inc;
  }
  return ticks;
}

function tickIncrement(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  return tickSpec(start, stop, count)[2];
}

function tickStep(start, stop, count) {
  stop = +stop, start = +start, count = +count;
  const reverse = stop < start, inc = reverse ? tickIncrement(stop, start, count) : tickIncrement(start, stop, count);
  return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
}

function initRange(domain, range) {
  switch (arguments.length) {
    case 0: break;
    case 1: this.range(domain); break;
    default: this.range(range).domain(domain); break;
  }
  return this;
}

const implicit = Symbol("implicit");

function ordinal() {
  var index = new InternMap(),
      domain = [],
      range = [],
      unknown = implicit;

  function scale(d) {
    let i = index.get(d);
    if (i === undefined) {
      if (unknown !== implicit) return unknown;
      index.set(d, i = domain.push(d) - 1);
    }
    return range[i % range.length];
  }

  scale.domain = function(_) {
    if (!arguments.length) return domain.slice();
    domain = [], index = new InternMap();
    for (const value of _) {
      if (index.has(value)) continue;
      index.set(value, domain.push(value) - 1);
    }
    return scale;
  };

  scale.range = function(_) {
    return arguments.length ? (range = Array.from(_), scale) : range.slice();
  };

  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  scale.copy = function() {
    return ordinal(domain, range).unknown(unknown);
  };

  initRange.apply(scale, arguments);

  return scale;
}

var constant = x => () => x;

function linear$1(a, d) {
  return function(t) {
    return a + t * d;
  };
}

function exponential(a, b, y) {
  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
    return Math.pow(a + t * b, y);
  };
}

function gamma(y) {
  return (y = +y) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y) : constant(isNaN(a) ? b : a);
  };
}

function nogamma(a, b) {
  var d = b - a;
  return d ? linear$1(a, d) : constant(isNaN(a) ? b : a);
}

var rgb = (function rgbGamma(y) {
  var color = gamma(y);

  function rgb(start, end) {
    var r = color((start = rgb$1(start)).r, (end = rgb$1(end)).r),
        g = color(start.g, end.g),
        b = color(start.b, end.b),
        opacity = nogamma(start.opacity, end.opacity);
    return function(t) {
      start.r = r(t);
      start.g = g(t);
      start.b = b(t);
      start.opacity = opacity(t);
      return start + "";
    };
  }

  rgb.gamma = rgbGamma;

  return rgb;
})(1);

function numberArray(a, b) {
  if (!b) b = [];
  var n = a ? Math.min(b.length, a.length) : 0,
      c = b.slice(),
      i;
  return function(t) {
    for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
    return c;
  };
}

function isNumberArray(x) {
  return ArrayBuffer.isView(x) && !(x instanceof DataView);
}

function genericArray(a, b) {
  var nb = b ? b.length : 0,
      na = a ? Math.min(nb, a.length) : 0,
      x = new Array(na),
      c = new Array(nb),
      i;

  for (i = 0; i < na; ++i) x[i] = interpolate(a[i], b[i]);
  for (; i < nb; ++i) c[i] = b[i];

  return function(t) {
    for (i = 0; i < na; ++i) c[i] = x[i](t);
    return c;
  };
}

function date(a, b) {
  var d = new Date;
  return a = +a, b = +b, function(t) {
    return d.setTime(a * (1 - t) + b * t), d;
  };
}

function interpolateNumber(a, b) {
  return a = +a, b = +b, function(t) {
    return a * (1 - t) + b * t;
  };
}

function object$1(a, b) {
  var i = {},
      c = {},
      k;

  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};

  for (k in b) {
    if (k in a) {
      i[k] = interpolate(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }

  return function(t) {
    for (k in i) c[k] = i[k](t);
    return c;
  };
}

var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
    reB = new RegExp(reA.source, "g");

function zero(b) {
  return function() {
    return b;
  };
}

function one(b) {
  return function(t) {
    return b(t) + "";
  };
}

function string(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
      am, // current match in a
      bm, // current match in b
      bs, // string preceding current number in b, if any
      i = -1, // index in s
      s = [], // string constants and placeholders
      q = []; // number interpolators

  // Coerce inputs to strings.
  a = a + "", b = b + "";

  // Interpolate pairs of numbers in a & b.
  while ((am = reA.exec(a))
      && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) { // a string precedes the next number in b
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
      if (s[i]) s[i] += bm; // coalesce with previous string
      else s[++i] = bm;
    } else { // interpolate non-matching numbers
      s[++i] = null;
      q.push({i: i, x: interpolateNumber(am, bm)});
    }
    bi = reB.lastIndex;
  }

  // Add remains of b.
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs; // coalesce with previous string
    else s[++i] = bs;
  }

  // Special optimization for only a single match.
  // Otherwise, interpolate each of the numbers and rejoin the string.
  return s.length < 2 ? (q[0]
      ? one(q[0].x)
      : zero(b))
      : (b = q.length, function(t) {
          for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
          return s.join("");
        });
}

function interpolate(a, b) {
  var t = typeof b, c;
  return b == null || t === "boolean" ? constant(b)
      : (t === "number" ? interpolateNumber
      : t === "string" ? ((c = color(b)) ? (b = c, rgb) : string)
      : b instanceof color ? rgb
      : b instanceof Date ? date
      : isNumberArray(b) ? numberArray
      : Array.isArray(b) ? genericArray
      : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object$1
      : interpolateNumber)(a, b);
}

function interpolateRound(a, b) {
  return a = +a, b = +b, function(t) {
    return Math.round(a * (1 - t) + b * t);
  };
}

function constants(x) {
  return function() {
    return x;
  };
}

function number(x) {
  return +x;
}

var unit = [0, 1];

function identity$1(x) {
  return x;
}

function normalize(a, b) {
  return (b -= (a = +a))
      ? function(x) { return (x - a) / b; }
      : constants(isNaN(b) ? NaN : 0.5);
}

function clamper(a, b) {
  var t;
  if (a > b) t = a, a = b, b = t;
  return function(x) { return Math.max(a, Math.min(b, x)); };
}

// normalize(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
// interpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding range value x in [a,b].
function bimap(domain, range, interpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
  if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
  else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
  return function(x) { return r0(d0(x)); };
}

function polymap(domain, range, interpolate) {
  var j = Math.min(domain.length, range.length) - 1,
      d = new Array(j),
      r = new Array(j),
      i = -1;

  // Reverse descending domains.
  if (domain[j] < domain[0]) {
    domain = domain.slice().reverse();
    range = range.slice().reverse();
  }

  while (++i < j) {
    d[i] = normalize(domain[i], domain[i + 1]);
    r[i] = interpolate(range[i], range[i + 1]);
  }

  return function(x) {
    var i = bisect(domain, x, 1, j) - 1;
    return r[i](d[i](x));
  };
}

function copy(source, target) {
  return target
      .domain(source.domain())
      .range(source.range())
      .interpolate(source.interpolate())
      .clamp(source.clamp())
      .unknown(source.unknown());
}

function transformer() {
  var domain = unit,
      range = unit,
      interpolate$1 = interpolate,
      transform,
      untransform,
      unknown,
      clamp = identity$1,
      piecewise,
      output,
      input;

  function rescale() {
    var n = Math.min(domain.length, range.length);
    if (clamp !== identity$1) clamp = clamper(domain[0], domain[n - 1]);
    piecewise = n > 2 ? polymap : bimap;
    output = input = null;
    return scale;
  }

  function scale(x) {
    return x == null || isNaN(x = +x) ? unknown : (output || (output = piecewise(domain.map(transform), range, interpolate$1)))(transform(clamp(x)));
  }

  scale.invert = function(y) {
    return clamp(untransform((input || (input = piecewise(range, domain.map(transform), interpolateNumber)))(y)));
  };

  scale.domain = function(_) {
    return arguments.length ? (domain = Array.from(_, number), rescale()) : domain.slice();
  };

  scale.range = function(_) {
    return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
  };

  scale.rangeRound = function(_) {
    return range = Array.from(_), interpolate$1 = interpolateRound, rescale();
  };

  scale.clamp = function(_) {
    return arguments.length ? (clamp = _ ? true : identity$1, rescale()) : clamp !== identity$1;
  };

  scale.interpolate = function(_) {
    return arguments.length ? (interpolate$1 = _, rescale()) : interpolate$1;
  };

  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  return function(t, u) {
    transform = t, untransform = u;
    return rescale();
  };
}

function continuous() {
  return transformer()(identity$1, identity$1);
}

function formatDecimal(x) {
  return Math.abs(x = Math.round(x)) >= 1e21
      ? x.toLocaleString("en").replace(/,/g, "")
      : x.toString(10);
}

// Computes the decimal coefficient and exponent of the specified number x with
// significant digits p, where x is positive and p is in [1, 21] or undefined.
// For example, formatDecimalParts(1.23) returns ["123", 0].
function formatDecimalParts(x, p) {
  if (!isFinite(x) || x === 0) return null; // NaN, ±Infinity, ±0
  var i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e"), coefficient = x.slice(0, i);

  // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
  // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
  return [
    coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
    +x.slice(i + 1)
  ];
}

function exponent(x) {
  return x = formatDecimalParts(Math.abs(x)), x ? x[1] : NaN;
}

function formatGroup(grouping, thousands) {
  return function(value, width) {
    var i = value.length,
        t = [],
        j = 0,
        g = grouping[0],
        length = 0;

    while (i > 0 && g > 0) {
      if (length + g + 1 > width) g = Math.max(1, width - length);
      t.push(value.substring(i -= g, i + g));
      if ((length += g + 1) > width) break;
      g = grouping[j = (j + 1) % grouping.length];
    }

    return t.reverse().join(thousands);
  };
}

function formatNumerals(numerals) {
  return function(value) {
    return value.replace(/[0-9]/g, function(i) {
      return numerals[+i];
    });
  };
}

// [[fill]align][sign][symbol][0][width][,][.precision][~][type]
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

function formatSpecifier(specifier) {
  if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
  var match;
  return new FormatSpecifier({
    fill: match[1],
    align: match[2],
    sign: match[3],
    symbol: match[4],
    zero: match[5],
    width: match[6],
    comma: match[7],
    precision: match[8] && match[8].slice(1),
    trim: match[9],
    type: match[10]
  });
}

formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

function FormatSpecifier(specifier) {
  this.fill = specifier.fill === undefined ? " " : specifier.fill + "";
  this.align = specifier.align === undefined ? ">" : specifier.align + "";
  this.sign = specifier.sign === undefined ? "-" : specifier.sign + "";
  this.symbol = specifier.symbol === undefined ? "" : specifier.symbol + "";
  this.zero = !!specifier.zero;
  this.width = specifier.width === undefined ? undefined : +specifier.width;
  this.comma = !!specifier.comma;
  this.precision = specifier.precision === undefined ? undefined : +specifier.precision;
  this.trim = !!specifier.trim;
  this.type = specifier.type === undefined ? "" : specifier.type + "";
}

FormatSpecifier.prototype.toString = function() {
  return this.fill
      + this.align
      + this.sign
      + this.symbol
      + (this.zero ? "0" : "")
      + (this.width === undefined ? "" : Math.max(1, this.width | 0))
      + (this.comma ? "," : "")
      + (this.precision === undefined ? "" : "." + Math.max(0, this.precision | 0))
      + (this.trim ? "~" : "")
      + this.type;
};

// Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
function formatTrim(s) {
  out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
    switch (s[i]) {
      case ".": i0 = i1 = i; break;
      case "0": if (i0 === 0) i0 = i; i1 = i; break;
      default: if (!+s[i]) break out; if (i0 > 0) i0 = 0; break;
    }
  }
  return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
}

var prefixExponent;

function formatPrefixAuto(x, p) {
  var d = formatDecimalParts(x, p);
  if (!d) return prefixExponent = undefined, x.toPrecision(p);
  var coefficient = d[0],
      exponent = d[1],
      i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
      n = coefficient.length;
  return i === n ? coefficient
      : i > n ? coefficient + new Array(i - n + 1).join("0")
      : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
      : "0." + new Array(1 - i).join("0") + formatDecimalParts(x, Math.max(0, p + i - 1))[0]; // less than 1y!
}

function formatRounded(x, p) {
  var d = formatDecimalParts(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
      : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
      : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

var formatTypes = {
  "%": (x, p) => (x * 100).toFixed(p),
  "b": (x) => Math.round(x).toString(2),
  "c": (x) => x + "",
  "d": formatDecimal,
  "e": (x, p) => x.toExponential(p),
  "f": (x, p) => x.toFixed(p),
  "g": (x, p) => x.toPrecision(p),
  "o": (x) => Math.round(x).toString(8),
  "p": (x, p) => formatRounded(x * 100, p),
  "r": formatRounded,
  "s": formatPrefixAuto,
  "X": (x) => Math.round(x).toString(16).toUpperCase(),
  "x": (x) => Math.round(x).toString(16)
};

function identity(x) {
  return x;
}

var map = Array.prototype.map,
    prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

function formatLocale(locale) {
  var group = locale.grouping === undefined || locale.thousands === undefined ? identity : formatGroup(map.call(locale.grouping, Number), locale.thousands + ""),
      currencyPrefix = locale.currency === undefined ? "" : locale.currency[0] + "",
      currencySuffix = locale.currency === undefined ? "" : locale.currency[1] + "",
      decimal = locale.decimal === undefined ? "." : locale.decimal + "",
      numerals = locale.numerals === undefined ? identity : formatNumerals(map.call(locale.numerals, String)),
      percent = locale.percent === undefined ? "%" : locale.percent + "",
      minus = locale.minus === undefined ? "−" : locale.minus + "",
      nan = locale.nan === undefined ? "NaN" : locale.nan + "";

  function newFormat(specifier, options) {
    specifier = formatSpecifier(specifier);

    var fill = specifier.fill,
        align = specifier.align,
        sign = specifier.sign,
        symbol = specifier.symbol,
        zero = specifier.zero,
        width = specifier.width,
        comma = specifier.comma,
        precision = specifier.precision,
        trim = specifier.trim,
        type = specifier.type;

    // The "n" type is an alias for ",g".
    if (type === "n") comma = true, type = "g";

    // The "" type, and any invalid type, is an alias for ".12~g".
    else if (!formatTypes[type]) precision === undefined && (precision = 12), trim = true, type = "g";

    // If zero fill is specified, padding goes after sign and before digits.
    if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

    // Compute the prefix and suffix.
    // For SI-prefix, the suffix is lazily computed.
    var prefix = (options && options.prefix !== undefined ? options.prefix : "") + (symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : ""),
        suffix = (symbol === "$" ? currencySuffix : /[%p]/.test(type) ? percent : "") + (options && options.suffix !== undefined ? options.suffix : "");

    // What format function should we use?
    // Is this an integer type?
    // Can this type generate exponential notation?
    var formatType = formatTypes[type],
        maybeSuffix = /[defgprs%]/.test(type);

    // Set the default precision if not specified,
    // or clamp the specified precision to the supported range.
    // For significant precision, it must be in [1, 21].
    // For fixed precision, it must be in [0, 20].
    precision = precision === undefined ? 6
        : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
        : Math.max(0, Math.min(20, precision));

    function format(value) {
      var valuePrefix = prefix,
          valueSuffix = suffix,
          i, n, c;

      if (type === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value;

        // Determine the sign. -0 is not less than 0, but 1 / -0 is!
        var valueNegative = value < 0 || 1 / value < 0;

        // Perform the initial formatting.
        value = isNaN(value) ? nan : formatType(Math.abs(value), precision);

        // Trim insignificant zeros.
        if (trim) value = formatTrim(value);

        // If a negative value rounds to zero after formatting, and no explicit positive sign is requested, hide the sign.
        if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;

        // Compute the prefix and suffix.
        valuePrefix = (valueNegative ? (sign === "(" ? sign : minus) : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
        valueSuffix = (type === "s" && !isNaN(value) && prefixExponent !== undefined ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

        // Break the formatted value into the integer “value” part that can be
        // grouped, and fractional or exponential “suffix” part that is not.
        if (maybeSuffix) {
          i = -1, n = value.length;
          while (++i < n) {
            if (c = value.charCodeAt(i), 48 > c || c > 57) {
              valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
              value = value.slice(0, i);
              break;
            }
          }
        }
      }

      // If the fill character is not "0", grouping is applied before padding.
      if (comma && !zero) value = group(value, Infinity);

      // Compute the padding.
      var length = valuePrefix.length + value.length + valueSuffix.length,
          padding = length < width ? new Array(width - length + 1).join(fill) : "";

      // If the fill character is "0", grouping is applied after padding.
      if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

      // Reconstruct the final output based on the desired alignment.
      switch (align) {
        case "<": value = valuePrefix + value + valueSuffix + padding; break;
        case "=": value = valuePrefix + padding + value + valueSuffix; break;
        case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
        default: value = padding + valuePrefix + value + valueSuffix; break;
      }

      return numerals(value);
    }

    format.toString = function() {
      return specifier + "";
    };

    return format;
  }

  function formatPrefix(specifier, value) {
    var e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
        k = Math.pow(10, -e),
        f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier), {suffix: prefixes[8 + e / 3]});
    return function(value) {
      return f(k * value);
    };
  }

  return {
    format: newFormat,
    formatPrefix: formatPrefix
  };
}

var locale;
var format;
var formatPrefix;

defaultLocale({
  thousands: ",",
  grouping: [3],
  currency: ["$", ""]
});

function defaultLocale(definition) {
  locale = formatLocale(definition);
  format = locale.format;
  formatPrefix = locale.formatPrefix;
  return locale;
}

function precisionFixed(step) {
  return Math.max(0, -exponent(Math.abs(step)));
}

function precisionPrefix(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
}

function precisionRound(step, max) {
  step = Math.abs(step), max = Math.abs(max) - step;
  return Math.max(0, exponent(max) - exponent(step)) + 1;
}

function tickFormat(start, stop, count, specifier) {
  var step = tickStep(start, stop, count),
      precision;
  specifier = formatSpecifier(specifier == null ? ",f" : specifier);
  switch (specifier.type) {
    case "s": {
      var value = Math.max(Math.abs(start), Math.abs(stop));
      if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
      return formatPrefix(specifier, value);
    }
    case "":
    case "e":
    case "g":
    case "p":
    case "r": {
      if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
      break;
    }
    case "f":
    case "%": {
      if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
      break;
    }
  }
  return format(specifier);
}

function linearish(scale) {
  var domain = scale.domain;

  scale.ticks = function(count) {
    var d = domain();
    return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
  };

  scale.tickFormat = function(count, specifier) {
    var d = domain();
    return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
  };

  scale.nice = function(count) {
    if (count == null) count = 10;

    var d = domain();
    var i0 = 0;
    var i1 = d.length - 1;
    var start = d[i0];
    var stop = d[i1];
    var prestep;
    var step;
    var maxIter = 10;

    if (stop < start) {
      step = start, start = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }

    while (maxIter-- > 0) {
      step = tickIncrement(start, stop, count);
      if (step === prestep) {
        d[i0] = start;
        d[i1] = stop;
        return domain(d);
      } else if (step > 0) {
        start = Math.floor(start / step) * step;
        stop = Math.ceil(stop / step) * step;
      } else if (step < 0) {
        start = Math.ceil(start * step) / step;
        stop = Math.floor(stop * step) / step;
      } else {
        break;
      }
      prestep = step;
    }

    return scale;
  };

  return scale;
}

function linear() {
  var scale = continuous();

  scale.copy = function() {
    return copy(scale, linear());
  };

  initRange.apply(scale, arguments);

  return linearish(scale);
}

const sequential = ["#f7fbff", "#08306b"];
const categorical = ["#4477aa", "#ee6677", "#228833", "#ccbb44", "#66ccee", "#aa3377", "#bbbbbb"];
const ANNOTATION_DEFAULTS = Object.freeze({ cellWidth: 32, cellHeight: 20, gap: 24,
  fontSize: 10, headingRotation: -60, missingColour: "#eeeeee",
  cellGap: 0, cellBorderWidth: 0, cellBorderColour: "#ffffff", width: 120, colour: "#267c9e" });
const ANNOTATION_PALETTES = {
  Blue: sequential,
  "Blue–red": ["#2166ac", "#f7f7f7", "#b2182b"],
  Viridis: ["#440154", "#21918c", "#fde725"],
  Qualitative: categorical,
};

// Validate at the JSON boundary; renderers only consume projected records.
function validateAnnotationPanels(panels, clusters, { previousPanels = null, tree = null } = {}) {
  if (panels == null) return;
  const fail = (message) => { throw new TypeError(`Invalid annotationPanels: ${message}`); };
  if (!Array.isArray(panels)) fail("expected an array.");
  const ids = new Set(), previous = new Map(previousPanels?.map((panel) => [panel.uid, panel]));
  let clusterIds;
  for (const panel of panels) {
    if (!panel || typeof panel !== "object") fail("each panel must be an object.");
    if (typeof panel.uid !== "string" || !panel.uid.trim() || ids.has(panel.uid)) fail("panels require unique, non-empty uid strings.");
    ids.add(panel.uid);
    const before = previous.get(panel.uid);
    if (before === panel) continue;
    if (!["heatmap", "bar", "groups"].includes(panel.type)) fail(`unsupported type for '${panel.uid}'; expected heatmap, bar or groups.`);
    if (panel.title != null && typeof panel.title !== "string") fail("title must be text.");
    for (const key of ["show", "showKey", "showColumnLabels"]) {
      if (panel[key] !== undefined && typeof panel[key] !== "boolean") fail(`${key} must be a boolean.`);
    }
    if (panel.headingRotation !== undefined && (!Number.isFinite(panel.headingRotation) || panel.headingRotation < -90 || panel.headingRotation > 0)) fail("headingRotation must be between -90 and 0 degrees.");
    for (const key of ["cellWidth", "cellHeight", "fontSize", "width"]) {
      if (panel[key] !== undefined && (!Number.isFinite(panel[key]) || panel[key] <= 0)) fail(`${key} must be positive.`);
    }
    if (panel.gap !== undefined && (!Number.isFinite(panel.gap) || panel.gap < 0)) fail("gap must be non-negative.");
    for (const key of ["cellGap", "cellBorderWidth"]) {
      if (panel[key] !== undefined && (!Number.isFinite(panel[key]) || panel[key] < 0)) fail(`${key} must be non-negative.`);
    }
    if ((panel.cellGap ?? 0) >= Math.min(panel.cellWidth ?? ANNOTATION_DEFAULTS.cellWidth,
      panel.cellHeight ?? ANNOTATION_DEFAULTS.cellHeight)) fail("cellGap must be smaller than cellWidth and cellHeight.");
    if (panel.cellBorderColour !== undefined && (typeof panel.cellBorderColour !== "string" || !color(panel.cellBorderColour))) fail("cellBorderColour must be a CSS colour.");
    if (panel.colour !== undefined && (typeof panel.colour !== "string" || !color(panel.colour))) fail("colour must be a CSS colour.");
    if (panel.type === "groups") {
      clusterIds ??= new Set(clusters.map((cluster) => cluster.uid));
      validateGroupPanel(panel, clusterIds, tree, fail);
      continue;
    }
    if (!Array.isArray(panel.columns) || !panel.columns.length ||
        panel.columns.some((column) => typeof column !== "string" || !column.trim()) ||
        new Set(panel.columns).size !== panel.columns.length) fail("columns must be unique, non-empty strings.");
    if (panel.type === "bar" && panel.columns.length !== 1) fail("bar panels require exactly one column.");
    if (!panel.values || typeof panel.values !== "object" || Array.isArray(panel.values)) fail("values must map cluster IDs to row arrays.");
    const scale = panel.scale ?? {};
    if (!scale || typeof scale !== "object" || Array.isArray(scale)) fail("scale must be an object.");
    const type = scale.type ?? "continuous";
    if (panel.type === "bar" && type !== "continuous") fail("bar panels require a continuous scale.");
    if (!["continuous", "categorical"].includes(type)) fail("scale.type must be continuous or categorical.");
    if (scale.colours !== undefined && (!Array.isArray(scale.colours) || !scale.colours.length ||
        scale.colours.some((value) => typeof value !== "string" || !color(value)))) fail("scale.colours must contain valid CSS colours.");
    if (type === "continuous" && scale.colours?.length < 2) fail("continuous scales need at least two colours.");
    if (panel.missingColour !== undefined && (typeof panel.missingColour !== "string" || !color(panel.missingColour))) fail("missingColour must be a CSS colour.");
    if (scale.domain !== undefined) {
      if (!Array.isArray(scale.domain)) fail("scale.domain must be an array.");
      if (type === "continuous" && (scale.domain.length !== 2 || !scale.domain.every(Number.isFinite) || scale.domain[0] >= scale.domain[1])) fail("continuous domain must be [min, max] with min < max.");
      if (panel.type === "bar" && (scale.domain[0] > 0 || scale.domain[1] < 0)) fail("bar domains must include zero.");
      if (type === "categorical" && (scale.domain.some((value) => typeof value !== "string") || new Set(scale.domain).size !== scale.domain.length)) fail("categorical domain must contain unique strings.");
    }
    // Presentation changes leave the matrix valid unless they change its
    // shape, value type or allowed categories. JSON loading always checks it.
    const oldScale = before?.scale ?? {};
    const sameCategories = sameArray(oldScale.domain, scale.domain);
    if (before?.values === panel.values && before.columns?.length === panel.columns.length &&
        (oldScale.type ?? "continuous") === type && (type !== "categorical" || sameCategories)) continue;
    clusterIds ??= new Set(clusters.map((cluster) => cluster.uid));
    const categories = type === "categorical" && scale.domain ? new Set(scale.domain) : null;
    for (const [uid, values] of Object.entries(panel.values)) {
      if (!clusterIds.has(uid)) fail(`unknown cluster '${uid}'.`);
      if (!Array.isArray(values) || values.length !== panel.columns.length) fail(`row '${uid}' must have one value per column.`);
      for (const value of values) {
        if (value === null) continue;
        if (type === "continuous" ? !Number.isFinite(value) : typeof value !== "string") fail(`invalid ${type} value in row '${uid}'.`);
        if (categories && !categories.has(value)) fail(`category '${value}' is absent from scale.domain.`);
      }
    }
  }
}

// Values are replaced at data boundaries and shared by presentation edits.
// Retain only their inferred domain, not a second flattened copy of the matrix.
const domainCache = new WeakMap();
function inferredDomain(values, type, isBar) {
  let cached = domainCache.get(values);
  if (!cached) { cached = {}; domainCache.set(values, cached); }
  const key = type === "categorical" ? "categories" : isBar ? "bars" : "numeric";
  if (cached[key]) return cached[key];
  const categories = new Set();
  let min = Infinity, max = -Infinity, count = 0;
  for (const row of Object.values(values)) for (const value of row) {
    if (value === null) continue;
    count++;
    if (type === "categorical") categories.add(value);
    else { min = Math.min(min, value); max = Math.max(max, value); }
  }
  if (isBar) { min = Math.min(0, min); max = Math.max(0, max); }
  return cached[key] = type === "categorical" ? [...categories]
    : !count || isBar && min === max ? [0, 1]
    : min === max ? [min - 0.5, max + 0.5] : [min, max];
}

/** Resolve scales identically for layout and the appearance editor. */
function resolveAnnotationScale(source) {
  const scale = source.scale ?? {}, type = scale.type ?? "continuous";
  const domain = scale.domain ?? inferredDomain(source.values, type, source.type === "bar");
  const colours = scale.colours ?? (type === "continuous" ? sequential : categorical);
  const colour = type === "categorical"
    ? ordinal(domain, colours).unknown(source.missingColour ?? "#eeeeee")
    : linear().domain(colours.map((_, i) => domain[0] + (domain[1] - domain[0]) * i / (colours.length - 1))).range(colours).clamp(true);
  return { type, domain, colours, colour };
}

const sameArray = (one, two) => one === two || Array.isArray(one) && Array.isArray(two) &&
  one.length === two.length && one.every((value, index) => value === two[index]);
Object.freeze([]);

const palettes = {
  light: { mode: "light", background: "#ffffff", foreground: "#20252c", muted: "#687586",
    branch: "#555555", guide: "#999999", outline: "#111111", surface: "#ffffff", border: "#cbd3de", missing: "#eeeeee", subtle: "#f3f6fa", hover: "#e3ecf8", selection: "#d6e6fc", accent: "#1677ff", danger: "#b42318" },
  dark: { mode: "dark", background: "#171b22", foreground: "#e5eaf1", muted: "#a0adbd",
    branch: "#bac4d1", guide: "#748193", outline: "#c9d2df", surface: "#232a35", border: "#465365", missing: "#39414e", subtle: "#293241", hover: "#354660", selection: "#3a5276", accent: "#85b7ff", danger: "#ffaaa3" },
};

function resolveTheme(mode = "auto") {
  const dark = mode === "dark" || mode === "auto" && globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return palettes[dark ? "dark" : "light"];
}

/** Figure colours are independent of the interface/system theme. */
function figureConfig(config) {
  if (config.figureStyle) return config;
  const theme = { background: config.plot.background, foreground: "#000000",
    outline: "#000000", branch: "#555555", guide: "#999999",
    muted: "#687586", missing: "#eeeeee" };
  return { ...config, figureStyle: theme,
    tree: { ...config.tree, textColour: theme.foreground,
      branch: { ...config.tree.branch, colour: config.tree.branch.colour ?? theme.branch },
      leafGuide: { ...config.tree.leafGuide, colour: config.tree.leafGuide.colour ?? theme.guide } },
    gene: { ...config.gene, shape: { ...config.gene.shape, stroke: config.gene.shape.stroke ?? theme.outline } },
    locus: { ...config.locus, trackBar: { ...config.locus.trackBar, colour: config.locus.trackBar.colour ?? theme.outline } },
    scaleBar: { ...config.scaleBar, colour: config.scaleBar.colour ?? theme.foreground },
  };
}

/** Scoped CSS keeps multiple independently themed charts on one page possible. */
function applyTheme(element, theme) {
  if (!element) return;
  element.dataset.clustermapTheme = theme.mode;
  element.style.colorScheme = theme.mode;
  for (const [key, value] of Object.entries(theme)) if (key !== "mode") element.style.setProperty(`--cm-${key}`, value);
  const doc = element.ownerDocument;
  if (doc.getElementById("clustermap-theme-style")) return;
  const style = doc.createElement("style"); style.id = "clustermap-theme-style";
  style.textContent = `
[data-clustermap-theme] { color:var(--cm-foreground); background:var(--cm-background); }
[data-clustermap-theme] :is(.tooltip,.cm-annotation-menu,.cm-annotation-hidden,.annotation-tooltip) { color:var(--cm-foreground)!important; background:var(--cm-surface)!important; border-color:var(--cm-border)!important; }
[data-clustermap-theme] :is(button,select,input:not([type=color]):not([type=checkbox]),textarea):not(.cm-data-ui *) { color:var(--cm-foreground)!important; background:var(--cm-surface)!important; border-color:var(--cm-border)!important; }
[data-clustermap-theme] button:hover:not(.cm-data-ui *) { background:var(--cm-hover)!important; }
[data-clustermap-theme] button:disabled { opacity:.45; }
clinker-editor[data-clustermap-theme] { background:var(--cm-surface); color:var(--cm-foreground); border-color:var(--cm-border); }
[data-clustermap-theme] .cm-annotation-menu :is(p,summary) { color:var(--cm-muted); }
[data-clustermap-theme] :is(svg.clusterMap,canvas.clusterMapCanvas,canvas.clusterMapWebGpuOverlay) { position:relative; z-index:1; background:transparent; color-scheme:light; }
[data-clustermap-theme] .clusterMapFigureSurface { z-index:0; box-shadow:0 2px 12px rgba(0,0,0,.2); outline:1px solid var(--cm-border); }
[data-clustermap-theme] .clusterMapFigureDimensions { z-index:2; color:var(--cm-muted); font:12px/20px system-ui,sans-serif; white-space:nowrap; }
[data-clustermap-theme] canvas.clusterMapMinimap { color-scheme:light; }
`;
  doc.head.append(style);
}

/** Editor field definitions; presentation metadata is independent of chart config. */
const APPEARANCE_FIELDS = [
  ["Plot", "plot.theme", "Interface theme", "select", ["auto", "light", "dark"]],
  ["Plot", "plot.background", "Figure background", "colour"],
  ["Annotations", "annotations.enabled", "Enable annotation panels", "checkbox"],
  ["Legend", "legend.show", "Show legend", "checkbox"], ["Legend", "legend.position", "Position", "select", ["right", "bottom"]], ["Legend", "legend.columns", "Columns", "number"], ["Legend", "legend.columnWidth", "Column width", "number", undefined, true], ["Legend", "legend.entryHeight", "Entry height", "number", undefined, true], ["Legend", "legend.fontSize", "Font size", "number", undefined, true], ["Legend", "legend.subtitleFontSize", "Subtitle size", "number", undefined, true], ["Legend", "legend.marginLeft", "Left margin", "number", undefined, true], ["Legend", "legend.marginTop", "Top margin", "number", undefined, true],
  ["Links", "link.show", "Show links", "checkbox"], ["Links", "link.asLine", "Draw as lines", "checkbox"], ["Links", "link.bestOnly", "Best match only", "checkbox"], ["Links", "link.threshold", "Minimum identity", "number"], ["Links", "link.straight", "Straight links", "checkbox", undefined, true], ["Links", "link.groupColour", "Use group colour", "checkbox", undefined, true], ["Links", "link.strokeWidth", "Stroke width", "number", undefined, true],
  ["Link labels", "link.label.show", "Show link labels", "checkbox"], ["Link labels", "link.label.background", "Label background", "checkbox", undefined, true], ["Link labels", "link.label.fontSize", "Font size", "number", undefined, true], ["Link labels", "link.label.position", "Position", "number", undefined, true],
  ["Tree", "tree.show", "Show tree", "checkbox"], ["Tree", "tree.width", "Tree width", "number"], ["Tree", "tree.useBranchLengths", "Use branch lengths", "checkbox"], ["Tree", "tree.branch.width", "Branch stroke width", "number"], ["Tree", "tree.branch.colour", "Branch colour", "colour"], ["Tree", "tree.support.show", "Show support values", "checkbox"], ["Tree", "tree.support.fontSize", "Support font size", "number", undefined, true], ["Tree", "tree.support.precision", "Support precision", "number", undefined, true], ["Tree", "tree.scaleBar.show", "Show tree scale bar", "checkbox"], ["Tree", "tree.leafGuide.show", "Show dashed leaf guides", "checkbox"], ["Tree", "tree.leafGuide.colour", "Leaf guide colour", "colour", undefined, true], ["Tree", "tree.leafGuide.width", "Leaf guide width", "number", undefined, true], ["Tree", "tree.leafGuide.dash", "Leaf guide dash pattern", "text", undefined, true],
  ["Clusters & loci", "cluster.alignLabels", "Align cluster labels", "checkbox"], ["Clusters & loci", "cluster.hideLocusCoordinates", "Hide locus coordinates", "checkbox"], ["Clusters & loci", "locus.trimIndicators.show", "Show trim indicators", "checkbox"], ["Clusters & loci", "cluster.spacing", "Cluster spacing", "number"], ["Clusters & loci", "locus.spacing", "Locus spacing", "number"], ["Clusters & loci", "cluster.nameFontSize", "Cluster name size", "number", undefined, true], ["Clusters & loci", "cluster.lociFontSize", "Locus label size", "number", undefined, true], ["Clusters & loci", "locus.trimIndicators.fontSize", "Trim indicator size", "number", undefined, true], ["Clusters & loci", "locus.trimIndicators.fontWeight", "Trim indicator weight", "number", undefined, true], ["Clusters & loci", "locus.trimIndicators.borderWidth", "Trim indicator border", "number", undefined, true], ["Clusters & loci", "locus.trimIndicators.borderOpacity", "Trim indicator border opacity", "number", undefined, true], ["Clusters & loci", "locus.trackBar.colour", "Track colour", "colour", undefined, true], ["Clusters & loci", "locus.trackBar.stroke", "Track stroke", "number", undefined, true],
  ["Genes", "gene.label.show", "Show gene labels", "checkbox"], ["Genes", "gene.label.name", "Label field", "select", ["uid", "name", "label"]], ["Genes", "gene.label.position", "Label position", "select", ["top", "bottom"]], ["Genes", "gene.label.anchor", "Label anchor", "select", ["start", "middle", "end"], true], ["Genes", "gene.label.fontSize", "Label size", "number", undefined, true], ["Genes", "gene.label.rotation", "Label rotation", "number", undefined, true], ["Genes", "gene.label.spacing", "Label spacing", "number", undefined, true], ["Genes", "gene.label.start", "Label start", "number", undefined, true], ["Genes", "gene.shape.bodyHeight", "Body height", "number", undefined, true], ["Genes", "gene.shape.tipHeight", "Tip height", "number", undefined, true], ["Genes", "gene.shape.tipLength", "Tip length", "number", undefined, true], ["Genes", "gene.shape.stroke", "Stroke colour", "colour", undefined, true], ["Genes", "gene.shape.strokeWidth", "Stroke width", "number", undefined, true],
  ["Scale bars", "scaleBar.show", "Show scale bar", "checkbox"], ["Scale bars", "scaleBar.basePair", "Base pairs", "number"], ["Scale bars", "colourBar.show", "Show identity bar", "checkbox"], ["Scale bars", "colourBar.domain.minMode", "Minimum source", "select", [["fixed", "Custom value"], ["data", "Lowest identity in data"]]], ["Scale bars", "colourBar.domain.min", "Minimum identity", "number"], ["Scale bars", "colourBar.domain.maxMode", "Maximum source", "select", [["fixed", "Custom value"], ["data", "Highest identity in data"]]], ["Scale bars", "colourBar.domain.max", "Maximum identity", "number"], ["Scale bars", "scaleBar.height", "Height", "number", undefined, true], ["Scale bars", "scaleBar.fontSize", "Font size", "number", undefined, true], ["Scale bars", "scaleBar.stroke", "Stroke", "number", undefined, true], ["Scale bars", "scaleBar.colour", "Colour", "colour", undefined, true], ["Scale bars", "scaleBar.marginTop", "Scale margin", "number", undefined, true], ["Scale bars", "colourBar.width", "Identity width", "number", undefined, true], ["Scale bars", "colourBar.height", "Identity height", "number", undefined, true], ["Scale bars", "colourBar.fontSize", "Identity font size", "number", undefined, true], ["Scale bars", "colourBar.marginTop", "Identity margin", "number", undefined, true],
  ["Plot & navigation", "plot.renderer", "Renderer", "select", ["svg", "canvas", "webgpu"]], ["Plot & navigation", "plot.minimap.show", "Show minimap", "checkbox"], ["Plot & navigation", "plot.minZoom", "Minimum zoom", "number"], ["Plot & navigation", "plot.maxZoom", "Maximum zoom", "number"], ["Plot & navigation", "plot.transitionDuration", "Transition (ms)", "number", undefined, true], ["Plot & navigation", "plot.scaleFactor", "Scale factor", "number", undefined, true], ["Plot & navigation", "plot.scaleGenes", "Scale genes", "checkbox", undefined, true], ["Plot & navigation", "plot.fontFamily", "Font family", "text", undefined, true], ["Plot & navigation", "plot.minimap.showLinks", "Minimap links", "checkbox", undefined, true], ["Plot & navigation", "plot.minimap.width", "Minimap width", "number", undefined, true], ["Plot & navigation", "plot.minimap.height", "Minimap height", "number", undefined, true], ["Plot & navigation", "plot.minimap.margin", "Minimap margin", "number", undefined, true],
  ];

const TREE_COLOURING_DEFAULTS = {
  mode: "none",
  cutHeight: "auto",
  palette: ["#267c9e", "#d7752d", "#5c8f39", "#9963a5", "#c34d61", "#9e8433"],
  showCutLine: false,
};
const metricsCache = new WeakMap();
const stylesCache = new WeakMap();
const fail = (message) => { throw new TypeError(`Invalid tree presentation: ${message}`); };
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function fields(value, allowed, where) {
  if (!object(value)) fail(`${where} must be an object.`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${where}.${key} is unsupported.`);
}
function colour(value, where) {
  if (typeof value !== "string" || !color(value)) fail(`${where} must be a valid colour.`);
}
function positive(value, where) {
  if (!Number.isFinite(value) || value <= 0) fail(`${where} must be finite and positive.`);
}
function validateTreeColouring(policy) {
  if (policy === undefined) return;
  fields(policy, ["mode", "cutHeight", "palette", "showCutLine"], "colouring");
  if (own(policy, "mode") && !["none", "cutHeight"].includes(policy.mode)) fail("colouring.mode must be none or cutHeight.");
  if (own(policy, "cutHeight") && policy.cutHeight !== "auto" && (!Number.isFinite(policy.cutHeight) || policy.cutHeight < 0)) {
    fail('colouring.cutHeight must be "auto" or a finite non-negative number.');
  }
  if (own(policy, "showCutLine") && typeof policy.showCutLine !== "boolean") fail("colouring.showCutLine must be boolean.");
  if (own(policy, "palette")) {
    if (!Array.isArray(policy.palette) || !policy.palette.length) fail("colouring.palette must be a non-empty colour array.");
    policy.palette.forEach((entry) => colour(entry, "colouring.palette"));
  }
}

/** Biological distances and canonical ID order survive child rotation unchanged. */
function treeMetrics(tree) {
  if (metricsCache.has(tree)) return metricsCache.get(tree);
  const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
  const parents = new Map();
  const distances = new Map([[tree.root, 0]]);
  let complete = true;
  const visit = (uid) => {
    for (const child of nodes.get(uid).children || []) {
      const length = nodes.get(child).branchLength;
      if (!Number.isFinite(length) || length < 0) complete = false;
      parents.set(child, uid);
      distances.set(child, distances.get(uid) + (Number.isFinite(length) ? length : 0));
      visit(child);
    }
  };
  visit(tree.root);
  const tips = tree.nodes.filter((node) => !node.children);
  const height = Math.max(0, ...tips.map((node) => distances.get(node.uid)));
  // Absolute 1e-12 plus relative 1e-9 tolerance, measured in input distance units.
  const tolerance = 1e-12 + 1e-9 * height;
  const ultrametric = complete && tips.every((node) => Math.abs(distances.get(node.uid) - height) <= tolerance);
  const result = {
    nodes, parents, height, ultrametric,
    heights: new Map([...distances].map(([uid, distance]) => [uid, Math.max(0, height - distance)])),
    canonical: [...tree.nodes].sort((a, b) => a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0),
  };
  metricsCache.set(tree, result);
  return result;
}

function validateBranch(style, where) {
  fields(style, ["colour", "width"], where);
  if (own(style, "colour")) colour(style.colour, `${where}.colour`);
  if (own(style, "width")) positive(style.width, `${where}.width`);
}

/** Validate optional data fields and the effective tree/config colouring policy. */
function validateTreePresentation(tree, config = {}) {
  validateTreeColouring(config.colouring);
  if (!tree) return;
  if (tree.distance !== undefined) {
    fields(tree.distance, ["kind", "label"], "distance");
    if (tree.distance.kind !== "mergeHeight") fail("distance.kind must be mergeHeight.");
    if (own(tree.distance, "label") && typeof tree.distance.label !== "string") fail("distance.label must be text.");
  }
  const presentation = tree.presentation;
  if (presentation !== undefined) {
    fields(presentation, ["colouring", "subtrees", "nodes"], "presentation");
    validateTreeColouring(presentation.colouring);
    const nodes = new Map(tree.nodes.map((node) => [node.uid, node]));
    for (const scope of ["subtrees", "nodes"]) {
      if (presentation[scope] === undefined) continue;
      if (!object(presentation[scope])) fail(`presentation.${scope} must be a node-ID dictionary.`);
      for (const [uid, record] of Object.entries(presentation[scope])) {
        const node = nodes.get(uid);
        if (!node) fail(`presentation.${scope} refers to unknown node '${uid}'.`);
        fields(record, scope === "subtrees" ? ["branch"] : ["branch", "label"], `${scope}.${uid}`);
        if (scope === "subtrees" && !node.children) fail(`subtree '${uid}' must be an internal node.`);
        if (record.branch !== undefined) {
          if (scope === "nodes" && uid === tree.root) fail("the display root has no incoming edge to style.");
          validateBranch(record.branch, `${scope}.${uid}.branch`);
        }
        if (record.label !== undefined) {
          if (!node.children) fail(`annotation '${uid}' must belong to an internal node.`);
          const label = record.label;
          fields(label, ["text", "colour", "fontSize", "fontWeight", "fontStyle"], `nodes.${uid}.label`);
          if (own(label, "text") && typeof label.text !== "string") fail(`annotation '${uid}' text must be a string.`);
          if (own(label, "colour")) colour(label.colour, `annotation '${uid}' colour`);
          if (own(label, "fontSize")) positive(label.fontSize, `annotation '${uid}' fontSize`);
          if (own(label, "fontWeight") && ![400, 700].includes(label.fontWeight)) fail("annotation fontWeight must be 400 or 700.");
          if (own(label, "fontStyle") && !["normal", "italic"].includes(label.fontStyle)) fail("annotation fontStyle must be normal or italic.");
        }
      }
    }
  }
  const policy = { ...TREE_COLOURING_DEFAULTS, ...config.colouring, ...presentation?.colouring };
  if (policy.mode === "cutHeight") {
    if (tree.distance?.kind !== "mergeHeight") fail("cutHeight colouring requires distance.kind = mergeHeight.");
    if (!treeMetrics(tree).ultrametric) fail("cutHeight colouring requires complete lengths and equal root-to-tip distances (absolute 1e-12 + relative 1e-9 tolerance).");
  }
}

/** Resolve properties once per presentation/config revision, never per tween. */
function resolveTreePresentation(tree, config = {}) {
  const defaults = { ...TREE_COLOURING_DEFAULTS, ...config.colouring };
  const signature = JSON.stringify([config.branch?.colour, config.branch?.width, config.textColour, defaults]);
  const cached = stylesCache.get(tree);
  if (cached && cached.presentation === tree.presentation && cached.signature === signature) return cached.value;
  validateTreePresentation(tree, config);
  const metrics = treeMetrics(tree);
  const policy = { ...defaults, ...tree.presentation?.colouring };
  const threshold = policy.cutHeight === "auto" ? metrics.height * 0.7 : policy.cutHeight;
  const groups = new Map();
  if (policy.mode === "cutHeight" && threshold > 0) {
    for (const node of metrics.canonical) {
      if (!node.children || metrics.heights.get(node.uid) >= threshold) continue;
      const parent = metrics.parents.get(node.uid);
      if (parent === undefined || metrics.heights.get(parent) >= threshold) {
        groups.set(node.uid, policy.palette[groups.size % policy.palette.length]);
      }
    }
  }
  const base = { colour: config.branch?.colour || "#555", width: Number(config.branch?.width) || 1.5 };
  const branches = new Map();
  const stems = new Map();
  const annotations = new Map();
  const visit = (uid, inherited = {}, groupColour = null) => {
    const node = metrics.nodes.get(uid);
    const automatic = groups.get(uid) || groupColour;
    const subtree = { ...inherited, ...tree.presentation?.subtrees?.[uid]?.branch };
    const mergeStyle = { ...base, ...(automatic ? { colour: automatic } : {}), ...subtree };
    if (node.children) stems.set(uid, mergeStyle);
    const label = tree.presentation?.nodes?.[uid]?.label;
    if (label?.text) annotations.set(uid, { colour: config.textColour || "#333", fontSize: 10, fontWeight: 400, fontStyle: "normal", ...label });
    for (const child of node.children || []) {
      branches.set(child, { ...mergeStyle, ...tree.presentation?.nodes?.[child]?.branch });
      visit(child, subtree, automatic);
    }
  };
  visit(tree.root);
  const value = { base, branches, stems, annotations, policy, height: metrics.height, threshold, metric: policy.mode === "cutHeight" };
  stylesCache.set(tree, { presentation: tree.presentation, signature, value });
  return value;
}

// Structural styles and the same neutral controls used by the plot editor.
function installTreeControlsStyle(doc) {
  if (doc.getElementById("clustermap-tree-controls-style")) return;
  const style = doc.createElement("style");
  style.id = "clustermap-tree-controls-style";
  style.textContent = `
.cm-tree-controls { font:inherit; color:inherit; text-align:left; }
.cm-tree-controls * { box-sizing:border-box; }
.cm-tree-controls [hidden] { display:none!important; }
.cm-tree-controls fieldset { min-width:0; margin:0 0 10px; padding:8px; border:1px solid var(--cm-border,#ddd); border-radius:4px; }
.cm-tree-controls legend { padding:0 4px; font-weight:600; }
.cm-tree-controls button[aria-pressed=true] { font-weight:600; }
.cm-tree-controls .cm-tree-row { display:flex; align-items:center; gap:6px; margin:6px 0; }
.cm-tree-controls .cm-tree-row > span { flex:1; min-width:0; }
.cm-tree-controls input[type=number] { width:64px; min-width:0; }
.cm-tree-controls input[type=range] { width:100%; }
.cm-tree-controls select { width:132px; min-width:0; }
.cm-tree-controls input[type=color] { width:30px; height:24px; padding:0; border:0; background:transparent; cursor:pointer; }
.cm-tree-controls .cm-tree-heading { font-weight:600; margin-bottom:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-tree-controls .cm-tree-branch-row { display:grid; grid-template-columns:minmax(0,1fr) 30px 64px 28px; gap:6px; align-items:center; margin:8px 0; }
.cm-tree-controls .cm-tree-reset { width:28px; padding:2px; min-height:26px; }
.cm-tree-controls .cm-tree-wide { display:block; }
.cm-tree-controls .cm-tree-wide > span { display:block; margin-bottom:4px; }
.cm-tree-controls .cm-tree-wide input, .cm-tree-controls .cm-tree-wide select { width:100%; }
.cm-tree-controls .cm-tree-format { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
.cm-tree-controls .cm-tree-format .cm-tree-row { gap:3px; }
.cm-tree-controls .cm-tree-separator { border:0; border-top:1px solid var(--cm-border,#e5e9ef); margin:10px 0; }
.cm-tree-controls .cm-tree-actions { display:flex; gap:6px; margin-top:10px; }
.cm-tree-controls [role=status]:empty { display:none; }
.cm-tree-controls [role=status] { color:var(--cm-danger,#a13c46); margin:6px 0 0; }
.cm-tree-controls--popover { width:260px; max-width:calc(100vw - 40px); max-height:75vh; overflow:auto; font-size:12px; line-height:1.3; }
.cm-tree-controls--popover .cm-tree-heading { font-size:12px; margin-bottom:6px; }
.cm-tree-controls--popover button, .cm-tree-controls--popover input:not([type=checkbox]):not([type=color]) { min-height:24px; padding:2px 5px; border-radius:4px; }
.cm-tree-controls--popover input[type=number] { width:52px; }
.cm-tree-controls--popover input[type=color] { width:24px; height:20px; }
.cm-tree-controls--popover input[type=checkbox] { width:12px; height:12px; margin:0; }
.cm-tree-controls--popover .cm-tree-branch-row { grid-template-columns:minmax(0,1fr) 24px 52px 22px; gap:5px; margin:5px 0; }
.cm-tree-controls--popover .cm-tree-reset { width:22px; min-height:22px; padding:0; }
.cm-tree-controls--popover .cm-tree-row { margin:4px 0; gap:4px; }
.cm-tree-controls--popover .cm-tree-format { gap:5px; }
.cm-tree-controls--popover .cm-tree-separator { margin:6px 0; }
.cm-tree-controls--popover .cm-tree-actions { margin-top:6px; }
`;
  doc.head.append(style);
}

/** Policy settings and node popovers share the same compact editing form. */
function createTreeControls({ tree, config, patch, preview, rotate, clusters = [], nodeUid = null,
  policy = true, onResize, document: doc = globalThis.document }) {
  installDataEditorStyle(doc);
  installTreeControlsStyle(doc);
  const ui = createControls(doc);
  const element = (tag, parent, text, className) => ui.el(tag, text, parent, className);
  const container = element("div", null, undefined, `cm-data-ui cm-tree-controls${policy ? "" : " cm-tree-controls--popover"}`);
  const message = element("p"); message.setAttribute("role", "status");
  const run = createActionRunner((text) => { message.textContent = text; });
  const button = (parent, title, action, className) => ui.button(parent, title, () => run(action), className);
  const section = (title) => { const field = element("fieldset", container); element("legend", field, title); return field; };
  const input = (parent, title, type, value, options = {}) => {
    const row = ui.row(parent, title); row.className = "cm-tree-row";
    return ui.input(row, title, value, type, undefined, options);
  };
  const reset = (scope, uid) => patch([{ type: "tree.presentation.reset", scope, ...(uid ? { ids: [uid] } : {}) }]);
  const resolved = resolveTreePresentation(tree, config);

  let compatible = tree.distance?.kind === "mergeHeight";
  try { validateTreePresentation({ ...tree, presentation: { ...tree.presentation, colouring: { ...resolved.policy, mode: "cutHeight" } } }, config); }
  catch { compatible = false; }
  if (policy && compatible) {
    const field = section("Clade colouring");
    const effective = resolved.policy;
    const change = (changes) => [{ type: "tree.presentation.update", scope: "tree", changes: { colouring: changes } }];
    const enabled = input(field, "Colour clades", "checkbox", effective.mode === "cutHeight");
    enabled.onchange = () => run(() => patch(change({ mode: enabled.checked ? "cutHeight" : "none" })));
    const options = element("div", field); options.hidden = !enabled.checked;
    const actual = effective.cutHeight === "auto" ? resolved.height * 0.7 : effective.cutHeight;
    const number = input(options, "Cut height", "number", actual, { min: "0", step: "any" });
    number.onchange = () => run(() => patch(change({ cutHeight: Number(number.value) })));
    const slider = element("input", options); slider.type = "range";
    Object.assign(slider, { min: "0", max: String(Math.max(resolved.height, actual) || 1), step: String(resolved.height / 1000 || 0.001), value: actual });
    slider.setAttribute("aria-label", "Preview cut height");
    let cancelled = false;
    const cancel = () => { cancelled = true; preview?.(null); slider.value = actual; number.value = actual; };
    slider.oninput = () => run(() => { cancelled = false; number.value = slider.value; preview?.(change({ cutHeight: Number(slider.value) })); });
    slider.onchange = () => { if (!cancelled) run(() => patch(change({ cutHeight: Number(slider.value) }))); };
    slider.onkeydown = (event) => { if (event.key === "Escape") { cancel(); event.preventDefault(); } };
    slider.onpointercancel = cancel;
    const auto = button(number.parentElement, "Auto", () => patch(change({ cutHeight: "auto" })));
    auto.title = "Use automatic cut height (70%)";
    auto.setAttribute("aria-pressed", String(effective.cutHeight === "auto"));
    const palettes = [
      ["Muted", ["#267c9e", "#d7752d", "#5c8f39", "#9963a5", "#c34d61", "#9e8433"]],
      ["Colorblind friendly", ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#d55e00", "#56b4e9"]],
    ];
    if (!palettes.some(([, colours]) => JSON.stringify(colours) === JSON.stringify(effective.palette))) palettes.unshift(["Custom", effective.palette]);
    const paletteRow = element("label", options, undefined, "cm-tree-row"); element("span", paletteRow, "Palette");
    const select = element("select", paletteRow); select.setAttribute("aria-label", "Clade palette");
    palettes.forEach(([name, colours], index) => { const option = element("option", select, name); option.value = index; option.selected = JSON.stringify(colours) === JSON.stringify(effective.palette); });
    select.onchange = () => run(() => patch(change({ palette: palettes[Number(select.value)][1] })));
    const line = input(options, "Show cut line", "checkbox", effective.showCutLine);
    line.onchange = () => run(() => patch(change({ showCutLine: line.checked })));
  }

  if (policy) {
    const resetAll = button(container, "Reset all manual styles", () => reset("manual"));
    resetAll.title = "Clear manual tree styles and labels; keep automatic clade colouring.";
    resetAll.disabled = !Object.keys(tree.presentation?.nodes || {}).length && !Object.keys(tree.presentation?.subtrees || {}).length;
    container.append(message);
    return container;
  }

  const nodesById = new Map(tree.nodes.map((node) => [node.uid, node]));
  const clusterNames = new Map(clusters.map((cluster) => [cluster.uid, cluster.name || cluster.label || cluster.uid]));
  const descriptions = new Map();
  const describe = (uid) => {
    if (descriptions.has(uid)) return descriptions.get(uid);
    const node = nodesById.get(uid);
    const children = node.children?.map(describe);
    const info = children ? { count: children.reduce((sum, child) => sum + child.count, 0), labels: children.flatMap((child) => child.labels).slice(0, 2) }
      : { count: 1, labels: [node.label || clusterNames.get(node.cluster) || node.cluster] };
    descriptions.set(uid, info);
    return info;
  };
  const titleFor = (uid) => {
    const node = nodesById.get(uid);
    if (node.label) return node.label;
    const { count, labels } = describe(uid);
    return uid === tree.root ? `All ${count} clusters` : `${labels.join(" + ")}${count > 2 ? ` + ${count - 2} more` : ""}`;
  };
  const uid = nodesById.get(nodeUid)?.children ? nodeUid : nodesById.get(tree.root)?.children ? tree.root : null;
  const host = element("div", container);

  const colourInput = (parent, title, value, fallback, onChange) => {
    const picker = element("input", parent); picker.type = "color";
    const initial = color(value || fallback)?.formatHex() || "#555555";
    let override = value ?? null;
    const refresh = () => {
      picker.value = color(override || fallback)?.formatHex() || initial;
      picker.title = `${title}${override === null ? " (inherited)" : ""}`;
    };
    picker.setAttribute("aria-label", title); refresh();
    picker.oninput = () => {
      if (picker.value === override) return;
      run(() => { onChange(picker.value); override = picker.value; picker.title = title; });
    };
    picker.onchange = picker.oninput;
    return { reset: () => { override = null; refresh(); } };
  };
  const liveNumber = (control, onChange) => {
    let previous = control.value === "" ? null : Number(control.value);
    control.oninput = () => {
      if (!control.validity.valid) return;
      const next = control.value === "" ? null : Number(control.value);
      if (next === previous) return;
      run(() => { onChange(next); previous = next; });
    };
    control.onchange = control.oninput;
    return (value = "") => { control.value = value; previous = value === "" ? null : Number(value); };
  };
  const resetButton = (parent, title, action) => {
    const control = button(parent, "↺", action, "cm-tree-reset");
    control.title = title; control.setAttribute("aria-label", title); return control;
  };
  function renderNode() {
    if (!host || !uid) return;
    host.replaceChildren();
    host.setAttribute("role", "group"); host.setAttribute("aria-label", "Tree node settings");
    const heading = element("div", host, titleFor(uid), "cm-tree-heading"); heading.title = heading.textContent;
    button(host, "Rotate branches", () => rotate(uid));
    const inheritedBranch = (scope) => {
      const collection = scope === "subtree" ? "subtrees" : "nodes";
      const records = tree.presentation?.[collection] || {};
      const record = { ...records[uid] }; delete record.branch;
      const inherited = resolveTreePresentation({ ...tree, presentation: {
        ...tree.presentation, [collection]: { ...records, [uid]: record },
      } }, config);
      return (scope === "subtree" ? inherited.stems : inherited.branches).get(uid) || inherited.base;
    };
    const branchControls = (scope, title, style, fallback) => {
      const row = element("div", host, undefined, "cm-tree-branch-row");
      const name = element("span", row, title);
      name.title = scope === "subtree" ? "Branches within this clade, excluding its incoming branch." : "Only the horizontal branch entering this node.";
      const update = (branch) => patch([{ type: "tree.presentation.update", scope, ids: [uid], changes: { branch } }]);
      const colour = colourInput(row, `${title} colour`, style?.colour, fallback.colour, (colour) => update({ colour }));
      const width = element("input", row); width.type = "number";
      Object.assign(width, { min: "0.1", step: "any", value: style?.width ?? fallback.width });
      width.setAttribute("aria-label", `${title} thickness`); width.title = "Thickness (px); leave blank to inherit";
      const clearWidth = liveNumber(width, (width) => update({ width }));
      width.onblur = () => {
        if (width.value !== "") return;
        const current = resolveTreePresentation(tree, config);
        clearWidth((scope === "subtree" ? current.stems : current.branches).get(uid)?.width ?? current.base.width);
      };
      resetButton(row, `Reset ${title.toLowerCase()} style`, () => { update(null); colour.reset(); clearWidth(fallback.width); });
    };
    branchControls("subtree", "Subtree", tree.presentation?.subtrees?.[uid]?.branch, inheritedBranch("subtree"));
    const record = tree.presentation?.nodes?.[uid] || {};
    if (uid !== tree.root) branchControls("node", "Incoming branch", record.branch, inheritedBranch("node"));
    element("hr", host, undefined, "cm-tree-separator");
    const label = record.label || {};
    const text = input(host, "Label", "text", label.text, { placeholder: "Clade label" });
    text.setAttribute("aria-label", "Annotation text"); text.parentElement.classList.add("cm-tree-wide");
    const updateLabel = (label) => patch([{ type: "tree.presentation.update", scope: "node", ids: [uid], changes: { label } }]);
    let previousText = text.value;
    text.oninput = () => {
      if (text.value === previousText) return;
      run(() => { updateLabel({ text: text.value || null }); previousText = text.value; });
    };
    const formatting = element("div", host, undefined, "cm-tree-format");
    const colour = colourInput(formatting, "Text colour", label.colour, "#333", (colour) => updateLabel({ colour }));
    const size = element("input", formatting); size.type = "number";
    Object.assign(size, { min: "1", step: "any", value: label.fontSize ?? "", placeholder: "10" });
    size.setAttribute("aria-label", "Text size"); size.title = "Text size (px); leave blank to inherit";
    const bold = input(formatting, "Bold", "checkbox", label.fontWeight === 700);
    const italic = input(formatting, "Italic", "checkbox", label.fontStyle === "italic");
    const clearSize = liveNumber(size, (fontSize) => updateLabel({ fontSize }));
    bold.onchange = () => run(() => updateLabel({ fontWeight: bold.checked ? 700 : null }));
    italic.onchange = () => run(() => updateLabel({ fontStyle: italic.checked ? "italic" : null }));
    resetButton(formatting, "Clear label and formatting", () => {
      updateLabel(null);
      text.value = ""; previousText = ""; colour.reset(); clearSize(); bold.checked = false; italic.checked = false;
    });
    const actions = element("div", host, undefined, "cm-tree-actions");
    const resetNode = button(actions, "Reset", () => {
      if (tree.presentation?.subtrees?.[uid] || tree.presentation?.nodes?.[uid]) {
        patch([
          { type: "tree.presentation.reset", scope: "subtree", ids: [uid] },
          { type: "tree.presentation.reset", scope: "node", ids: [uid] },
        ]);
      }
      renderNode();
      host.querySelector(".cm-tree-actions button")?.focus({ preventScroll: true });
    });
    resetNode.title = "Reset this node's subtree style, incoming branch and label; keep descendant overrides and automatic colouring.";
    onResize?.();
  }
  renderNode();
  container.append(message);
  return container;
}

/** Build native fields once; synchronize values and filtering without losing focus. */
function createAppearanceControls({ document, patch, preview, rotate }) {
  const ui = createControls(document), node = ui.el("div", undefined, null, "cm-editor__appearance-grid");
  const sections = new Map(), fields = [];
  for (const [name, path, label, type, options, advanced] of APPEARANCE_FIELDS) {
    let section = sections.get(name);
    if (!section) {
      const box = ui.el("fieldset", undefined, node); ui.el("legend", name, box);
      section = { box, key: name.toLowerCase().replaceAll(/\W+/g, "-"), details: null, fields: [] }; sections.set(name, section);
    }
    if (advanced && !section.details) {
      section.details = ui.el("details", undefined, section.box); section.details.dataset.appearanceSection = section.key;
      ui.el("summary", "Advanced", section.details);
    }
    const row = ui.row(advanced ? section.details : section.box, label);
    // Some sections interleave general and advanced entries; keep disclosure last.
    if (!advanced && section.details) section.box.insertBefore(row, section.details);
    const control = type === "select" ? ui.select(row, label, "", options)
      : ui.input(row, label, "", type === "colour" ? "color" : type);
    control.dataset.config = path;
    const field = { row, control, path, type, advanced, search: `${name} ${label} ${path}`.toLowerCase() };
    fields.push(field); section.fields.push(field);
  }
  const empty = ui.el("p", "", node, "cm-editor__empty"), treeHost = ui.el("div", undefined, node, "cm-editor__appearance-tree");
  let treeState = null;
  return { node, update({ config, tree, filter, expanded }) {
    for (const field of fields) {
      const { control, path, type } = field;
      const value = path.split(".").reduce((current, key) => current?.[key], config);
      if (type === "checkbox") control.checked = Boolean(value);
      else if (control !== document.activeElement) control.value = type === "colour" ? colourHex(value) : value ?? "";
      const bound = path === "colourBar.domain.min" ? "min" : path === "colourBar.domain.max" ? "max" : null;
      control.disabled = Boolean(bound && config.colourBar.domain[`${bound}Mode`] === "data");
      field.row.hidden = Boolean(filter && !field.search.includes(filter));
    }
    let visible = 0;
    for (const section of sections.values()) {
      section.box.hidden = section.fields.every((field) => field.row.hidden);
      if (!section.box.hidden) visible++;
      if (section.details) {
        section.details.hidden = !section.fields.some((field) => field.advanced && !field.row.hidden);
        section.details.open = Boolean(filter) || expanded.has(section.key);
      }
    }
    empty.hidden = visible > 0; empty.textContent = `No appearance settings match “${filter}”.`;
    treeHost.hidden = !tree || Boolean(filter && !/tree|clade|colour|color|annotation|branch|cut|palette/.test(filter));
    const treeKey = JSON.stringify(config.tree);
    if (!treeHost.hidden && (treeState?.tree !== tree || treeState?.config !== treeKey)) {
      treeHost.replaceChildren(createTreeControls({ tree, config: config.tree, patch, preview, rotate, document }));
      treeState = { tree, config: treeKey };
    }
  } };
}

const tagName = "clinker-editor";
const HTMLElementBase = globalThis.HTMLElement || class {};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const labelFor = (record, fallback = "") => record?.label || record?.name || fallback;
// Chart palettes are stored as CSS colours (often rgb(...)); colour inputs only
// accept hexadecimal values. D3's parser is bundled with the chart and keeps
// editor swatches in sync with the rendered legend.
const groupMap = (data) => new Map((data?.groups || []).flatMap((group) =>
  (group.genes || []).flatMap((id) => [[id, group], [String(id), group]])
));
function editableCell(kind, id, value, placeholder, compact = false, width = null) {
  const length = String(value || placeholder || "").length;
  const fixed = Number.isFinite(width);
  const size = compact && !fixed ? ` size="${Math.max(8, Math.min(30, length + 1))}"` : "";
  const style = Number.isFinite(width) ? ` style="width:${Math.ceil(width) + 2}px;min-width:${Math.ceil(width) + 2}px"` : "";
  return `<input class="cm-data-cell cm-data-field cm-editor-inline-input${fixed ? " cm-editor-inline-input--fixed" : ""}" data-edit="${kind}" data-id="${escapeHtml(id)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${size}${style}>`;
}

function editableField(kind, id, value, placeholder, label, editing, compact = false, width = null) {
  if (editing) {
    const fixed = Number.isFinite(width) ? ` style="width:${Math.ceil(width) + 16}px;flex:0 0 ${Math.ceil(width) + 16}px"` : "";
    return `<span class="cm-data-cell cm-editor__editable-field is-editing"${fixed}>${editableCell(kind, id, value, placeholder, compact, width)}</span>`;
  }
  const text = value ? escapeHtml(value) : `<span class="cm-data-placeholder">${escapeHtml(placeholder)}</span>`;
  return `<span class="cm-data-cell cm-editor__editable-field"><span class="cm-editor__editable-label" title="${escapeHtml(value || placeholder)}">${text}</span><button type="button" class="cm-editor__edit-icon" data-focus-edit="${kind}" data-id="${escapeHtml(id)}" aria-label="Edit ${escapeHtml(label)}" title="Edit ${escapeHtml(label)}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.1-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z"></path><path d="m13.8 7.2 3 3"></path></svg></button></span>`;
}

/**
 * An optional, light-DOM editor for a ClusterMap chart.
 *
 * Shared native-control styles are installed on mount; `clinker/editor.css`
 * supplies the optional panel layout. Set .chart to an already rendered chart.
 * Edits use its public API; the component owns no copy of the chart data.
 */
class ClinkerEditorElement extends HTMLElementBase {
  #chart = null;
  #runEdit = createActionRunner((message) => {
    const status = this.querySelector("[data-editor-error]");
    if (status) { status.textContent = message; status.hidden = !message; }
  });
  #annotationEditor = null;
  #appearanceView = null;
  #recordView = null;
  #editAnnotation = (event) => {
    if (event.defaultPrevented || event.detail?.chart !== this.#chart) return;
    event.preventDefault(); this.editAnnotations(event.detail.panelUid);
  };
  #unsubscribe = null;
  #kind = "groups";
  #geneView = "tree";
  #selected = new RowSelection();
  #rowView = null;
  #selectionControls = null;
  #rowsCache = null;
  #selectionData = null;
  #filter = "";
  #appearanceFilter = "";
  #appearanceAdvanced = new Set();
  #memberGroupId = null;
  #expanded = new Set();
  #draggedGroupId = null;
  #resizeStart = null;
  #editingKey = null;
  #editWidths = new Map();
  #sort = {
    genes: { key: "label", direction: 1 },
    links: { key: "source", direction: 1 },
  };
  #hoverRow = null;
  #hoveredRow = null;
  #hoverTimer = null;
  #hoverFrame = null;
  #dataCache = null;

  constructor() { super(); }

  connectedCallback() {
    this.classList.add("cm-editor", "cm-data-ui");
    installDataEditorStyle(this.ownerDocument);
    if (!this.hasChildNodes()) this.#renderShell();
    this.#bind();
    this.ownerDocument.addEventListener("clustermap:edit-annotation", this.#editAnnotation);
    this.#subscribe();
    this.#render();
  }

  disconnectedCallback() {
    this.ownerDocument.removeEventListener("clustermap:edit-annotation", this.#editAnnotation);
    this.#chart?.previewTreePresentation?.(null);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#cancelHover();
    this.#rowView?.destroy(); this.#rowView = null;
    this.#annotationEditor?.destroy();
    this.#annotationEditor = null;
    this.querySelector("[data-annotation-editor]")?.replaceChildren();
  }

  get chart() { return this.#chart; }

  set chart(value) {
    if (value === this.#chart) return;
    this.#chart?.previewTreePresentation?.(null);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#chart = value || null;
    this.#selected.clear(); this.#selectionData = null; this.#rowsCache = null;
    this.#dataCache = null;
    this.#subscribe();
    this.#initializeExpanded();
    this.#render();
  }

  get value() { return this.#chart?.data?.(); }

  /** Open a panel's annotation data from the plot or a host application. */
  editAnnotations(panelUid) {
    this.hidden = false;
    this.#kind = "annotations";
    this.#selected.clear();
    this.querySelectorAll("[data-tab]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.tab === "data")));
    this.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== "data"; });
    this.querySelectorAll("[data-kind]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.kind === "annotations")));
    this.#renderData();
    if (panelUid) this.#annotationEditor?.select(panelUid);
    this.dispatchEvent(new CustomEvent("clinker-editor-open", { bubbles: true }));
    return this;
  }

  /** Replace any declarative fallback content with the packaged editor UI. */
  reset() {
    this.#appearanceView = null;
    this.#rowView?.destroy(); this.#rowView = null;
    this.#annotationEditor?.destroy();
    this.#annotationEditor = null;
    this.replaceChildren();
    this.#renderShell();
    this.#render();
    return this;
  }

  #renderShell() {
    this.innerHTML = `
      <div class="cm-editor__resize-handle" data-resize role="separator" aria-label="Resize plot editor" aria-orientation="horizontal"></div>
      <header class="cm-editor__header">
        <h2 class="cm-editor__title">Plot editor</h2>
        <div class="cm-editor__history">
          <button type="button" data-command="undo" disabled>Undo</button>
          <button type="button" data-command="redo" disabled>Redo</button>
        </div>
      </header>
      <div class="cm-editor__tabs" role="tablist" aria-label="Plot editor sections">
        <button type="button" data-tab="data" role="tab" aria-selected="true">Data</button>
        <button type="button" data-tab="appearance" role="tab" aria-selected="false">Appearance</button>
      </div>
      <div data-editor-error class="cm-data-error" role="alert" hidden></div>
      <section data-panel="data" class="cm-editor__panel">
        <div class="cm-editor__toolbar cm-data-toolbar">
          <div class="cm-editor__segmented" aria-label="Data type">
            <button type="button" data-kind="groups" aria-pressed="true">Groups</button>
            <button type="button" data-kind="genes" aria-pressed="false">Genes</button>
            <button type="button" data-kind="links" aria-pressed="false">Links</button>
            <button type="button" data-kind="annotations" aria-pressed="false">Annotations</button>
          </div>
          <div class="cm-editor__segmented" data-gene-view aria-label="Gene view" hidden>
            <button type="button" data-gene-view-kind="tree" aria-pressed="true">By locus</button>
            <button type="button" data-gene-view-kind="groups" aria-pressed="false">By group</button>
            <button type="button" data-gene-view-kind="list" aria-pressed="false">List</button>
          </div>
          <button type="button" data-command="toggle-tree" hidden>Expand visible</button>
          <button type="button" data-command="new-group">Create group…</button>
          <div data-annotation-toolbar class="cm-editor__annotation-toolbar" hidden></div>
          <span data-search-slot></span>
          <button type="button" data-command="clear-filter" aria-label="Clear filter" title="Clear filter" hidden>×</button>
        </div>
        <div data-annotation-editor class="cm-editor__annotation-editor" hidden></div>
        <div data-record-editor></div>
      </section>
      <section data-panel="appearance" class="cm-editor__panel" hidden>
        <div class="cm-editor__appearance-toolbar"><label class="cm-editor__search"><span class="cm-editor__sr-only">Find an appearance setting</span><input type="search" data-appearance-filter placeholder="Find a setting"></label><button type="button" data-command="clear-appearance-filter" aria-label="Clear appearance filter" title="Clear appearance filter" hidden>×</button></div>
        <div class="cm-editor__appearance" data-appearance></div>
      </section>`;
    const panel = createDataPanel(this.ownerDocument);
    panel.node.dataset.recordEditor = "";
    panel.tools.dataset.recordTools = "";
    panel.tools.innerHTML = `<div class="cm-editor__member-filter" data-member-filter hidden><span>Group: <strong data-member-label></strong></span><button type="button" data-command="clear-member-filter" aria-label="Clear group member filter" title="Clear group member filter">×</button></div>`;
    this.#selectionControls = createSelectionControls(panel, { selection: this.#selected,
      onChange: () => { this.#renderData(); this.#syncHighlight(); } });
    this.#selectionControls.actions.dataset.actions = "";
    panel.viewport.classList.add("cm-editor__table");
    panel.viewport.innerHTML = `<div data-head class="cm-editor__head"></div><div data-rows></div>`;
    this.querySelector("[data-record-editor]").replaceWith(panel.node);
    const search = createDataSearch(this.ownerDocument);
    search.input.dataset.filter = "";
    this.querySelector("[data-search-slot]").replaceWith(search.node);
  }

  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (change.type === "data.apply" || change.type === "data.replace") {
        // Patches can mutate the existing data object, so identity alone does
        // not invalidate derived rows, indexes or deleted-record selections.
        this.#dataCache = null;
        this.#rowsCache = null;
        this.#selectionData = null;
      }
      if (change.type === "data.replace") {
        this.#selected.clear();
        this.#expanded.clear();
        this.#initializeExpanded();
      }
      if (change.type === "data.apply" || change.type === "data.replace") this.#renderData();
      else if (change.type === "config.change" || change.type === "theme.change") this.#renderAppearance();
      if (change.type === "data.replace" || (change.type === "data.apply" && change.operations?.some((op) => op.type.startsWith("tree.presentation.")))) this.#renderAppearance();
      if (change.type === "history.change") this.#renderHistory();
    });
  }

  #bind() {
    if (this.dataset.bound) return;
    this.dataset.bound = "true";
    this.addEventListener("click", (event) => this.#click(event));
    this.addEventListener("change", (event) => this.#change(event));
    this.addEventListener("toggle", (event) => {
      const details = event.target.closest("details[data-appearance-section]");
      if (!details) return;
      if (details.open) this.#appearanceAdvanced.add(details.dataset.appearanceSection);
      else this.#appearanceAdvanced.delete(details.dataset.appearanceSection);
    }, true);
    this.addEventListener("pointerdown", (event) => {
      if (event.target.closest("[data-focus-edit]")) event.preventDefault();
      if (!event.target.closest("[data-resize]") || !this.hasAttribute("resizable")) return;
      event.preventDefault();
      this.#resizeStart = { pointerY: event.clientY, height: this.getBoundingClientRect().height };
      event.target.setPointerCapture?.(event.pointerId);
    });
    this.addEventListener("pointermove", (event) => {
      if (!this.#resizeStart) return;
      const parentHeight = this.parentElement?.getBoundingClientRect().height || innerHeight;
      const height = Math.max(180, Math.min(parentHeight - 48, this.#resizeStart.height - (event.clientY - this.#resizeStart.pointerY)));
      this.style.height = `${height}px`;
    });
    this.addEventListener("pointerup", () => { this.#resizeStart = null; });
    this.addEventListener("pointercancel", () => { this.#resizeStart = null; });
    this.addEventListener("input", (event) => {
      if (event.target.matches("[data-filter]")) this.#activeDataView?.setFilter(event.target.value);
      if (event.target.matches("[data-appearance-filter]")) {
        this.#appearanceFilter = event.target.value.trim().toLowerCase();
        this.#renderAppearance();
      }
    });
    this.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape" && event.target.matches("[data-edit]")) {
        event.preventDefault();
        this.#editWidths.delete(this.#editingKey);
        this.#editingKey = null;
        this.#renderData();
        return;
      }
      if (event.key === "Escape") this.#activeDataView?.clearSelection();
      if (event.key === "Enter" && event.target.matches("[data-edit]")) event.target.blur();
      const grip = event.target.closest("[data-reorder]");
      if (grip && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        this.#moveGroup(this.#id(grip.dataset.reorder), event.key === "ArrowUp" ? -1 : 1);
      }
    });
    this.addEventListener("focusout", (event) => {
      if (!event.target.matches("[data-edit]")) return;
      const editingKey = this.#editingKey;
      globalThis.setTimeout(() => {
        if (editingKey && this.#editingKey === editingKey && !this.contains(document.activeElement)) {
          this.#editWidths.delete(editingKey);
          this.#editingKey = null;
          this.#renderData();
        }
      }, 0);
    });
    this.addEventListener("dragstart", (event) => {
      const grip = event.target.closest("[data-reorder]");
      if (!grip) return;
      this.#draggedGroupId = this.#id(grip.dataset.reorder);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(this.#draggedGroupId));
    });
    this.addEventListener("dragover", (event) => {
      if (this.#draggedGroupId === null) return;
      const target = event.target.closest(".cm-editor__row--groups");
      if (!target || this.#id(target.dataset.id) === this.#draggedGroupId) return;
      event.preventDefault();
      this.querySelectorAll(".cm-editor__drop-target").forEach((node) => node.classList.remove("cm-editor__drop-target"));
      target.classList.add("cm-editor__drop-target");
    });
    this.addEventListener("drop", (event) => {
      const target = event.target.closest(".cm-editor__row--groups");
      if (this.#draggedGroupId !== null && target) {
        event.preventDefault();
        const targetId = this.#id(target.dataset.id);
        const bounds = target.getBoundingClientRect();
        this.#placeGroup(this.#draggedGroupId, targetId, event.clientY > bounds.top + bounds.height / 2);
      }
      this.#finishGroupDrag();
    });
    this.addEventListener("dragend", () => this.#finishGroupDrag());
    this.addEventListener("pointerover", (event) => {
      const row = event.target.closest(".cm-editor__row, .cm-editor__tree-row");
      if (!row || row.contains(event.relatedTarget) || !this.#chart?.highlight) return;
      this.#queueHover(row);
    });
    this.addEventListener("pointerout", (event) => {
      const row = event.target.closest(".cm-editor__row, .cm-editor__tree-row");
      if (!row || row.contains(event.relatedTarget)) return;
      this.#queueHover(null);
    });

  }

  #click(event) {
    const checkbox = event.target.closest("[data-select]");
    if (checkbox) {
      this.#selectRow(this.#id(checkbox.dataset.select), checkbox.checked, event.shiftKey);
      this.#renderData(); this.#syncHighlight(); return;
    }
    const edit = event.target.closest("[data-focus-edit]");
    if (edit) {
      event.preventDefault();
      this.#editingKey = this.#editKey(edit.dataset.focusEdit, edit.dataset.id);
      const label = edit.closest(".cm-editor__editable-field")?.querySelector(".cm-editor__editable-label");
      if (label) this.#editWidths.set(this.#editingKey, label.getBoundingClientRect().width);
      this.#renderData();
      const focusInput = () => {
        const input = [...this.querySelectorAll("[data-edit]")].find((node) => node.dataset.edit === edit.dataset.focusEdit && node.dataset.id === edit.dataset.id);
        if (!input) return null;
        input.focus({ preventScroll: true });
        input.select();
        return input;
      };
      // The pencil has just been replaced synchronously, so focus the new
      // native input directly. WebKit can subsequently apply the old button's
      // default focus at the end of this click, so retry only in that event
      // loop microtask; this is not tied to rendering or animation frames.
      if (focusInput()) {
        (globalThis.queueMicrotask || ((callback) => Promise.resolve().then(callback)))(() => {
          const current = [...this.querySelectorAll("[data-edit]")].find((node) => node.dataset.edit === edit.dataset.focusEdit && node.dataset.id === edit.dataset.id);
          if (current && document.activeElement !== current) focusInput();
        });
      }
      return;
    }
    const sort = event.target.closest("[data-sort]");
    if (sort) {
      const current = this.#sort[this.#kind];
      const key = sort.dataset.sort;
      this.#sort[this.#kind] = { key, direction: current?.key === key ? -current.direction : 1 };
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      this.#renderData();
      return;
    }
    const treeToggle = event.target.closest("[data-tree-toggle]");
    if (treeToggle) {
      const key = treeToggle.dataset.treeToggle;
      if (this.#expanded.has(key)) this.#expanded.delete(key);
      else this.#expanded.add(key);
      this.#renderData();
      return;
    }
    const row = event.target.closest(".cm-editor__row, .cm-editor__tree-gene");
    if (row && !event.target.closest("input, select, button")) {
      const id = this.#id(row.dataset.id);
      this.#selectRow(id, !this.#selected.has(id), event.shiftKey);
      this.#renderData();
      this.#syncHighlight();
      return;
    }
    const visibility = event.target.closest("[data-visible]");
    if (visibility) {
      const { type, id, hidden } = visibility.dataset;
      this.#apply({ type: `${type}.update`, ids: [this.#id(id)], changes: { hidden: hidden !== "true" } });
      return;
    }
    const button = event.target.closest("button");
    if (!button) return;
    const tab = button.dataset.tab;
    if (tab) {
      this.querySelectorAll("[data-tab]").forEach((node) => node.setAttribute("aria-selected", String(node === button)));
      this.querySelectorAll("[data-panel]").forEach((node) => { node.hidden = node.dataset.panel !== tab; });
      if (tab === "appearance") this.#renderAppearance(); else this.#renderData();
      return;
    }
    const kind = button.dataset.kind;
    if (kind) {
      this.#kind = kind;
      if (kind !== "genes") this.#memberGroupId = null;
      this.#selected.clear();
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      this.querySelectorAll("[data-kind]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
      this.#renderData();
      return;
    }
    const geneView = button.dataset.geneViewKind;
    if (geneView) {
      this.#geneView = geneView;
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      this.querySelectorAll("[data-gene-view-kind]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
      this.#renderData();
      return;
    }
    const command = button.dataset.command;
    if (command === "delete") {
      this.#deleteSelected();
    } else if (command === "new-group") {
      const label = window.prompt("Name for the new homology group");
      if (label?.trim()) this.#apply({ type: "groups.create", group: { uid: this.#nextGroupUid(), label: label.trim() } });
    } else if (command === "assign") {
      const select = this.querySelector("[data-assign-group]");
      if (select?.value) this.#apply({ type: "groups.assignGenes", groupId: this.#groupId(select.value), geneIds: [...this.#selected] });
    } else if (command === "unassign") {
      this.#apply({ type: "groups.unassignGenes", geneIds: [...this.#selected] });
    } else if (command === "new-group-for-selection") {
      const label = window.prompt("Name for the new homology group");
      if (label?.trim()) {
        const geneIds = [...this.#selected];
        this.#selected.clear();
        this.#apply({ type: "groups.create", group: { uid: this.#nextGroupUid(), label: label.trim() }, geneIds });
      }
    } else if (command === "focus") {
      this.#focusSelected();
    } else if (command === "batch-label") {
      const input = this.querySelector("[data-batch-label]");
      if (input?.value.trim()) {
        this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { label: input.value.trim() } });
      }
    } else if (command === "batch-identity") {
      const input = this.querySelector("[data-batch-identity]");
      const identity = Number(input?.value);
      if (Number.isFinite(identity) && identity >= 0 && identity <= 100) {
        this.#apply({ type: "links.update", ids: [...this.#selected], changes: { identity: identity / 100 } });
      }
    } else if (command === "merge") {
      const targetId = this.#groupId(this.querySelector("[data-merge-target]")?.value);
      if (targetId !== undefined) {
        const sourceIds = [...this.#selected];
        this.#selected.clear();
        this.#apply({ type: "groups.merge", targetId, sourceIds });
      }
    } else if (command === "view-members") {
      const groupId = [...this.#selected][0];
      if (groupId !== undefined) this.#viewGroupMembers(groupId);
    } else if (command === "move-first") {
      this.#moveSelectedGroupTo(0);
    } else if (command === "move-last") {
      this.#moveSelectedGroupTo((this.#data()?.groups.length || 1) - 1);
    } else if (command === "move-position") {
      this.#moveSelectedGroupTo(Number(this.querySelector("[data-group-position]")?.value) - 1);
    } else if (command === "undo") {
      this.#undo();
    } else if (command === "redo") {
      this.#redo();
    } else if (command === "toggle-tree") {
      this.#toggleTree();
    } else if (command === "clear-filter") {
      this.#activeDataView?.setFilter("");
    } else if (command === "clear-member-filter") {
      this.#memberGroupId = null;
      this.#renderData();
    } else if (command === "clear-appearance-filter") {
      this.#appearanceFilter = "";
      const input = this.querySelector("[data-appearance-filter]");
      if (input) input.value = "";
      this.#renderAppearance();
    }
  }

  #change(event) {
    const target = event.target;
    if (target.matches("[data-select-many]")) {
      const ids = JSON.parse(target.dataset.selectMany || "[]").map((id) => this.#id(id));
      this.#selected.setMany(ids, target.checked);
      this.#renderData();
      this.#syncHighlight();
      return;
    }
    if (target.matches("[data-select]")) {
      const id = this.#id(target.dataset.select);
      if (this.#selected.has(id) === target.checked) return;
      this.#selectRow(id, target.checked, false);
      this.#renderData();
      this.#syncHighlight();
      return;
    }
    if (target.matches("[data-visible]")) {
      const { type, id, hidden } = target.dataset;
      this.#apply({ type: `${type}.update`, ids: [this.#id(id)], changes: { hidden: hidden !== "true" } });
      return;
    }
    if (target.matches("[data-colour]")) {
      const { type, id } = target.dataset;
      this.#apply({ type: `${type}.update`, ids: [this.#id(id)], changes: { colour: target.value } });
      return;
    }
    if (target.matches("[data-edit]")) {
      this.#edit(target);
      return;
    }
    if (target.matches("[data-batch-colour]")) {
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { colour: target.value } });
      return;
    }
    if (target.matches("[data-batch-visibility]") && target.value) {
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { hidden: target.value === "hide" } });
      target.value = "";
      return;
    }
    if (target.matches("[data-config]")) this.#setConfig(target);
  }

  #apply(operation) {
    if (!this.#chart?.patch) return;
    this.#runEdit(() => this.#chart.patch([operation]));
  }

  #edit(input) {
    const [type, field] = input.dataset.edit.split(":");
    const id = this.#id(input.dataset.id);
    let value = input.value.trim();
    if (field === "identity") {
      value = Number(value) / 100;
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        this.#editingKey = null;
        return this.#renderData();
      }
    }
    const operationType = type === "cluster" ? "clusters.update" : type === "locus" ? "loci.update" : `${type}s.update`;
    const changeField = type === "cluster" || type === "locus" ? "name" : field;
    this.#editWidths.delete(this.#editingKey);
    this.#editingKey = null;
    if (value || field === "subtitle" || field === "label") this.#apply({ type: operationType, ids: [id], changes: { [changeField]: value } });
  }

  #setConfig(input) {
    if (!this.#chart?.config) return;
    const keys = input.dataset.config.split(".");
    const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
    let config = value;
    for (const key of keys.slice().reverse()) config = { [key]: config };
    this.#runEdit(() => this.#chart.config(config), input);
  }

  #data() { return this.#chart?.data?.() || null; }

  #cache() {
    const data = this.#data();
    if (!data) return null;
    if (this.#dataCache?.data === data) return this.#dataCache;

    const ids = new Map();
    const remember = (record) => {
      if (record?.uid !== undefined) ids.set(String(record.uid), record.uid);
      return record;
    };
    const groups = groupMap(data);
    const groupById = new Map((data.groups || []).map((group) => [String(group.uid), remember(group)]));
    const genes = [];
    const geneById = new Map();
    const clusterById = new Map();
    const locusById = new Map();
    const linkById = new Map();
    for (const cluster of data.clusters || []) {
      remember(cluster);
      clusterById.set(String(cluster.uid), cluster);
      for (const locus of cluster.loci || []) {
        remember(locus);
        locusById.set(String(locus.uid), locus);
        for (const gene of locus.genes || []) {
          remember(gene);
          geneById.set(String(gene.uid), gene);
          genes.push({ gene, locus, cluster });
        }
      }
    }
    for (const link of data.links || []) {
      remember(link);
      linkById.set(String(link.uid), link);
    }
    this.#dataCache = { data, ids, groups, groupById, genes, geneById, clusterById, locusById, linkById };
    return this.#dataCache;
  }

  #initializeExpanded() {
    const data = this.#data();
    const geneCount = data?.clusters?.flatMap((cluster) => cluster.loci).reduce((count, locus) => count + locus.genes.length, 0) || 0;
    if (!geneCount || geneCount > 500) return;
    data.clusters.forEach((cluster) => {
      if (cluster.loci.length === 1) this.#expanded.add(`cluster-locus:${cluster.uid}:${cluster.loci[0].uid}`);
      else {
        this.#expanded.add(`cluster:${cluster.uid}`);
        cluster.loci.forEach((locus) => this.#expanded.add(`locus:${locus.uid}`));
      }
    });
    (data.groups || []).forEach((group) => this.#expanded.add(`gene-group:${group.uid}`));
    this.#expanded.add("gene-group:ungrouped");
  }
  #id(value) {
    return this.#cache()?.ids.get(String(value)) ?? value;
  }
  #groupId(value) { return this.#cache()?.groupById.get(String(value))?.uid; }

  #nextGroupUid() {
    const used = new Set((this.#data()?.groups || []).map((group) => String(group.uid)));
    let index = used.size + 1;
    while (used.has(`group-${index}`)) index += 1;
    return `group-${index}`;
  }

  #editKey(kind, id) { return `${kind}:${String(id)}`; }

  #isEditing(kind, id) { return this.#editingKey === this.#editKey(kind, id); }

  #selectRow(id, checked, range) {
    this.#selected.select(id, checked, { range, orderedIds: this.#rows().filter((row) => row.type === "gene" || !row.type).map((row) => row.id) });
  }

  #selectableIds(rows = this.#rows()) {
    return [...new Set(rows.flatMap((row) => row.selectIds || (row.type === "gene" || !row.type ? [row.id] : [])))];
  }

  #sortRows(rows) {
    const sort = this.#sort[this.#kind];
    if (!sort) return rows;
    return [...rows].sort((left, right) => {
      const a = left[sort.key] ?? "";
      const b = right[sort.key] ?? "";
      const comparison = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
      return comparison * sort.direction;
    });
  }

  #rows() {
    const data = this.#data();
    const key = JSON.stringify([this.#kind, this.#geneView, this.#filter, this.#memberGroupId, this.#sort, [...this.#expanded]]);
    if (this.#rowsCache?.data === data && this.#rowsCache.key === key) return this.#rowsCache.rows;
    const rows = this.#computeRows();
    this.#rowsCache = { data, key, rows }; return rows;
  }

  #computeRows() {
    const data = this.#data();
    if (!data) return [];
    const needle = this.#filter;
    const includes = (...values) => !needle || values.join(" ").toLowerCase().includes(needle);
    const cache = this.#cache();
    const groups = cache.groups;
    if (this.#kind === "groups") return data.groups.filter((group) => includes(labelFor(group, group.uid), group.subtitle)).map((group) => ({
      id: group.uid, label: labelFor(group, group.uid), subtitle: group.subtitle || "", count: group.genes?.length || 0, hidden: Boolean(group.hidden), colour: group.colour,
    }));
    if (this.#kind === "links") {
      const genes = cache.geneById;
      return this.#sortRows(data.links.filter((link) => includes(labelFor(genes.get(link.query.uid), link.query.uid), labelFor(genes.get(link.target.uid), link.target.uid), link.label)).map((link) => ({
        id: link.uid,
        source: labelFor(genes.get(link.query.uid), link.query.uid),
        target: labelFor(genes.get(link.target.uid), link.target.uid),
        identity: Math.round((link.identity || 0) * 1000) / 10,
        groups: `${labelFor(groups.get(link.query.uid), "Ungrouped")} / ${labelFor(groups.get(link.target.uid), "Ungrouped")}`,
        label: link.label || "",
        hidden: Boolean(link.hidden),
        colour: link.colour,
      })));
    }
    const memberGroup = data.groups.find((group) => group.uid === this.#memberGroupId);
    if (this.#memberGroupId !== null && !memberGroup) this.#memberGroupId = null;
    const memberIds = memberGroup && new Set((memberGroup.genes || []).map(String));
    const genes = cache.genes.filter(({ gene, locus, cluster }) =>
      (!memberIds || memberIds.has(String(gene.uid))) && includes(labelFor(gene, gene.uid), labelFor(locus, locus.uid), labelFor(cluster, cluster.uid), labelFor(groups.get(gene.uid), "Ungrouped")));
    if (this.#geneView === "tree") return this.#treeRows(data, groups, genes, needle);
    if (this.#geneView === "groups") return this.#groupTreeRows(data, groups, genes, needle);
    return this.#sortRows(genes.map(({ gene, locus, cluster }) => ({
      id: gene.uid, label: labelFor(gene, gene.uid), locus: labelFor(locus, locus.uid), cluster: labelFor(cluster, cluster.uid), group: labelFor(groups.get(gene.uid), "Ungrouped"), colour: gene.colour || groups.get(gene.uid)?.colour,
    })));
  }

  #treeRows(data, groups, visible, needle) {
    const visibleIds = new Set(visible.map(({ gene }) => gene.uid));
    const rows = [];
    for (const cluster of data.clusters) {
      const loci = cluster.loci.map((locus) => ({ locus, genes: locus.genes.filter((gene) => visibleIds.has(gene.uid)) })).filter(({ genes }) => genes.length);
      if (!loci.length) continue;
      if (loci.length === 1) {
        const { locus, genes } = loci[0];
        const key = `cluster-locus:${cluster.uid}:${locus.uid}`;
        const open = Boolean(needle) || this.#expanded.has(key);
        rows.push({ type: "cluster-locus", key, cluster, locus, label: labelFor(cluster, cluster.uid), locusLabel: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open });
        if (open) rows.push(...genes.map((gene) => this.#treeGeneRow(gene, locus, cluster, groups, 1)));
        continue;
      }
      const key = `cluster:${cluster.uid}`;
      const open = Boolean(needle) || this.#expanded.has(key);
      rows.push({ type: "cluster", key, cluster, label: labelFor(cluster, cluster.uid), count: loci.reduce((count, item) => count + item.genes.length, 0), selectIds: loci.flatMap(({ genes }) => genes.map((gene) => gene.uid)), open });
      if (!open) continue;
      for (const { locus, genes } of loci) {
        const locusKey = `locus:${locus.uid}`;
        const locusOpen = Boolean(needle) || this.#expanded.has(locusKey);
        rows.push({ type: "locus", key: locusKey, locus, label: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open: locusOpen, depth: 1 });
        if (locusOpen) rows.push(...genes.map((gene) => this.#treeGeneRow(gene, locus, cluster, groups, 2)));
      }
    }
    return rows;
  }

  #treeGeneRow(gene, locus, cluster, groups, depth) {
    return { type: "gene", id: gene.uid, label: labelFor(gene, gene.uid), locus: labelFor(locus, locus.uid), cluster: labelFor(cluster, cluster.uid), group: labelFor(groups.get(gene.uid), "Ungrouped"), colour: gene.colour || groups.get(gene.uid)?.colour, depth };
  }

  #groupTreeRows(data, groups, visible, needle) {
    const entries = new Map(visible.flatMap(({ gene, locus, cluster }) => {
      const entry = { gene, locus, cluster };
      return [[gene.uid, entry], [String(gene.uid), entry]];
    }));
    const buckets = [
      ...(data.groups || []).map((group) => ({ key: `gene-group:${group.uid}`, label: labelFor(group, group.uid), genes: (group.genes || []).map((id) => entries.get(id)).filter(Boolean) })),
      { key: "gene-group:ungrouped", label: "Ungrouped", genes: visible.filter(({ gene }) => !groups.has(gene.uid)) },
    ];
    const rows = [];
    for (const bucket of buckets) {
      if (!bucket.genes.length) continue;
      const open = Boolean(needle) || this.#expanded.has(bucket.key);
      rows.push({ type: "gene-group", key: bucket.key, label: bucket.label, count: bucket.genes.length, selectIds: bucket.genes.map(({ gene }) => gene.uid), open });
      if (open) rows.push(...bucket.genes.map(({ gene, locus, cluster }) => this.#treeGeneRow(gene, locus, cluster, groups, 1)));
    }
    return rows;
  }

  #render() {
    if (!this.isConnected || !this.querySelector("[data-rows]")) return;
    this.#renderData();
    this.#renderAppearance();
    this.#renderHistory();
  }

  #renderHistory() {
    const undo = this.querySelector('[data-command="undo"]');
    const redo = this.querySelector('[data-command="redo"]');
    if (undo) undo.disabled = !this.#chart?.canUndo?.();
    if (redo) redo.disabled = !this.#chart?.canRedo?.();
  }

  get #activeDataView() {
    if (this.#kind === "annotations") return this.#annotationEditor;
    return this.#recordView ||= {
      setFilter: (text) => {
        this.#filter = text.trim().toLowerCase();
        this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
        this.#renderData();
      },
      clearSelection: () => { this.#selected.clear(); this.#renderData(); this.#syncHighlight(); },
      update: () => this.#renderData(),
      destroy: () => { this.#rowView?.destroy(); this.#rowView = null; },
    };
  }

  #renderData() {
    if (this.querySelector('[data-panel="data"]')?.hidden) return;
    const annotations = this.#kind === "annotations";
    const annotationHost = this.querySelector("[data-annotation-editor]");
    if (!annotationHost) return;
    annotationHost.hidden = !annotations;
    this.querySelector("[data-annotation-toolbar]").hidden = !annotations;
    const search = this.querySelector("[data-filter]");
    search.value = annotations ? this.#annotationEditor?.filter || "" : this.#filter;
    search.placeholder = annotations ? "Find a cluster" : "Search names, labels, loci, or clusters";
    this.querySelector("[data-record-editor]").hidden = annotations;
    if (annotations) {
      for (const selector of ["[data-gene-view]", "[data-member-filter]", '[data-command="new-group"]',
        '[data-command="toggle-tree"]']) this.querySelector(selector).hidden = true;
      if (!this.#annotationEditor) {
        this.#annotationEditor = createAnnotationDataControls({ document: this.ownerDocument,
          embedded: true,
          getPanels: () => this.#data()?.annotationPanels || [], getClusters: () => this.#data()?.clusters || [],
          getTree: () => this.#data()?.tree, patch: (operations) => this.#chart.patch(operations),
          annotationApi: { ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, resolveAnnotationScale, validateAnnotationPanels },
        });
        annotationHost.append(this.#annotationEditor.node);
        this.querySelector("[data-annotation-toolbar]").append(this.#annotationEditor.toolbar);
      } else this.#activeDataView.update();
      search.value = this.#annotationEditor.filter;
      this.querySelector('[data-command="clear-filter"]').hidden = !this.#annotationEditor.filter;
      return;
    }
    const data = this.#data();
    const head = this.querySelector("[data-head]");
    const list = this.querySelector("[data-rows]");
    const actions = this.querySelector("[data-actions]");
    if (!data) {
      this.#rowView?.destroy(); this.#rowView = null;
      setMarkup(head, ""); list.textContent = "Set the chart property to edit a ClusterMap chart.";
      this.#selectionControls.update({ ids: [], summary: "No chart attached.", noun: this.#kind.slice(0, -1) });
      setMarkup(actions, "");
      return;
    }
    const geneView = this.querySelector("[data-gene-view]");
    const memberFilter = this.querySelector("[data-member-filter]");
    const memberGroup = data.groups.find((group) => group.uid === this.#memberGroupId);
    if (!memberGroup) this.#memberGroupId = null;
    const rows = this.#rows();
    memberFilter.hidden = !memberGroup || this.#kind !== "genes";
    this.querySelector("[data-record-tools]").hidden = memberFilter.hidden;
    if (memberGroup) this.querySelector("[data-member-label]").textContent = labelFor(memberGroup, memberGroup.uid);
    geneView.hidden = this.#kind !== "genes";
    this.querySelector('[data-command="new-group"]').hidden = this.#kind !== "groups";
    this.querySelector('[data-command="clear-filter"]').hidden = !this.#filter;
    const isTree = this.#kind === "genes" && this.#geneView !== "list";
    const treeButton = this.querySelector('[data-command="toggle-tree"]');
    treeButton.hidden = !isTree || Boolean(this.#filter);
    if (isTree) {
      const hasCollapsed = rows.some((row) => row.type !== "gene" && !row.open);
      treeButton.textContent = hasCollapsed ? "Expand visible" : "Collapse all";
      treeButton.title = hasCollapsed ? "Expand all currently visible branches" : "Collapse every tree branch";
    }
    // Visibility is a compact icon control with an explicit per-row label;
    // repeating its long text in a 28px heading produces an unreadable merged
    // “VisibleColour” column on narrow editors.
    const columns = this.#kind === "groups" ? [{ label: "" }, { label: "↕" }, { label: "Group" }, { label: "Legend label" }, { label: "Genes" }, { label: "" }, { label: "Colour" }]
      : this.#kind === "links" ? [{ label: "" }, { label: "Source", sort: "source" }, { label: "Target", sort: "target" }, { label: "Identity", sort: "identity" }, { label: "Endpoint groups", sort: "groups" }, { label: "Link label", sort: "label" }, { label: "" }, { label: "Colour" }]
        : [{ label: "" }, { label: "Gene", sort: "label" }, { label: "Locus", sort: "locus" }, { label: "Cluster", sort: "cluster" }, { label: "Group", sort: "group" }, { label: "Colour" }];
    const sort = this.#sort[this.#kind];
    head.hidden = isTree;
    head.className = `cm-data-head cm-editor__head cm-editor__head--${this.#kind}`;
    setMarkup(head, columns.map(({ label, sort: key }, index) => {
      if (index === 0) return dataCell("", true);
      if (!key) return `<span class="cm-data-cell">${label}</span>`;
      const active = sort?.key === key;
      const direction = active && sort.direction < 0 ? "descending" : "ascending";
      return `<button type="button" class="cm-data-cell cm-editor__sort" data-sort="${key}" aria-label="Sort by ${label}, ${direction}" title="Sort by ${label}">${label}<span aria-hidden="true">${active ? (sort.direction < 0 ? "↓" : "↑") : "↕"}</span></button>`;
    }).join(""));
    list.className = `cm-editor__rows cm-editor__rows--${isTree ? "tree" : this.#kind}`;
    const table = this.querySelector(".cm-editor__table");
    if (!this.#rowView) {
      list.replaceChildren();
      const markup = new WeakMap();
      const build = (row, html = row.type ? this.#treeRowMarkup(row) : this.#rowMarkup(row)) => {
        const template = this.ownerDocument.createElement("template"); template.innerHTML = html;
        const node = template.content.firstElementChild; markup.set(node, html); return node;
      };
      this.#rowView = createVirtualRows({ viewport: table, container: list,
        key: (row) => `${this.#kind}:${row.type || "row"}:${row.key ?? row.id}`,
        headerHeight: () => head.hidden ? 0 : head.offsetHeight, createRow: build,
        createEmpty: () => { const message = this.ownerDocument.createElement("p"); message.className = "cm-editor__empty"; message.textContent = "No records match the filter."; return message; },
        updateRow: (node, row) => {
          const html = row.type ? this.#treeRowMarkup(row) : this.#rowMarkup(row);
          return markup.get(node) === html ? node : build(row, html);
        } });
    }
    if (this.#selectionData !== data) {
      const cache = this.#cache();
      const records = this.#kind === "genes" ? cache.geneById.values() : this.#kind === "links" ? data.links : data.groups;
      this.#selected.prune([...records].map((record) => record.uid)); this.#selectionData = data;
    }
    this.#rowView.setRows(rows);
    const visibleGenes = isTree ? new Set(rows.flatMap((row) => row.selectIds || (row.type === "gene" ? [row.id] : []))).size : rows.length;
    const summaryText = isTree
      ? `${rows.filter((row) => row.type !== "gene").length.toLocaleString()} cluster/locus rows · ${visibleGenes.toLocaleString()} genes${this.#filter ? " matching search" : ""}.`
      : `${rows.length.toLocaleString()} visible ${this.#kind}${memberGroup && this.#kind === "genes" ? " in selected group" : ""}${this.#filter ? " matching search" : ""}.`;
    this.#selectionControls.update({ ids: this.#selectableIds(rows), summary: summaryText,
      noun: this.#kind.slice(0, -1), selectSuffix: isTree ? " genes" : "" });
    setMarkup(actions, this.#selected.size ? this.#actionsMarkup(this.#selected.size) : "");
  }

  #rowMarkup(row) {
    const selected = this.#selected.has(row.id);
    const box = dataCell(`<input type="checkbox" data-select="${escapeHtml(row.id)}" ${selected ? "checked" : ""} aria-label="Select ${escapeHtml(row.label || row.source)}">`, true);
    const visible = (type) => `<button type="button" class="cm-editor__visibility" data-visible data-type="${type}" data-id="${escapeHtml(row.id)}" data-hidden="${row.hidden}" aria-label="${row.hidden ? "Show" : "Hide"}" title="${row.hidden ? "Show" : "Hide"}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.75"></circle>${row.hidden ? '<path d="m4 4 16 16"></path>' : ""}</svg></button>`;
    const colour = (type) => dataCell(`<input type="color" data-colour data-type="${type}" data-id="${escapeHtml(row.id)}" value="${colourHex(row.colour)}" aria-label="Colour">`);
    if (this.#kind === "groups") return `<div data-id="${escapeHtml(row.id)}" class="cm-data-row cm-editor__row cm-editor__row--groups ${selected ? "is-selected" : ""}">${box}<button type="button" class="cm-editor__reorder" draggable="true" data-reorder="${escapeHtml(row.id)}" aria-label="Reorder ${escapeHtml(row.label)}; use Arrow Up or Arrow Down to move it" title="Drag to reorder; Arrow Up or Arrow Down moves one place">⠿</button>${editableField("group:label", row.id, row.label, "Group name", row.label || "group", this.#isEditing("group:label", row.id))}${editableField("group:subtitle", row.id, row.subtitle, "Add subtitle…", `${row.label || "group"} subtitle`, this.#isEditing("group:subtitle", row.id))}<span class="cm-data-cell">${row.count.toLocaleString()} genes</span>${visible("groups")}${colour("groups")}</div>`;
    if (this.#kind === "links") return `<div data-id="${escapeHtml(row.id)}" class="cm-data-row cm-editor__row cm-editor__row--links ${selected ? "is-selected" : ""}">${box}<span class="cm-data-cell" title="${escapeHtml(row.source)}">${escapeHtml(row.source)}</span><span class="cm-data-cell" title="${escapeHtml(row.target)}">${escapeHtml(row.target)}</span>${editableCell("link:identity", row.id, row.identity, "Identity")}<span class="cm-data-cell" title="${escapeHtml(row.groups)}">${escapeHtml(row.groups)}</span>${editableField("link:label", row.id, row.label, "Add label…", "link label", this.#isEditing("link:label", row.id))}<span>${visible("links")}</span>${colour("links")}</div>`;
    return `<div data-id="${escapeHtml(row.id)}" class="cm-data-row cm-editor__row cm-editor__row--genes ${selected ? "is-selected" : ""}">${box}${editableField("gene:label", row.id, row.label, "Gene label", row.label || "gene", this.#isEditing("gene:label", row.id))}<span class="cm-data-cell" title="${escapeHtml(row.locus)}">${escapeHtml(row.locus)}</span><span class="cm-data-cell" title="${escapeHtml(row.cluster)}">${escapeHtml(row.cluster)}</span><span class="cm-data-cell" title="${escapeHtml(row.group)}">${escapeHtml(row.group)}</span>${colour("genes")}</div>`;
  }

  #treeRowMarkup(row) {
    if (row.type === "gene") {
      const selected = this.#selected.has(row.id);
      return `<div data-id="${escapeHtml(row.id)}" class="cm-data-row cm-editor__tree-row cm-editor__tree-gene ${selected ? "is-selected" : ""}" style="--depth:${row.depth}">${dataCell(`<input type="checkbox" data-select="${escapeHtml(row.id)}" ${selected ? "checked" : ""} aria-label="Select ${escapeHtml(row.label)}">`, true)}${editableField("gene:label", row.id, row.label, "Gene label", row.label || "gene", this.#isEditing("gene:label", row.id))}<span class="cm-data-cell" title="${escapeHtml(row.group)}">${escapeHtml(row.group)}</span>${dataCell(`<input type="color" data-colour data-type="genes" data-id="${escapeHtml(row.id)}" value="${colourHex(row.colour)}" aria-label="Colour">`)}</div>`;
    }
    const arrow = `<button type="button" class="cm-editor__tree-toggle" data-tree-toggle="${escapeHtml(row.key)}" aria-label="${row.open ? "Collapse" : "Expand"}">${row.open ? "▾" : "▸"}</button>`;
    const selected = row.selectIds?.length && row.selectIds.every((id) => this.#selected.has(id));
    const select = dataCell(`<input type="checkbox" data-select-many="${escapeHtml(JSON.stringify(row.selectIds || []))}" ${selected ? "checked" : ""} aria-label="Select ${row.count.toLocaleString()} genes in ${escapeHtml(row.label)}">`, true);
    const count = `<span class="cm-editor__tree-count">(${row.count.toLocaleString()})</span>`;
    const selectedIds = escapeHtml(JSON.stringify(row.selectIds || []));
    if (row.type === "cluster-locus") {
      const clusterEditing = this.#isEditing("cluster:label", row.cluster.uid);
      const locusEditing = this.#isEditing("locus:label", row.locus.uid);
      return `<div data-select-ids="${selectedIds}" class="cm-data-row cm-editor__tree-row cm-editor__tree-parent">${arrow}${select}<div class="cm-editor__tree-combined ${clusterEditing || locusEditing ? "is-editing" : ""}">${editableField("cluster:label", row.cluster.uid, row.label, "Cluster name", row.label || "cluster", clusterEditing, true, this.#editWidths.get(this.#editKey("cluster:label", row.cluster.uid)))}<span class="cm-editor__tree-separator">·</span>${editableField("locus:label", row.locus.uid, row.locusLabel, "Locus name", row.locusLabel || "locus", locusEditing, true, this.#editWidths.get(this.#editKey("locus:label", row.locus.uid)))}${count}</div></div>`;
    }
    if (row.type === "gene-group") return `<div data-select-ids="${selectedIds}" class="cm-data-row cm-editor__tree-row cm-editor__tree-parent">${arrow}${select}<span class="cm-data-cell cm-editor__tree-group-label">${escapeHtml(row.label)} ${count}</span></div>`;
    const type = row.type === "cluster" ? "cluster" : "locus";
    const record = row[type];
    return `<div data-select-ids="${selectedIds}" class="cm-data-row cm-editor__tree-row cm-editor__tree-parent" style="--depth:${row.depth || 0}">${arrow}${select}<span class="cm-editor__tree-name-with-count">${editableField(`${type}:label`, record.uid, row.label, `${type} name`, row.label || type, this.#isEditing(`${type}:label`, record.uid), true)}${count}</span></div>`;
  }

  #actionsMarkup(count) {
    const focus = `<span class="cm-editor__action-group"><button type="button" data-command="focus">Focus in plot</button></span>`;
    if (this.#kind === "genes") {
      const options = (this.#data()?.groups || []).map((group) => `<option value="${escapeHtml(group.uid)}">${escapeHtml(labelFor(group, group.uid))}</option>`).join("");
      return `${focus}<span class="cm-editor__action-group"><label>Move to <select data-assign-group><option value="">Choose a group…</option>${options}</select></label><button type="button" data-command="assign">Move</button><button type="button" data-command="unassign">Remove from groups</button><button type="button" data-command="new-group-for-selection">New group…</button></span><span class="cm-editor__action-group"><button type="button" data-command="delete" class="cm-editor__danger">Delete selected genes</button></span>`;
    }
    // Individual records are edited inline. Keep this bar for explicitly
    // shared presentation changes, as in the original editor.
    const presentation = count > 1 ? `<span class="cm-editor__action-group"><input data-batch-label placeholder="Set label"><button type="button" data-command="batch-label">Set label</button><label title="Set colour"><span class="cm-editor__sr-only">Set colour</span><input type="color" data-batch-colour value="#888888"></label>${this.#kind === "links" ? `<input type="number" data-batch-identity min="0" max="100" step=".1" placeholder="Set identity (%)"><button type="button" data-command="batch-identity">Set identity</button>` : ""}<select data-batch-visibility aria-label="Set visibility"><option value="">Visibility…</option><option value="show">Show</option><option value="hide">Hide</option></select></span>` : "";
    const groupActions = this.#kind !== "groups" ? "" : count > 1
      ? `<span class="cm-editor__action-group"><select data-merge-target><option value="">Choose group to keep…</option>${(this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid)).map((group) => `<option value="${escapeHtml(group.uid)}">${escapeHtml(labelFor(group, group.uid))}</option>`).join("")}</select><button type="button" data-command="merge">Merge groups</button></span>`
      : `<span class="cm-editor__action-group"><button type="button" data-command="view-members">View member genes</button><button type="button" data-command="move-first">First</button><label>Position <input type="number" data-group-position min="1" max="${this.#data()?.groups.length || 1}" value="${Math.max(1, (this.#data()?.groups || []).findIndex((group) => this.#selected.has(group.uid)) + 1)}"></label><button type="button" data-command="move-position">Move</button><button type="button" data-command="move-last">Last</button></span>`;
    return `${focus}${presentation}${groupActions}<span class="cm-editor__action-group"><button type="button" data-command="delete" class="cm-editor__danger">Delete selected ${this.#kind}</button></span>`;
  }

  #deleteSelected() {
    const ids = [...this.#selected];
    if (!ids.length || !window.confirm(`Delete ${ids.length} selected ${this.#kind}?`)) return;
    const type = this.#kind === "groups" ? "groups.delete" : `${this.#kind}.delete`;
    this.#selected.clear();
    this.#apply({ type, ids });
  }

  #moveGroup(uid, delta) {
    const ids = (this.#data()?.groups || []).map((group) => group.uid);
    const from = ids.indexOf(uid);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, uid);
    this.#apply({ type: "groups.reorder", ids });
  }

  #moveSelectedGroupTo(index) {
    const ids = (this.#data()?.groups || []).map((group) => group.uid);
    const selected = [...this.#selected][0];
    const from = ids.indexOf(selected);
    if (from < 0 || !Number.isFinite(index)) return;
    ids.splice(from, 1);
    ids.splice(Math.max(0, Math.min(ids.length, Math.trunc(index))), 0, selected);
    this.#apply({ type: "groups.reorder", ids });
  }

  #viewGroupMembers(groupId) {
    this.#memberGroupId = this.#id(groupId);
    this.#kind = "genes";
    this.#geneView = "list";
    this.#selected.clear();
    this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
    this.querySelectorAll("[data-kind]").forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.kind === "genes")));
    this.querySelectorAll("[data-gene-view-kind]").forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.geneViewKind === "list")));
    this.#syncHighlight();
    this.#renderData();
  }

  #focusSelected() {
    if (!this.#chart?.focus || !this.#selected.size) return;
    if (this.#kind === "groups") {
      const genes = (this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid)).flatMap((group) => group.genes || []);
      this.#chart.focus({ genes });
    } else if (this.#kind === "links") this.#chart.focus({ links: [...this.#selected] });
    else this.#chart.focus({ genes: [...this.#selected] });
  }

  #placeGroup(uid, targetUid, after) {
    const ids = (this.#data()?.groups || []).map((group) => group.uid);
    const from = ids.indexOf(uid);
    if (from < 0 || uid === targetUid) return;
    ids.splice(from, 1);
    let target = ids.indexOf(targetUid);
    if (target < 0) return;
    if (after) target += 1;
    ids.splice(target, 0, uid);
    this.#apply({ type: "groups.reorder", ids });
  }

  #finishGroupDrag() {
    this.#draggedGroupId = null;
    this.querySelectorAll(".cm-editor__drop-target").forEach((node) => node.classList.remove("cm-editor__drop-target"));
  }

  #undo() {
    this.#chart?.undo?.();
  }

  #redo() {
    this.#chart?.redo?.();
  }

  #toggleTree() {
    const rows = this.#rows();
    if (rows.some((row) => row.type !== "gene" && !row.open)) {
      const data = this.#data();
      if (this.#geneView === "groups") {
        (data?.groups || []).forEach((group) => this.#expanded.add(`gene-group:${group.uid}`));
        this.#expanded.add("gene-group:ungrouped");
      } else {
        (data?.clusters || []).forEach((cluster) => {
          if (cluster.loci.length === 1) this.#expanded.add(`cluster-locus:${cluster.uid}:${cluster.loci[0].uid}`);
          else {
            this.#expanded.add(`cluster:${cluster.uid}`);
            cluster.loci.forEach((locus) => this.#expanded.add(`locus:${locus.uid}`));
          }
        });
      }
    } else this.#expanded.clear();
    this.#renderData();
  }

  #syncHighlight() {
    this.#cancelHover();
    this.#applySelectionHighlight();
  }

  #applySelectionHighlight() {
    if (!this.#chart?.highlight) return;
    if (this.#kind === "links") this.#chart.highlight({ links: this.#selected });
    else if (this.#kind === "groups") {
      const genes = (this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid)).flatMap((group) => group.genes || []);
      this.#chart.highlight({ genes });
    } else this.#chart.highlight({ genes: this.#selected });
  }

  #queueHover(row) {
    this.#hoverRow = row;
    if (this.#hoverTimer !== null) globalThis.clearTimeout(this.#hoverTimer);
    this.#hoverTimer = globalThis.setTimeout(() => {
      this.#hoverTimer = null;
      if (this.#hoverFrame !== null) return;
      const requestFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
      this.#hoverFrame = requestFrame(() => {
        this.#hoverFrame = null;
        const hovered = this.#hoverRow;
        if (hovered === this.#hoveredRow) return;
        this.#hoveredRow = hovered;
        if (hovered?.isConnected) this.#highlightRow(hovered);
        else this.#applySelectionHighlight();
      });
    }, 36);
  }

  #cancelHover() {
    if (this.#hoverTimer !== null) globalThis.clearTimeout(this.#hoverTimer);
    if (this.#hoverFrame !== null) {
      const cancelFrame = globalThis.cancelAnimationFrame || globalThis.clearTimeout;
      cancelFrame(this.#hoverFrame);
    }
    this.#hoverTimer = null;
    this.#hoverFrame = null;
    this.#hoverRow = null;
    this.#hoveredRow = null;
  }

  #highlightRow(row) {
    if (!this.#chart?.highlight) return;
    if (row.classList.contains("cm-editor__row--links")) {
      this.#chart.highlight({ links: [this.#id(row.dataset.id)] });
      return;
    }
    let genes = [];
    if (row.dataset.selectIds) {
      try { genes = JSON.parse(row.dataset.selectIds); } catch { genes = []; }
    } else if (row.classList.contains("cm-editor__row--groups")) {
      genes = this.#data()?.groups.find((group) => group.uid === this.#id(row.dataset.id))?.genes || [];
    } else if (row.dataset.id !== undefined) {
      genes = [this.#id(row.dataset.id)];
    }
    this.#chart.highlight({ genes: genes.map((id) => this.#id(id)) });
  }

  #renderAppearance() {
    const container = this.querySelector("[data-appearance]");
    const requestedConfig = this.#chart?.config?.();
    const config = requestedConfig && figureConfig(requestedConfig);
    if (config) applyTheme(this, resolveTheme(config.plot.theme));
    if (!container) return;
    container.hidden = !config;
    if (!config || this.querySelector('[data-panel="appearance"]')?.hidden) return;
    const clear = this.querySelector('[data-command="clear-appearance-filter"]');
    if (clear) clear.hidden = !this.#appearanceFilter;
    if (!this.#appearanceView) {
      this.#appearanceView = createAppearanceControls({ document: this.ownerDocument,
        patch: (ops) => this.#chart.patch(ops), preview: (ops) => this.#chart.previewTreePresentation(ops),
        rotate: (uid) => this.#chart.rotateTreeNode(uid) });
      container.append(this.#appearanceView.node);
    }
    this.#appearanceView.update({ config, tree: this.#chart.data()?.tree, filter: this.#appearanceFilter,
      expanded: this.#appearanceAdvanced });
  }
}

/** Register the documented <clinker-editor> element once. */
function defineClinkerEditor() {
  if (!globalThis.customElements) {
    throw new Error("Custom elements are unavailable in this environment.");
  }
  if (!customElements.get(tagName)) customElements.define(tagName, ClinkerEditorElement);
  return customElements.get(tagName);
}

/**
 * Mount the small batch-locus toolbar inside a plot container.
 * It is intentionally separate from <clinker-editor>: selection and flipping
 * are plot operations, and applications may use them without opening data UI.
 */
let activeToolbar = null;

function mountPlotSelectionToolbar(chart, container) {
  if (!chart?.locusSelection || !chart?.flipLoci || !chart?.trimLoci || !chart?.restoreLoci) throw new TypeError("A mounted ClusterMap chart is required.");
  if (!(container instanceof Element)) throw new TypeError("A plot container element is required.");
  const root = document.createElement("div");
  root.className = "cm-plot-selection-toolbar";
  root.hidden = true;
  root.innerHTML = `<strong></strong><button type="button" data-flip>Flip selected loci</button><button type="button" data-trim>Trim selected loci</button><button type="button" data-restore>Restore full loci</button><button type="button" data-clear>Clear</button>`;
  const summary = root.querySelector("strong");
  const sync = () => {
    const count = chart.locusSelection().length;
    root.hidden = count === 0;
    summary.textContent = `${count} ${count === 1 ? "locus" : "loci"} selected`;
  };
  const clear = () => chart.locusSelection([]);
  const activate = () => { activeToolbar = root; };
  root.querySelector("[data-flip]").addEventListener("click", () => chart.flipLoci());
  root.querySelector("[data-trim]").addEventListener("click", () => chart.trimLoci());
  root.querySelector("[data-restore]").addEventListener("click", () => chart.restoreLoci());
  root.querySelector("[data-clear]").addEventListener("click", clear);
  const onKeyDown = (event) => {
    if (activeToolbar !== root || event.key !== "Escape" || event.defaultPrevented || !chart.locusSelection().length) return;
    if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    clear();
  };
  // Keyboard focus is commonly still on <body> after an SVG/canvas click, so
  // track the active chart at its container rather than requiring focusable
  // renderer surfaces. This prevents one chart's Escape handler clearing all
  // other charts on the page.
  container.addEventListener("pointerdown", activate);
  container.addEventListener("focusin", activate);
  document.addEventListener("keydown", onKeyDown);
  const unsubscribe = chart.on("change", (change) => {
    if (change.type === "loci.select") sync();
  });
  container.append(root);
  sync();
  return () => {
    unsubscribe();
    if (activeToolbar === root) activeToolbar = null;
    container.removeEventListener("pointerdown", activate);
    container.removeEventListener("focusin", activate);
    document.removeEventListener("keydown", onKeyDown);
    root.remove();
  };
}

export { ClinkerEditorElement, defineClinkerEditor, mountPlotSelectionToolbar };
