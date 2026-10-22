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
        const focused = container.getRootNode().activeElement || document.activeElement;
        if (node.contains(focused)) { focused.blur(); viewport.focus({ preventScroll: true }); }
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
    <clinker-data-table class="cm-data-table" role="region"></clinker-data-table>
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

const DATA_EDITOR_CSS = `
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
.cm-data-head { box-sizing:border-box; height:32px; border-bottom:1px solid var(--cm-border,#dbe2eb); background:var(--cm-subtle,#f3f6fa); color:var(--cm-muted,#556274); font-size:11px; line-height:20px; font-weight:650; text-align:left; }
.cm-data-row { --cm-row-background:var(--cm-surface,#fff); box-sizing:border-box; height:${DATA_ROW_HEIGHT}px; border-bottom:1px solid var(--cm-border,#eee); background:var(--cm-row-background); font-size:13px; line-height:20px; }
.cm-data-row > :is(th,td) { height:${DATA_ROW_HEIGHT}px; box-sizing:border-box; background:var(--cm-row-background); border-bottom:1px solid var(--cm-border,#eee); }
.cm-data-row:hover { --cm-row-background:var(--cm-hover,#e3ecf8); }
.cm-data-row.is-selected { --cm-row-background:var(--cm-selection,#d6e6fc); }
.cm-data-row:is(:hover,.is-selected) { --cm-edit-icon-width:20px; }
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

function installDataEditorStyle(document) {
  if (document.getElementById("cm-data-editor-style")) return;
  const style = document.createElement("style"); style.id = "cm-data-editor-style";
  style.textContent = DATA_EDITOR_CSS;
  document.head.append(style);
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

const [markup$f, css$f] = await Promise.all([
  "<input type=\"search\" part=\"input\">\n<button type=\"button\" part=\"clear\" aria-label=\"Clear search\" title=\"Clear search\" hidden>×</button>\n",
  ":host { position: relative; display: flex; flex: 1; min-width: 140px; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\ninput, button { box-sizing: border-box; color: inherit; font: inherit; }\ninput {\n  width: 100%;\n  min-width: 0;\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\ninput[data-filled] { padding-inline-end: 30px; }\ninput::-webkit-search-cancel-button { appearance: none; }\ninput::placeholder { color: var(--cm-muted, #687586); }\ninput:focus { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\nbutton {\n  position: absolute;\n  inset-inline-end: 4px;\n  top: 50%;\n  transform: translateY(-50%);\n  display: grid;\n  place-items: center;\n  width: 22px;\n  height: 22px;\n  padding: 0;\n  border: 0;\n  border-radius: var(--cm-control-radius, 6px);\n  background: transparent;\n  color: var(--cm-muted, #687586);\n  cursor: pointer;\n}\nbutton:hover { background: var(--cm-hover, #e3ecf8); color: var(--cm-accent, #1677ff); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n",
]);
const template$f = createTemplate(markup$f);
const HTMLElementBase$g = globalThis.HTMLElement || class {};

class SearchField extends HTMLElementBase$g {
  static observedAttributes = ["label", "placeholder"];
  #input;
  #clear;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$f;
    root.append(style, template$f(this.ownerDocument));
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

const [markup$e, css$e] = await Promise.all([
  "<span part=\"label\"></span>\n<button type=\"button\" part=\"edit-button\">\n  <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\">\n    <path d=\"m4 20 4.1-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.1 16 4 20Z\"></path>\n    <path d=\"m13.8 7.2 3 3\"></path>\n  </svg>\n</button>\n<input type=\"text\" part=\"input\" hidden>\n<select part=\"input\" hidden></select>\n",
  ":host {\n  display: flex;\n  align-items: center;\n  min-width: 0;\n  height: 28px;\n  box-sizing: border-box;\n  color: inherit;\n  font: inherit;\n}\n:host([hidden]), [hidden] { display: none !important; }\n:host([compact]) { flex: 0 0 auto; width: var(--cm-edit-width, max-content); max-width: 100%; }\n:host(:hover) { --cm-edit-icon-width:20px; }\nspan { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: text; }\nspan[data-placeholder] { color: var(--cm-muted, #687586); }\nbutton, input, select { box-sizing: border-box; font: inherit; color: inherit; }\nbutton {\n  display: inline-grid;\n  place-items: center;\n  flex: 0 0 auto;\n  width: var(--cm-edit-icon-width, 0px);\n  min-width: 0;\n  height: 20px;\n  overflow: hidden;\n  padding: 0;\n  border: 0;\n  border-radius: var(--cm-control-radius, 6px);\n  background: transparent;\n  color: var(--cm-muted, #64748b);\n  cursor: pointer;\n}\nbutton:hover { background: var(--cm-hover, #e3ecf8); color: var(--cm-accent, #1677ff); }\nbutton:focus-visible { width:20px; outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\nbutton:disabled { cursor: default; opacity: .45; }\nsvg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }\ninput, select {\n  width: 100%;\n  min-width: 0;\n  height: 28px;\n  margin-inline: -1px;\n  padding: 2px 7px;\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n  line-height: 20px;\n}\ninput::placeholder { color: var(--cm-muted, #687586); }\ninput:focus, select:focus { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n",
]);
const template$e = createTemplate(markup$e);
const HTMLElementBase$f = globalThis.HTMLElement || class {};

/** A field owns its draft; consumers accept or cancel value-commit events. */
class EditableField extends HTMLElementBase$f {
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
    const style = this.ownerDocument.createElement("style"); style.textContent = css$e;
    root.append(style, template$e(this.ownerDocument));
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

const [markup$d, css$d] = await Promise.all([
  "<details>\n  <summary></summary>\n  <div data-items>\n    <template>\n      <div class=\"category\">\n        <input type=\"color\">\n        <clinker-editable-field required></clinker-editable-field>\n        <button type=\"button\" data-remove>×</button>\n      </div>\n    </template>\n    <form class=\"category\">\n      <input type=\"color\" aria-label=\"New category colour\">\n      <input type=\"text\" aria-label=\"New category name\" placeholder=\"New category\" required>\n      <button type=\"submit\" aria-label=\"Add category\">+</button>\n    </form>\n  </div>\n  <div data-removal hidden>\n    <span></span>\n    <select aria-label=\"Replacement category\"></select>\n    <button type=\"button\" data-confirm>Remove</button>\n    <button type=\"button\" data-cancel>Cancel</button>\n  </div>\n</details>\n",
  ":host { display: block; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\nsummary { cursor: pointer; color: var(--cm-muted, #687586); }\nsummary:hover { color: var(--cm-accent, #1677ff); }\n[data-items] { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 8px 0 2px; }\n.category, [data-removal] { display: flex; align-items: center; gap: 5px; }\n.category:hover { --cm-edit-icon-width:20px; }\nform { margin: 0; }\nclinker-editable-field, input[type=text] { width: 140px; min-width: 0; }\ninput, button, select { box-sizing: border-box; font: inherit; color: inherit; }\ninput[type=color] { width: 30px; height: 22px; padding: 0; border: 0; background: transparent; cursor: pointer; }\ninput[type=text], button, select {\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\ninput::placeholder { color: var(--cm-muted, #687586); }\nbutton { cursor: pointer; }\nbutton:hover { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #e3ecf8); }\n:where(button, summary):focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n:where(input, select):focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n[data-removal] { flex-wrap: wrap; margin-top: 6px; padding: 6px; border: 1px solid var(--cm-border, #cbd3de); border-radius: 4px; }\n",
]);
const template$d = createTemplate(markup$d);
const HTMLElementBase$e = globalThis.HTMLElement || class {};

class CategoryEditor extends HTMLElementBase$e {
  #value = [];
  #palette = ["#888888"];
  #revision = 0;
  #rows = new Map();
  #details;
  #items;
  #template;
  #form;
  #name;
  #colour;
  #removal;
  #replacement;
  #removing = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$d;
    root.append(style, template$d(this.ownerDocument));
    this.#details = root.querySelector("details"); this.#items = root.querySelector("[data-items]");
    this.#template = this.#items.querySelector("template"); this.#form = root.querySelector("form");
    this.#name = this.#form.querySelector('[type="text"]'); this.#colour = this.#form.querySelector('[type="color"]');
    this.#removal = root.querySelector("[data-removal]"); this.#replacement = this.#removal.querySelector("select");
    this.#name.oninput = () => this.#name.setCustomValidity("");
    this.#form.onsubmit = (event) => {
      event.preventDefault(); const name = this.#name.value.trim();
      if (this.#validateName(name, this.#name) && this.#propose([...this.#value, { name, colour: this.#colour.value }])) this.#name.value = "";
    };
    root.querySelector("[data-cancel]").onclick = () => this.#cancelRemoval();
    root.querySelector("[data-confirm]").onclick = () => {
      const replacement = this.#replacement.value === "missing" ? null : this.#value[Number(this.#replacement.value)].name;
      if (this.#propose(this.#value.filter(({ name }) => name !== this.#removing), [[this.#removing, replacement]])) {
        this.#removing = null; this.#renderRemoval(); this.#name.focus();
      }
    };
    this.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.defaultPrevented && this.#removing !== null) {
        event.preventDefault(); event.stopPropagation(); this.#cancelRemoval();
      }
    });
    this.#render();
  }

  get value() { return this.#value; }
  set value(items) {
    this.#value = items.map(({ name, colour }) => ({ name, colour }));
    this.#revision++; this.#render();
  }
  set palette(colours) { this.#palette = colours.length ? colours.map((colour) => colourHex(colour)) : ["#888888"]; this.#suggestColour(); }
  get open() { return this.#details.open; }
  set open(value) { this.#details.open = Boolean(value); }
  disconnectedCallback() { this.cancelEdit(); }
  cancelEdit() { for (const row of this.#rows.values()) row.querySelector("clinker-editable-field").cancelEdit(); }

  #validateName(name, control, previous) {
    control.setCustomValidity(!name ? "Category names cannot be empty." : name !== previous && this.#value.some((item) => item.name === name) ? "Category names must be unique." : "");
    return control.reportValidity();
  }

  #propose(value, replacements = []) {
    const revision = this.#revision;
    if (!this.dispatchEvent(new CustomEvent("value-commit", { detail: { value, replacements }, bubbles: true, composed: true, cancelable: true }))) return false;
    if (this.isConnected && revision === this.#revision) this.value = value;
    return true;
  }

  #createRow(name) {
    const row = this.ownerDocument.importNode(this.#template.content, true).firstElementChild;
    const colour = row.querySelector("input"), label = row.querySelector("clinker-editable-field"), remove = row.querySelector("button");
    colour.onchange = () => {
      if (!this.#propose(this.#value.map((item) => item.name === name ? { ...item, colour: colour.value } : item))) colour.value = colourHex(this.#value.find((item) => item.name === name).colour);
    };
    label.addEventListener("value-commit", (event) => {
      event.stopPropagation(); const next = event.detail.value.trim();
      if (!this.#validateName(next, label, name) || !this.#propose(this.#value.map((item) => item.name === name ? { ...item, name: next } : item), [[name, next]])) event.preventDefault();
      else label.value = next;
    });
    remove.onclick = () => { this.#removing = name; this.#renderRemoval(); this.#replacement.focus(); };
    colour.setAttribute("aria-label", `Colour for ${name}`); label.setAttribute("label", `Rename category ${name}`);
    remove.setAttribute("aria-label", `Remove category ${name}`);
    return row;
  }

  #render() {
    this.shadowRoot.querySelector("summary").textContent = `Categories (${this.#value.length})`;
    for (const [name, row] of this.#rows) if (!this.#value.some((item) => item.name === name)) {
      row.querySelector("clinker-editable-field").cancelEdit(); row.remove(); this.#rows.delete(name);
    }
    let next = this.#form;
    for (const item of [...this.#value].reverse()) {
      let row = this.#rows.get(item.name);
      if (!row) { row = this.#createRow(item.name); this.#rows.set(item.name, row); }
      row.querySelector("input").value = colourHex(item.colour); row.querySelector("clinker-editable-field").value = item.name;
      if (row.nextSibling !== next) this.#items.insertBefore(row, next);
      next = row;
    }
    if (!this.#value.some(({ name }) => name === this.#removing)) this.#removing = null;
    this.#renderRemoval(); this.#suggestColour();
  }

  #suggestColour() {
    const used = new Set(this.#value.map(({ colour }) => colourHex(colour)));
    this.#colour.value = this.#palette.find((colour) => !used.has(colour)) || this.#palette[this.#value.length % this.#palette.length] || "#888888";
  }

  #renderRemoval() {
    this.#removal.hidden = this.#removing === null;
    if (this.#removing === null) return;
    this.#removal.querySelector("span").textContent = `Replace “${this.#removing}” with`;
    updateSelectOptions(this.#replacement, [["missing", "Missing"], ...this.#value.flatMap(({ name }, index) => name === this.#removing ? [] : [[String(index), name]])]);
    this.#replacement.value = "missing";
  }

  #cancelRemoval() {
    const name = this.#removing; this.#removing = null; this.#renderRemoval();
    this.#rows.get(name)?.querySelector("button").focus();
  }
}

function defineCategoryEditor() {
  defineEditableField();
  if (!customElements.get("clinker-category-editor")) customElements.define("clinker-category-editor", CategoryEditor);
}

const [markup$c, css$c] = await Promise.all([
  "<select aria-label=\"Annotation panel\"></select>\n<button type=\"button\" data-action=\"add\">Add panel</button>\n<button type=\"button\" data-action=\"replace\">Replace data…</button>\n<button type=\"button\" data-action=\"show\">Hide</button>\n<button type=\"button\" data-action=\"left\" aria-label=\"Move left\" title=\"Move left\">←</button>\n<button type=\"button\" data-action=\"right\" aria-label=\"Move right\" title=\"Move right\">→</button>\n<button type=\"button\" data-action=\"remove\" aria-label=\"Remove panel\">Remove</button>\n<slot></slot>\n",
  ":host { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex-shrink: 0; color: inherit; font: inherit; }\n:host([embedded]), slot { display: contents; }\n:host([hidden]), [hidden] { display: none !important; }\nbutton, select {\n  box-sizing: border-box;\n  font: inherit;\n  color: inherit;\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\nselect { max-width: 260px; }\n:host([embedded]) select { max-width: 220px; }\nbutton { cursor: pointer; }\nbutton:hover:not(:disabled) { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #e3ecf8); }\nbutton:disabled { color: var(--cm-muted, #8993a1); opacity: .45; cursor: default; }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\nselect:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n",
]);
const template$c = createTemplate(markup$c);
const HTMLElementBase$d = globalThis.HTMLElement || class {};

class AnnotationToolbar extends HTMLElementBase$d {
  #select;
  #buttons;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$c;
    root.append(style, template$c(this.ownerDocument));
    this.#select = root.querySelector("select");
    this.#buttons = Object.fromEntries([...root.querySelectorAll("button")].map((button) => [button.dataset.action, button]));
    this.#select.onchange = () => this.#emit("panel-change", { value: this.#select.value });
    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (button && !button.disabled) this.#emit("panel-action", { action: button.dataset.action });
    });
    this.state = {};
  }

  set state({ panels = [], value = null, creating = false }) {
    const panel = panels.find(({ uid }) => uid === value), index = panels.indexOf(panel);
    updateSelectOptions(this.#select, panels.map(({ uid, title }) => [uid, title || uid]));
    this.#select.value = value ?? ""; this.#select.hidden = !panels.length;
    for (const [action, button] of Object.entries(this.#buttons)) {
      button.hidden = action !== "add" && (!panel || creating || action === "replace" && panel.type === "groups");
    }
    this.#buttons.add.textContent = creating ? "Cancel" : "Add panel";
    this.#buttons.show.textContent = panel?.show === false ? "Show" : "Hide";
    this.#buttons.left.disabled = index <= 0;
    this.#buttons.right.disabled = index < 0 || index === panels.length - 1;
  }

  #emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); }
}

function defineAnnotationToolbar() {
  if (!customElements.get("clinker-annotation-toolbar")) customElements.define("clinker-annotation-toolbar", AnnotationToolbar);
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

const [markup$b, css$b] = await Promise.all([
  "<form>\n  <div data-create>\n    <label><span>Type</span><select name=\"type\" aria-label=\"Type\"><option value=\"heatmap\">Heatmap</option><option value=\"bar\">Bar chart</option><option value=\"groups\">Group markers</option></select></label>\n    <label><span>Title</span><input name=\"title\" type=\"text\" aria-label=\"Title\"></label>\n    <label data-scale><span>Values</span><select name=\"scale\" aria-label=\"Values\"><option value=\"continuous\">Numeric</option><option value=\"categorical\">Categories</option></select></label>\n    <p data-help></p>\n  </div>\n  <label class=\"data\"><span>Data</span><textarea name=\"data\" aria-label=\"Data\" rows=\"8\" spellcheck=\"false\"></textarea></label>\n  <p data-error role=\"alert\" hidden></p>\n  <div class=\"actions\"><button type=\"submit\">Add panel</button><button type=\"button\" data-cancel hidden>Cancel</button></div>\n</form>\n",
  ":host { display: block; flex-shrink: 0; min-width: 0; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\nform { margin: 0; }\nlabel { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }\nlabel > span { flex: 1; min-width: 0; }\ninput, select { width: 140px; max-width: 65%; }\ninput, select, textarea, button {\n  box-sizing: border-box;\n  font: inherit;\n  color: inherit;\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\n.data { display: block; }\ntextarea { display: block; width: 100%; margin-top: 4px; resize: vertical; }\np { margin: 8px 0; color: var(--cm-muted, #687586); }\n[data-error] { color: var(--cm-danger, #b42318); }\n.actions { display: flex; gap: 8px; }\nbutton { cursor: pointer; }\nbutton:hover { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #e3ecf8); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n:is(input, select, textarea):focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n",
]);
const template$b = createTemplate(markup$b);
const HTMLElementBase$c = globalThis.HTMLElement || class {};

class AnnotationDataForm extends HTMLElementBase$c {
  static observedAttributes = ["mode"];
  #form;
  #clusters = [];

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$b;
    root.append(style, template$b(this.ownerDocument));
    this.#form = root.querySelector("form");
    this.#field("type").onchange = () => { this.#sync(); this.#example(); };
    this.#form.onsubmit = (event) => { event.preventDefault(); this.error = ""; this.#emit("data-submit", this.value); };
    root.querySelector("[data-cancel]").onclick = () => this.#emit("data-cancel");
    this.#sync();
  }

  set clusters(value) { this.#clusters = value; this.#example(); }
  get value() { return Object.fromEntries(["type", "title", "scale", "data"].map((name) => [name, this.#field(name).value])); }
  set value(value) { for (const [name, text] of Object.entries(value)) this.#field(name).value = text; this.#sync(); }
  set error(message) {
    const error = this.shadowRoot.querySelector("[data-error]"); error.textContent = message; error.hidden = !message;
  }
  focus(options) { this.#field(this.getAttribute("mode") === "replace" ? "data" : "type").focus(options); }
  attributeChangedCallback() { this.#sync(); }

  #field(name) { return this.#form.elements.namedItem(name); }
  #emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true })); }
  #sync() {
    const root = this.shadowRoot, replace = this.getAttribute("mode") === "replace", type = this.#field("type").value;
    root.querySelector("[data-create]").hidden = replace;
    root.querySelector("[data-scale]").hidden = type === "groups";
    this.#field("scale").disabled = type === "bar";
    if (type === "bar") this.#field("scale").value = "continuous";
    root.querySelector("[data-help]").textContent = type === "groups"
      ? "Define groups as JSON. Each needs a uid, a label, and either clusterIds or a tree nodeUid. Colours are optional."
      : "Paste CSV or a tab-separated table. First column: cluster ID; remaining headings: data columns. Blank cells are missing. Bars use one data column. JSON {columns, values} is also accepted.";
    this.#field("data").rows = replace ? 5 : 8;
    this.#field("data").setAttribute("aria-label", replace ? "Replacement annotation data (CSV, TSV or JSON)" : "Data");
    root.querySelector('[type="submit"]').textContent = replace ? "Replace data" : "Add panel";
    root.querySelector("[data-cancel]").hidden = !replace;
  }
  #example() {
    if (this.getAttribute("mode") === "replace") return;
    this.#field("data").value = this.#field("type").value === "groups"
      ? JSON.stringify({ groups: [{ uid: "group-1", label: "Example group", clusterIds: this.#clusters.slice(0, 2).map(({ uid }) => uid) }] }, null, 2)
      : csvFormatRows([["cluster", "Value"], ...this.#clusters.map(({ uid }) => [uid, ""])]);
  }
}

function defineAnnotationDataForm() {
  if (!customElements.get("clinker-annotation-data-form")) customElements.define("clinker-annotation-data-form", AnnotationDataForm);
}

const [markup$a, css$a] = await Promise.all([
  "<div data-groups>\n  <template>\n    <fieldset>\n      <legend></legend>\n      <div class=\"controls\">\n        <clinker-editable-field label=\"Group label\"></clinker-editable-field>\n        <input type=\"color\" aria-label=\"Group colour\">\n        <select data-mode aria-label=\"Membership\"></select>\n        <button type=\"button\">Remove group</button>\n      </div>\n      <select data-members></select>\n    </fieldset>\n  </template>\n</div>\n<button type=\"button\" data-add>Add group</button>\n",
  ":host { display: block; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\nfieldset { min-width: 0; margin: 0 0 8px; padding: 8px; border: 1px solid var(--cm-border, #cbd3de); border-radius: 6px; }\nlegend { padding: 0 4px; font-weight: 600; }\n.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }\nclinker-editable-field { width: 140px; }\nclinker-editable-field:hover { --cm-edit-icon-width: 20px; }\nbutton, select, input { box-sizing: border-box; color: inherit; font: inherit; }\nbutton, select {\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\nselect { max-width: 100%; }\n[data-members] { display: block; margin-top: 8px; }\ninput[type=color] { width: 30px; height: 22px; padding: 0; border: 0; background: transparent; cursor: pointer; }\nbutton { cursor: pointer; }\nbutton:hover:not(:disabled) { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #e3ecf8); }\nbutton:disabled { color: var(--cm-muted, #8993a1); opacity: .45; cursor: default; }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n:is(input, select):focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n",
]);
const template$a = createTemplate(markup$a);
const HTMLElementBase$b = globalThis.HTMLElement || class {};

class AnnotationGroupEditor extends HTMLElementBase$b {
  #state = { groups: [], clusters: [], tree: null };
  #revision = 0;
  #rows = new Map();
  #items;
  #template;
  #add;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$a;
    root.append(style, template$a(this.ownerDocument));
    this.#items = root.querySelector("[data-groups]"); this.#template = this.#items.querySelector("template");
    this.#add = root.querySelector("[data-add]");
    this.#add.onclick = () => {
      const { groups, clusters } = this.#state;
      if (!clusters.length) return;
      let serial = 1; while (groups.some(({ uid }) => uid === `group-${serial}`)) serial++;
      this.#propose([...groups, { uid: `group-${serial}`, label: `Group ${serial}`, clusterIds: [clusters[0].uid] }]);
    };
    this.#render();
  }

  set state(value) { this.#state = value; this.#revision++; this.#render(); }
  cancelEdit() { for (const { label } of this.#rows.values()) label.cancelEdit(); }
  disconnectedCallback() { this.cancelEdit(); }

  #propose(groups) {
    const revision = this.#revision;
    const accepted = this.dispatchEvent(new CustomEvent("value-commit", { detail: { value: groups }, bubbles: true, composed: true, cancelable: true }));
    if (accepted && revision === this.#revision) this.state = { ...this.#state, groups };
    if (!accepted) this.#render();
    return accepted;
  }

  #edit(uid, changes) { return this.#propose(this.#state.groups.map((group) => group.uid === uid ? { ...group, ...changes } : group)); }

  #createRow(uid) {
    const node = this.ownerDocument.importNode(this.#template.content, true).firstElementChild;
    const row = { node, label: node.querySelector("clinker-editable-field"), colour: node.querySelector("input"),
      mode: node.querySelector("[data-mode]"), members: node.querySelector("[data-members]"), remove: node.querySelector("button") };
    row.label.addEventListener("value-commit", (event) => {
      event.stopPropagation(); if (!this.#edit(uid, { label: event.detail.value })) event.preventDefault();
    });
    row.colour.onchange = () => this.#edit(uid, { colour: row.colour.value });
    row.remove.onclick = () => this.#propose(this.#state.groups.filter((group) => group.uid !== uid));
    row.mode.onchange = () => {
      const { tree, clusters } = this.#state;
      if (row.mode.value === "tree" && tree) this.#edit(uid, { clusterIds: undefined, nodeUid: tree.root });
      else if (clusters.length) this.#edit(uid, { nodeUid: undefined, clusterIds: [clusters[0].uid] });
      else this.#render();
    };
    row.members.onchange = () => {
      const { clusters, tree } = this.#state;
      this.#edit(uid, row.members.multiple
        ? { clusterIds: [...row.members.selectedOptions].map((option) => clusters.find(({ uid }) => String(uid) === option.value).uid) }
        : { nodeUid: tree.nodes.find(({ uid }) => String(uid) === row.members.value).uid });
    };
    return row;
  }

  #render() {
    const { groups, clusters, tree, colour } = this.#state;
    this.#add.disabled = !clusters.length;
    for (const [uid, row] of this.#rows) if (!groups.some((group) => group.uid === uid)) {
      row.label.cancelEdit(); row.node.remove(); this.#rows.delete(uid);
    }
    let next = null;
    for (const group of [...groups].reverse()) {
      let row = this.#rows.get(group.uid);
      if (!row) { row = this.#createRow(group.uid); this.#rows.set(group.uid, row); }
      if (row.node.nextSibling !== next || row.node.parentNode !== this.#items) this.#items.insertBefore(row.node, next);
      next = row.node;
      row.node.querySelector("legend").textContent = group.label || group.uid;
      row.label.value = group.label ?? group.uid; row.colour.value = colourHex(group.colour ?? colour ?? "#267c9e");
      row.remove.disabled = groups.length === 1;
      updateSelectOptions(row.mode, [["clusters", "Selected clusters"], ...(tree ? [["tree", "Tree clade"]] : [])]);
      row.mode.value = group.nodeUid === undefined ? "clusters" : "tree";
      row.members.multiple = group.nodeUid === undefined; row.members.size = row.members.multiple ? Math.max(1, Math.min(5, clusters.length)) : 0;
      row.members.setAttribute("aria-label", row.members.multiple ? `Clusters in ${group.label || group.uid}` : "Tree node");
      updateSelectOptions(row.members, row.members.multiple ? clusters.map(({ uid, name }) => [uid, `${name || uid} (${uid})`]) : (tree?.nodes || []).map(({ uid, label }) => [uid, label || uid]));
      for (const option of row.members.options) option.selected = row.members.multiple
        ? (group.clusterIds || []).some((uid) => String(uid) === option.value) : String(group.nodeUid) === option.value;
    }
  }
}

function defineAnnotationGroupEditor() {
  defineEditableField();
  if (!customElements.get("clinker-annotation-group-editor")) customElements.define("clinker-annotation-group-editor", AnnotationGroupEditor);
}

const [markup$9, css$9] = await Promise.all([
  "<span part=\"summary\"></span>\n<div part=\"actions\" hidden>\n  <slot name=\"actions\"></slot>\n  <button type=\"button\" data-clear aria-label=\"Clear selection\">Clear</button>\n</div>\n<button type=\"button\" data-all hidden>Select all visible</button>\n",
  ":host {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 32px;\n  min-width: 0;\n  flex-shrink: 0;\n  color: var(--cm-muted, #687586);\n  font: 12px/1.4 system-ui, sans-serif;\n}\n:host([hidden]), [hidden] { display: none !important; }\nspan { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\nspan.is-selected { color: var(--cm-foreground, #273444); font-weight: 600; }\ndiv { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }\nslot { display: contents; }\nbutton {\n  flex-shrink: 0;\n  box-sizing: border-box;\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n  color: inherit;\n  font: inherit;\n  cursor: pointer;\n}\nbutton:hover:not(:disabled) { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #f4f8ff); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\nbutton:disabled { color: var(--cm-muted, #8993a1); opacity: .45; cursor: default; }\n",
]);
const template$9 = createTemplate(markup$9);
const HTMLElementBase$a = globalThis.HTMLElement || class {};

class SelectionBar extends HTMLElementBase$a {
  #summary;
  #actions;
  #all;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$9;
    root.append(style, template$9(this.ownerDocument));
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

const [markup$8, css$8] = await Promise.all([
  "<details>\n  <summary part=\"trigger\"></summary>\n  <div part=\"panel\"><slot></slot></div>\n</details>\n",
  ":host { display: block; position: relative; color: var(--cm-foreground, #273444); font: inherit; }\n:host([hidden]) { display: none !important; }\nsummary {\n  display: block;\n  box-sizing: border-box;\n  min-height: 30px;\n  padding: 4px 8px;\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: 6px;\n  background: var(--cm-surface, #fff);\n  list-style: none;\n  white-space: nowrap;\n  cursor: pointer;\n}\nsummary::-webkit-details-marker { display: none; }\nsummary:hover, details[open] > summary { background: var(--cm-hover, #e3ecf8); border-color: var(--cm-accent, #78a9ed); }\nsummary:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\ndiv {\n  position: absolute;\n  right: 0;\n  top: calc(100% + 4px);\n  z-index: 10;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  width: max-content;\n  max-width: min(340px, 80vw);\n  max-height: 50vh;\n  overflow: auto;\n  padding: 10px;\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: 8px;\n  background: var(--cm-surface, #fff);\n  box-shadow: 0 4px 16px #0002;\n}\nslot { display: contents; }\n::slotted(button) { text-align: left; }\n::slotted(label) { display: flex; align-items: center; gap: 6px; }\n::slotted(input[type=number]) { width: 112px; }\n",
]);
const template$8 = createTemplate(markup$8);
const activeMenus = new WeakMap();
const HTMLElementBase$9 = globalThis.HTMLElement || class {};

class ActionMenu extends HTMLElementBase$9 {
  static observedAttributes = ["label", "open"];
  #details;
  #trigger;
  #outside = (event) => { if (!event.composedPath().includes(this)) this.open = false; };

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$8;
    root.append(style, template$8(this.ownerDocument));
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

const [markup$7, css$7] = await Promise.all([
  "<div part=\"viewport\" tabindex=\"-1\"><slot name=\"header\"></slot><slot></slot><p part=\"empty\" hidden>No records match the filter.</p></div>\n<template id=\"heading\"><span class=\"cm-data-cell\"></span></template>\n<template id=\"sort\"><button type=\"button\" class=\"cm-data-cell cm-editor__sort\"><span data-label></span><span aria-hidden=\"true\"></span></button></template>\n",
  ":host { display: flex; flex: 1; min-width: 0; min-height: 120px; color: inherit; font: inherit; }\n:host([hidden]) { display: none !important; }\n[hidden] { display: none !important; }\n[part=viewport] { flex: 1; min-width: 0; min-height: 0; overflow: auto; overflow-anchor: none; outline: none; }\nslot { display: contents; }\n[part=empty] { padding: 16px; color: var(--cm-muted, #667386); text-align: center; }\n",
]);
const template$7 = createTemplate(markup$7);
const HTMLElementBase$8 = globalThis.HTMLElement || class {};

class DataTable extends HTMLElementBase$8 {
  #viewport;
  #renderer = null;
  #rows = [];
  #view = null;
  #header = null;
  #columnsKey;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$7;
    root.append(style, template$7(this.ownerDocument));
    this.#viewport = root.querySelector("div");
  }

  connectedCallback() { this.#mount(); }
  disconnectedCallback() { this.#dispose(); }

  // Row adapters provide their container, key and create/update/dispose callbacks.
  set renderer(value) {
    if (value === this.#renderer) return;
    this.#dispose(); this.#renderer = value; this.#rows = []; this.#syncEmpty(); this.#mount();
  }
  set rows(value) { this.#rows = value; this.#syncEmpty(); this.#view?.setRows(value); }
  set header({ columns, sort }) {
    const node = this.querySelector('[slot="header"]');
    if (!node) return;
    const key = JSON.stringify(columns);
    if (this.#header !== node || this.#columnsKey !== key) {
      this.#header = node; this.#columnsKey = key;
      node.replaceChildren(...columns.map(({ label, sort }, index) => {
        const template = this.shadowRoot.getElementById(sort ? "sort" : "heading");
        const cell = this.ownerDocument.importNode(template.content, true).firstElementChild;
        if (sort) { cell.dataset.sort = sort; cell.querySelector("[data-label]").textContent = label; cell.title = `Sort by ${label}`; }
        else cell.textContent = label;
        cell.classList.toggle("cm-data-cell--select", index === 0); return cell;
      }));
    }
    for (const button of node.querySelectorAll("[data-sort]")) {
      const label = button.querySelector("[data-label]").textContent, active = sort?.key === button.dataset.sort;
      button.setAttribute("aria-label", `Sort by ${label}, ${active && sort.direction < 0 ? "descending" : "ascending"}`);
      button.lastElementChild.textContent = active ? sort.direction < 0 ? "↓" : "↑" : "↕";
    }
  }
  get scrollTop() { return this.#viewport.scrollTop; }
  set scrollTop(value) { this.#viewport.scrollTop = value; }
  get scrollLeft() { return this.#viewport.scrollLeft; }
  set scrollLeft(value) { this.#viewport.scrollLeft = value; }
  get scrollHeight() { return this.#viewport.scrollHeight; }
  get scrollWidth() { return this.#viewport.scrollWidth; }
  scrollTo(...args) { this.#viewport.scrollTo(...args); }
  focus(options) { this.#viewport.focus(options); }

  #mount() {
    if (!this.isConnected || !this.#renderer || this.#view) return;
    this.#view = createVirtualRows({ ...this.#renderer, viewport: this.#viewport });
    this.#view.setRows(this.#rows);
  }
  #dispose() { this.#view?.destroy(); this.#view = null; }
  #syncEmpty() { this.shadowRoot.querySelector("[part=empty]").hidden = !this.#renderer || this.#rows.length > 0; }
}

function defineDataTable() {
  if (!customElements.get("clinker-data-table")) customElements.define("clinker-data-table", DataTable);
}

const [markup$6, controls$3, css$6] = await Promise.all([
  "<select data-columns aria-label=\"Columns to edit\"></select>\n<input type=\"number\" step=\"any\" placeholder=\"Value\" aria-label=\"Batch value\">\n<select data-categories aria-label=\"Batch value\" hidden></select>\n<button type=\"button\" data-set>Set values</button>\n<button type=\"button\" data-clear>Clear values</button>\n",
  "button, input, select { box-sizing: border-box; font: inherit; color: inherit; }\nbutton, input:not([type=color]):not([type=checkbox]):not([type=range]), select {\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\nbutton { cursor: pointer; }\nbutton:hover { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #f4f8ff); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n:is(input, select):focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n",
  ":host { display: flex; flex-direction: column; gap: 8px; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\nbutton { text-align: left; }\ninput { width: 112px; }\n",
]);
const template$6 = createTemplate(markup$6);
const HTMLElementBase$7 = globalThis.HTMLElement || class {};

class AnnotationValueActions extends HTMLElementBase$7 {
  #columns;
  #numeric;
  #categories;
  #domain = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = controls$3 + css$6;
    root.append(style, template$6(this.ownerDocument));
    this.#columns = root.querySelector("[data-columns]"); this.#numeric = root.querySelector("input"); this.#categories = root.querySelector("[data-categories]");
    root.addEventListener("change", () => this.#draftChanged());
    root.querySelector("[data-set]").onclick = () => this.#submit(false);
    root.querySelector("[data-clear]").onclick = () => this.#submit(true);
  }

  set state({ columns, domain = null, draft = { column: "0", value: "" } }) {
    this.#domain = domain;
    this.#numeric.hidden = domain !== null; this.#categories.hidden = domain === null;
    updateSelectOptions(this.#columns, [["all", "All columns"], ...columns.map((name, index) => [String(index), name])]);
    if (domain !== null) updateSelectOptions(this.#categories, [["", "Missing"], ...domain.map((name, index) => [String(index), name])]);
    this.#columns.value = draft.column; this.#input.value = draft.value;
  }

  get #input() { return this.#domain === null ? this.#numeric : this.#categories; }
  #draftChanged() {
    this.dispatchEvent(new CustomEvent("draft-change", { detail: { column: this.#columns.value, value: this.#input.value }, bubbles: true, composed: true }));
  }
  #submit(clear) {
    const input = this.#input;
    if (!clear && !input.reportValidity()) return;
    this.#draftChanged();
    const value = clear || input.value === "" ? null : this.#domain === null ? Number(input.value) : this.#domain[Number(input.value)];
    const column = this.#columns.value === "all" ? "all" : Number(this.#columns.value);
    this.dispatchEvent(new CustomEvent("values-commit", { detail: { column, value }, bubbles: true, composed: true, cancelable: true }));
  }
}

function defineAnnotationValueActions() {
  if (!customElements.get("clinker-annotation-value-actions")) customElements.define("clinker-annotation-value-actions", AnnotationValueActions);
}

const [markup$5, css$5] = await Promise.all([
  "<template id=\"tools\"><slot name=\"tools\"></slot></template>\n<template id=\"table\">\n<table><thead><tr>\n  <th class=\"cm-data-cell cm-data-cell--select cm-data-head\"><input type=\"checkbox\" aria-label=\"Select all filtered clusters\"></th>\n  <th class=\"cm-data-cell cm-data-head\">Cluster</th>\n</tr></thead><tbody></tbody></table>\n</template>\n\n<template id=\"column\">\n<th class=\"cm-data-cell cm-data-head\"><div class=\"cm-annotation-column\">\n  <clinker-editable-field required></clinker-editable-field><button type=\"button\" class=\"cm-data-icon-button\">×</button>\n</div></th>\n</template>\n\n<template id=\"add-column\">\n<th class=\"cm-data-cell cm-data-head cm-annotation-add-column\"><form>\n  <button type=\"button\" aria-label=\"Add column\">+</button>\n  <input type=\"text\" aria-label=\"New column name\" placeholder=\"Column name\" hidden><button type=\"submit\" hidden>Add</button>\n</form></th>\n</template>\n\n<template id=\"row\">\n<tr class=\"cm-data-row\">\n  <td class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></td><th class=\"cm-data-cell\" scope=\"row\"></th>\n</tr>\n</template>\n\n<template id=\"empty-cell\">\n<td class=\"cm-data-cell\"></td>\n</template>\n\n<template id=\"spacer\">\n<tr class=\"cm-annotation-spacer\" aria-hidden=\"true\"><td></td></tr>\n</template>\n\n<template id=\"cell\">\n  <td class=\"cm-data-cell\"><clinker-editable-field placeholder=\"—\" step=\"any\"></clinker-editable-field></td>\n</template>\n",
  ":host { display:flex; flex:1; min-width:0; min-height:0; color:inherit; font:inherit; }\n:host([hidden]) { display:none!important; }\nslot { display:contents; }\n.cm-annotation-matrix { position:relative; }\n.cm-annotation-matrix table { border-collapse:separate; border-spacing:0; font:inherit; color:inherit; width:max-content; min-width:100%; }\n\n.cm-annotation-matrix thead th { position:sticky; top:0; z-index:2; background:var(--cm-subtle,#f3f6fa); }\n.cm-annotation-matrix tr > :first-child { position:sticky; left:0; z-index:1; width:32px; min-width:32px; background:var(--cm-row-background,var(--cm-subtle,#f3f6fa)); }\n.cm-annotation-matrix tr > :nth-child(2) { position:sticky; left:32px; z-index:1; }\n.cm-annotation-matrix tbody th { background:var(--cm-row-background); }\n.cm-annotation-matrix thead th:nth-child(-n+2) { z-index:3; background:var(--cm-subtle,#f3f6fa); }\n.cm-annotation-matrix tbody th { cursor:pointer; min-width:200px; max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:400; }\n.cm-annotation-matrix :is(input:not([type=checkbox]),clinker-editable-field) { width:140px; }\n.cm-annotation-column { display:flex; align-items:center; }\n.cm-annotation-column button { --cm-icon-size:24px; visibility:hidden; }\n.cm-annotation-column:is(:hover,:focus-within) button { visibility:visible; }\n.cm-annotation-add-column { width:36px; }\n.cm-annotation-add-column form { display:flex; gap:4px; }\n.cm-annotation-spacer > td { height:0; border:0; padding:0; }\n",
]);
const template$5 = createTemplate(markup$5);
const HTMLElementBase$6 = globalThis.HTMLElement || class {};

class AnnotationTable extends HTMLElementBase$6 {
  #templates;
  #layout;
  #panel;
  #domain = null;
  #filtered = [];
  #filter = "";
  #schema;
  #table;
  #selection = new RowSelection();
  #rowIds = new WeakMap();
  #selectionControls;
  #batch;
  #draft = { column: "0", value: "" };

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = DATA_EDITOR_CSS + css$5;
    this.#templates = template$5(this.ownerDocument);
    this.#layout = createDataPanel(this.ownerDocument, { label: "Editable annotation data" });
    this.#layout.node.classList.add("cm-data-ui");
    this.#layout.tools.replaceWith(this.#element("tools"));
    this.#layout.viewport.classList.add("cm-annotation-matrix");
    this.#selectionControls = createSelectionControls(this.#layout, { selection: this.#selection, menuLabel: "Edit values…", onChange: () => this.#syncSelection() });
    this.#batch = this.ownerDocument.createElement("clinker-annotation-value-actions");
    this.#selectionControls.actions.append(this.#batch);
    this.#batch.addEventListener("draft-change", (event) => { event.stopPropagation(); this.#draft = event.detail; });
    this.#batch.addEventListener("values-commit", (event) => {
      event.stopPropagation();
      const { column, value } = event.detail, values = {};
      for (const uid of this.#selection) {
        const row = [...(this.#panel.values[uid] || this.#panel.columns.map(() => null))];
        row.forEach((_, index) => { if (column === "all" || column === index) row[index] = value; }); values[uid] = row;
      }
      if (!this.#emit("rows-change", { values })) event.preventDefault();
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.defaultPrevented && this.#selection.size) {
        event.preventDefault(); event.stopPropagation(); this.clearSelection();
      }
    });
    root.append(style, this.#layout.node);
  }

  set state({ panel, clusters, domain = null, filter = "" }) {
    const changed = this.#panel?.uid !== panel.uid, filtered = this.#filter !== filter;
    if (changed) { this.#selection.clear(); this.#draft = { column: "0", value: "" }; }
    this.#panel = panel; this.#domain = domain; this.#filter = filter;
    this.#selection.prune(new Set(clusters.map(({ uid }) => uid)));
    const scroll = changed || filtered ? 0 : this.#layout.viewport.scrollTop;
    const schema = JSON.stringify([panel.uid, panel.type, panel.columns, domain]);
    if (this.#schema !== schema) { this.#schema = schema; this.#build(); }
    const needle = filter.trim().toLowerCase();
    this.#filtered = clusters.filter(({ uid, name }) => `${name} ${uid}`.toLowerCase().includes(needle));
    this.#layout.viewport.rows = this.#filtered;
    this.#layout.viewport.scrollTop = scroll;
  }

  clearSelection() { this.#selection.clear(); this.#syncSelection(); }
  cancelEdit() { for (const field of this.shadowRoot.querySelectorAll("clinker-editable-field")) field.cancelEdit(); }
  disconnectedCallback() { this.cancelEdit(); }

  #element(name) { return this.ownerDocument.importNode(this.#templates.getElementById(name).content, true).firstElementChild; }
  #emit(type, detail) {
    const accepted = this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: true }));
    if (accepted) for (const menu of this.shadowRoot.querySelectorAll("clinker-action-menu")) menu.open = false;
    return accepted;
  }
  #columns(columns, values) { return this.#emit("columns-change", { columns, ...(values ? { values } : {}) }); }

  #syncSelection() {
    this.#selectionControls.update({ ids: this.#filtered.map(({ uid }) => uid), summary: `${this.#filtered.length.toLocaleString()} visible clusters`, noun: "cluster" });
    if (!this.#table) return;
    const all = this.#table.querySelector("thead input"), selected = this.#filtered.filter(({ uid }) => this.#selection.has(uid)).length;
    all.checked = this.#filtered.length > 0 && selected === this.#filtered.length; all.indeterminate = selected > 0 && !all.checked;
    for (const row of this.#table.querySelectorAll("tbody .cm-data-row")) {
      const checked = this.#selection.has(this.#rowIds.get(row));
      row.classList.toggle("is-selected", checked); row.setAttribute("aria-selected", String(checked)); row.querySelector("input").checked = checked;
    }
  }

  #build() {
    const viewport = this.#layout.viewport, panel = this.#panel, extra = panel.type === "heatmap";
    this.cancelEdit(); viewport.renderer = null;
    this.#table = this.#element("table"); viewport.replaceChildren(this.#table);
    const head = this.#table.querySelector("tr");
    head.querySelector("input").onchange = (event) => { this.#selection.setMany(this.#filtered.map(({ uid }) => uid), event.target.checked); this.#syncSelection(); };
    if (this.#draft.column !== "all" && Number(this.#draft.column) >= panel.columns.length) this.#draft.column = "0";
    if (this.#domain !== null && this.#draft.value !== "" && this.#domain[Number(this.#draft.value)] === undefined) this.#draft.value = "";
    this.#batch.state = { columns: panel.columns, domain: this.#domain, draft: this.#draft };
    panel.columns.forEach((column, index) => {
      const heading = this.#element("column"), field = heading.querySelector("clinker-editable-field"), remove = heading.querySelector("button");
      field.value = column; field.setAttribute("label", `Column ${index + 1} name`);
      field.addEventListener("value-commit", (event) => {
        event.stopPropagation(); const columns = [...this.#panel.columns]; columns[index] = event.detail.value.trim();
        if (!this.#columns(columns)) event.preventDefault();
      });
      if (extra) {
        remove.setAttribute("aria-label", `Remove column ${column}`); remove.disabled = panel.columns.length === 1;
        remove.onclick = () => this.#columns(this.#panel.columns.filter((_, i) => i !== index),
          Object.fromEntries(Object.entries(this.#panel.values).map(([uid, values]) => [uid, values.filter((_, i) => i !== index)])));
      } else remove.remove();
      head.append(heading);
    });
    if (extra) {
      const heading = this.#element("add-column"), form = heading.querySelector("form"), [add, save] = form.querySelectorAll("button"), name = form.querySelector("input");
      add.onclick = () => { add.hidden = true; name.hidden = save.hidden = false; name.focus(); };
      form.onsubmit = (event) => {
        event.preventDefault(); if (!name.value.trim()) return;
        this.#columns([...this.#panel.columns, name.value.trim()], Object.fromEntries(Object.entries(this.#panel.values).map(([uid, values]) => [uid, [...values, null]])));
      };
      name.onkeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); name.hidden = save.hidden = true; add.hidden = false; add.focus(); } };
      head.append(heading);
    }
    viewport.renderer = { container: this.#table.querySelector("tbody"), key: ({ uid }) => uid,
      createRow: (cluster) => this.#createRow(cluster, extra), updateRow: (row, cluster) => this.#updateRow(row, cluster),
      disposeRow: (row) => { for (const field of row.querySelectorAll("clinker-editable-field")) field.cancelEdit(); },
      createSpacer: () => { const row = this.#element("spacer"); row.firstElementChild.colSpan = panel.columns.length + 2 + Number(extra); return row; },
      headerHeight: () => head.offsetHeight, onRender: () => { this.#table.setAttribute("aria-rowcount", this.#filtered.length + 1); this.#syncSelection(); } };
  }

  #createRow(cluster, extra) {
    const row = this.#element("row"), check = row.querySelector("input"), name = row.querySelector("th"); this.#rowIds.set(row, cluster.uid);
    const select = (checked, range) => { this.#selection.select(cluster.uid, checked, { range, orderedIds: this.#filtered.map(({ uid }) => uid) }); this.#syncSelection(); };
    check.onclick = (event) => select(check.checked, event.shiftKey);
    name.onclick = (event) => select(!this.#selection.has(cluster.uid), event.shiftKey);
    this.#panel.columns.forEach((_, index) => {
      const cell = this.#element("cell"), field = cell.firstElementChild;
      if (this.#domain === null) field.setAttribute("type", "number");
      else field.options = [["", "Missing"], ...this.#domain.map((name, i) => [String(i), name])];
      field.addEventListener("value-commit", (event) => {
        event.stopPropagation(); const values = [...(this.#panel.values[cluster.uid] || this.#panel.columns.map(() => null))], value = event.detail.value;
        values[index] = value === "" ? null : this.#domain === null ? Number(value) : this.#domain[Number(value)];
        if (!this.#emit("rows-change", { values: { [cluster.uid]: values } })) event.preventDefault();
      });
      row.append(cell);
    });
    if (extra) row.append(this.#element("empty-cell"));
    return this.#updateRow(row, cluster);
  }

  #updateRow(row, cluster) {
    const label = cluster.name || cluster.uid, name = row.querySelector("th"); name.textContent = label; name.title = cluster.uid;
    row.querySelector("input").setAttribute("aria-label", `Select ${label}`);
    [...row.querySelectorAll("clinker-editable-field")].forEach((field, index) => {
      const value = this.#panel.values[cluster.uid]?.[index] ?? null;
      field.setAttribute("label", `${label}: ${this.#panel.columns[index]}`);
      field.value = this.#domain === null ? value : value === null ? "" : String(this.#domain.indexOf(value));
    });
    return row;
  }
}

function defineAnnotationTable() {
  defineEditableField(); defineSelectionBar(); defineActionMenu(); defineDataTable(); defineAnnotationValueActions();
  if (!customElements.get("clinker-annotation-table")) customElements.define("clinker-annotation-table", AnnotationTable);
}

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

function createAnnotationCreateControls({ document, getData, patch, onCreate, annotationApi }) {
  defineAnnotationDataForm();
  const node = document.createElement("clinker-annotation-data-form");
  node.clusters = getData().clusters;
  const run = createActionRunner((message) => { node.error = message; });
  node.addEventListener("data-submit", (event) => {
    run(() => {
      const { type, title, scale, data } = event.detail;
      const raw = data.trim();
      const contents = type === "groups" ? { groups: JSON.parse(raw).groups } : parseAnnotationTable(raw, scale === "categorical");
      const ids = new Set((getData()?.annotationPanels || []).map((panel) => panel.uid));
      let serial = 1;
      while (ids.has(`${type}-${serial}`)) serial++;
      const panel = { uid: `${type}-${serial}`, type,
        title: title.trim() || (type === "groups" ? "Groups" : type === "bar" ? "Bar chart" : "Heatmap"),
        ...contents, ...(type === "groups" ? {} : { scale: { type: scale } }) };
      annotationApi.validateAnnotationPanels([panel], getData().clusters, { tree: getData().tree });
      patch([{ type: "annotationPanels.create", panel }]);
      onCreate(panel.uid);
    });
  });
  return { node };
}

const editorTemplate = createTemplate(`<div class="cm-data-ui cm-annotation-data-editor" tabindex="-1">
  <clinker-annotation-toolbar>
    <clinker-search-field label="Filter records" placeholder="Find a cluster"></clinker-search-field>
  </clinker-annotation-toolbar>
  <div class="cm-data-error" data-data-error role="alert"></div><div class="cm-annotation-data-body"></div>
</div>`);
const matrixTemplate = createTemplate('<clinker-annotation-table></clinker-annotation-table>');
const categoriesTemplate = createTemplate('<clinker-category-editor class="cm-annotation-categories"></clinker-category-editor>');
const replacementTemplate = createTemplate('<clinker-annotation-data-form mode="replace" hidden></clinker-annotation-data-form>');
const groupsTemplate = createTemplate('<clinker-annotation-group-editor></clinker-annotation-group-editor>');
const emptyTemplate = createTemplate('<p>No annotation panels. Add a panel to attach data to cluster rows.</p>');

/** Data editing is optional UI; every change goes through the chart's patch API. */
function createAnnotationDataControls({ document, getData, getClusters = () => getData().clusters, patch, annotationApi, embedded = false }) {
  defineSearchField(); defineCategoryEditor(); defineAnnotationToolbar(); defineAnnotationDataForm(); defineAnnotationGroupEditor(); defineDataTable(); defineAnnotationTable();
  installDataEditorStyle(document); installStyle(document);
  const { resolveAnnotationScale, ANNOTATION_PALETTES } = annotationApi;
  const node = editorTemplate(document).firstElementChild, toolbar = node.querySelector("clinker-annotation-toolbar");
  const body = node.querySelector(".cm-annotation-data-body"), status = node.querySelector("[data-data-error]");
  if (embedded) { toolbar.setAttribute("embedded", ""); toolbar.querySelector("clinker-search-field").remove(); toolbar.remove(); }
  let selected = null, applying = false, renderedPanel = null, renderedPanels = null, renderedClusters = null;
  let filter = "", creating = false, view = null, viewKey = null;
  const getPanels = () => getData()?.annotationPanels || [];
  const current = () => getPanels().find((panel) => panel.uid === selected);
  const error = (message) => { status.textContent = message; };
  const run = createActionRunner(error);
  const commit = (operations) => {
    applying = true;
    try { return run(() => {
      patch(operations);
      render();
    }); } finally { applying = false; }
  };
  const update = (changes) => commit([{ type: "annotationPanels.update", ids: [selected], changes }]);
  const categoryScale = (panel, domain, colours) => ({ ...panel.scale, type: "categorical", domain,
    colours: colours.length ? colours : [...ANNOTATION_PALETTES.Qualitative] });
  const clearSelection = () => view?.matrix?.clearSelection();
  toolbar.addEventListener("panel-change", (event) => { selected = event.detail.value; creating = false; render(); });
  toolbar.addEventListener("panel-action", (event) => {
    const { action } = event.detail;
    if (action === "add") { creating = !creating; render(); }
    else if (action === "replace") view?.replace?.();
    else if (action === "show") update({ show: current().show === false });
    else if (action === "remove") commit([{ type: "annotationPanels.delete", ids: [selected] }]);
    else if (action === "left" || action === "right") {
      const ids = getPanels().map((panel) => panel.uid), index = ids.indexOf(selected), next = index + (action === "left" ? -1 : 1);
      if (index < 0 || next < 0 || next >= ids.length) return;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      commit([{ type: "annotationPanels.reorder", ids }]);
    }
  });
  const search = !embedded && toolbar.querySelector("clinker-search-field");
  if (search) search.addEventListener("input", () => { filter = search.value; view?.update(); });
  const disposeView = () => { view?.matrix?.cancelEdit(); view?.categories?.cancelEdit(); view?.groups?.cancelEdit(); };

  function createMatrix(parent) {
    const matrix = matrixTemplate(document).firstElementChild; parent.append(matrix);
    matrix.addEventListener("columns-change", (event) => { if (update(event.detail) === false) event.preventDefault(); });
    matrix.addEventListener("rows-change", (event) => {
      const panel = current(), categorical = panel.scale?.type === "categorical", scale = resolveAnnotationScale(panel);
      if (commit([
        ...(categorical && !panel.scale?.domain ? [{ type: "annotationPanels.update", ids: [selected],
          changes: { scale: categoryScale(panel, scale.domain, scale.domain.map(scale.colour)) } }] : []),
        { type: "annotationPanels.updateRows", uid: selected, values: event.detail.values },
      ]) === false) event.preventDefault();
    });
    return { matrix, update() {
      const panel = current();
      matrix.state = { panel, clusters: getClusters(), filter, domain: panel.scale?.type === "categorical" ? resolveAnnotationScale(panel).domain : null };
    } };
  }

  function createReplacement(parent) {
    const box = replacementTemplate(document).firstElementChild; box.slot = "tools"; parent.append(box);
    box.addEventListener("data-submit", (event) => { try {
      const source = current(), categorical = source.scale?.type === "categorical", changes = parseAnnotationTable(event.detail.data, categorical);
      if (categorical) {
        const scale = resolveAnnotationScale(source), domain = new Set(scale.domain);
        for (const row of Object.values(changes.values)) for (const value of row) if (value !== null) domain.add(value);
        const categories = [...domain]; changes.scale = categoryScale(source, categories, categories.map((value, i) =>
          scale.domain.includes(value) ? scale.colour(value) : ANNOTATION_PALETTES.Qualitative[i % ANNOTATION_PALETTES.Qualitative.length]));
      }
      if (update(changes)) box.hidden = true;
    } catch (exception) { box.error = exception.message; } });
    box.addEventListener("data-cancel", () => { box.hidden = true; });
    return () => {
      box.hidden = !box.hidden;
      if (!box.hidden) { box.value = { data: annotationTableText(current(), getClusters()) }; box.error = ""; box.focus(); }
    };
  }

  function createGroups(parent) {
    const groups = groupsTemplate(document).firstElementChild; parent.append(groups);
    groups.addEventListener("value-commit", (event) => {
      if (update({ groups: event.detail.value }) === false) event.preventDefault();
    });
    return { groups, update() { groups.state = { groups: current().groups, colour: current().colour, clusters: getClusters(), tree: getData().tree }; } };
  }

  function render() {
    const panels = getPanels();
    if (!panels.some((panel) => panel.uid === selected)) selected = panels[0]?.uid ?? null;
    const panel = current(); renderedPanel = panel; renderedPanels = panels; renderedClusters = getClusters();
    toolbar.state = { panels, value: selected, creating };
    if (search) { search.hidden = !panel || creating || panel.type === "groups"; search.value = filter; }
    const categorical = panel?.scale?.type === "categorical";
    const key = creating ? "create" : panel ? JSON.stringify([panel.uid, panel.type]) : "empty";
    if (key !== viewKey) {
      disposeView(); body.replaceChildren(); view = null; viewKey = key;
      if (creating) body.append(createAnnotationCreateControls({ document, getData, patch, annotationApi,
        onCreate: (uid) => { selected = uid; creating = false; render(); } }).node);
      else if (!panel) body.append(emptyTemplate(document));
      else {
        if (panel.type === "groups") {
          const layout = createDataPanel(document, { label: "Editable annotation data" }); layout.meta.hidden = true;
          body.append(layout.node); view = createGroups(layout.viewport);
        } else {
          view = createMatrix(body); view.replace = createReplacement(view.matrix);
        }
      }
    }
    view?.update();
    if (view?.matrix && categorical && !view.categories) {
      view.categoryKey = null;
      view.categories = categoriesTemplate(document).firstElementChild; view.categories.slot = "tools"; view.matrix.prepend(view.categories);
      view.categories.palette = ANNOTATION_PALETTES.Qualitative;
      view.categories.addEventListener("value-commit", (event) => {
        const { value, replacements } = event.detail, mapping = new Map(replacements);
        const changes = { scale: categoryScale(current(), value.map(({ name }) => name), value.map(({ colour }) => colour)) };
        if (mapping.size) changes.values = mapAnnotationValues(current().values, (item) => mapping.has(item) ? mapping.get(item) : item);
        if (update(changes) === false) event.preventDefault();
      });
    } else if (!categorical && view?.categories) {
      view.categories.cancelEdit(); view.categories.remove(); view.categories = null;
    }
    if (view?.categories) {
      const key = JSON.stringify(panel.scale);
      if (key !== view.categoryKey) {
        const { domain, colour } = resolveAnnotationScale(panel);
        view.categories.value = domain.map((name) => ({ name, colour: colour(name) })); view.categoryKey = key;
      }
    }
  }
  render();
  return { node, toolbar, select(uid) { selected = uid; creating = false; render(); }, clearSelection,
    get filter() { return filter; }, setFilter(value) { filter = value; view?.update(); },
    invalidate({ replace = false } = {}) {
      renderedPanel = renderedPanels = renderedClusters = null;
      if (replace) { disposeView(); view = null; viewKey = null; selected = null; }
    },
    destroy() { disposeView(); toolbar.remove(); },
    update() { if (!applying && (current() !== renderedPanel || getPanels() !== renderedPanels || getClusters() !== renderedClusters)) render(); } };
}
function installStyle(document) {
  if (document.getElementById("cm-annotation-data-style")) return;
  const style = document.createElement("style"); style.id = "cm-annotation-data-style";
  style.textContent = `
@layer clinker-editor {
.cm-annotation-data-editor { --cm-control-height:30px; --cm-control-padding:4px 8px; --cm-control-radius:6px; outline:none; display:flex; flex-direction:column; gap:8px; min-height:0; }
.cm-annotation-data-body { display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden; }
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
    const sameValueRules = before?.columns?.length === panel.columns.length &&
      (oldScale.type ?? "continuous") === type && (type !== "categorical" || sameCategories);
    if (before?.values === panel.values && sameValueRules) continue;
    clusterIds ??= new Set(clusters.map((cluster) => cluster.uid));
    const categories = type === "categorical" && scale.domain ? new Set(scale.domain) : null;
    for (const [uid, values] of Object.entries(panel.values)) {
      if (!clusterIds.has(uid)) fail(`unknown cluster '${uid}'.`);
      if (sameValueRules && before.values[uid] === values) continue;
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

const palettes$1 = {
  light: { mode: "light", background: "#ffffff", foreground: "#20252c", muted: "#687586",
    branch: "#555555", guide: "#999999", outline: "#111111", surface: "#ffffff", border: "#cbd3de", missing: "#eeeeee", subtle: "#f3f6fa", hover: "#e3ecf8", selection: "#d6e6fc", accent: "#1677ff", danger: "#b42318" },
  dark: { mode: "dark", background: "#171b22", foreground: "#e5eaf1", muted: "#a0adbd",
    branch: "#bac4d1", guide: "#748193", outline: "#c9d2df", surface: "#232a35", border: "#465365", missing: "#39414e", subtle: "#293241", hover: "#354660", selection: "#3a5276", accent: "#85b7ff", danger: "#ffaaa3" },
};

function resolveTheme(mode = "auto") {
  const dark = mode === "dark" || mode === "auto" && globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return palettes$1[dark ? "dark" : "light"];
}

/** Figure colours are independent of the interface/system theme. */
function figureConfig(config) {
  if (config.figureStyle) return config;
  const theme = { background: config.plot?.background ?? "#ffffff", foreground: "#000000",
    outline: "#000000", branch: "#555555", guide: "#999999",
    muted: "#687586", missing: "#eeeeee" };
  return { ...config, figureStyle: theme,
    tree: { ...config.tree, textColour: theme.foreground,
      branch: { ...config.tree?.branch, colour: config.tree?.branch?.colour ?? theme.branch },
      leafGuide: { ...config.tree?.leafGuide, colour: config.tree?.leafGuide?.colour ?? theme.guide } },
    gene: { ...config.gene, shape: { ...config.gene?.shape, stroke: config.gene?.shape?.stroke ?? theme.outline } },
    locus: { ...config.locus, trackBar: { ...config.locus?.trackBar, colour: config.locus?.trackBar?.colour ?? theme.outline } },
    scaleBar: { ...config.scaleBar, colour: config.scaleBar?.colour ?? theme.foreground },
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

const rowTemplates = createTemplate(await "<template id=\"groups\">\n  <div class=\"cm-data-row cm-editor__row cm-editor__row--groups\">\n    <span class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></span>\n    <button type=\"button\" class=\"cm-data-icon-button cm-editor__reorder\" draggable=\"true\" data-reorder>⠿</button>\n    <clinker-editable-field class=\"cm-data-cell\" data-type=\"groups\" data-field=\"label\" label=\"Group name\" placeholder=\"Group name\"></clinker-editable-field>\n    <clinker-editable-field class=\"cm-data-cell\" data-type=\"groups\" data-field=\"subtitle\" label=\"Legend label\" placeholder=\"Add subtitle…\"></clinker-editable-field>\n    <span class=\"cm-data-cell\" data-count></span>\n    <button type=\"button\" class=\"cm-data-icon-button cm-editor__visibility\" data-visible>\n      <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\">\n        <path d=\"M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z\"></path>\n        <circle cx=\"12\" cy=\"12\" r=\"2.75\"></circle><path data-slash d=\"m4 4 16 16\"></path>\n      </svg>\n    </button>\n    <span class=\"cm-data-cell\"><input type=\"color\" data-colour aria-label=\"Colour\"></span>\n  </div>\n</template>\n\n<template id=\"links\">\n  <div class=\"cm-data-row cm-editor__row cm-editor__row--links\">\n    <span class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></span>\n    <span class=\"cm-data-cell\" data-text=\"source\"></span>\n    <span class=\"cm-data-cell\" data-text=\"target\"></span>\n    <clinker-editable-field class=\"cm-data-cell\" data-type=\"links\" data-field=\"identity\" label=\"Identity\" type=\"number\" min=\"0\" max=\"100\" step=\"any\" required></clinker-editable-field>\n    <span class=\"cm-data-cell\" data-text=\"groups\"></span>\n    <clinker-editable-field class=\"cm-data-cell\" data-type=\"links\" data-field=\"label\" label=\"Link label\" placeholder=\"Add label…\"></clinker-editable-field>\n    <button type=\"button\" class=\"cm-data-icon-button cm-editor__visibility\" data-visible>\n      <svg aria-hidden=\"true\" viewBox=\"0 0 24 24\">\n        <path d=\"M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6Z\"></path>\n        <circle cx=\"12\" cy=\"12\" r=\"2.75\"></circle><path data-slash d=\"m4 4 16 16\"></path>\n      </svg>\n    </button>\n    <span class=\"cm-data-cell\"><input type=\"color\" data-colour aria-label=\"Colour\"></span>\n  </div>\n</template>\n\n<template id=\"genes\">\n  <div class=\"cm-data-row cm-editor__row cm-editor__row--genes\">\n    <span class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></span>\n    <clinker-editable-field class=\"cm-data-cell\" data-type=\"genes\" data-field=\"label\" label=\"Gene label\" placeholder=\"Gene label\"></clinker-editable-field>\n    <span class=\"cm-data-cell\" data-text=\"locus\"></span>\n    <span class=\"cm-data-cell\" data-text=\"cluster\"></span>\n    <span class=\"cm-data-cell\" data-text=\"group\"></span>\n    <span class=\"cm-data-cell\"><input type=\"color\" data-colour aria-label=\"Colour\"></span>\n  </div>\n</template>\n\n<template id=\"gene\">\n  <div class=\"cm-data-row cm-editor__tree-row cm-editor__tree-gene\">\n    <span class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></span>\n    <span aria-hidden=\"true\"></span>\n    <clinker-editable-field class=\"cm-data-cell\" data-type=\"genes\" data-field=\"label\" label=\"Gene label\" placeholder=\"Gene label\"></clinker-editable-field>\n    <span class=\"cm-data-cell\" data-text=\"group\"></span>\n    <span class=\"cm-data-cell\"><input type=\"color\" data-colour aria-label=\"Colour\"></span>\n  </div>\n</template>\n\n<template id=\"cluster\">\n  <div class=\"cm-data-row cm-editor__tree-row cm-editor__tree-parent\">\n    <span class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></span>\n    <button type=\"button\" class=\"cm-data-icon-button cm-editor__tree-toggle\" data-tree-toggle></button>\n    <span class=\"cm-editor__tree-name-with-count\">\n      <clinker-editable-field class=\"cm-data-cell\" data-type=\"clusters\" data-field=\"name\" label=\"Cluster name\" placeholder=\"Cluster name\" compact required></clinker-editable-field>\n      <span class=\"cm-editor__tree-count\"></span>\n      <button type=\"button\" class=\"cm-data-icon-button\" data-remove-record>×</button>\n    </span>\n  </div>\n</template>\n\n<template id=\"locus\">\n  <div class=\"cm-data-row cm-editor__tree-row cm-editor__tree-parent\">\n    <span class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></span>\n    <button type=\"button\" class=\"cm-data-icon-button cm-editor__tree-toggle\" data-tree-toggle></button>\n    <span class=\"cm-editor__tree-name-with-count\">\n      <clinker-editable-field class=\"cm-data-cell\" data-type=\"loci\" data-field=\"name\" label=\"Locus name\" placeholder=\"Locus name\" compact required></clinker-editable-field>\n      <span class=\"cm-editor__tree-count\"></span>\n      <button type=\"button\" class=\"cm-data-icon-button\" data-remove-record>×</button>\n    </span>\n  </div>\n</template>\n\n<template id=\"cluster-locus\">\n  <div class=\"cm-data-row cm-editor__tree-row cm-editor__tree-parent\">\n    <span class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></span>\n    <button type=\"button\" class=\"cm-data-icon-button cm-editor__tree-toggle\" data-tree-toggle></button>\n    <div class=\"cm-editor__tree-combined\">\n      <clinker-editable-field class=\"cm-data-cell\" data-type=\"clusters\" data-field=\"name\" label=\"Cluster name\" placeholder=\"Cluster name\" compact required></clinker-editable-field>\n      <span class=\"cm-editor__tree-separator\">·</span>\n      <clinker-editable-field class=\"cm-data-cell\" data-type=\"loci\" data-field=\"name\" label=\"Locus name\" placeholder=\"Locus name\" compact required></clinker-editable-field>\n      <span class=\"cm-editor__tree-count\"></span>\n      <button type=\"button\" class=\"cm-data-icon-button\" data-remove-record>×</button>\n    </div>\n  </div>\n</template>\n\n<template id=\"gene-group\">\n  <div class=\"cm-data-row cm-editor__tree-row cm-editor__tree-parent\">\n    <span class=\"cm-data-cell cm-data-cell--select\"><input type=\"checkbox\"></span>\n    <button type=\"button\" class=\"cm-data-icon-button cm-editor__tree-toggle\" data-tree-toggle></button>\n    <span class=\"cm-data-cell cm-editor__tree-group-label\"><span data-text=\"label\"></span> <span class=\"cm-editor__tree-count\"></span></span>\n  </div>\n</template>\n");
const definitions = new WeakMap();

/** Stable rows assembled from HTML templates; fields own their editing behavior. */
function createEditorRow(document, kind, type, change) {
  if (!definitions.has(document)) definitions.set(document, rowTemplates(document));
  const template = definitions.get(document).getElementById(type || kind);
  const node = document.importNode(template.content, true).firstElementChild;
  const parent = type && type !== "gene";
  const check = node.querySelector('[type="checkbox"]'), swatch = node.querySelector('[type="color"]');
  const visible = node.querySelector("[data-visible]"), arrow = node.querySelector("[data-tree-toggle]");
  const remove = node.querySelector("[data-remove-record]"), count = node.querySelector("[data-count], .cm-editor__tree-count");
  const reorder = node.querySelector("[data-reorder]"), fields = [...node.querySelectorAll("clinker-editable-field")];
  const texts = [...node.querySelectorAll("[data-text]")];
  for (const field of fields) field.addEventListener("value-commit", (event) => {
    const { type, id, field: name } = field.dataset;
    const value = name === "identity" ? Number(event.detail.value) / 100 : event.detail.value.trim();
    if (change(type, id, { [name]: value }, field) === false) event.preventDefault();
  });
  return { node, update(row, selection) {
    const selected = parent ? row.selectIds.length > 0 && row.selectIds.every((id) => selection.has(id)) : selection.has(row.id);
    node.classList.toggle("is-selected", selected);
    node.style.setProperty("--depth", row.depth || 0);
    check.checked = selected;
    check.setAttribute("aria-label", parent ? `Select ${row.count.toLocaleString()} genes in ${row.label}` : `Select ${row.label || row.source}`);
    if (parent) {
      node.dataset.selectIds = JSON.stringify(row.selectIds);
      check.dataset.selectRow = row.key;
      check.indeterminate = !selected && row.selectIds.some((id) => selection.has(id));
      check.setAttribute("aria-checked", check.indeterminate ? "mixed" : String(selected));
      arrow.dataset.treeToggle = row.key; arrow.textContent = row.open ? "▾" : "▸";
      arrow.setAttribute("aria-label", row.open ? "Collapse" : "Expand"); arrow.title = row.open ? "Collapse" : "Expand";
    } else {
      node.dataset.id = row.id; check.dataset.select = row.id;
    }
    for (const field of fields) {
      const record = field.dataset.type === "clusters" ? row.cluster : field.dataset.type === "loci" ? row.locus : null;
      field.dataset.id = record?.uid ?? row.id;
      field.value = field.dataset.field === "name"
        ? type === "cluster-locus" && field.dataset.type === "loci" ? row.locusLabel : row.label
        : row[field.dataset.field];
    }
    for (const text of texts) text.title = text.textContent = row[text.dataset.text] ?? "";
    if (count) count.textContent = parent ? `(${row.count.toLocaleString()})` : `${row.count.toLocaleString()} genes`;
    if (swatch) { swatch.dataset.type = kind; swatch.dataset.id = row.id; swatch.value = colourHex(row.colour); }
    if (visible) {
      const label = row.hidden ? "Show" : "Hide";
      Object.assign(visible.dataset, { type: kind, id: row.id, hidden: String(row.hidden) });
      visible.title = label; visible.setAttribute("aria-label", label); visible.querySelector("[data-slash]").style.display = row.hidden ? "" : "none";
    }
    if (reorder) {
      reorder.dataset.reorder = row.id;
      reorder.setAttribute("aria-label", `Reorder ${row.label}; use Arrow Up or Arrow Down to move it`);
      reorder.title = "Drag to reorder; Arrow Up or Arrow Down moves one place";
    }
    if (remove) {
      const cluster = type === "cluster" || type === "cluster-locus";
      remove.dataset.removeRecord = cluster ? "clusters" : "loci"; remove.dataset.id = row[cluster ? "cluster" : "locus"].uid;
      remove.title = `Remove ${cluster ? "cluster" : "locus"} from plot`; remove.setAttribute("aria-label", remove.title);
    }
    return node;
  }, destroy() { for (const field of fields) field.cancelEdit(); } };
}

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

const [markup$4, controls$2, css$4] = await Promise.all([
  "<div class=\"toolbar\"><clinker-search-field data-appearance-filter label=\"Find an appearance setting\" placeholder=\"Find a setting\"></clinker-search-field></div>\n<div class=\"settings\">\n  <fieldset>\n    <legend>Plot</legend>\n    <label><span>Interface theme</span><select data-config=\"plot.theme\" aria-label=\"Interface theme\"><option value=\"auto\">auto</option><option value=\"light\">light</option><option value=\"dark\">dark</option></select></label>\n    <label><span>Figure background</span><input type=\"color\" data-config=\"plot.background\" aria-label=\"Figure background\"></label>\n  </fieldset>\n  <fieldset>\n    <legend>Annotations</legend>\n    <label><span>Enable annotation panels</span><input type=\"checkbox\" data-config=\"annotations.enabled\" aria-label=\"Enable annotation panels\"></label>\n  </fieldset>\n  <fieldset>\n    <legend>Legend</legend>\n    <label><span>Show legend</span><input type=\"checkbox\" data-config=\"legend.show\" aria-label=\"Show legend\"></label>\n    <label><span>Position</span><select data-config=\"legend.position\" aria-label=\"Position\"><option value=\"right\">right</option><option value=\"bottom\">bottom</option></select></label>\n    <label><span>Columns</span><input type=\"number\" step=\"any\" data-config=\"legend.columns\" aria-label=\"Columns\"></label>\n    <details data-appearance-section=\"legend\">\n      <summary>Advanced</summary>\n      <label><span>Column width</span><input type=\"number\" step=\"any\" data-config=\"legend.columnWidth\" aria-label=\"Column width\"></label>\n      <label><span>Entry height</span><input type=\"number\" step=\"any\" data-config=\"legend.entryHeight\" aria-label=\"Entry height\"></label>\n      <label><span>Font size</span><input type=\"number\" step=\"any\" data-config=\"legend.fontSize\" aria-label=\"Font size\"></label>\n      <label><span>Subtitle size</span><input type=\"number\" step=\"any\" data-config=\"legend.subtitleFontSize\" aria-label=\"Subtitle size\"></label>\n      <label><span>Left margin</span><input type=\"number\" step=\"any\" data-config=\"legend.marginLeft\" aria-label=\"Left margin\"></label>\n      <label><span>Top margin</span><input type=\"number\" step=\"any\" data-config=\"legend.marginTop\" aria-label=\"Top margin\"></label>\n    </details>\n  </fieldset>\n  <fieldset>\n    <legend>Links</legend>\n    <label><span>Show links</span><input type=\"checkbox\" data-config=\"link.show\" aria-label=\"Show links\"></label>\n    <label><span>Draw as lines</span><input type=\"checkbox\" data-config=\"link.asLine\" aria-label=\"Draw as lines\"></label>\n    <label><span>Best match only</span><input type=\"checkbox\" data-config=\"link.bestOnly\" aria-label=\"Best match only\"></label>\n    <label><span>Minimum identity</span><input type=\"number\" step=\"any\" data-config=\"link.threshold\" aria-label=\"Minimum identity\"></label>\n    <details data-appearance-section=\"links\">\n      <summary>Advanced</summary>\n      <label><span>Straight links</span><input type=\"checkbox\" data-config=\"link.straight\" aria-label=\"Straight links\"></label>\n      <label><span>Use group colour</span><input type=\"checkbox\" data-config=\"link.groupColour\" aria-label=\"Use group colour\"></label>\n      <label><span>Stroke width</span><input type=\"number\" step=\"any\" data-config=\"link.strokeWidth\" aria-label=\"Stroke width\"></label>\n    </details>\n  </fieldset>\n  <fieldset>\n    <legend>Link labels</legend>\n    <label><span>Show link labels</span><input type=\"checkbox\" data-config=\"link.label.show\" aria-label=\"Show link labels\"></label>\n    <details data-appearance-section=\"link-labels\">\n      <summary>Advanced</summary>\n      <label><span>Label background</span><input type=\"checkbox\" data-config=\"link.label.background\" aria-label=\"Label background\"></label>\n      <label><span>Font size</span><input type=\"number\" step=\"any\" data-config=\"link.label.fontSize\" aria-label=\"Font size\"></label>\n      <label><span>Position</span><input type=\"number\" step=\"any\" data-config=\"link.label.position\" aria-label=\"Position\"></label>\n    </details>\n  </fieldset>\n  <fieldset>\n    <legend>Tree</legend>\n    <label><span>Show tree</span><input type=\"checkbox\" data-config=\"tree.show\" aria-label=\"Show tree\"></label>\n    <label><span>Tree width</span><input type=\"number\" step=\"any\" data-config=\"tree.width\" aria-label=\"Tree width\"></label>\n    <label><span>Use branch lengths</span><input type=\"checkbox\" data-config=\"tree.useBranchLengths\" aria-label=\"Use branch lengths\"></label>\n    <label><span>Branch stroke width</span><input type=\"number\" step=\"any\" data-config=\"tree.branch.width\" aria-label=\"Branch stroke width\"></label>\n    <label><span>Branch colour</span><input type=\"color\" data-config=\"tree.branch.colour\" aria-label=\"Branch colour\"></label>\n    <label><span>Show support values</span><input type=\"checkbox\" data-config=\"tree.support.show\" aria-label=\"Show support values\"></label>\n    <label><span>Show tree scale bar</span><input type=\"checkbox\" data-config=\"tree.scaleBar.show\" aria-label=\"Show tree scale bar\"></label>\n    <label><span>Show dashed leaf guides</span><input type=\"checkbox\" data-config=\"tree.leafGuide.show\" aria-label=\"Show dashed leaf guides\"></label>\n    <details data-appearance-section=\"tree\">\n      <summary>Advanced</summary>\n      <label><span>Support font size</span><input type=\"number\" step=\"any\" data-config=\"tree.support.fontSize\" aria-label=\"Support font size\"></label>\n      <label><span>Support precision</span><input type=\"number\" step=\"any\" data-config=\"tree.support.precision\" aria-label=\"Support precision\"></label>\n      <label><span>Leaf guide colour</span><input type=\"color\" data-config=\"tree.leafGuide.colour\" aria-label=\"Leaf guide colour\"></label>\n      <label><span>Leaf guide width</span><input type=\"number\" step=\"any\" data-config=\"tree.leafGuide.width\" aria-label=\"Leaf guide width\"></label>\n      <label><span>Leaf guide dash pattern</span><input type=\"text\" data-config=\"tree.leafGuide.dash\" aria-label=\"Leaf guide dash pattern\"></label>\n    </details>\n  </fieldset>\n  <fieldset>\n    <legend>Clusters &amp; loci</legend>\n    <label><span>Align cluster labels</span><input type=\"checkbox\" data-config=\"cluster.alignLabels\" aria-label=\"Align cluster labels\"></label>\n    <label><span>Hide locus coordinates</span><input type=\"checkbox\" data-config=\"cluster.hideLocusCoordinates\" aria-label=\"Hide locus coordinates\"></label>\n    <label><span>Show trim indicators</span><input type=\"checkbox\" data-config=\"locus.trimIndicators.show\" aria-label=\"Show trim indicators\"></label>\n    <label><span>Cluster spacing</span><input type=\"number\" step=\"any\" data-config=\"cluster.spacing\" aria-label=\"Cluster spacing\"></label>\n    <label><span>Locus spacing</span><input type=\"number\" step=\"any\" data-config=\"locus.spacing\" aria-label=\"Locus spacing\"></label>\n    <details data-appearance-section=\"clusters-loci\">\n      <summary>Advanced</summary>\n      <label><span>Cluster name size</span><input type=\"number\" step=\"any\" data-config=\"cluster.nameFontSize\" aria-label=\"Cluster name size\"></label>\n      <label><span>Locus label size</span><input type=\"number\" step=\"any\" data-config=\"cluster.lociFontSize\" aria-label=\"Locus label size\"></label>\n      <label><span>Trim indicator size</span><input type=\"number\" step=\"any\" data-config=\"locus.trimIndicators.fontSize\" aria-label=\"Trim indicator size\"></label>\n      <label><span>Trim indicator weight</span><input type=\"number\" step=\"any\" data-config=\"locus.trimIndicators.fontWeight\" aria-label=\"Trim indicator weight\"></label>\n      <label><span>Trim indicator border</span><input type=\"number\" step=\"any\" data-config=\"locus.trimIndicators.borderWidth\" aria-label=\"Trim indicator border\"></label>\n      <label><span>Trim indicator border opacity</span><input type=\"number\" step=\"any\" data-config=\"locus.trimIndicators.borderOpacity\" aria-label=\"Trim indicator border opacity\"></label>\n      <label><span>Track colour</span><input type=\"color\" data-config=\"locus.trackBar.colour\" aria-label=\"Track colour\"></label>\n      <label><span>Track stroke</span><input type=\"number\" step=\"any\" data-config=\"locus.trackBar.stroke\" aria-label=\"Track stroke\"></label>\n    </details>\n  </fieldset>\n  <fieldset>\n    <legend>Genes</legend>\n    <label><span>Show gene labels</span><input type=\"checkbox\" data-config=\"gene.label.show\" aria-label=\"Show gene labels\"></label>\n    <label><span>Label field</span><select data-config=\"gene.label.name\" aria-label=\"Label field\"><option value=\"uid\">uid</option><option value=\"name\">name</option><option value=\"label\">label</option></select></label>\n    <label><span>Label position</span><select data-config=\"gene.label.position\" aria-label=\"Label position\"><option value=\"top\">top</option><option value=\"bottom\">bottom</option></select></label>\n    <details data-appearance-section=\"genes\">\n      <summary>Advanced</summary>\n      <label><span>Label anchor</span><select data-config=\"gene.label.anchor\" aria-label=\"Label anchor\"><option value=\"start\">start</option><option value=\"middle\">middle</option><option value=\"end\">end</option></select></label>\n      <label><span>Label size</span><input type=\"number\" step=\"any\" data-config=\"gene.label.fontSize\" aria-label=\"Label size\"></label>\n      <label><span>Label rotation</span><input type=\"number\" step=\"any\" data-config=\"gene.label.rotation\" aria-label=\"Label rotation\"></label>\n      <label><span>Label spacing</span><input type=\"number\" step=\"any\" data-config=\"gene.label.spacing\" aria-label=\"Label spacing\"></label>\n      <label><span>Label start</span><input type=\"number\" step=\"any\" data-config=\"gene.label.start\" aria-label=\"Label start\"></label>\n      <label><span>Body height</span><input type=\"number\" step=\"any\" data-config=\"gene.shape.bodyHeight\" aria-label=\"Body height\"></label>\n      <label><span>Tip height</span><input type=\"number\" step=\"any\" data-config=\"gene.shape.tipHeight\" aria-label=\"Tip height\"></label>\n      <label><span>Tip length</span><input type=\"number\" step=\"any\" data-config=\"gene.shape.tipLength\" aria-label=\"Tip length\"></label>\n      <label><span>Stroke colour</span><input type=\"color\" data-config=\"gene.shape.stroke\" aria-label=\"Stroke colour\"></label>\n      <label><span>Stroke width</span><input type=\"number\" step=\"any\" data-config=\"gene.shape.strokeWidth\" aria-label=\"Stroke width\"></label>\n    </details>\n  </fieldset>\n  <fieldset>\n    <legend>Scale bars</legend>\n    <label><span>Show scale bar</span><input type=\"checkbox\" data-config=\"scaleBar.show\" aria-label=\"Show scale bar\"></label>\n    <label><span>Base pairs</span><input type=\"number\" step=\"any\" data-config=\"scaleBar.basePair\" aria-label=\"Base pairs\"></label>\n    <label><span>Show identity bar</span><input type=\"checkbox\" data-config=\"colourBar.show\" aria-label=\"Show identity bar\"></label>\n    <label><span>Minimum source</span><select data-config=\"colourBar.domain.minMode\" aria-label=\"Minimum source\"><option value=\"fixed\">Custom value</option><option value=\"data\">Lowest identity in data</option></select></label>\n    <label><span>Minimum identity</span><input type=\"number\" step=\"any\" data-config=\"colourBar.domain.min\" aria-label=\"Minimum identity\"></label>\n    <label><span>Maximum source</span><select data-config=\"colourBar.domain.maxMode\" aria-label=\"Maximum source\"><option value=\"fixed\">Custom value</option><option value=\"data\">Highest identity in data</option></select></label>\n    <label><span>Maximum identity</span><input type=\"number\" step=\"any\" data-config=\"colourBar.domain.max\" aria-label=\"Maximum identity\"></label>\n    <details data-appearance-section=\"scale-bars\">\n      <summary>Advanced</summary>\n      <label><span>Height</span><input type=\"number\" step=\"any\" data-config=\"scaleBar.height\" aria-label=\"Height\"></label>\n      <label><span>Font size</span><input type=\"number\" step=\"any\" data-config=\"scaleBar.fontSize\" aria-label=\"Font size\"></label>\n      <label><span>Stroke</span><input type=\"number\" step=\"any\" data-config=\"scaleBar.stroke\" aria-label=\"Stroke\"></label>\n      <label><span>Colour</span><input type=\"color\" data-config=\"scaleBar.colour\" aria-label=\"Colour\"></label>\n      <label><span>Scale margin</span><input type=\"number\" step=\"any\" data-config=\"scaleBar.marginTop\" aria-label=\"Scale margin\"></label>\n      <label><span>Identity width</span><input type=\"number\" step=\"any\" data-config=\"colourBar.width\" aria-label=\"Identity width\"></label>\n      <label><span>Identity height</span><input type=\"number\" step=\"any\" data-config=\"colourBar.height\" aria-label=\"Identity height\"></label>\n      <label><span>Identity font size</span><input type=\"number\" step=\"any\" data-config=\"colourBar.fontSize\" aria-label=\"Identity font size\"></label>\n      <label><span>Identity margin</span><input type=\"number\" step=\"any\" data-config=\"colourBar.marginTop\" aria-label=\"Identity margin\"></label>\n    </details>\n  </fieldset>\n  <fieldset>\n    <legend>Plot &amp; navigation</legend>\n    <label><span>Renderer</span><select data-config=\"plot.renderer\" aria-label=\"Renderer\"><option value=\"svg\">svg</option><option value=\"canvas\">canvas</option><option value=\"webgpu\">webgpu</option></select></label>\n    <label><span>Show minimap</span><input type=\"checkbox\" data-config=\"plot.minimap.show\" aria-label=\"Show minimap\"></label>\n    <label><span>Minimum zoom</span><input type=\"number\" step=\"any\" data-config=\"plot.minZoom\" aria-label=\"Minimum zoom\"></label>\n    <label><span>Maximum zoom</span><input type=\"number\" step=\"any\" data-config=\"plot.maxZoom\" aria-label=\"Maximum zoom\"></label>\n    <details data-appearance-section=\"plot-navigation\">\n      <summary>Advanced</summary>\n      <label><span>Transition (ms)</span><input type=\"number\" step=\"any\" data-config=\"plot.transitionDuration\" aria-label=\"Transition (ms)\"></label>\n      <label><span>Scale factor</span><input type=\"number\" step=\"any\" data-config=\"plot.scaleFactor\" aria-label=\"Scale factor\"></label>\n      <label><span>Scale genes</span><input type=\"checkbox\" data-config=\"plot.scaleGenes\" aria-label=\"Scale genes\"></label>\n      <label><span>Font family</span><input type=\"text\" data-config=\"plot.fontFamily\" aria-label=\"Font family\"></label>\n      <label><span>Minimap links</span><input type=\"checkbox\" data-config=\"plot.minimap.showLinks\" aria-label=\"Minimap links\"></label>\n      <label><span>Minimap width</span><input type=\"number\" step=\"any\" data-config=\"plot.minimap.width\" aria-label=\"Minimap width\"></label>\n      <label><span>Minimap height</span><input type=\"number\" step=\"any\" data-config=\"plot.minimap.height\" aria-label=\"Minimap height\"></label>\n      <label><span>Minimap margin</span><input type=\"number\" step=\"any\" data-config=\"plot.minimap.margin\" aria-label=\"Minimap margin\"></label>\n    </details>\n  </fieldset>\n  <p class=\"empty\" hidden></p>\n  <slot name=\"tree\"></slot>\n</div>\n",
  "button, input, select { box-sizing: border-box; font: inherit; color: inherit; }\nbutton, input:not([type=color]):not([type=checkbox]):not([type=range]), select {\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\nbutton { cursor: pointer; }\nbutton:hover { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #f4f8ff); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n:is(input, select):focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n",
  ":host { display: flex; flex: 1; flex-direction: column; min-width: 0; min-height: 0; gap: 8px; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\n.toolbar { display: flex; flex-shrink: 0; }\n.settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 10px 20px; align-content: start; overflow: auto; padding: 4px 0; min-height: 0; }\nfieldset { min-width: 0; margin: 0; padding: 8px; border: 1px solid var(--cm-border, #cbd3de); border-radius: 6px; }\nlegend { padding: 0 4px; font-weight: 600; }\nlabel { display: flex; align-items: center; gap: 6px; margin: 6px 0; }\nlabel > span { min-width: 0; flex: 1; }\nselect, input:not([type=checkbox]) { width: 88px; min-width: 0; }\ninput[type=checkbox] { cursor: pointer; }\ninput[type=color] { width: 30px; height: 22px; padding: 0; border: 0; background: transparent; cursor: pointer; }\ndetails { margin-top: 8px; border-top: 1px solid var(--cm-border, #e5e9ef); }\nsummary { padding: 7px 0 1px; color: var(--cm-muted, #687586); cursor: pointer; font-size: 12px; font-weight: 600; }\nsummary:hover { color: var(--cm-accent, #1677ff); }\nsummary:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n.empty { grid-column: 1 / -1; padding: 16px; color: var(--cm-muted, #667386); text-align: center; }\n::slotted(*) { min-width: 0; }\n",
]);
const template$4 = createTemplate(markup$4);
const HTMLElementBase$5 = globalThis.HTMLElement || class {};

class AppearancePanel extends HTMLElementBase$5 {
  #config;
  #hasTree = false;
  #filter = "";
  #expanded = new Set();
  #sections;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = controls$2 + css$4;
    root.append(style, template$4(this.ownerDocument));
    this.#sections = [...root.querySelectorAll("fieldset")].map((box) => ({ box, details: box.querySelector("details"),
      fields: [...box.querySelectorAll("[data-config]")].map((control) => ({ control, row: control.closest("label"), advanced: Boolean(control.closest("details")),
        search: `${box.querySelector("legend").textContent} ${control.getAttribute("aria-label")} ${control.dataset.config}`.toLowerCase() })) }));
    const search = root.querySelector("clinker-search-field");
    search.addEventListener("input", () => { this.#filter = search.value.trim().toLowerCase(); this.#sync(); });
    root.addEventListener("click", (event) => {
      const details = event.target.closest("summary")?.parentElement;
      if (!details || event.defaultPrevented || this.#filter) return;
      const key = details.dataset.appearanceSection;
      if (details.open) this.#expanded.delete(key); else this.#expanded.add(key);
    });
    root.addEventListener("change", (event) => {
      const input = event.target;
      if (!input.matches("[data-config]")) return;
      if (!input.reportValidity()) return;
      const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
      if (!this.dispatchEvent(new CustomEvent("config-change", { detail: { path: input.dataset.config, value }, bubbles: true, composed: true, cancelable: true }))) this.#syncField(input, true);
    });
  }

  set state({ config, hasTree = false }) { this.#config = config; this.#hasTree = hasTree; this.#sync(); }

  #syncField(control, force = false) {
    const path = control.dataset.config, value = path.split(".").reduce((current, key) => current?.[key], this.#config);
    if (control.type === "checkbox") control.checked = Boolean(value);
    else if (force || control !== this.shadowRoot.activeElement) control.value = control.type === "color" ? colourHex(value) : value ?? "";
    const bound = path === "colourBar.domain.min" ? "min" : path === "colourBar.domain.max" ? "max" : null;
    control.disabled = Boolean(bound && this.#config?.colourBar?.domain?.[`${bound}Mode`] === "data");
  }

  #sync() {
    let visible = 0;
    for (const { box, details, fields } of this.#sections) {
      for (const { control, row, search } of fields) {
        this.#syncField(control); row.hidden = Boolean(this.#filter && !search.includes(this.#filter));
      }
      box.hidden = fields.every(({ row }) => row.hidden);
      if (!box.hidden) visible++;
      if (details) {
        details.hidden = !fields.some(({ advanced, row }) => advanced && !row.hidden);
        details.open = Boolean(this.#filter) || this.#expanded.has(details.dataset.appearanceSection);
      }
    }
    const empty = this.shadowRoot.querySelector(".empty");
    empty.hidden = visible > 0; empty.textContent = `No appearance settings match “${this.#filter}”.`;
    this.shadowRoot.querySelector("slot").hidden = !this.#hasTree || Boolean(this.#filter && !/tree|clade|colour|color|annotation|branch|cut|palette/.test(this.#filter));
  }
}

function defineAppearancePanel() {
  defineSearchField();
  if (!customElements.get("clinker-appearance-panel")) customElements.define("clinker-appearance-panel", AppearancePanel);
}

const [markup$3, controls$1, css$3] = await Promise.all([
  "<fieldset hidden>\n  <legend>Clade colouring</legend>\n  <label><span>Colour clades</span><input type=\"checkbox\" data-enabled aria-label=\"Colour clades\"></label>\n  <div data-options hidden>\n    <label><span>Cut height</span><input type=\"number\" min=\"0\" step=\"any\" data-height aria-label=\"Cut height\"><button type=\"button\" data-auto title=\"Use automatic cut height (70%)\">Auto</button></label>\n    <input type=\"range\" min=\"0\" aria-label=\"Preview cut height\">\n    <label><span>Palette</span><select aria-label=\"Clade palette\"><option value=\"custom\" hidden>Custom</option><option value=\"muted\">Muted</option><option value=\"accessible\">Colorblind friendly</option></select></label>\n    <label><span>Show cut line</span><input type=\"checkbox\" data-line aria-label=\"Show cut line\"></label>\n  </div>\n</fieldset>\n<button type=\"button\" data-reset title=\"Clear manual tree styles and labels; keep automatic clade colouring.\" disabled>Reset all manual styles</button>\n<p role=\"status\" hidden></p>\n",
  "button, input, select { box-sizing: border-box; font: inherit; color: inherit; }\nbutton, input:not([type=color]):not([type=checkbox]):not([type=range]), select {\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\nbutton { cursor: pointer; }\nbutton:hover { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #f4f8ff); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n:is(input, select):focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n",
  ":host { display: block; min-width: 0; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\nfieldset { min-width: 0; margin: 0 0 10px; padding: 8px; border: 1px solid var(--cm-border, #cbd3de); border-radius: 6px; }\nlegend { padding: 0 4px; font-weight: 600; }\nlabel { display: flex; align-items: center; gap: 6px; margin: 6px 0; }\nlabel > span { flex: 1; min-width: 0; }\ninput[type=number] { width: 64px; min-width: 0; }\ninput[type=range] { width: 100%; }\ninput[type=checkbox] { cursor: pointer; }\nselect { width: 132px; min-width: 0; }\nbutton[aria-pressed=true] { font-weight: 600; }\nbutton:disabled { color: var(--cm-muted, #8993a1); opacity: .45; cursor: default; }\np { color: var(--cm-danger, #b42318); margin: 6px 0 0; }\n",
]);
const template$3 = createTemplate(markup$3);
const palettes = { muted: TREE_COLOURING_DEFAULTS.palette, accessible: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#d55e00", "#56b4e9"] };
const HTMLElementBase$4 = globalThis.HTMLElement || class {};

class TreeAppearance extends HTMLElementBase$4 {
  #state;
  #height;
  #slider;
  #previewing = false;
  #cancelled = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = controls$1 + css$3;
    root.append(style, template$3(this.ownerDocument));
    this.#height = root.querySelector("[data-height]"); this.#slider = root.querySelector('[type="range"]');
    root.querySelector("[data-enabled]").onchange = (event) => this.#change({ mode: event.target.checked ? "cutHeight" : "none" });
    this.#height.onchange = () => { if (this.#height.reportValidity()) this.#change({ cutHeight: Number(this.#height.value) }); };
    root.querySelector("[data-auto]").onclick = () => this.#change({ cutHeight: "auto" });
    root.querySelector("select").onchange = (event) => this.#change({ palette: palettes[event.target.value] || this.#state.policy.palette });
    root.querySelector("[data-line]").onchange = (event) => this.#change({ showCutLine: event.target.checked });
    root.querySelector("[data-reset]").onclick = () => this.#emit("reset-styles");
    this.#slider.oninput = () => {
      this.#cancelled = false; this.#previewing = true; this.#height.value = this.#slider.value;
      if (!this.#emit("colouring-preview", { cutHeight: Number(this.#slider.value) })) this.#cancelPreview();
    };
    this.#slider.onchange = () => { if (!this.#cancelled) this.#change({ cutHeight: Number(this.#slider.value) }); };
    this.#slider.onkeydown = (event) => { if (event.key === "Escape") { this.#cancelPreview(); event.preventDefault(); } };
    this.#slider.onpointercancel = () => this.#cancelPreview();
  }

  set state(value) { this.#state = value; this.#previewing = false; this.#sync(); }
  set error(message) { const status = this.shadowRoot.querySelector("p"); status.textContent = message; status.hidden = !message; }
  disconnectedCallback() { if (this.#previewing) this.#cancelPreview(); }

  #emit(type, detail) { return this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: true })); }
  #change(changes) { if (!this.#emit("colouring-change", changes)) this.#cancelPreview(); }
  #cancelPreview() {
    this.#cancelled = true; this.#previewing = false; this.#emit("colouring-preview", null); this.#sync();
  }
  #sync() {
    if (!this.#state) return;
    const { policy, height, compatible, canReset } = this.#state, root = this.shadowRoot;
    root.querySelector("fieldset").hidden = !compatible;
    root.querySelector("[data-enabled]").checked = policy.mode === "cutHeight";
    root.querySelector("[data-options]").hidden = policy.mode !== "cutHeight";
    const actual = policy.cutHeight === "auto" ? height * 0.7 : policy.cutHeight;
    this.#height.value = actual;
    Object.assign(this.#slider, { max: String(Math.max(height, actual) || 1), step: String(height / 1000 || 0.001), value: actual });
    root.querySelector("[data-auto]").setAttribute("aria-pressed", String(policy.cutHeight === "auto"));
    const palette = Object.keys(palettes).find((key) => JSON.stringify(palettes[key]) === JSON.stringify(policy.palette)) || "custom";
    root.querySelector('[value="custom"]').hidden = palette !== "custom";
    root.querySelector("select").value = palette;
    root.querySelector("[data-line]").checked = policy.showCutLine;
    root.querySelector("[data-reset]").disabled = !canReset;
  }
}

function defineTreeAppearance() {
  if (!customElements.get("clinker-tree-appearance")) customElements.define("clinker-tree-appearance", TreeAppearance);
}

function createAppearanceControls({ document, patch, preview }) {
  defineAppearancePanel(); defineTreeAppearance();
  const node = document.createElement("clinker-appearance-panel");
  const controls = document.createElement("clinker-tree-appearance"); controls.slot = "tree"; node.append(controls);
  const run = createActionRunner((message) => { controls.error = message; });
  const runPreview = createActionRunner((message) => { if (message) controls.error = message; });
  const colouring = (changes) => [{ type: "tree.presentation.update", scope: "tree", changes: { colouring: changes } }];
  controls.addEventListener("colouring-change", (event) => { if (!run(() => patch(colouring(event.detail)))) event.preventDefault(); });
  controls.addEventListener("colouring-preview", (event) => { if (!runPreview(() => preview?.(event.detail ? colouring(event.detail) : null))) event.preventDefault(); });
  controls.addEventListener("reset-styles", (event) => { if (!run(() => patch([{ type: "tree.presentation.reset", scope: "manual" }]))) event.preventDefault(); });
  return { node, update({ config, tree }) {
    node.state = { config, hasTree: Boolean(tree) };
    if (!tree) return;
    const { policy, height } = resolveTreePresentation(tree, config.tree);
    let compatible = tree.distance?.kind === "mergeHeight";
    try { validateTreePresentation({ ...tree, presentation: { ...tree.presentation, colouring: { ...policy, mode: "cutHeight" } } }, config.tree); }
    catch { compatible = false; }
    controls.state = { policy, height, compatible,
      canReset: Boolean(Object.keys(tree.presentation?.nodes || {}).length || Object.keys(tree.presentation?.subtrees || {}).length) };
  } };
}

/** Shared activation and horizontal keyboard navigation for option buttons. */
function bindOptionButtons(group, choose) {
  group.addEventListener("click", (event) => choose(event.target.closest("button")));
  group.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = [...group.querySelectorAll("button:not(:disabled)")];
    if (!buttons.length) return;
    const index = buttons.indexOf(event.target);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
      : (index + (event.key === "ArrowLeft" ? -1 : 1) + buttons.length) % buttons.length;
    event.preventDefault(); buttons[next].focus(); choose(buttons[next]);
  });
}

const [markup$2, css$2] = await Promise.all([
  "<div role=\"group\">\n  <template><button type=\"button\"></button></template>\n</div>\n",
  ":host { display: block; color: inherit; font: inherit; }\n:host([hidden]) { display: none !important; }\ndiv {\n  display: flex;\n  padding: 3px;\n  border: 1px solid var(--cm-border, #e0e5eb);\n  border-radius: 7px;\n  background: var(--cm-subtle, #f3f6fa);\n}\nbutton {\n  box-sizing: border-box;\n  min-height: 28px;\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 0;\n  border-radius: var(--cm-control-radius, 6px);\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  white-space: nowrap;\n  cursor: pointer;\n}\nbutton[aria-pressed=true] { background: var(--cm-surface, #fff); box-shadow: 0 1px 2px #1d2b3d29; font-weight: 600; }\nbutton:hover:not(:disabled) { background: var(--cm-hover, #e3ecf8); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\nbutton:disabled { color: var(--cm-muted, #8993a1); opacity: .45; cursor: default; }\n",
]);
const template$2 = createTemplate(markup$2);
const HTMLElementBase$3 = globalThis.HTMLElement || class {};

class ViewSwitcher extends HTMLElementBase$3 {
  static observedAttributes = ["value", "label"];
  #group;
  #template;
  #buttons = [];
  #observer;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$2;
    root.append(style, template$2(this.ownerDocument));
    this.#group = root.querySelector("div"); this.#template = root.querySelector("template");
    bindOptionButtons(this.#group, (button) => this.#choose(button));
    this.#observer = new this.ownerDocument.defaultView.MutationObserver((records) => {
      if (records.some((record) => record.target !== this || record.type === "childList")) this.#renderOptions();
    });
  }

  get value() { return this.getAttribute("value") || ""; }
  set value(value) { if (this.value !== String(value)) this.setAttribute("value", String(value)); }
  attributeChangedCallback() { this.#sync(); }
  connectedCallback() {
    this.#renderOptions();
    this.#observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["value", "label", "disabled"] });
  }
  disconnectedCallback() { this.#observer.disconnect(); }

  #renderOptions() {
    this.#buttons = [...this.querySelectorAll("option")].map((option) => {
      const button = this.ownerDocument.importNode(this.#template.content, true).firstElementChild;
      button.value = option.value; button.textContent = option.label; button.disabled = option.disabled;
      return button;
    });
    this.#group.replaceChildren(this.#template, ...this.#buttons);
    if (!this.hasAttribute("value")) this.value = this.#buttons.find((button) => !button.disabled)?.value || "";
    this.#sync();
  }

  #sync() {
    this.#group.setAttribute("aria-label", this.getAttribute("label") || "View");
    const active = this.#buttons.find((button) => !button.disabled && button.value === this.value)
      || this.#buttons.find((button) => !button.disabled);
    for (const button of this.#buttons) {
      button.setAttribute("aria-pressed", String(button.value === this.value));
      button.tabIndex = button === active ? 0 : -1;
    }
  }

  #choose(button) {
    if (!button || button.disabled || button.value === this.value) return;
    this.value = button.value;
    this.dispatchEvent(new CustomEvent("value-change", { detail: { value: this.value }, bubbles: true, composed: true }));
  }
}

function defineViewSwitcher() {
  if (!customElements.get("clinker-view-switcher")) customElements.define("clinker-view-switcher", ViewSwitcher);
}

const [markup$1, css$1] = await Promise.all([
  "<div part=\"tab-list\" role=\"tablist\">\n  <template><button type=\"button\" role=\"tab\"></button></template>\n</div>\n<slot name=\"status\"></slot>\n<div part=\"panels\">\n  <template><div role=\"tabpanel\" tabindex=\"0\"><slot></slot></div></template>\n</div>\n",
  ":host { display: flex; flex: 1; flex-direction: column; min-height: 0; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\n[role=tablist] { display: flex; flex-shrink: 0; gap: 4px; margin-bottom: 10px; border-bottom: 1px solid var(--cm-border, #e1e5ea); }\nbutton {\n  box-sizing: border-box;\n  min-height: 30px;\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 0;\n  border-bottom: 2px solid transparent;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  cursor: pointer;\n}\nbutton[aria-selected=true] { border-bottom-color: var(--cm-accent, #1677ff); font-weight: 600; }\nbutton:hover:not(:disabled) { background: var(--cm-hover, #e3ecf8); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\nbutton:disabled { color: var(--cm-muted, #8993a1); opacity: .45; cursor: default; }\n[part=panels], [role=tabpanel] { display: flex; flex: 1; flex-direction: column; min-height: 0; }\n[role=tabpanel]:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\nslot { display: contents; }\n",
]);
const template$1 = createTemplate(markup$1);
const HTMLElementBase$2 = globalThis.HTMLElement || class {};
let nextId = 0;

class Tabs extends HTMLElementBase$2 {
  static observedAttributes = ["value", "label"];
  #prefix = `clinker-tabs-${++nextId}`;
  #list;
  #content;
  #buttonTemplate;
  #panelTemplate;
  #tabs = [];
  #observer;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = css$1;
    root.append(style, template$1(this.ownerDocument));
    this.#list = root.querySelector("[role=tablist]"); this.#content = root.querySelector("[part=panels]");
    this.#buttonTemplate = this.#list.querySelector("template"); this.#panelTemplate = this.#content.querySelector("template");
    bindOptionButtons(this.#list, (button) => {
      if (!button || button.disabled || button.value === this.value) return;
      this.value = button.value;
      this.dispatchEvent(new CustomEvent("value-change", { detail: { value: this.value }, bubbles: true, composed: true }));
    });
    this.#observer = new this.ownerDocument.defaultView.MutationObserver((records) => {
      if (records.some((record) => record.type === "childList" ? record.target === this : record.target.parentElement === this)) this.#mountPanels();
    });
  }

  get value() { return this.getAttribute("value") || ""; }
  set value(value) { if (this.value !== String(value)) this.setAttribute("value", String(value)); }
  attributeChangedCallback() { this.#sync(); }
  connectedCallback() {
    this.#mountPanels();
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["name", "label", "disabled"] });
  }
  disconnectedCallback() { this.#observer.disconnect(); }

  #mountPanels() {
    this.#tabs = [...this.children].filter((panel) => panel.hasAttribute("name")).map((panel, index) => {
      const button = this.ownerDocument.importNode(this.#buttonTemplate.content, true).firstElementChild;
      const wrapper = this.ownerDocument.importNode(this.#panelTemplate.content, true).firstElementChild;
      const id = `${this.#prefix}-${index}`, name = panel.getAttribute("name");
      panel.slot = id; wrapper.id = id; wrapper.querySelector("slot").name = id;
      button.id = `${id}-tab`; button.value = name; button.textContent = panel.getAttribute("label") || name;
      button.disabled = panel.hasAttribute("disabled"); button.setAttribute("aria-controls", id); wrapper.setAttribute("aria-labelledby", button.id);
      return { name, panel, button, wrapper };
    });
    this.#list.replaceChildren(this.#buttonTemplate, ...this.#tabs.map(({ button }) => button));
    this.#content.replaceChildren(this.#panelTemplate, ...this.#tabs.map(({ wrapper }) => wrapper));
    this.#sync();
  }

  #sync() {
    this.#list.setAttribute("aria-label", this.getAttribute("label") || "Sections");
    const active = this.#tabs.find((tab) => tab.name === this.value && !tab.button.disabled) || this.#tabs.find((tab) => !tab.button.disabled);
    if (active && active.name !== this.value) { this.value = active.name; return; }
    for (const tab of this.#tabs) {
      const selected = tab === active;
      tab.button.setAttribute("aria-selected", String(selected)); tab.button.tabIndex = selected ? 0 : -1;
      tab.panel.hidden = tab.wrapper.hidden = !selected;
    }
  }
}

function defineTabs() {
  if (!customElements.get("clinker-tabs")) customElements.define("clinker-tabs", Tabs);
}

const [markup, controls, css] = await Promise.all([
  "<button type=\"button\" data-command=\"focus\">Focus in plot</button>\n<clinker-action-menu label=\"Assign…\" data-menu=\"assign\">\n  <label>Move to <select data-assign-group aria-label=\"Move to group\"></select></label>\n  <button type=\"button\" data-command=\"assign\">Move</button>\n  <button type=\"button\" data-command=\"unassign\">Remove from groups</button>\n  <button type=\"button\" data-command=\"new-group-for-selection\">New group…</button>\n</clinker-action-menu>\n<clinker-action-menu label=\"Edit…\" data-menu=\"edit\">\n  <input data-batch-label placeholder=\"Set label\" aria-label=\"Set label\">\n  <button type=\"button\" data-command=\"batch-label\">Set label</button>\n  <label>Set colour <input type=\"color\" value=\"#888888\" aria-label=\"Set colour\" data-batch-colour></label>\n  <select data-batch-visibility aria-label=\"Set visibility\"><option value=\"\">Visibility…</option><option value=\"show\">Show</option><option value=\"hide\">Hide</option></select>\n  <input type=\"number\" data-batch-identity min=\"0\" max=\"100\" step=\".1\" placeholder=\"Set identity (%)\" aria-label=\"Set identity (%)\">\n  <button type=\"button\" data-command=\"batch-identity\">Set identity</button>\n</clinker-action-menu>\n<clinker-action-menu label=\"Merge…\" data-menu=\"merge\">\n  <select data-merge-target aria-label=\"Group to keep\"></select>\n  <button type=\"button\" data-command=\"merge\">Merge groups</button>\n</clinker-action-menu>\n<clinker-action-menu label=\"Group…\" data-menu=\"group\">\n  <button type=\"button\" data-command=\"view-members\">View member genes</button>\n  <label>Position <input type=\"number\" data-group-position required min=\"1\"></label>\n</clinker-action-menu>\n<clinker-action-menu label=\"Remove…\" data-menu=\"remove\">\n  <button type=\"button\" data-command=\"delete\" class=\"danger\"></button>\n  <button type=\"button\" data-command=\"remove-loci\"></button>\n  <button type=\"button\" data-command=\"remove-clusters\"></button>\n  <button type=\"button\" data-command=\"delete-groups\" title=\"Genes remain in the plot\"></button>\n</clinker-action-menu>\n",
  "button, input, select { box-sizing: border-box; font: inherit; color: inherit; }\nbutton, input:not([type=color]):not([type=checkbox]):not([type=range]), select {\n  min-height: var(--cm-control-height, 30px);\n  padding: var(--cm-control-padding, 4px 8px);\n  border: 1px solid var(--cm-border, #cbd3de);\n  border-radius: var(--cm-control-radius, 6px);\n  background: var(--cm-surface, #fff);\n}\nbutton { cursor: pointer; }\nbutton:hover { border-color: var(--cm-accent, #78a9ed); background: var(--cm-hover, #f4f8ff); }\nbutton:focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: 2px; }\n:is(input, select):focus-visible { outline: 2px solid var(--cm-accent, #1677ff); outline-offset: -2px; }\n",
  ":host { display: flex; align-items: center; gap: 6px; color: inherit; font: inherit; }\n:host([hidden]), [hidden] { display: none !important; }\ninput[type=color] { width: 30px; height: 22px; padding: 0; border: 0; background: transparent; cursor: pointer; }\ninput[type=number] { width: 112px; }\n.danger { border-color: var(--cm-danger, #e4aaa5); color: var(--cm-danger, #b3261e); background: var(--cm-hover, #fffafa); }\n",
]);
const template = createTemplate(markup);
const groupOptions = (groups) => groups.map(({ uid, label, name }) => [uid, label || name || uid]);
const HTMLElementBase$1 = globalThis.HTMLElement || class {};

class RecordActions extends HTMLElementBase$1 {
  #context;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = this.ownerDocument.createElement("style"); style.textContent = controls + css;
    root.append(style, template(this.ownerDocument));
    root.addEventListener("click", (event) => {
      const command = event.target.closest("[data-command]")?.dataset.command;
      if (!command) return;
      const field = { assign: "assign-group", merge: "merge-target", "batch-label": "batch-label", "batch-identity": "batch-identity" }[command];
      const input = field && this.#field(field);
      if (input && !input.reportValidity()) return;
      if (input && !input.value.trim()) return;
      this.#emit(command, input?.value);
    });
    root.addEventListener("change", (event) => {
      const input = event.target;
      if (input.matches("[data-batch-colour]")) this.#emit("batch-colour", input.value);
      else if (input.matches("[data-batch-visibility]") && input.value) { this.#emit("batch-visibility", input.value); input.value = ""; }
      else if (input.matches("[data-group-position]") && input.reportValidity()) this.#emit("group-position", Number(input.value) - 1);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.matches("[data-group-position]")) event.target.blur();
    });
  }

  connectedCallback() {
    if (this.#context === undefined) this.state = { kind: "groups", count: 0, groups: [], allGroups: [], loci: [], clusters: [] };
  }

  set state({ kind, count, groups, allGroups, loci, clusters }) {
    const context = JSON.stringify([kind, count > 0, count > 1, groups.map(({ uid }) => uid)]);
    if (this.#context !== context) {
      this.#context = context;
      for (const menu of this.shadowRoot.querySelectorAll("clinker-action-menu")) menu.open = false;
      this.#field("batch-label").value = this.#field("batch-identity").value = "";
    }
    this.hidden = !count;
    const visible = { assign: kind === "genes", edit: kind !== "genes" && count > 1, merge: groups.length > 1, group: groups.length === 1, remove: true };
    for (const menu of this.shadowRoot.querySelectorAll("[data-menu]")) menu.hidden = !visible[menu.dataset.menu];
    this.#field("batch-identity").hidden = this.#command("batch-identity").hidden = kind !== "links";
    updateSelectOptions(this.#field("assign-group"), [["", "Choose a group…"], ...groupOptions(allGroups)]);
    updateSelectOptions(this.#field("merge-target"), [["", "Choose group to keep…"], ...groupOptions(groups)]);
    const position = this.#field("group-position"); position.max = allGroups.length || 1;
    if (this.shadowRoot.activeElement !== position) position.value = allGroups.findIndex(({ uid }) => uid === groups[0]?.uid) + 1;
    for (const [command, label, show] of [["delete", `Delete selected ${kind}`, true], ["remove-loci", `Entire loci (${loci.length})`, loci.length],
      ["remove-clusters", `Entire clusters (${clusters.length})`, clusters.length], ["delete-groups", `Delete groups (${groups.length})`, kind === "genes" && groups.length]]) {
      const button = this.#command(command); button.textContent = label; button.hidden = !show;
    }
  }

  #field(name) { return this.shadowRoot.querySelector(`[data-${name}]`); }
  #command(name) { return this.shadowRoot.querySelector(`[data-command="${name}"]`); }
  #emit(command, value) { this.dispatchEvent(new CustomEvent("selection-action", { detail: { command, value }, bubbles: true, composed: true })); }
}

function defineRecordActions() {
  defineActionMenu();
  if (!customElements.get("clinker-record-actions")) customElements.define("clinker-record-actions", RecordActions);
}

const shellTemplate = createTemplate(await "<div class=\"cm-editor__resize-handle\" data-resize role=\"separator\" aria-label=\"Resize plot editor\" aria-orientation=\"horizontal\"></div>\n<header class=\"cm-editor__header\">\n  <h2 class=\"cm-editor__title\">Plot editor</h2>\n  <div class=\"cm-editor__history\">\n    <button type=\"button\" data-command=\"undo\" disabled>Undo</button>\n    <button type=\"button\" data-command=\"redo\" disabled>Redo</button>\n  </div>\n</header>\n<clinker-tabs data-editor-tabs label=\"Plot editor sections\" value=\"data\">\n  <div slot=\"status\" data-editor-error class=\"cm-data-error\" role=\"alert\" hidden></div>\n  <section name=\"data\" label=\"Data\" data-panel=\"data\" class=\"cm-editor__panel\">\n    <div class=\"cm-editor__toolbar cm-data-toolbar\">\n      <clinker-view-switcher data-kind-picker label=\"Data type\" value=\"groups\">\n        <option value=\"groups\">Groups</option><option value=\"genes\">Genes</option>\n        <option value=\"links\">Links</option><option value=\"annotations\">Annotations</option>\n      </clinker-view-switcher>\n      <clinker-view-switcher data-gene-view label=\"Gene view\" value=\"tree\" hidden>\n        <option value=\"tree\">By locus</option><option value=\"groups\">By group</option><option value=\"list\">List</option>\n      </clinker-view-switcher>\n      <button type=\"button\" data-command=\"toggle-tree\" hidden>Expand visible</button>\n      <button type=\"button\" data-command=\"new-group\">Create group…</button>\n      <div data-annotation-toolbar class=\"cm-editor__annotation-toolbar\" hidden></div>\n      <clinker-search-field data-filter label=\"Filter records\" placeholder=\"Search names, labels, loci, or clusters\"></clinker-search-field>\n    </div>\n    <div data-annotation-editor class=\"cm-editor__annotation-editor\" hidden></div>\n    <div data-record-editor></div>\n  </section>\n  <section name=\"appearance\" label=\"Appearance\" data-panel=\"appearance\" class=\"cm-editor__panel\" hidden>\n    <div class=\"cm-editor__appearance\" data-appearance></div>\n  </section>\n</clinker-tabs>\n");

const memberFilterTemplate = createTemplate(`<div class="cm-editor__member-filter" data-member-filter hidden>
  <span>Group: <strong data-member-label></strong></span><button type="button" data-command="clear-member-filter" aria-label="Clear group member filter" title="Clear group member filter">×</button>
</div>`);
const tableTemplate = createTemplate('<div slot="header" data-head class="cm-editor__head"></div><div data-rows></div>');

const tagName = "clinker-editor";
const HTMLElementBase = globalThis.HTMLElement || class {};

const labelFor = (record, fallback = "") => record?.label || record?.name || fallback;
const groupMap = (data) => new Map((data?.groups || []).flatMap((group) =>
  (group.genes || []).flatMap((id) => [[id, group], [String(id), group]])
));
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
  #editAnnotation = (event) => {
    if (event.defaultPrevented || event.detail?.chart !== this.#chart) return;
    event.preventDefault(); this.editAnnotations(event.detail.panelUid);
  };
  #unsubscribe = null;
  #kind = "groups";
  #geneView = "tree";
  #selected = new RowSelection();
  #rowKind = null;
  #table = null;
  #actions = null;
  #selectionControls = null;
  #rowsCache = null;
  #selectionData = null;
  #filter = "";
  #memberGroupId = null;
  #expanded = new Set();
  #draggedGroupId = null;
  #resizeStart = null;
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
    defineEditableField(); defineSelectionBar(); defineActionMenu(); defineViewSwitcher(); defineSearchField(); defineTabs(); defineRecordActions(); defineDataTable();
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
    this.#disposeRows();
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
    this.#invalidateData({ replace: true });
    this.#subscribe();
    this.#render();
  }

  get value() { return this.#chart?.data?.(); }

  /** Open a panel's annotation data from the plot or a host application. */
  editAnnotations(panelUid) {
    this.hidden = false;
    this.#kind = "annotations";
    this.#selected.clear();
    this.querySelector("[data-editor-tabs]")?.setAttribute("value", "data");
    this.#renderData();
    if (panelUid) this.#annotationEditor?.select(panelUid);
    this.dispatchEvent(new CustomEvent("clinker-editor-open", { bubbles: true }));
    return this;
  }

  /** Reveal the plot's selected loci or clusters in the gene hierarchy. */
  editSelection({ kind, ids }) {
    this.hidden = false;
    this.#kind = "genes"; this.#geneView = "tree";
    this.#filter = ""; this.#memberGroupId = null;
    const selected = new Set(ids), genes = [];
    for (const cluster of this.#data()?.clusters || []) {
      const loci = cluster.loci.filter((locus) => selected.has(kind === "clusters" ? cluster.uid : locus.uid));
      if (!loci.length) continue;
      this.#expanded.add(`cluster:${cluster.uid}`);
      this.#expanded.add(`cluster-locus:${cluster.uid}:${cluster.loci[0]?.uid}`);
      for (const locus of loci) {
        this.#expanded.add(`locus:${locus.uid}`);
        genes.push(...locus.genes.map((gene) => gene.uid));
      }
    }
    this.#selected.clear(); this.#selected.setMany(genes); this.#rowsCache = null;
    this.querySelector("[data-editor-tabs]")?.setAttribute("value", "data");
    this.#renderData(); this.#syncHighlight();
    const first = this.#rows().findIndex((row) => row.selectIds?.some((id) => this.#selected.has(id)));
    this.querySelector(".cm-editor__table").scrollTop = Math.max(0, first) * DATA_ROW_HEIGHT;
    this.dispatchEvent(new CustomEvent("clinker-editor-open", { bubbles: true }));
    return this;
  }

  /** Replace any declarative fallback content with the packaged editor UI. */
  reset() {
    this.#appearanceView = null;
    this.#disposeRows();
    this.#annotationEditor?.destroy();
    this.#annotationEditor = null;
    this.replaceChildren();
    this.#renderShell();
    this.#render();
    return this;
  }

  #renderShell() {
    this.replaceChildren(shellTemplate(this.ownerDocument));
    const panel = createDataPanel(this.ownerDocument);
    this.#table = panel.viewport;
    panel.node.dataset.recordEditor = "";
    panel.tools.dataset.recordTools = "";
    panel.tools.append(memberFilterTemplate(this.ownerDocument));
    this.#selectionControls = createSelectionControls(panel, { selection: this.#selected,
      onChange: () => { this.#renderData(); this.#syncHighlight(); } });
    this.#selectionControls.actions.dataset.actions = "";
    this.#actions = this.ownerDocument.createElement("clinker-record-actions");
    this.#actions.addEventListener("selection-action", (event) => this.#command(event.detail.command, event.detail.value));
    this.#selectionControls.actions.append(this.#actions);
    panel.viewport.classList.add("cm-editor__table");
    panel.viewport.append(tableTemplate(this.ownerDocument));
    this.querySelector("[data-record-editor]").replaceWith(panel.node);
  }

  #subscribe() {
    if (this.#unsubscribe || !this.isConnected || !this.#chart?.on) return;
    this.#unsubscribe = this.#chart.on("change", (change) => {
      if (change.type === "data.apply" || change.type === "data.replace" || change.type === "state.replace") {
        this.#invalidateData({ replace: change.type === "data.replace" });
      }
      if (change.type === "data.apply" || change.type === "data.replace" || change.type === "state.replace") this.#renderData();
      else if (change.type === "config.change" || change.type === "theme.change") this.#renderAppearance();
      if (change.type === "data.replace" || change.type === "state.replace" || (change.type === "data.apply" && change.operations?.some((op) => op.type.startsWith("tree.presentation.")))) this.#renderAppearance();
      if (change.type === "history.change") this.#renderHistory();
    });
  }

  #bind() {
    if (this.dataset.bound) return;
    this.dataset.bound = "true";
    this.addEventListener("click", (event) => this.#click(event));
    this.addEventListener("change", (event) => this.#change(event));
    this.addEventListener("value-change", (event) => {
      if (event.target.matches("[data-editor-tabs]")) {
        if (event.detail.value === "appearance") this.#renderAppearance(); else this.#renderData();
        return;
      }
      if (event.target.matches("[data-kind-picker]")) {
        this.#kind = event.detail.value;
        if (this.#kind !== "genes") this.#memberGroupId = null;
        this.#selected.clear();
      } else if (event.target.matches("[data-gene-view]")) this.#geneView = event.detail.value;
      else return;
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
      this.#renderData();
    });
    this.addEventListener("pointerdown", (event) => {
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
      if (event.target.matches("[data-filter]")) this.#setDataFilter(event.target.value);
    });
    this.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") this.#clearDataSelection();
      const grip = event.target.closest("[data-reorder]");
      if (grip && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const uid = this.#id(grip.dataset.reorder);
        const index = this.#data().groups.findIndex((group) => group.uid === uid);
        this.#moveGroup(uid, index + (event.key === "ArrowUp" ? -1 : 1));
      }
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
    if (event.target.closest("clinker-editable-field")) return;
    const checkbox = event.target.closest("[data-select], [data-select-row]");
    if (checkbox) {
      this.#selectRow(checkbox.dataset.selectRow ?? this.#id(checkbox.dataset.select), checkbox.checked, event.shiftKey);
      this.#renderData(); this.#syncHighlight(); return;
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
    const row = event.target.closest(".cm-editor__row, .cm-editor__tree-row");
    if (row && !event.target.closest("input, select, button")) {
      const parent = row.querySelector("[data-select-row]");
      const id = parent?.dataset.selectRow ?? this.#id(row.dataset.id);
      this.#selectRow(id, parent ? !parent.checked : !this.#selected.has(id), event.shiftKey);
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
    if (button.dataset.removeRecord) {
      this.#removeRecords(button.dataset.removeRecord, [this.#id(button.dataset.id)]);
      return;
    }
    this.#command(button.dataset.command);
  }

  #command(command, value) {
    if (command === "remove-loci" || command === "remove-clusters") {
      const kind = command === "remove-loci" ? "loci" : "clusters";
      this.#removeRecords(kind, this.#selectedParents(kind));
      return;
    }
    if (command === "delete" || command === "delete-groups") {
      if (command === "delete-groups") this.#deleteSelected("groups", this.#selectedGroups().map((group) => group.uid));
      else this.#deleteSelected();
    } else if (command === "new-group" || command === "new-group-for-selection") {
      const label = window.prompt("Name for the new homology group");
      if (label?.trim()) {
        const geneIds = command === "new-group-for-selection" ? [...this.#selected] : [];
        if (geneIds.length) this.#selected.clear();
        this.#apply({ type: "groups.create", group: { uid: this.#nextGroupUid(), label: label.trim() }, geneIds });
      }
    } else if (command === "assign") {
      if (value) this.#apply({ type: "groups.assignGenes", groupId: this.#groupId(value), geneIds: [...this.#selected] });
    } else if (command === "unassign") {
      this.#apply({ type: "groups.unassignGenes", geneIds: [...this.#selected] });
    } else if (command === "focus") {
      this.#focusSelected();
    } else if (command === "batch-label") {
      if (value?.trim()) {
        this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes: { label: value.trim() } });
      }
    } else if (command === "batch-identity") {
      const identity = Number(value);
      if (Number.isFinite(identity) && identity >= 0 && identity <= 100) {
        this.#apply({ type: "links.update", ids: [...this.#selected], changes: { identity: identity / 100 } });
      }
    } else if (command === "merge") {
      const targetId = this.#groupId(value);
      if (targetId !== undefined) {
        const sourceIds = this.#selectedGroups().map((group) => group.uid);
        this.#selected.clear();
        this.#apply({ type: "groups.merge", targetId, sourceIds });
      }
    } else if (command === "batch-colour" || command === "batch-visibility") {
      const changes = command === "batch-colour" ? { colour: value } : { hidden: value === "hide" };
      this.#apply({ type: `${this.#kind}.update`, ids: [...this.#selected], changes });
    } else if (command === "group-position") {
      this.#moveGroup(this.#selectedGroups()[0]?.uid, value);
    } else if (command === "view-members") {
      const groupId = this.#selectedGroups()[0]?.uid;
      if (groupId !== undefined) this.#viewGroupMembers(groupId);
    } else if (command === "undo") {
      this.#chart?.undo?.();
    } else if (command === "redo") {
      this.#chart?.redo?.();
    } else if (command === "toggle-tree") {
      this.#toggleTree();
    } else if (command === "clear-member-filter") {
      this.#memberGroupId = null;
      this.#renderData();
    }
  }

  #change(event) {
    const target = event.target;
    if (target.matches("[data-select-row]")) {
      const row = this.#rows().find((row) => row.key === target.dataset.selectRow);
      if (!row || row.selectIds.every((id) => this.#selected.has(id)) === target.checked) return;
      this.#selectRow(row.key, target.checked, false);
      this.#renderData(); this.#syncHighlight(); return;
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
  }

  #apply(operation, control) {
    if (!this.#chart?.patch) return false;
    return this.#runEdit(() => this.#chart.patch([operation]), control);
  }

  #setConfig({ path, value }) {
    if (!this.#chart?.config) return false;
    const keys = path.split(".");
    let config = value;
    for (const key of keys.slice().reverse()) config = { [key]: config };
    return this.#runEdit(() => this.#chart.config(config));
  }

  #disposeRows() {
    if (this.#table) this.#table.renderer = null;
    this.#rowKind = null;
  }

  #invalidateData({ replace = false } = {}) {
    // Patches can mutate data in place; invalidate all derived state together.
    this.#dataCache = null;
    this.#rowsCache = null;
    this.#selectionData = null;
    this.#annotationEditor?.invalidate({ replace });
    if (replace) {
      this.#disposeRows();
      this.#selected.clear(); this.#expanded.clear(); this.#memberGroupId = null;
      this.#initializeExpanded();
    }
  }

  #data() { return this.#chart?.visibleData?.() || this.#chart?.data?.() || null; }

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
    for (const cluster of data.clusters || []) {
      remember(cluster);
      for (const locus of cluster.loci || []) {
        remember(locus);
        for (const gene of locus.genes || []) {
          remember(gene);
          geneById.set(String(gene.uid), gene);
          genes.push({ gene, locus, cluster });
        }
      }
    }
    for (const link of data.links || []) remember(link);
    this.#dataCache = { data, ids, groups, groupById, genes, geneById };
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


  #selectRow(id, checked, range) {
    const rows = new Map(this.#rows().map((row) => [row.key ?? row.id, row]));
    this.#selected.select(id, checked, { range, orderedIds: [...rows.keys()],
      idsFor: (key) => rows.get(key).selectIds || [rows.get(key).id] });
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
    return this.#sortRows(genes.map(({ gene, locus, cluster }) => this.#geneRow(gene, locus, cluster, groups)));
  }

  #treeRows(data, groups, visible, needle) {
    const visibleIds = new Set(visible.map(({ gene }) => gene.uid));
    const rows = [];
    for (const cluster of data.clusters) {
      const loci = cluster.loci.map((locus) => ({ locus, genes: locus.genes.filter((gene) => visibleIds.has(gene.uid)) }))
        .filter(({ locus, genes }) => genes.length || (!needle && !this.#memberGroupId && !locus.genes.length));
      if (!loci.length && (cluster.loci.length || needle || this.#memberGroupId)) continue;
      if (loci.length === 1) {
        const { locus, genes } = loci[0];
        const key = `cluster-locus:${cluster.uid}:${locus.uid}`;
        const open = Boolean(needle) || this.#expanded.has(key);
        rows.push({ type: "cluster-locus", key, cluster, locus, label: labelFor(cluster, cluster.uid), locusLabel: labelFor(locus, locus.uid), count: genes.length, selectIds: genes.map((gene) => gene.uid), open });
        if (open) rows.push(...genes.map((gene) => this.#geneRow(gene, locus, cluster, groups, 1)));
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
        if (locusOpen) rows.push(...genes.map((gene) => this.#geneRow(gene, locus, cluster, groups, 2)));
      }
    }
    return rows;
  }

  #geneRow(gene, locus, cluster, groups, depth = null) {
    return { ...(depth === null ? {} : { type: "gene", depth }), id: gene.uid, label: labelFor(gene, gene.uid), locus: labelFor(locus, locus.uid), cluster: labelFor(cluster, cluster.uid), group: labelFor(groups.get(gene.uid), "Ungrouped"), colour: gene.colour || groups.get(gene.uid)?.colour };
  }

  #groupTreeRows(data, groups, visible, needle) {
    const entries = new Map(visible.flatMap(({ gene, locus, cluster }) => {
      const entry = { gene, locus, cluster };
      return [[gene.uid, entry], [String(gene.uid), entry]];
    }));
    const buckets = [
      ...(data.groups || []).map((group) => ({ group, key: `gene-group:${group.uid}`, label: labelFor(group, group.uid), genes: (group.genes || []).map((id) => entries.get(id)).filter(Boolean) })),
      { key: "gene-group:ungrouped", label: "Ungrouped", genes: visible.filter(({ gene }) => !groups.has(gene.uid)) },
    ];
    const rows = [];
    for (const bucket of buckets) {
      if (!bucket.genes.length) continue;
      const open = Boolean(needle) || this.#expanded.has(bucket.key);
      rows.push({ type: "gene-group", group: bucket.group, key: bucket.key, label: bucket.label, count: bucket.genes.length, selectIds: bucket.genes.map(({ gene }) => gene.uid), open });
      if (open) rows.push(...bucket.genes.map(({ gene, locus, cluster }) => this.#geneRow(gene, locus, cluster, groups, 1)));
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

  #setDataFilter(text) {
    if (this.#kind === "annotations") this.#annotationEditor?.setFilter(text);
    else {
      this.#filter = text.trim().toLowerCase();
      this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
    }
    this.#renderData();
  }

  #clearDataSelection() {
    if (this.#kind === "annotations") this.#annotationEditor?.clearSelection();
    else { this.#selected.clear(); this.#renderData(); this.#syncHighlight(); }
  }

  #renderData() {
    if (this.querySelector('[data-panel="data"]')?.hidden) return;
    const annotations = this.#kind === "annotations";
    const annotationHost = this.querySelector("[data-annotation-editor]");
    if (!annotationHost) return;
    this.querySelector("[data-kind-picker]").value = this.#kind;
    this.querySelector("[data-gene-view]").value = this.#geneView;
    annotationHost.hidden = !annotations;
    this.querySelector("[data-annotation-toolbar]").hidden = !annotations;
    const search = this.querySelector("[data-filter]");
    search.value = annotations ? this.#annotationEditor?.filter || "" : this.#filter;
    search.setAttribute("placeholder", annotations ? "Find a cluster" : "Search names, labels, loci, or clusters");
    this.querySelector("[data-record-editor]").hidden = annotations;
    if (annotations) {
      this.#disposeRows();
      for (const selector of ["[data-gene-view]", "[data-member-filter]", '[data-command="new-group"]',
        '[data-command="toggle-tree"]']) this.querySelector(selector).hidden = true;
      if (!this.#annotationEditor) {
        this.#annotationEditor = createAnnotationDataControls({ document: this.ownerDocument,
          embedded: true,
          getData: () => this.#chart?.data?.() || { clusters: [] },
          getClusters: () => this.#data()?.clusters || [], patch: (operations) => this.#chart.patch(operations),
          annotationApi: { ANNOTATION_DEFAULTS, ANNOTATION_PALETTES, resolveAnnotationScale, validateAnnotationPanels },
        });
        annotationHost.append(this.#annotationEditor.node);
        this.querySelector("[data-annotation-toolbar]").append(this.#annotationEditor.toolbar);
      } else this.#annotationEditor.update();
      search.value = this.#annotationEditor.filter;
      return;
    }
    const data = this.#data();
    const table = this.#table;
    const head = this.querySelector("[data-head]");
    const list = this.querySelector("[data-rows]");
    if (!data) {
      this.#disposeRows();
      table.header = { columns: [], sort: null }; list.textContent = "Set the chart property to edit a ClusterMap chart.";
      this.#selectionControls.update({ ids: [], summary: "No chart attached.", noun: this.#kind.slice(0, -1) });
      this.#actions.state = { kind: this.#kind, count: 0, groups: [], allGroups: [], loci: [], clusters: [] };
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
    const columns = isTree ? [{ label: "" }, { label: "" }, { label: this.#geneView === "groups" ? "Group / gene" : "Cluster / locus / gene" }, { label: "Group" }, { label: "Colour" }]
      : this.#kind === "groups" ? [{ label: "" }, { label: "↕" }, { label: "Group" }, { label: "Legend label" }, { label: "Genes" }, { label: "" }, { label: "Colour" }]
      : this.#kind === "links" ? [{ label: "" }, { label: "Source", sort: "source" }, { label: "Target", sort: "target" }, { label: "Identity", sort: "identity" }, { label: "Endpoint groups", sort: "groups" }, { label: "Link label", sort: "label" }, { label: "" }, { label: "Colour" }]
        : [{ label: "" }, { label: "Gene", sort: "label" }, { label: "Locus", sort: "locus" }, { label: "Cluster", sort: "cluster" }, { label: "Group", sort: "group" }, { label: "Colour" }];
    const sort = this.#sort[this.#kind];
    head.className = `cm-data-head cm-editor__head cm-editor__head--${isTree ? "tree" : this.#kind}`;
    table.header = { columns, sort };
    list.className = `cm-editor__rows cm-editor__rows--${isTree ? "tree" : this.#kind}`;
    if (this.#rowKind !== this.#kind) this.#disposeRows();
    if (!this.#rowKind) {
      const kind = this.#kind;
      this.#rowKind = kind;
      list.replaceChildren();
      const components = new WeakMap();
      const updateRow = (node, row) => components.get(node).update(row, this.#selected);
      table.renderer = { container: list,
        key: (row) => `${kind}:${row.type || "row"}:${row.key ?? row.id}`,
        headerHeight: () => head.offsetHeight,
        createRow: (row) => {
          const component = createEditorRow(this.ownerDocument, kind, row.type,
            (type, id, changes, control) => this.#apply({ type: `${type}.update`, ids: [this.#id(id)], changes }, control));
          components.set(component.node, component); return updateRow(component.node, row);
        },
        disposeRow: (node) => components.get(node).destroy(), updateRow };
    }
    if (this.#selectionData !== data) {
      const cache = this.#cache();
      const records = this.#kind === "genes" ? cache.geneById.values() : this.#kind === "links" ? data.links : data.groups;
      this.#selected.prune([...records].map((record) => record.uid)); this.#selectionData = data;
    }
    table.rows = rows;
    const visibleGenes = isTree ? new Set(rows.flatMap((row) => row.selectIds || (row.type === "gene" ? [row.id] : []))).size : rows.length;
    const summaryText = isTree
      ? `${rows.filter((row) => row.type !== "gene").length.toLocaleString()} ${this.#geneView === "groups" ? "group" : "cluster/locus"} rows · ${visibleGenes.toLocaleString()} genes${this.#filter ? " matching search" : ""}.`
      : `${rows.length.toLocaleString()} visible ${this.#kind}${memberGroup && this.#kind === "genes" ? " in selected group" : ""}${this.#filter ? " matching search" : ""}.`;
    this.#selectionControls.update({ ids: this.#selectableIds(rows), summary: summaryText,
      noun: this.#kind.slice(0, -1), selectSuffix: isTree ? " genes" : "" });
    const parentRemoval = this.#kind === "genes" && this.#geneView === "tree" && this.#chart?.remove;
    this.#actions.state = { kind: this.#kind, count: this.#selected.size, groups: this.#selectedGroups(), allGroups: data.groups,
      loci: parentRemoval ? this.#selectedParents("loci") : [], clusters: parentRemoval ? this.#selectedParents("clusters") : [] };
  }

  #selectedGroups() {
    if (this.#kind === "groups") return (this.#data()?.groups || []).filter((group) => this.#selected.has(group.uid));
    if (this.#kind !== "genes" || this.#geneView !== "groups") return [];
    return this.#rows().filter((row) => row.type === "gene-group" && row.group?.genes?.length &&
      row.group.genes.every((id) => this.#selected.has(this.#id(id)))).map((row) => row.group);
  }

  #selectedParents(kind) {
    const clusters = this.#data()?.clusters || [];
    const records = kind === "loci" ? clusters.flatMap((cluster) => cluster.loci) : clusters;
    return records.filter((record) => {
      const genes = kind === "loci" ? record.genes : record.loci.flatMap((locus) => locus.genes);
      return genes.length && genes.every((gene) => this.#selected.has(gene.uid));
    }).map((record) => record.uid);
  }

  #removeRecords(kind, ids) {
    if (!ids.length || !window.confirm(`Remove ${ids.length} ${kind} and all their genes from the plot? This can be undone.`)) return;
    this.#runEdit(() => {
      this.#chart.remove({ [kind]: ids });
      this.#selected.clear();
      this.#renderData(); this.#syncHighlight();
    });
  }

  #deleteSelected(kind = this.#kind, ids = [...this.#selected]) {
    if (!ids.length || !window.confirm(`Delete ${ids.length} selected ${kind}?${kind === "groups" ? " Their genes will remain in the plot." : ""}`)) return;
    const type = `${kind}.delete`;
    this.#selected.clear();
    this.#apply({ type, ids });
  }

  #moveGroup(uid, index) {
    const ids = this.#data().groups.map((group) => group.uid), from = ids.indexOf(uid);
    if (from < 0 || !Number.isFinite(index)) return;
    const to = Math.max(0, Math.min(ids.length - 1, Math.trunc(index)));
    if (to === from) return;
    ids.splice(from, 1);
    ids.splice(to, 0, uid);
    this.#apply({ type: "groups.reorder", ids });
  }

  #viewGroupMembers(groupId) {
    this.#memberGroupId = this.#id(groupId);
    this.#kind = "genes";
    this.#geneView = "list";
    this.#selected.clear();
    this.querySelector(".cm-editor__table")?.scrollTo({ top: 0 });
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
    const ids = this.#data().groups.map((group) => group.uid);
    const from = ids.indexOf(uid), target = ids.indexOf(targetUid);
    if (from < 0 || target < 0 || uid === targetUid) return;
    this.#moveGroup(uid, target + Number(after) - Number(from < target));
  }

  #finishGroupDrag() {
    this.#draggedGroupId = null;
    this.querySelectorAll(".cm-editor__drop-target").forEach((node) => node.classList.remove("cm-editor__drop-target"));
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
    if (!this.#appearanceView) {
      this.#appearanceView = createAppearanceControls({ document: this.ownerDocument,
        patch: (ops) => this.#chart.patch(ops), preview: (ops) => this.#chart.previewTreePresentation(ops) });
      this.#appearanceView.node.addEventListener("config-change", (event) => {
        if (this.#setConfig(event.detail) === false) event.preventDefault();
      });
      container.append(this.#appearanceView.node);
    }
    this.#appearanceView.update({ config, tree: this.#chart.data()?.tree });
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

const toolbarTemplate = createTemplate(await "<strong></strong>\n<button type=\"button\" data-action=\"focus\">Focus</button>\n<button type=\"button\" data-action=\"flip\">Flip</button>\n<button type=\"button\" data-action=\"trim\">Trim</button>\n<clinker-action-menu label=\"Loci…\" data-loci-menu hidden>\n  <button type=\"button\" data-action=\"restore\">Restore full loci</button>\n</clinker-action-menu>\n<clinker-action-menu label=\"More…\" data-more-menu>\n  <button type=\"button\" data-action=\"edit\">Edit data…</button>\n  <button type=\"button\" data-action=\"remove\"></button>\n</clinker-action-menu>\n<button type=\"button\" data-action=\"clear\">Clear</button>\n");

let activeToolbar = null;

/** Mount contextual plot actions without requiring the full data editor. */
function mountPlotSelectionToolbar(chart, container) {
  if (!chart?.selection || !chart?.flipLoci || !chart?.trimLoci || !chart?.restoreLoci) throw new TypeError("A mounted ClusterMap chart is required.");
  if (!(container instanceof Element)) throw new TypeError("A plot container element is required.");
  const document = container.ownerDocument;
  defineActionMenu(); installDataEditorStyle(document);
  const root = document.createElement("div");
  root.className = "cm-data-ui cm-plot-selection-toolbar";
  root.hidden = true;
  root.append(toolbarTemplate(document));
  const button = (action) => root.querySelector(`[data-action="${action}"]`);
  const flip = button("flip"), trim = button("trim"), restore = button("restore");
  const lociMenu = root.querySelector("[data-loci-menu]"), moreMenu = root.querySelector("[data-more-menu]");
  let clusterActions;
  const editor = () => [...document.querySelectorAll("clinker-editor")].find((editor) => editor.chart === chart);
  const lociFor = ({ kind, ids }) => kind === "loci" ? ids :
    (chart.visibleData()?.clusters || []).filter((cluster) => ids.includes(cluster.uid)).flatMap((cluster) => cluster.loci.map((locus) => locus.uid));
  const sync = () => {
    const { kind, ids } = chart.selection(), clusters = kind === "clusters";
    root.hidden = !ids.length;
    const noun = ids.length === 1 ? (clusters ? "cluster" : "locus") : kind;
    root.querySelector("strong").textContent = `${ids.length} ${noun} selected`;
    flip.textContent = clusters ? "Flip each locus" : "Flip"; trim.textContent = clusters ? "Trim each locus" : "Trim";
    button("edit").hidden = !editor(); button("remove").textContent = `Remove selected ${kind}`;
    if (clusterActions !== clusters) {
      if (clusters) lociMenu.prepend(flip, trim, restore);
      else { root.insertBefore(flip, lociMenu); root.insertBefore(trim, lociMenu); moreMenu.prepend(restore); }
      lociMenu.open = moreMenu.open = false;
      lociMenu.hidden = !clusters; clusterActions = clusters;
    }
    if (root.hidden) lociMenu.open = moreMenu.open = false;
  };
  const clear = () => chart.selection({ kind: chart.selection().kind, ids: [] });
  const activate = () => { activeToolbar = root; };
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const selection = chart.selection(), loci = lociFor(selection);
    if (action === "flip") chart.flipLoci(loci);
    else if (action === "trim") chart.trimLoci(loci);
    else if (action === "restore") chart.restoreLoci(loci);
    else if (action === "clear") clear();
    else if (action === "edit") editor()?.editSelection(selection);
    else if (action === "focus") chart.focus({ [selection.kind]: selection.ids });
    else if (action === "remove" && document.defaultView.confirm(`Remove ${selection.ids.length} ${selection.kind} and their contents from the plot? This can be undone.`)) {
      chart.remove({ [selection.kind]: selection.ids });
    }
    for (const menu of root.querySelectorAll("clinker-action-menu[open]")) menu.open = false;
  });
  const onKeyDown = (event) => {
    if (activeToolbar !== root || event.key !== "Escape" || event.defaultPrevented || !chart.selection().ids.length) return;
    if (event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault(); clear();
  };
  container.addEventListener("pointerdown", activate);
  container.addEventListener("focusin", activate);
  document.addEventListener("keydown", onKeyDown);
  const unsubscribe = chart.on("change", (change) => {
    if (["selection.change", "state.replace", "data.apply", "data.replace"].includes(change.type)) sync();
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
