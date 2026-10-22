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

/** Parse static markup once per document; each mount receives its own nodes. */
function createTemplate(markup) {
  const templates = new WeakMap();
  return (document) => {
    let template = templates.get(document);
    if (!template) {
      template = document.createElement("template"); template.innerHTML = markup;
      templates.set(document, template);
    }
    return document.importNode(template.content, true);
  };
}

const controlTemplates = Object.fromEntries(["button", "input", "select", "option"].map((tag) =>
  [tag, createTemplate(tag === "input" ? "<input>" : `<${tag}></${tag}>`)]));
const labelTemplate = createTemplate("<label><span></span></label>");
const selectOptions = new WeakMap();
function updateSelectOptions(control, entries) {
  const options = entries.map((entry) => Array.isArray(entry) ? entry : [entry, entry]);
  const key = JSON.stringify(options);
  if (selectOptions.get(control) === key) return;
  const value = control.value;
  control.replaceChildren(...options.map(([value, label]) => {
    const option = controlTemplates.option(control.ownerDocument).firstElementChild;
    option.value = value; option.textContent = label; return option;
  }));
  control.value = value; selectOptions.set(control, key);
}

/** Native controls with consistent labels, values and validity handling. */
function createControls(document) {
  const el = (tag, text, parent, className) => {
    const node = controlTemplates[tag]?.(document).firstElementChild || document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    parent?.append(node); return node;
  };
  const row = (parent, label) => {
    const node = labelTemplate(document).firstElementChild;
    node.firstElementChild.textContent = label; parent?.append(node); return node;
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
    updateSelectOptions(node, entries);
    node.value = value;
    if (onChange) node.onchange = () => onChange(node.value);
    return node;
  };
  const field = (parent, label, value, { type = "text", entries, options, commit, cancel } = {}) =>
    bindEditableField(entries ? select(parent, label, value, entries) : input(parent, label, value, type, undefined, options),
      { commit, cancel });
  return { el, row, button, input, select, field };
}

const fieldValues = new WeakMap();
function updateFieldValue(control, value) {
  if (control === control.ownerDocument.activeElement) return;
  control.value = value ?? "";
  fieldValues.set(control, control.value);
}

/** Shared commit, validation and cancellation for editable fields. */
function bindEditableField(control, { commit, cancel }) {
  control.classList.add("cm-data-field");
  fieldValues.set(control, control.value);
  control.onchange = () => {
    control.setCustomValidity("");
    if (!control.checkValidity()) { control.reportValidity(); return; }
    if (control.value === fieldValues.get(control)) return;
    if (commit(control.value, control) !== false) fieldValues.set(control, control.value);
    else control.reportValidity();
  };
  control.onkeydown = (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      control.value = fieldValues.get(control); control.setCustomValidity(""); cancel?.();
    } else if (event.key === "Enter" && control.tagName === "INPUT") {
      event.preventDefault(); control.blur();
    }
  };
  return control;
}

/** Report rejected UI edits consistently while leaving validation in the model. */
function createActionRunner(report) {
  return (action, control) => {
    control?.setCustomValidity("");
    try { action(); report(""); return true; }
    catch (error) { report(error.message); control?.setCustomValidity(error.message); return false; }
  };
}

/** Shared fixed-height row window for scrollable data editors. */
const DATA_ROW_HEIGHT = 34;

function virtualRowWindow(count, scrollTop, height, { rowHeight = DATA_ROW_HEIGHT, overscan = 8, threshold = 200 } = {}) {
  const virtual = count > threshold;
  const first = virtual ? Math.min(Math.max(0, count - 1), Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)) : 0;
  const last = virtual ? Math.min(count, first + Math.ceil((height || 320) / rowHeight) + overscan * 2) : count;
  return { first, last, before: first * rowHeight, after: (count - last) * rowHeight };
}

/** Own scrolling, resizing and keyed DOM rows; callers supply row/spacer elements. */
function createVirtualRows({ viewport, container, key, createRow, updateRow,
  disposeRow = () => {}, createSpacer, createEmpty, headerHeight = () => 0, onRender = () => {} }) {
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
    const scrollTop = viewport.scrollTop;
    rendering = true;
    try {
      first = window.first; last = window.last;
      const visible = rows.slice(first, last), ids = new Set(visible.map(key));
      const remove = (node) => {
        if (node.contains(document.activeElement)) { document.activeElement.blur(); viewport.focus({ preventScroll: true }); }
        disposeRow(node); node.remove();
      };
      for (const [id, entry] of mounted) if (!ids.has(id)) { remove(entry.node); mounted.delete(id); }
      if (empty) empty.hidden = rows.length > 0;
      let next = empty || bottom;
      for (let index = visible.length - 1; index >= 0; index--) {
        const row = visible[index], id = key(row);
        let entry = mounted.get(id);
        if (!entry) { entry = { node: createRow(row) }; mounted.set(id, entry); }
        else updateRow?.(entry.node, row);
        entry.node.setAttribute("aria-rowindex", first + index + 2);
        if (entry.node.nextSibling !== next) container.insertBefore(entry.node, next);
        next = entry.node;
      }
      // A table spacer uses its cell for height; a list spacer uses the element.
      (top.firstElementChild || top).style.height = `${window.before}px`;
      (bottom.firstElementChild || bottom).style.height = `${window.after}px`;
      // Removing mounted rows can temporarily shrink the scroll area and clamp
      // its position, especially when jumping to the end of a native table.
      viewport.scrollTop = scrollTop;
      onRender([...mounted.values()].map((entry) => entry.node));
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
      for (const { node } of mounted.values()) { disposeRow(node); node.remove(); }
      top.remove(); bottom.remove(); empty?.remove(); mounted.clear();
    },
  };
}

const panelTemplate = createTemplate(`
  <div class="cm-data-panel">
    <div class="cm-data-tools" hidden></div>
    <clinker-selection-bar class="cm-data-meta"><div slot="actions" class="cm-data-actions"></div></clinker-selection-bar>
    <div class="cm-data-table" role="region"></div>
  </div>`);
const selectionActionsTemplate = createTemplate('<span class="cm-data-selection-actions"></span>');
const menuTemplate = createTemplate('<clinker-action-menu></clinker-action-menu>');
function createDataActionMenu(document, label, content) {
  const node = menuTemplate(document).firstElementChild;
  node.setAttribute("label", label); if (content) node.append(content);
  return node;
}
/** Shared content layout for every data view, including the standalone editor. */
function createDataPanel(document, { label = "Editable chart data" } = {}) {
  installDataEditorStyle(document);
  const node = panelTemplate(document).firstElementChild;
  const tools = node.querySelector(".cm-data-tools"), meta = node.querySelector(".cm-data-meta");
  const actions = meta.querySelector(".cm-data-actions");
  node.addEventListener("mousedown", (event) => {
    if (event.button === 0 && event.shiftKey && event.target.closest(".cm-data-row") &&
        !event.target.closest('input:not([type="checkbox"]), textarea, select, [contenteditable], clinker-editable-field')) event.preventDefault();
  });
  const viewport = node.querySelector(".cm-data-table"); viewport.setAttribute("aria-label", label);
  return { node, tools, meta, actions, viewport,
    sync() { tools.hidden = ![...tools.children].some((child) => !child.hidden); } };
}

/** Keep selection controls independent of the table's row and action rendering. */
function createSelectionControls(panel, { selection, onChange, checkbox, menuLabel } = {}) {
  const menu = menuLabel && createDataActionMenu(panel.node.ownerDocument, menuLabel);
  if (menu) panel.actions.append(menu);
  const actions = menu || selectionActionsTemplate(panel.node.ownerDocument).firstElementChild;
  if (!menu) panel.actions.append(actions);
  panel.meta.addEventListener("clear-selection", () => { selection.clear(); onChange(); });
  let visibleIds = [];
  panel.meta.addEventListener("select-all", () => { selection.setMany(visibleIds); onChange(); });
  if (checkbox) checkbox.onchange = () => { selection.setMany(visibleIds, checkbox.checked); onChange(); };
  return { actions,
    update({ ids, summary, noun, selectSuffix = "" }) {
      visibleIds = ids;
      const selectedVisible = ids.reduce((total, id) => total + Number(selection.has(id)), 0);
      const all = ids.length > 0 && selectedVisible === ids.length;
      panel.meta.state = { count: selection.size, total: ids.length, all, summary, noun, selectSuffix };
      if (checkbox) {
        checkbox.checked = all;
        checkbox.indeterminate = selectedVisible > 0 && !all;
        checkbox.disabled = !ids.length;
      }
    },
  };
}

function installDataEditorStyle(document) {
  if (document.getElementById("cm-data-editor-style")) return;
  const style = document.createElement("style"); style.id = "cm-data-editor-style";
  style.textContent = `
@layer clinker-editor {
.cm-data-ui { color:var(--cm-foreground,#273444); font:13px/1.4 system-ui,sans-serif; }
.cm-data-ui [hidden] { display:none!important; }
.cm-data-ui form { margin:0; }
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
.cm-data-ui .cm-data-icon-button { display:inline-grid; place-items:center; width:var(--cm-icon-size,28px); min-width:var(--cm-icon-size,28px); min-height:var(--cm-icon-size,28px); padding:0; border:0; background:transparent; color:var(--cm-muted,#64748b); line-height:1; }
.cm-data-ui .cm-data-icon-button:hover:not(:disabled) { background:var(--cm-hover,#e3ecf8); color:var(--cm-accent,#1677ff); }
.cm-data-icon-button svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.cm-data-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; flex-shrink:0; }
.cm-data-error { color:var(--cm-danger,#b42318); font-size:12px; margin:6px 0; }
.cm-data-error:empty { display:none; }
.cm-data-panel { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; gap:8px; }
.cm-data-tools { flex-shrink:0; }
.cm-data-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.cm-data-selection-actions { display:contents; }
.cm-data-table { flex:1; min-height:120px; overflow:auto; overflow-anchor:none; }
.cm-data-head { box-sizing:border-box; height:32px; border-bottom:1px solid var(--cm-border,#dbe2eb); background:var(--cm-subtle,#f3f6fa); color:var(--cm-muted,#556274); font-size:11px; line-height:20px; font-weight:650; text-align:left; }
.cm-data-row { --cm-row-background:var(--cm-surface,#fff); box-sizing:border-box; height:${DATA_ROW_HEIGHT}px; border-bottom:1px solid var(--cm-border,#eee); background:var(--cm-row-background); font-size:13px; line-height:20px; }
.cm-data-row > :is(th,td) { height:${DATA_ROW_HEIGHT}px; box-sizing:border-box; background:var(--cm-row-background); border-bottom:1px solid var(--cm-border,#eee); }
.cm-data-row:is(:hover,:focus-within) { --cm-row-background:var(--cm-hover,#e3ecf8); }
.cm-data-row.is-selected { --cm-row-background:var(--cm-selection,#d6e6fc); }
.cm-data-row:is(:hover,:focus-within,.is-selected) { --cm-edit-affordance-opacity:1; }
.cm-data-cell { box-sizing:border-box; padding:0 8px; text-align:left; vertical-align:middle; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cm-data-cell--select { width:32px; min-width:32px; padding:0; text-align:center; }
span.cm-data-cell--select { display:flex; align-items:center; justify-content:center; }
.cm-data-cell--select input { display:block; margin:auto; }
.cm-data-cell > input[type=color] { display:block; }
.cm-data-ui .cm-data-cell .cm-data-field { padding-inline:0; margin-inline:-1px; }
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

const [markup$3, css$3] = await Promise.all([
  "<span part=\"label\"></span>\n<button type=\"button\" part=\"edit-button\">\n  <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\">\n    <path d=\"m4 20 4.1-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z\"></path>\n    <path d=\"m13.8 7.2 3 3\"></path>\n  </svg>\n</button>\n<input type=\"text\" part=\"input\" hidden>\n<select part=\"input\" hidden></select>\n",
  ":host {\n  position: relative;\n  display: flex;\n  align-items: center;\n  min-width: 0;\n  height: 28px;\n  box-sizing: border-box;\n  color: inherit;\n  font: inherit;\n}\n:host([hidden]), [hidden] { display: none !important; }\n:host([compact]) { flex: 0 0 auto; width: var(--cm-edit-width, max-content); max-width: 100%; }\nspan { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: text; }\nspan[data-placeholder] { color: var(--cm-muted, #687586); }\nbutton, input, select { box-sizing: border-box; font: inherit; color: inherit; }\nbutton {\n  position: absolute;\n  inset-inline-end: 4px;\n  top: 50%;\n  transform: translateY(-50%);\n  display: inline-grid;\n  place-items: center;\n  width: 20px;\n  height: 20px;\n  padding: 0;\n  border: 0;\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-row-background, var(--cm-surface, #fff));\n  color: var(--cm-muted, #64748b);\n  cursor: pointer;\n  opacity: var(--cm-edit-affordance-opacity, 0);\n  pointer-events: none;\n}\n:host(:hover) button, :host(:focus-within) button { opacity: 1; pointer-events: auto; }\nbutton:hover { background: var(--cm-hover, #e3ecf8); color: var(--cm-accent, #1677ff); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\nbutton:disabled { cursor: default; opacity: .45; }\nsvg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }\ninput, select {\n  width: 100%;\n  min-width: 0;\n  height: 28px;\n  margin-inline: -1px;\n  padding: 2px 7px;\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n  line-height: 20px;\n}\ninput::placeholder { color: var(--cm-muted, #687586); }\ninput:focus, select:focus { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n",
]);
const template$3 = createTemplate(markup$3);
const HTMLElementBase$3 = globalThis.HTMLElement || class {};

/** A field owns its draft; consumers accept or cancel value-commit events. */
class EditableField extends HTMLElementBase$3 {
  static observedAttributes = ["label", "placeholder", "type", "min", "max", "step", "required", "disabled"];
  #value = "";
  #revision = 0;
  #editing = false;
  #text;
  #button;
  #input;
  #select;
  #options = null;
  get #control() { return this.#options ? this.#select : this.#input; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$3;
    root.append(style, template$3(this.ownerDocument));
    this.#text = root.querySelector("span");
    this.#button = root.querySelector("button");
    this.#input = root.querySelector("input");
    this.#select = root.querySelector("select");
    this.#text.onclick = () => this.#beginEdit();
    this.#button.onclick = () => this.#beginEdit();
    for (const control of [this.#input, this.#select]) {
      control.onblur = () => { if (this.isConnected) this.#commit(); };
      control.oninput = () => control.setCustomValidity("");
      control.onkeydown = (event) => {
        if (event.isComposing) return;
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault(); event.stopPropagation();
          if (event.key === "Escape") this.#finish();
          else this.#commit();
          if (!this.#editing) this.#button.focus({ preventScroll: true });
        }
      };
    }
    this.#select.onchange = () => this.#commit();
    this.#render();
  }

  get value() { return this.#value; }
  set value(value) {
    const next = String(value ?? ""); this.#revision++;
    if (next === this.#value) return;
    this.#value = next;
    this.#render();
  }

  set options(entries) {
    this.#options = entries;
    if (entries) updateSelectOptions(this.#select, entries);
    this.#render();
  }

  attributeChangedCallback(name) {
    if (name === "disabled" && this.hasAttribute("disabled")) this.#finish();
    else this.#render();
  }
  disconnectedCallback() { this.#finish(); }

  cancelEdit() { this.#finish(); }
  setCustomValidity(message) { this.#control.setCustomValidity(message); }
  reportValidity() { return this.#control.reportValidity(); }

  #render() {
    const label = this.getAttribute("label") || "Value", placeholder = this.getAttribute("placeholder") || "";
    const display = this.#options?.find(([value]) => String(value) === this.#value)?.[1] ?? this.#value;
    this.#text.textContent = display || placeholder; this.#text.title = display || placeholder;
    this.#text.toggleAttribute("data-placeholder", !this.#value);
    this.#button.setAttribute("aria-label", `Edit ${label}`); this.#button.title = `Edit ${label}`;
    this.#select.setAttribute("aria-label", label);
    this.#input.setAttribute("aria-label", label); this.#input.placeholder = placeholder;
    const type = this.getAttribute("type") || "text";
    if (this.#input.type !== type) this.#input.type = type;
    for (const name of ["min", "max", "step"]) {
      if (this.hasAttribute(name)) this.#input.setAttribute(name, this.getAttribute(name));
      else this.#input.removeAttribute(name);
    }
    this.#select.required = this.hasAttribute("required");
    this.#input.required = this.hasAttribute("required");
    this.#select.disabled = this.#input.disabled = this.#button.disabled = this.hasAttribute("disabled");
    this.#text.hidden = this.#button.hidden = this.#editing;
    this.#input.hidden = !this.#editing || Boolean(this.#options);
    this.#select.hidden = !this.#editing || !this.#options;
    if (!this.#editing) this.#control.value = this.#value;
  }

  #beginEdit() {
    if (this.hasAttribute("disabled")) return;
    if (this.hasAttribute("compact")) this.style.setProperty("--cm-edit-width", `${this.getBoundingClientRect().width}px`);
    this.#editing = true;
    this.#control.value = this.#value; this.#control.setCustomValidity("");
    this.#render(); this.#control.focus({ preventScroll: true }); this.#control.select?.();
  }

  #finish() {
    this.#editing = false; this.#control.setCustomValidity("");
    this.style.removeProperty("--cm-edit-width"); this.#render();
  }

  #commit() {
    if (!this.#editing) return;
    if (!this.#control.reportValidity()) return;
    const value = this.#control.value, revision = this.#revision;
    if (value !== this.#value) {
      const event = new CustomEvent("value-commit", { detail: { value }, bubbles: true, composed: true, cancelable: true });
      if (!this.dispatchEvent(event)) { this.#control.reportValidity(); return; }
      if (revision === this.#revision) this.#value = value;
    }
    this.#finish();
  }
}

function defineEditableField() {
  if (!customElements.get("clinker-editable-field")) customElements.define("clinker-editable-field", EditableField);
}

const [markup$2, css$2] = await Promise.all([
  "<span part=\"summary\"></span>\n<div part=\"actions\" hidden>\n  <slot name=\"actions\"></slot>\n  <button type=\"button\" data-clear aria-label=\"Clear selection\">Clear</button>\n</div>\n<button type=\"button\" data-all hidden>Select all visible</button>\n",
  ":host {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 32px;\n  min-width: 0;\n  flex-shrink: 0;\n  color: var(--cm-muted, #687586);\n  font: 12px/1.4 system-ui, sans-serif;\n}\n:host([hidden]), [hidden] { display: none !important; }\nspan { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\nspan.is-selected { color: var(--cm-foreground, #273444); font-weight: 600; }\ndiv { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }\nslot { display: contents; }\nbutton {\n  flex-shrink: 0;\n  box-sizing: border-box;\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n  color: inherit;\n  font: inherit;\n  cursor: pointer;\n}\nbutton:hover:not(:disabled) { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #f4f8ff); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\nbutton:disabled { color: var(--cm-muted, #8993a1); opacity: .45; cursor: default; }\n",
]);
const template$2 = createTemplate(markup$2);
const HTMLElementBase$2 = globalThis.HTMLElement || class {};

class SelectionBar extends HTMLElementBase$2 {
  #summary;
  #actions;
  #all;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$2;
    root.append(style, template$2(this.ownerDocument));
    this.#summary = root.querySelector("span");
    this.#actions = root.querySelector("div");
    this.#all = root.querySelector("[data-all]");
    for (const [selector, name] of [["[data-clear]", "clear-selection"], ["[data-all]", "select-all"]]) {
      root.querySelector(selector).onclick = () => this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
    }
  }

  set state({ count, total, all, summary, noun, selectSuffix = "" }) {
    this.#summary.textContent = count ? `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"} selected` : summary;
    this.#summary.classList.toggle("is-selected", count > 0);
    this.#summary.title = summary;
    this.#actions.hidden = !count;
    this.#all.hidden = !total;
    this.#all.disabled = all;
    this.#all.textContent = `Select all ${total.toLocaleString()} visible${selectSuffix}`;
  }
}

function defineSelectionBar() {
  if (!customElements.get("clinker-selection-bar")) customElements.define("clinker-selection-bar", SelectionBar);
}

const [markup$1, css$1] = await Promise.all([
  "<details>\n  <summary part=\"trigger\"></summary>\n  <div part=\"panel\"><slot></slot></div>\n</details>\n",
  ":host { display: block; position: relative; color: var(--cm-foreground, #273444); font: inherit; }\n:host([hidden]) { display: none !important; }\nsummary {\n  display: block;\n  box-sizing: border-box;\n  min-height: 30px;\n  padding: 4px 8px;\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: 6px;\n  background: var(--cm-surface, #fff);\n  list-style: none;\n  white-space: nowrap;\n  cursor: pointer;\n}\nsummary::-webkit-details-marker { display: none; }\nsummary:hover, details[open] > summary { background: var(--cm-hover, #e3ecf8); border-color: var(--cm-accent, #78a9ed); }\nsummary:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\ndiv {\n  position: absolute;\n  right: 0;\n  top: calc(100% + 4px);\n  z-index: 10;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  width: max-content;\n  max-width: min(340px, 80vw);\n  max-height: 50vh;\n  overflow: auto;\n  padding: 10px;\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: 8px;\n  background: var(--cm-surface, #fff);\n  box-shadow: 0 4px 16px #0002;\n}\nslot { display: contents; }\n::slotted(button) { text-align: left; }\n::slotted(label) { display: flex; align-items: center; gap: 6px; }\n::slotted(input[type=number]) { width: 112px; }\n",
]);
const template$1 = createTemplate(markup$1);
const activeMenus = new WeakMap();
const HTMLElementBase$1 = globalThis.HTMLElement || class {};

class ActionMenu extends HTMLElementBase$1 {
  static observedAttributes = ["label", "open"];
  #details;
  #trigger;
  #outside = (event) => { if (!event.composedPath().includes(this)) this.open = false; };

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$1;
    root.append(style, template$1(this.ownerDocument));
    this.#details = root.querySelector("details");
    this.#trigger = root.querySelector("summary");
    this.#details.ontoggle = () => { this.open = this.#details.open; };
    this.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || !this.open) return;
      this.open = false; this.#trigger.focus(); event.preventDefault(); event.stopPropagation();
    });
  }

  get open() { return this.#details.open; }
  set open(value) {
    this.#details.open = Boolean(value);
    this.toggleAttribute("open", this.#details.open);
  }
  connectedCallback() { this.#syncOpen(); }
  disconnectedCallback() { this.open = false; this.#release(); }

  attributeChangedCallback(name) {
    if (name === "label") this.#trigger.textContent = this.getAttribute("label") || "Actions";
    else { this.#details.open = this.hasAttribute("open"); this.#syncOpen(); }
  }

  #syncOpen() {
    if (!this.open || !this.isConnected) { this.#release(); return; }
    const previous = activeMenus.get(this.ownerDocument);
    if (previous && previous !== this) previous.open = false;
    activeMenus.set(this.ownerDocument, this);
    this.ownerDocument.addEventListener("pointerdown", this.#outside, true);
  }

  #release() {
    this.ownerDocument.removeEventListener("pointerdown", this.#outside, true);
    if (activeMenus.get(this.ownerDocument) === this) activeMenus.delete(this.ownerDocument);
  }
}

function defineActionMenu() {
  if (!customElements.get("clinker-action-menu")) customElements.define("clinker-action-menu", ActionMenu);
}

const [markup, css] = await Promise.all([
  "<input type=\"search\" part=\"input\">\n<button type=\"button\" part=\"clear\" aria-label=\"Clear search\" title=\"Clear search\" hidden>×</button>\n",
  ":host { position: relative; display: flex; flex: 1; min-width: 140px; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\ninput, button { box-sizing: border-box; color: inherit; font: inherit; }\ninput {\n  width: 100%;\n  min-width: 0;\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\ninput[data-filled] { padding-inline-end: 30px; }\ninput::-webkit-search-cancel-button { appearance: none; }\ninput::placeholder { color: var(--cm-muted, #687586); }\ninput:focus { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\nbutton {\n  position: absolute;\n  inset-inline-end: 4px;\n  top: 50%;\n  transform: translateY(-50%);\n  display: grid;\n  place-items: center;\n  width: 22px;\n  height: 22px;\n  padding: 0;\n  border: 0;\n  border-radius: var(--cm-control-radius, 6px);\n  background: transparent;\n  color: var(--cm-muted, #687586);\n  cursor: pointer;\n}\nbutton:hover { background: var(--cm-hover, #e3ecf8); color: var(--cm-accent, #1677ff); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n",
]);
const template = createTemplate(markup);
const HTMLElementBase = globalThis.HTMLElement || class {};

class SearchField extends HTMLElementBase {
  static observedAttributes = ["label", "placeholder"];
  #input;
  #clear;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css;
    root.append(style, template(this.ownerDocument));
    this.#input = root.querySelector("input"); this.#clear = root.querySelector("button");
    this.#input.oninput = () => this.#sync();
    this.#clear.onclick = () => this.#clearValue();
    this.#input.onkeydown = (event) => {
      if (event.key !== "Escape" || !this.value || event.isComposing) return;
      event.preventDefault(); event.stopPropagation(); this.#clearValue();
    };
    this.#sync();
  }

  get value() { return this.#input.value; }
  set value(value) {
    const next = String(value ?? "");
    if (next !== this.value) this.#input.value = next;
    this.#sync();
  }
  focus(options) { this.#input.focus(options); }
  attributeChangedCallback() { this.#sync(); }

  #sync() {
    this.#input.setAttribute("aria-label", this.getAttribute("label") || "Filter records");
    this.#input.placeholder = this.getAttribute("placeholder") || "Search";
    this.#input.toggleAttribute("data-filled", Boolean(this.value));
    this.#clear.hidden = !this.value;
  }

  #clearValue() {
    this.value = ""; this.focus();
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }
}

function defineSearchField() {
  if (!customElements.get("clinker-search-field")) customElements.define("clinker-search-field", SearchField);
}

/** Selection shared by flat rows, tree leaves and annotation matrices. */
class RowSelection extends Set {
  #anchor = null;

  select(id, checked, { orderedIds = [], range = false, idsFor = (id) => [id] } = {}) {
    const start = orderedIds.indexOf(this.#anchor), end = orderedIds.indexOf(id);
    const ids = range && start >= 0 && end >= 0
      ? orderedIds.slice(Math.min(start, end), Math.max(start, end) + 1) : [id];
    const anchor = range && start >= 0 ? this.#anchor : id;
    this.setMany(ids.flatMap(idsFor), checked);
    this.#anchor = anchor;
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

const formTemplate = createTemplate(`<form>
  <label><span>Type</span><select aria-label="Type"><option value="heatmap">Heatmap</option><option value="bar">Bar chart</option><option value="groups">Group markers</option></select></label>
  <label><span>Title</span><input type="text" aria-label="Title"></label>
  <label><span>Values</span><select aria-label="Values"><option value="continuous">Numeric</option><option value="categorical">Categories</option></select></label>
  <p data-help></p>
  <label class="cm-annotation-data"><span>Data</span><textarea aria-label="Data" rows="8" spellcheck="false"></textarea></label>
  <p data-annotation-error role="alert"></p><button type="submit">Add panel</button>
</form>`);

/** Small data-entry form; panel validation and history remain in the patch API. */
function createAnnotationCreateControls({ document, getData, patch, onCreate, annotationApi }) {
  const { validateAnnotationPanels } = annotationApi;
  const node = formTemplate(document).firstElementChild;
  const type = node.querySelector('[aria-label="Type"]'), title = node.querySelector('[aria-label="Title"]');
  const scale = node.querySelector('[aria-label="Values"]'), help = node.querySelector("[data-help]");
  const data = node.querySelector("textarea"), error = node.querySelector("[data-annotation-error]");
  type.onchange = () => {
    const groups = type.value === "groups";
    scale.parentElement.hidden = groups;
    scale.disabled = type.value === "bar";
    if (scale.disabled) scale.value = "continuous";
    help.textContent = groups ? "Define groups as JSON. Each needs a uid, a label, and either clusterIds or a tree nodeUid. Colours are optional."
      : tableHelp;
    data.value = groups ? JSON.stringify({ groups: [{ uid: "group-1", label: "Example group",
      clusterIds: getData().clusters.slice(0, 2).map((cluster) => cluster.uid) }] }, null, 2) : tableTemplate;
  };
  const tableHelp = "Paste CSV or a tab-separated table. First column: cluster ID; remaining headings: data columns. Blank cells are missing. Bars use one data column. JSON {columns, values} is also accepted.";
  help.textContent = tableHelp;
  const tableTemplate = csvFormatRows([["cluster", "Value"], ...getData().clusters.map((cluster) => [cluster.uid, ""])]);
  data.value = tableTemplate;
  const run = createActionRunner((message) => { error.textContent = message; });
  node.onsubmit = (event) => {
    event.preventDefault(); error.textContent = "";
    run(() => {
      const raw = data.value.trim();
      let columns, values, groups;
      if (type.value === "groups") ({ groups } = JSON.parse(raw));
      else ({ columns, values } = parseAnnotationTable(raw, scale.value === "categorical"));
      const ids = new Set((getData()?.annotationPanels || []).map((panel) => panel.uid));
      let serial = 1;
      while (ids.has(`${type.value}-${serial}`)) serial++;
      const panel = { uid: `${type.value}-${serial}`, type: type.value,
        title: title.value.trim() || (type.value === "groups" ? "Groups" : type.value === "bar" ? "Bar chart" : "Heatmap"),
        ...(type.value === "groups" ? { groups } : { columns, values, scale: { type: scale.value } }) };
      validateAnnotationPanels([panel], getData().clusters, { tree: getData().tree });
      patch([{ type: "annotationPanels.create", panel }]);
      onCreate(panel.uid);
    });
  };
  return { node };
}

const editorTemplate = createTemplate(`<div class="cm-data-ui cm-annotation-data-editor" tabindex="-1">
  <div class="cm-data-toolbar">
    <select aria-label="Annotation panel"></select><button type="button" data-add>Add panel</button>
    <button type="button" data-replace>Replace data…</button><button type="button" data-show>Hide</button>
    <button type="button" data-left aria-label="Move left" title="Move left">←</button>
    <button type="button" data-right aria-label="Move right" title="Move right">→</button>
    <button type="button" data-remove aria-label="Remove panel">Remove</button>
    <clinker-search-field label="Filter records" placeholder="Find a cluster"></clinker-search-field>
  </div>
  <div class="cm-data-error" data-data-error role="alert"></div><div class="cm-annotation-data-body"></div>
</div>`);
const matrixTemplate = createTemplate(await "<template id=\"table\">\n<table><thead><tr>\n  <th class=\"cm-data-cell cm-data-cell--select cm-data-head\"><input type=\"checkbox\" aria-label=\"Select all filtered clusters\"></th>\n  <th class=\"cm-data-cell cm-data-head\">Cluster</th>\n</tr></thead><tbody></tbody></table>\n</template>\n\n<template id=\"column\">\n<th class=\"cm-data-cell cm-data-head\"><div class=\"cm-annotation-column\">\n  <clinker-editable-field required></clinker-editable-field><button type=\"button\" class=\"cm-data-icon-button\">×</button>\n</div></th>\n</template>\n\n<template id=\"add-column\">\n<th class=\"cm-data-cell cm-data-head cm-annotation-add-column\"><form>\n  <button type=\"button\" aria-label=\"Add column\">+</button>\n  <input type=\"text\" aria-label=\"New column name\" placeholder=\"Column name\" hidden><button type=\"submit\" hidden>Add</button>\n</form></th>\n</template>\n\n<template id=\"row\">\n<tr class=\"cm-data-row\">\n  <td class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></td><th class=\"cm-data-cell\" scope=\"row\"></th>\n</tr>\n</template>\n\n<template id=\"empty-cell\">\n<td class=\"cm-data-cell\"></td>\n</template>\n\n<template id=\"spacer\">\n<tr class=\"cm-annotation-spacer\" aria-hidden=\"true\"><td></td></tr>\n</template>\n\n<template id=\"cell\">\n  <td class=\"cm-data-cell\"><clinker-editable-field placeholder=\"—\" step=\"any\"></clinker-editable-field></td>\n</template>\n");
const numericInputTemplate = createTemplate('<input type="number" step="any" placeholder="Value">');
const categoryInputTemplate = createTemplate('<select></select>');
const batchTemplate = createTemplate(`<div class="cm-data-selection-actions">
  <select aria-label="Columns to edit"></select><span data-value></span>
  <button type="button" data-set>Set values</button><button type="button" data-clear>Clear values</button>
</div>`);
const categoriesTemplate = createTemplate('<details class="cm-annotation-categories"><summary></summary><div></div></details>');
const categoryTemplate = createTemplate(`<div class="cm-annotation-category">
  <input type="color"><input type="text"><button type="button">×</button>
</div>`);
const categoryRemovalTemplate = createTemplate(`<div class="cm-annotation-category-remove"><span></span>
  <select aria-label="Replacement category"></select><button type="button" data-remove>Remove</button><button type="button" data-cancel>Cancel</button>
</div>`);
const replacementTemplate = createTemplate(`<div class="cm-annotation-replacement" hidden>
  <textarea rows="5" spellcheck="false" aria-label="Replacement annotation data (CSV, TSV or JSON)"></textarea>
  <div class="cm-data-toolbar"><button type="button" data-replace>Replace data</button><button type="button" data-cancel>Cancel</button></div>
</div>`);
const groupTemplate = createTemplate(`<fieldset><legend></legend><div class="cm-data-toolbar cm-annotation-data-toolbar">
  <input type="text" aria-label="Group label"><input type="color" aria-label="Group colour">
  <button type="button">Remove group</button><select aria-label="Membership"></select>
</div><select data-members></select></fieldset>`);
const addGroupTemplate = createTemplate('<button type="button">Add group</button>');
const emptyTemplate = createTemplate('<p>No annotation panels. Add a panel to attach data to cluster rows.</p>');

/** Data editing is optional UI; every change goes through the chart's patch API. */
function createAnnotationDataControls({ document, getData, getClusters = () => getData().clusters, patch, annotationApi, embedded = false }) {
  defineEditableField(); defineSelectionBar(); defineActionMenu(); defineSearchField();
  installDataEditorStyle(document); installStyle$1(document);
  const { resolveAnnotationScale, ANNOTATION_PALETTES } = annotationApi;
  const node = editorTemplate(document).firstElementChild, toolbar = node.querySelector(".cm-data-toolbar");
  const body = node.querySelector(".cm-annotation-data-body"), status = node.querySelector("[data-data-error]");
  const panelSelect = toolbar.querySelector("select");
  const control = (name) => toolbar.querySelector(`[data-${name}]`);
  if (embedded) { toolbar.querySelector("clinker-search-field").remove(); toolbar.remove(); }
  let selected = null, applying = false, renderedPanel = null, renderedPanels = null, renderedClusters = null;
  let filter = "", deleting = null, creating = false, view = null, viewKey = null;
  const selection = new RowSelection();
  let selectionPanel = null, batchColumn = "0", batchValue = "";
  const getPanels = () => getData()?.annotationPanels || [];
  const current = () => getPanels().find((panel) => panel.uid === selected);
  const error = (message) => { status.textContent = message; };
  const run = createActionRunner(error);
  const commit = (operations, refresh = true, control) => {
    applying = true;
    try { return run(() => {
      patch(operations);
      if (refresh) {
        for (const menu of node.querySelectorAll("clinker-action-menu")) menu.open = false;
        render();
      } else { renderedPanel = current(); renderedPanels = getPanels(); }
    }, control); } finally { applying = false; }
  };
  const update = (changes, refresh = true, control) => commit([{ type: "annotationPanels.update", ids: [selected], changes }], refresh, control);
  const categoryScale = (panel, domain, colours) => ({ ...panel.scale, type: "categorical", domain,
    colours: colours.length ? colours : [...ANNOTATION_PALETTES.Qualitative] });
  const clearSelection = () => { selection.clear(); view?.syncSelection?.(); };
  panelSelect.onchange = () => { selected = panelSelect.value; deleting = null; creating = false; render(); };
  control("add").onclick = () => { creating = !creating; render(); };
  control("show").onclick = () => update({ show: current().show === false });
  control("remove").onclick = () => commit([{ type: "annotationPanels.delete", ids: [selected] }]);
  for (const [name, direction] of [["left", -1], ["right", 1]]) control(name).onclick = () => {
    const ids = getPanels().map((panel) => panel.uid), index = ids.indexOf(selected);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    commit([{ type: "annotationPanels.reorder", ids }]);
  };
  const search = !embedded && toolbar.querySelector("clinker-search-field");
  if (search) search.addEventListener("input", () => { filter = search.value; view?.filterRows?.(); });
  node.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && selection.size) { event.preventDefault(); clearSelection(); }
  });

  function renderCategories(parent) {
    const panel = current(), { domain, colour } = resolveAnnotationScale(panel), colours = domain.map(colour);
    parent.replaceChildren();
    domain.forEach((name, index) => {
      const row = categoryTemplate(document).firstElementChild;
      const swatch = row.querySelector('[type="color"]'), label = row.querySelector('[type="text"]'), remove = row.querySelector("button");
      swatch.value = colourHex(colour(name)); swatch.setAttribute("aria-label", `Colour for ${name}`);
      swatch.onchange = () => { const next = [...colours]; next[index] = swatch.value; update({ scale: categoryScale(current(), domain, next) }); };
      label.value = name; label.setAttribute("aria-label", `Rename category ${name}`);
      label.onchange = () => {
        if (!label.value.trim()) { error("Category names cannot be empty."); return; }
        update({ values: mapAnnotationValues(current().values, (item) => item === name ? label.value : item),
          scale: categoryScale(current(), domain.map((item) => item === name ? label.value : item), colours) });
      };
      remove.setAttribute("aria-label", `Remove category ${name}`); remove.onclick = () => { deleting = name; render(); };
      parent.append(row);
      if (deleting === name) {
        const box = categoryRemovalTemplate(document).firstElementChild, replacement = box.querySelector("select");
        box.querySelector("span").textContent = `Replace “${name}” with`;
        updateSelectOptions(replacement, [["missing", "Missing"], ...domain.flatMap((item, i) => item === name ? [] : [[String(i), item]])]);
        replacement.value = "missing";
        box.querySelector("[data-remove]").onclick = () => {
          const value = replacement.value === "missing" ? null : domain[Number(replacement.value)]; deleting = null;
          update({ values: mapAnnotationValues(current().values, (item) => item === name ? value : item),
            scale: categoryScale(current(), domain.filter((item) => item !== name), colours.filter((_, i) => i !== index)) });
        };
        box.querySelector("[data-cancel]").onclick = () => { deleting = null; render(); }; parent.append(box);
      }
    });
    const row = categoryTemplate(document).firstElementChild;
    const swatch = row.querySelector('[type="color"]'), name = row.querySelector('[type="text"]'), add = row.querySelector("button");
    const used = new Set(colours.map((value) => colourHex(value)));
    swatch.value = colourHex(ANNOTATION_PALETTES.Qualitative.find((value) => !used.has(colourHex(value))) ?? ANNOTATION_PALETTES.Qualitative[domain.length % ANNOTATION_PALETTES.Qualitative.length]);
    swatch.setAttribute("aria-label", "New category colour"); name.setAttribute("aria-label", "New category name"); name.placeholder = "New category";
    add.textContent = "+"; add.setAttribute("aria-label", "Add category"); add.onclick = () => {
      if (!name.value.trim()) { name.focus(); return; }
      update({ scale: categoryScale(current(), [...domain, name.value.trim()], [...colours, swatch.value]) });
    };
    parent.append(row);
  }

  function createMatrix(layout) {
    const panel = current(), categorical = panel.scale?.type === "categorical", resolved = resolveAnnotationScale(panel), extra = panel.type === "heatmap";
    const templates = matrixTemplate(document);
    const element = (name) => document.importNode(templates.getElementById(name).content, true).firstElementChild;
    const tableArea = layout.viewport; tableArea.classList.add("cm-annotation-matrix");
    const table = element("table"), head = table.querySelector("tr"), all = head.querySelector("input");
    tableArea.append(table);
    let clusters = [], mounted = [];
    const rowIds = new WeakMap();
    const syncSelection = () => {
      selectionControls.update({ ids: clusters.map((cluster) => cluster.uid), summary: `${clusters.length.toLocaleString()} visible clusters`, noun: "cluster" });
      for (const row of mounted) {
        const checked = selection.has(rowIds.get(row)); row.classList.toggle("is-selected", checked); row.setAttribute("aria-selected", String(checked));
        row.querySelector('[type="checkbox"]').checked = checked;
      }
    };
    const selectionControls = createSelectionControls(layout, { selection, checkbox: all, menuLabel: "Edit values…", onChange: syncSelection });
    const batch = batchTemplate(document).firstElementChild, columns = batch.querySelector("select");
    selectionControls.actions.append(batch);
    updateSelectOptions(columns, [["all", "All columns"], ...panel.columns.map((name, index) => [String(index), name])]); columns.value = batchColumn;
    columns.onchange = () => { batchColumn = columns.value; };
    const value = (categorical ? categoryInputTemplate : numericInputTemplate)(document).firstElementChild;
    value.setAttribute("aria-label", "Batch value"); value.placeholder = "Value";
    if (categorical) updateSelectOptions(value, [["", "Missing"], ...resolved.domain.map((name, index) => [String(index), name])]);
    value.value = batchValue; value.onchange = () => { batchValue = value.value; }; batch.querySelector("[data-value]").replaceWith(value);
    const updateRows = (values, refresh = true, control) => {
      const source = current();
      return commit([
        ...(categorical && !source.scale?.domain ? [{ type: "annotationPanels.update", ids: [selected],
          changes: { scale: categoryScale(source, resolved.domain, resolved.domain.map(resolved.colour)) } }] : []),
        { type: "annotationPanels.updateRows", uid: selected, values },
      ], refresh, control);
    };
    const applyValues = (clear) => {
      if (!clear && !value.checkValidity()) { value.reportValidity(); return; }
      const source = current(), values = {};
      const next = clear || value.value === "" ? null : categorical ? resolved.domain[Number(value.value)] : Number(value.value);
      for (const uid of selection) {
        const row = [...(source.values[uid] || source.columns.map(() => null))];
        source.columns.forEach((_, index) => { if (columns.value === "all" || index === Number(columns.value)) row[index] = next; }); values[uid] = row;
      }
      updateRows(values);
    };
    batch.querySelector("[data-set]").onclick = () => applyValues(false); batch.querySelector("[data-clear]").onclick = () => applyValues(true);
    panel.columns.forEach((column, index) => {
      const heading = element("column"), field = heading.querySelector("clinker-editable-field"), remove = heading.querySelector("button");
      field.value = column; field.setAttribute("label", `Column ${index + 1} name`);
      field.addEventListener("value-commit", (event) => {
        const columns = [...current().columns]; columns[index] = event.detail.value.trim();
        if (update({ columns }, true, field) === false) event.preventDefault();
      });
      if (extra) {
        remove.setAttribute("aria-label", `Remove column ${column}`); remove.disabled = panel.columns.length === 1;
        remove.onclick = () => update({ columns: current().columns.filter((_, i) => i !== index),
          values: Object.fromEntries(Object.entries(current().values).map(([uid, values]) => [uid, values.filter((_, i) => i !== index)])) });
      } else remove.remove();
      head.append(heading);
    });
    if (extra) {
      const heading = element("add-column"), form = heading.querySelector("form");
      const [add, save] = form.querySelectorAll("button"), name = form.querySelector("input");
      add.onclick = () => { add.hidden = true; name.hidden = save.hidden = false; name.focus(); };
      form.onsubmit = (event) => {
        event.preventDefault(); if (!name.value.trim()) return;
        update({ columns: [...current().columns, name.value.trim()], values: Object.fromEntries(Object.entries(current().values).map(([uid, values]) => [uid, [...values, null]])) });
      };
      name.onkeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); name.hidden = save.hidden = true; add.hidden = false; add.focus(); } };
      head.append(heading);
    }
    const toggleRow = (cluster, checked, shift) => {
      selection.select(cluster.uid, checked, { range: shift, orderedIds: clusters.map((cluster) => cluster.uid) }); syncSelection();
    };
    const createRow = (cluster) => {
      const row = element("row"), check = row.querySelector("input"), name = row.querySelector("th");
      rowIds.set(row, cluster.uid); check.onclick = (event) => toggleRow(cluster, check.checked, event.shiftKey);
      name.onclick = (event) => toggleRow(cluster, !selection.has(cluster.uid), event.shiftKey);
      panel.columns.forEach((column, index) => {
        const cell = element("cell"), field = cell.firstElementChild;
        if (categorical) field.options = [["", "Missing"], ...resolved.domain.map((name, i) => [String(i), name])];
        else field.setAttribute("type", "number");
        field.addEventListener("value-commit", (event) => {
          const source = current(), values = [...(source.values[cluster.uid] ?? source.columns.map(() => null))];
          const value = event.detail.value;
          values[index] = value === "" ? null : categorical ? resolved.domain[Number(value)] : Number(value);
          if (updateRows({ [cluster.uid]: values }, false, field) === false) event.preventDefault();
        });
        row.append(cell);
      });
      if (extra) row.append(element("empty-cell"));
      return updateRow(row, cluster);
    };
    const updateRow = (row, cluster) => {
      const name = row.querySelector("th"), label = cluster.name || cluster.uid;
      name.textContent = label; name.title = cluster.uid; row.querySelector("input").setAttribute("aria-label", `Select ${label}`);
      [...row.querySelectorAll("clinker-editable-field")].forEach((field, index) => {
        const value = current().values[cluster.uid]?.[index] ?? null;
        field.setAttribute("label", `${label}: ${panel.columns[index]}`);
        field.value = categorical ? value === null ? "" : String(resolved.domain.indexOf(value)) : value;
      });
      return row;
    };
    const cancelFields = (root) => { for (const field of root.querySelectorAll("clinker-editable-field")) field.cancelEdit(); };
    const list = createVirtualRows({ viewport: tableArea, container: table.querySelector("tbody"), key: (cluster) => cluster.uid, createRow, updateRow, disposeRow: cancelFields,
      createSpacer: () => { const row = element("spacer"); row.firstElementChild.colSpan = panel.columns.length + 2 + Number(extra); return row; },
      headerHeight: () => head.offsetHeight, onRender: (nodes) => { mounted = nodes; table.setAttribute("aria-rowcount", clusters.length + 1); syncSelection(); } });
    const filterRows = () => {
      const needle = filter.trim().toLowerCase(); clusters = getClusters().filter((cluster) => `${cluster.name} ${cluster.uid}`.toLowerCase().includes(needle)); list.setRows(clusters);
    };
    return { update: filterRows, filterRows() { tableArea.scrollTop = 0; filterRows(); }, syncSelection, destroy() { cancelFields(table); list.destroy(); } };
  }

  function createReplacement(layout) {
    const box = replacementTemplate(document).firstElementChild, data = box.querySelector("textarea"); layout.tools.append(box);
    box.querySelector("[data-replace]").onclick = () => { try {
      const source = current(), categorical = source.scale?.type === "categorical", changes = parseAnnotationTable(data.value, categorical);
      if (categorical) {
        const scale = resolveAnnotationScale(source), domain = new Set(scale.domain);
        for (const row of Object.values(changes.values)) for (const value of row) if (value !== null) domain.add(value);
        const categories = [...domain]; changes.scale = categoryScale(source, categories, categories.map((value, i) =>
          scale.domain.includes(value) ? scale.colour(value) : ANNOTATION_PALETTES.Qualitative[i % ANNOTATION_PALETTES.Qualitative.length]));
      }
      if (update(changes)) { box.hidden = true; layout.sync(); }
    } catch (exception) { error(exception.message); } };
    box.querySelector("[data-cancel]").onclick = () => { box.hidden = true; layout.sync(); };
    return () => {
      box.hidden = !box.hidden; layout.sync();
      if (!box.hidden) { data.value = annotationTableText(current(), getClusters()); data.focus(); }
    };
  }

  function createGroups(parent) {
    const groups = new Map(), add = addGroupTemplate(document).firstElementChild; parent.append(add);
    const editGroup = (uid, changes) => update({ groups: current().groups.map((group) => group.uid === uid ? { ...group, ...changes } : group) });
    add.onclick = () => {
      if (!getClusters().length) return;
      const panel = current(); let serial = 1; while (panel.groups.some((group) => group.uid === `group-${serial}`)) serial++;
      update({ groups: [...panel.groups, { uid: `group-${serial}`, label: `Group ${serial}`, clusterIds: [getClusters()[0].uid] }] });
    };
    return { update() {
      const panel = current(), tree = getData().tree;
      for (const [uid, box] of groups) if (!panel.groups.some((group) => group.uid === uid)) { box.remove(); groups.delete(uid); }
      for (const group of panel.groups) {
        let box = groups.get(group.uid);
        if (!box) { box = groupTemplate(document).firstElementChild; groups.set(group.uid, box); }
        parent.insertBefore(box, add);
        const label = box.querySelector('[type="text"]'), colour = box.querySelector('[type="color"]');
        box.querySelector("legend").textContent = group.label || group.uid; updateFieldValue(label, group.label ?? group.uid);
        colour.value = colourHex(group.colour ?? panel.colour ?? "#267c9e");
        label.onchange = () => editGroup(group.uid, { label: label.value }); colour.onchange = () => editGroup(group.uid, { colour: colour.value });
        const remove = box.querySelector("button"), mode = box.querySelector("select"), members = box.querySelector("[data-members]");
        remove.disabled = panel.groups.length === 1; remove.onclick = () => update({ groups: current().groups.filter((item) => item.uid !== group.uid) });
        updateSelectOptions(mode, [["clusters", "Selected clusters"], ...(tree ? [["tree", "Tree clade"]] : [])]); mode.value = group.nodeUid === undefined ? "clusters" : "tree";
        mode.onchange = () => {
          const { nodeUid, clusterIds, ...style } = group;
          if (mode.value !== "tree" && !getClusters().length) return;
          editGroup(group.uid, mode.value === "tree" ? { ...style, clusterIds: undefined, nodeUid: tree.root } : { ...style, nodeUid: undefined, clusterIds: [getClusters()[0].uid] });
        };
        members.multiple = group.nodeUid === undefined; members.size = members.multiple ? Math.min(5, getClusters().length) : 0;
        members.setAttribute("aria-label", members.multiple ? `Clusters in ${group.label || group.uid}` : "Tree node");
        updateSelectOptions(members, members.multiple ? getClusters().map((cluster) => [cluster.uid, `${cluster.name || cluster.uid} (${cluster.uid})`]) : tree.nodes.map((node) => [node.uid, node.label || node.uid]));
        for (const option of members.options) option.selected = members.multiple ? group.clusterIds.some((uid) => String(uid) === option.value) : String(group.nodeUid) === option.value;
        members.onchange = () => editGroup(group.uid, members.multiple ? { clusterIds: [...members.selectedOptions].map((option) => option.value) } : { nodeUid: members.value });
      }
    } };
  }

  function render() {
    const panels = getPanels();
    if (!panels.some((panel) => panel.uid === selected)) selected = panels[0]?.uid ?? null;
    const panel = current(); renderedPanel = panel; renderedPanels = panels; renderedClusters = getClusters();
    updateSelectOptions(panelSelect, panels.map((panel) => [panel.uid, panel.title || panel.uid])); panelSelect.value = selected;
    panelSelect.hidden = !panels.length; control("add").textContent = creating ? "Cancel" : "Add panel";
    for (const name of ["replace", "show", "left", "right", "remove"]) control(name).hidden = !panel || creating || name === "replace" && panel.type === "groups";
    if (search) { search.hidden = !panel || creating || panel.type === "groups"; search.value = filter; }
    if (panel) {
      control("show").textContent = panel.show === false ? "Show" : "Hide";
      control("left").disabled = panels.indexOf(panel) === 0; control("right").disabled = panels.indexOf(panel) === panels.length - 1;
    }
    if (selectionPanel !== panel?.uid) { selection.clear(); selectionPanel = panel?.uid; batchColumn = "0"; batchValue = ""; deleting = null; }
    selection.prune(new Set(getClusters().map((cluster) => cluster.uid)));
    if (batchColumn !== "all" && Number(batchColumn) >= (panel?.columns?.length || 0)) batchColumn = "0";
    const categorical = panel?.scale?.type === "categorical";
    if (categorical && batchValue !== "" && !resolveAnnotationScale(panel).domain[Number(batchValue)]) batchValue = "";
    const key = creating ? "create" : panel ? JSON.stringify([panel.uid, panel.type, panel.columns, categorical && resolveAnnotationScale(panel).domain]) : "empty";
    if (key !== viewKey) {
      const scroll = viewKey && panel?.uid === view?.uid ? view.layout.viewport.scrollTop : 0;
      const categoriesOpen = panel?.uid === view?.uid && view?.categories?.open;
      view?.destroy?.(); body.replaceChildren(); view = null; viewKey = key;
      if (creating) body.append(createAnnotationCreateControls({ document, getData, patch, annotationApi,
        onCreate: (uid) => { selected = uid; creating = false; render(); } }).node);
      else if (!panel) body.append(emptyTemplate(document));
      else {
        const layout = createDataPanel(document, { label: "Editable annotation data" }); body.append(layout.node);
        if (panel.type === "groups") { layout.meta.hidden = true; view = createGroups(layout.viewport); }
        else {
          control("replace").onclick = createReplacement(layout);
          view = createMatrix(layout);
          if (categorical) {
            view.categories = categoriesTemplate(document).firstElementChild; layout.tools.prepend(view.categories);
            view.categories.open = Boolean(categoriesOpen);
          }
        }
        Object.assign(view, { uid: panel.uid, layout }); view.update(); layout.viewport.scrollTop = scroll;
      }
    } else view?.update();
    if (view?.categories) {
      const key = JSON.stringify([panel.scale, deleting]);
      if (key !== view.categoryKey) {
        view.categories.querySelector("summary").textContent = `Categories (${resolveAnnotationScale(panel).domain.length})`;
        renderCategories(view.categories.querySelector("div")); view.categoryKey = key;
      }
      if (deleting !== null) view.categories.open = true;
    }
    view?.layout.sync();
  }
  render();
  return { node, toolbar, select(uid) { selected = uid; creating = false; deleting = null; render(); }, clearSelection,
    get filter() { return filter; }, setFilter(value) { filter = value; view?.filterRows?.(); },
    invalidate({ replace = false } = {}) {
      renderedPanel = renderedPanels = renderedClusters = null;
      if (replace) { view?.destroy?.(); view = null; viewKey = null; selection.clear(); selected = selectionPanel = null; }
    },
    destroy() { view?.destroy?.(); toolbar.remove(); },
    update() { if (!applying && (current() !== renderedPanel || getPanels() !== renderedPanels || getClusters() !== renderedClusters)) render(); } };
}
function installStyle$1(document) {
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
.cm-annotation-category { display:flex; align-items:center; gap:5px; }
.cm-annotation-category input[type=text] { min-width:0; width:140px; }
.cm-annotation-category-remove { display:flex; flex-wrap:wrap; align-items:center; gap:5px; padding:6px; border:1px solid var(--cm-border,#cbd3de); border-radius:4px; }
.cm-annotation-matrix { position:relative; }
.cm-annotation-data-editor .cm-data-actions input[type=number] { width:112px; }
.cm-annotation-matrix table { border-collapse:separate; border-spacing:0; font:inherit; color:inherit; width:max-content; min-width:100%; }

.cm-annotation-matrix thead th { position:sticky; top:0; z-index:2; background:var(--cm-subtle,#f3f6fa); }
.cm-annotation-matrix tr > :first-child { position:sticky; left:0; z-index:1; width:32px; min-width:32px; background:var(--cm-row-background,var(--cm-subtle,#f3f6fa)); }
.cm-annotation-matrix tr > :nth-child(2) { position:sticky; left:32px; z-index:1; }
.cm-annotation-matrix tbody th { background:var(--cm-row-background); }
.cm-annotation-matrix thead th:nth-child(-n+2) { z-index:3; background:var(--cm-subtle,#f3f6fa); }
.cm-annotation-matrix tbody th { cursor:pointer; min-width:200px; max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:400; }
.cm-annotation-matrix :is(input:not([type=checkbox]),clinker-editable-field) { width:140px; }
.cm-annotation-column { display:flex; align-items:center; }
.cm-annotation-column button { --cm-icon-size:24px; visibility:hidden; }
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

/** Quick styling stays in the plot; data and membership editing live in the data editor. */
function createAnnotationControls({ getData, patch, document, panelUid, annotationApi, onEditData }) {
  const { ANNOTATION_DEFAULTS: defaults, ANNOTATION_PALETTES: palettes, resolveAnnotationScale } = annotationApi;
  const node = document.createElement("fieldset"); node.className = "cm-annotation-controls";
  let applying = false;
  const run = createActionRunner((message) => { node.querySelector("[data-annotation-error]").textContent = message; });
  const current = () => (getData()?.annotationPanels || []).find((panel) => panel.uid === panelUid);
  const ui = createControls(document), { el, row } = ui;
  const input = (parent, label, field, value, type = "text", options = {}) => {
    const control = ui.input(row(parent, label), label, value, type, undefined, options);
    control.dataset.annotationField = field; return control;
  };
  const select = (parent, label, field, value, entries) => {
    const control = ui.select(row(parent, label), label, value, entries);
    control.dataset.annotationField = field; return control;
  };
  const paletteSelect = (parent, resolved) => {
    const name = Object.entries(palettes).find(([, colours]) => colours.length === resolved.colours.length &&
      colours.every((value, i) => colourHex(value) === colourHex(resolved.colours[i])))?.[0] || "custom";
    select(parent, "Palette", "palette", name, [["custom", "Custom"], ...Object.keys(palettes).map((key) => [key, key])]);
  };
  const gradient = () => {
    const preview = node.querySelector("[data-colour-preview]");
    if (preview) preview.style.background = `linear-gradient(to right, ${resolveAnnotationScale(current()).colours.join(",")})`;
  };
  function render() {
    const open = node.querySelector("details")?.open || false, panel = current();
    node.replaceChildren(); if (!panel) return;
    const groups = panel.type === "groups", bar = panel.type === "bar";
    input(node, "Title", "title", panel.title ?? panel.uid);
    const resolved = groups ? null : resolveAnnotationScale(panel);
    if (groups) panel.groups.forEach((group, i) => input(node, group.label || group.uid, `group:${i}:colour`,
      group.colour ?? panel.colour ?? defaults.colour, "color"));
    else if (bar) input(node, "Colour", "colour", panel.colour ?? defaults.colour, "color");
    else if (resolved.type === "categorical") resolved.domain.forEach((name, i) => input(node, name, `colour:${i}`, resolved.colour(name), "color"));
    else {
      paletteSelect(node, resolved);
      const preview = el("div", undefined, node); preview.dataset.colourPreview = ""; preview.className = "cm-annotation-gradient";
      preview.setAttribute("role", "img"); preview.setAttribute("aria-label", "Colour gradient"); gradient();
    }
    if (resolved?.type === "continuous") {
      const range = el("div", undefined, node); range.className = "cm-annotation-range";
      select(range, "Range", "autoDomain", panel.scale?.domain ? "custom" : "auto", [["auto", "Auto"], ["custom", "Custom"]]);
      if (panel.scale?.domain) {
        input(range, "Minimum", "domainMin", resolved.domain[0], "number");
        input(range, "Maximum", "domainMax", resolved.domain[1], "number");
      }
    }
    if (!groups) input(node, bar ? "Show axis" : "Show legend", "showKey", panel.showKey !== false, "checkbox");
    const data = el("button", "Edit data…", node); data.type = "button"; data.onclick = () => onEditData?.();
    const advanced = el("details", undefined, node); el("summary", "Advanced", advanced); advanced.open = open;
    const sizes = groups ? [["markerWidth", "Bar thickness", 3], ["laneGap", "Lane gap", 12]]
      : bar ? [["width", "Panel width", defaults.width], ["cellHeight", "Bar height", defaults.cellHeight]]
        : [["cellWidth", "Cell width", defaults.cellWidth], ["cellHeight", "Cell height", defaults.cellHeight], ["cellGap", "Cell gap", defaults.cellGap]];
    for (const [field, label, fallback] of [...sizes, ["gap", "Panel gap", defaults.gap], ["fontSize", "Font size", defaults.fontSize]]) {
      input(advanced, label, field, panel[field] ?? fallback, "number", { min: ["gap", "cellGap"].includes(field) ? "0" : "0.1" });
    }
    if (!groups) {
      input(advanced, "Border width", "cellBorderWidth", panel.cellBorderWidth ?? defaults.cellBorderWidth, "number", { min: "0" });
      input(advanced, "Border colour", "cellBorderColour", panel.cellBorderColour ?? defaults.cellBorderColour, "color");
      input(advanced, "Missing colour", "missingColour", panel.missingColour ?? defaults.missingColour, "color");
      if (!bar && resolved.type === "continuous") resolved.colours.forEach((value, i) => input(advanced, `Colour stop ${i + 1}`, `colour:${i}`, value, "color"));
      else if (!bar) paletteSelect(advanced, resolved);
      input(advanced, "Show column labels", "showColumnLabels", panel.showColumnLabels !== false, "checkbox");
      input(advanced, "Heading angle", "headingRotation", panel.headingRotation ?? (bar ? 0 : defaults.headingRotation), "number", { min: "-90", max: "0" });
    }
    const error = el("div", undefined, node); error.dataset.annotationError = ""; error.setAttribute("role", "alert");
  }
  const edit = (event) => {
    const control = event.target, field = control.dataset.annotationField;
    if (!field || (control.type === "text") !== (event.type === "change")) return;
    control.setCustomValidity("");
    if (!control.checkValidity() || control.type === "number" && control.value === "") return;
    const panel = current(), resolved = panel.type === "groups" ? null : resolveAnnotationScale(panel);
    const value = control.type === "checkbox" ? control.checked : control.type === "number" ? control.valueAsNumber : control.value;
    let changes, refresh = false;
    const scale = { ...panel.scale };
    if (field.startsWith("group:")) {
      const index = Number(field.split(":")[1]);
      changes = { groups: panel.groups.map((group, i) => i === index ? { ...group, colour: value } : group) };
    } else if (field === "autoDomain") {
      if (value === "auto") delete scale.domain; else scale.domain = resolved.domain;
      changes = { scale }; refresh = true;
    } else if (field === "domainMin" || field === "domainMax") {
      const domain = [...resolved.domain]; domain[field === "domainMin" ? 0 : 1] = value;
      changes = { scale: { ...scale, domain } };
    } else if (field === "palette") {
      if (value === "custom") return;
      changes = { scale: { ...scale, colours: [...palettes[value]] } }; refresh = true;
    } else if (field.startsWith("colour:")) {
      const colours = resolved.type === "categorical" ? resolved.domain.map(resolved.colour) : [...resolved.colours];
      colours[Number(field.split(":")[1])] = value; changes = { scale: { ...scale, colours } };
    } else changes = { [field]: value };
    applying = true;
    try { run(() => {
      patch([{ type: "annotationPanels.update", ids: [panel.uid], changes }]);
      node.querySelector("[data-annotation-error]").textContent = "";
      node.querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
      if (refresh) render();
      else { gradient(); if (field.startsWith("colour:")) { const palette = node.querySelector('[data-annotation-field="palette"]'); if (palette) palette.value = "custom"; } }
    }, control); } finally { applying = false; }
  };
  node.addEventListener("input", edit); node.addEventListener("change", edit);
  render();
  return { node, update() { if (!applying) render(); } };
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
.cm-annotation-ui { position:fixed; z-index:4; box-sizing:border-box; --cm-control-height:24px; --cm-control-padding:2px 5px; --cm-control-radius:4px; color:var(--cm-foreground,#273444); font-size:12px; line-height:1.3; }
.cm-annotation-ui[hidden] { display:none!important; }
.cm-annotation-frame { pointer-events:none; border:1px solid #78a9ed; border-radius:4px; background:rgba(22,119,255,.025); }
.cm-annotation-frame button { position:absolute; right:0; top:-28px; pointer-events:auto; }
.cm-annotation-frame:not(.cm-annotation-add)::before { content:""; position:absolute; top:-28px; right:0; width:48px; height:28px; pointer-events:auto; }
.cm-annotation-add { border-style:dashed; background:transparent; }
.cm-annotation-add button { top:50%; right:50%; transform:translate(50%,-50%); font-size:22px; width:32px; height:32px; }
.cm-annotation-actions { display:flex; gap:5px; border-top:1px solid var(--cm-border,#e5e9ef); margin-top:8px; padding-top:8px; }
.cm-annotation-menu p { font-size:11px; color:var(--cm-muted,#607086); }
.cm-annotation-menu .cm-annotation-data { display:block; }
.cm-annotation-menu textarea { display:block; width:100%; margin-top:4px; resize:vertical; border:1px solid var(--cm-border,#cbd3de); border-radius:4px; padding:5px; }
.cm-annotation-menu { width:280px; max-width:calc(100vw - 16px); max-height:calc(100vh - 16px); overflow:auto; padding:8px; border:1px solid var(--cm-border,#cbd3de); border-radius:4px; background:var(--cm-surface,#fff); box-shadow:0 2px 8px rgba(0,0,0,.2); }
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
.cm-annotation-menu details:not(.cm-annotation-data-editor *) { border-top:1px solid var(--cm-border,#e5e9ef); margin-top:8px; }
.cm-annotation-menu summary:not(.cm-annotation-data-editor *) { color:var(--cm-muted,#4f6d95); font-weight:600; padding-top:6px; cursor:pointer; }
.cm-annotation-menu [data-annotation-error] { color:var(--cm-danger,#b42318); }
.cm-annotation-gradient { height:12px; border:1px solid var(--cm-border,#cbd3de); border-radius:3px; margin:6px 0; }
.cm-annotation-range { display:flex; gap:6px; align-items:center; }
.cm-annotation-range label:first-child { flex:1; }
.cm-annotation-range label:first-child select { width:78px; }
.cm-annotation-range label:not(:first-child) > span { display:none; }
.cm-annotation-range input[type=number] { width:60px; }
.cm-annotation-menu--data { --cm-control-height:30px; --cm-control-padding:4px 8px; --cm-control-radius:6px; width:760px; display:flex; flex-direction:column; height:min(600px,calc(100vh - 16px)); box-sizing:border-box; }
.cm-annotation-menu--data > .cm-annotation-data-editor { flex:1; min-height:0; }
.cm-annotation-menu--data .cm-annotation-data-editor label { margin:0; }
.cm-annotation-menu--data .cm-annotation-data-editor select { width:auto; max-width:100%; }
.cm-annotation-menu--data .cm-annotation-matrix :is(input,select) { width:140px; max-width:none; }
.cm-annotation-hidden { border:1px solid var(--cm-border,#cbd3de); border-radius:4px; padding:3px 6px; background:var(--cm-surface,#fff); cursor:pointer; }
.cm-annotation-menu .cm-annotation-restore { display:block; width:100%; margin:5px 0; text-align:left; }
`;
  document.head.append(style);
}

/** Renderer-independent editing affordances, kept outside the exported scene. */
function createAnnotationOverlay({ container, getData, patch, annotationApi, editData }) {
  const getPanels = () => getData()?.annotationPanels || [];
  const { annotationPanelsForFrame, annotationPanelBounds } = annotationApi;
  const document = container.ownerDocument, window = document.defaultView;
  installDataEditorStyle(document);
  installStyle(document);
  const element = (tag, className, parent = container) => {
    const node = document.createElement(tag); node.className = className; parent.append(node); return node;
  };
  const frame = element("div", "cm-data-ui cm-annotation-ui cm-annotation-frame"); frame.hidden = true;
  const edit = element("button", "", frame); edit.type = "button"; edit.textContent = "Edit";
  edit.setAttribute("aria-haspopup", "dialog"); edit.setAttribute("aria-expanded", "false");
  const addFrame = element("div", "cm-data-ui cm-annotation-ui cm-annotation-frame cm-annotation-add"); addFrame.hidden = true;
  const add = element("button", "", addFrame); add.type = "button"; add.textContent = "+";
  add.setAttribute("aria-label", "Add annotation panel"); add.setAttribute("aria-haspopup", "dialog");
  const hiddenButton = element("button", "cm-data-ui cm-annotation-ui cm-annotation-hidden");
  hiddenButton.type = "button"; hiddenButton.hidden = true; hiddenButton.setAttribute("aria-haspopup", "dialog");
  const menu = element("div", "cm-data-ui cm-annotation-ui cm-annotation-menu"); menu.hidden = true;
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
    menuState?.controls?.destroy?.();
    menuState = null; hovered = null; menu.hidden = true; frame.hidden = true; addFrame.hidden = true;
    menu.replaceChildren();
    for (const button of [edit, hiddenButton, add]) button.setAttribute("aria-expanded", "false");
    if (returnFocus && opener?.isConnected && !opener.hidden && !opener.closest("[hidden]")) opener.focus({ preventScroll: true });
    else if (returnFocus) surfaces[0]?.focus?.({ preventScroll: true });
  };
  const beginMenu = (kind, title, button, uid = null) => {
    // Keep the menu anchored when creating a panel moves its opener offscreen.
    const anchor = button.closest("[hidden]") ? menuState?.anchor : button.getBoundingClientRect();
    menuState?.controls?.destroy?.();
    menuState = { kind, uid, anchor, opener: button };
    hovered = null; frame.hidden = true; addFrame.hidden = true;
    for (const opener of [edit, hiddenButton, add]) opener.setAttribute("aria-expanded", String(opener === button));
    menu.replaceChildren();
    menu.classList.remove("cm-annotation-menu--data");
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
    state.controls = createAnnotationControls({ getData, patch, document, panelUid: uid, annotationApi,
      onEditData: () => {
        if (editData?.(uid)) { close(); return; }
        const dataState = beginMenu("data", "Annotation data", edit, uid);
        menu.classList.add("cm-annotation-menu--data");
        dataState.controls = createAnnotationDataControls({ document, getData, patch, annotationApi });
        dataState.controls.select(uid); menu.append(dataState.controls.node); positionMenu();
      } });
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
    state.actions = { left: action("←", () => movePanel(-1)), right: action("→", () => movePanel(1)),
      visibility: action(panel.show === false ? "Show" : "Hide", () => patch([{ type: "annotationPanels.update", ids: [uid],
        changes: { show: getPanels().find((item) => item.uid === uid).show === false } }])) };
    state.actions.left.setAttribute("aria-label", "Move panel left"); state.actions.left.title = "Move panel left";
    state.actions.right.setAttribute("aria-label", "Move panel right"); state.actions.right.title = "Move panel right";
    action("Remove", () => patch([{ type: "annotationPanels.delete", ids: [uid] }]));
    refresh();
    positionMenu();
    menu.querySelector("input, select")?.focus({ preventScroll: true });
  };
  edit.onclick = () => { if (hovered) openPanel(hovered, edit); };
  add.onclick = () => {
    beginMenu("add", "Add annotation panel", add);
    const form = createAnnotationCreateControls({ document, getData, patch, annotationApi,
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
      menuState.actions.visibility.textContent = panels[index].show === false ? "Show" : "Hide";
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
      menuState?.controls?.destroy?.();
      tooltip?.dispose();
      detach(); window.removeEventListener("click", outside); window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", refresh); window.removeEventListener("scroll", refresh, true);
      frame.remove(); addFrame.remove(); menu.remove(); hiddenButton.remove();
    },
  };
}

export { createAnnotationOverlay };
