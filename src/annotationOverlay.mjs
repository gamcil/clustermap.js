import { installDataEditorStyle } from "./dataEditorUi.mjs";
import { createAnnotationDataControls } from "./annotationDataControls.mjs";
import { createAnnotationControls } from "./annotationControls.mjs";
import { createAnnotationCreateControls } from "./annotationCreateControls.mjs";
import { createAnnotationTooltip } from "./annotationTooltip.mjs";

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
export function createAnnotationOverlay({ container, getData, patch, annotationApi, editData }) {
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
