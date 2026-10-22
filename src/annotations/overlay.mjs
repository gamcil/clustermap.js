import { worldPoint } from "../scene/camera.mjs";
import { textAsset } from "../ui/assets.mjs";
import { installDataEditorStyle, installStyle } from "../editor/shared/styles.mjs";
import { defineAnnotationEditor } from "../editor/components/annotation-editor/annotation-editor.js";
import { createAnnotationControls } from "./controls.mjs";
import { defineAnnotationDataForm } from "../editor/components/annotation-data-form/annotation-data-form.js";
import { createAnnotationPanel } from "./data.mjs";

const css = await textAsset(new URL("./overlay.css", import.meta.url));

/** Renderer-independent editing affordances, kept outside the exported scene. */
export function createAnnotationOverlay({ container, getData, patch, annotationApi, editData }) {
  const getPanels = () => getData()?.annotationPanels || [];
  const { annotationPanelsForFrame, annotationPanelBounds, hitTestAnnotationCell } = annotationApi;
  const document = container.ownerDocument, window = document.defaultView;
  installDataEditorStyle(document);
  installStyle(document, "clustermap-annotation-ui-style", css);
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
  const tooltip = element("div", "annotation-tooltip"); tooltip.hidden = true;
  tooltip.setAttribute("role", "tooltip");
  let context = null, surfaces = [], hovered = null, menuState = null;
  let tooltipKey = null;
  let panelAreas = [], addArea = null;
  let areaScene = null, areaPreview = null;
  const contains = (bounds, point) => point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
  const hideFrame = () => { if (!menuState) { hovered = null; frame.hidden = true; addFrame.hidden = true; } };
  const hideTooltip = () => { tooltip.hidden = true; tooltipKey = null; };
  const updateTooltip = (event, point) => {
    const cell = hitTestAnnotationCell(context.getScene(), point, context.getPreview());
    if (!cell) { hideTooltip(); return; }
    const key = JSON.stringify([cell.panelUid, cell.clusterUid, cell.column, cell.value]);
    if (tooltipKey !== key) {
      tooltipKey = key; tooltip.replaceChildren();
      element("strong", "", tooltip).textContent = cell.title || cell.panelUid;
      for (const value of [cell.clusterName, `${cell.column}: ${cell.value === null ? "Missing" : cell.value}`]) {
        element("div", "", tooltip).textContent = value;
      }
    }
    tooltip.hidden = false;
    const bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(event.clientX + 12, window.innerWidth - bounds.width - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(event.clientY + 12, window.innerHeight - bounds.height - 8))}px`;
  };
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
    hideTooltip();
    if (!menuState && !hovered && frame.hidden && addFrame.hidden) return;
    const opener = menuState?.opener;
    menuState = null; hovered = null; menu.hidden = true; frame.hidden = true; addFrame.hidden = true;
    menu.replaceChildren();
    for (const button of [edit, hiddenButton, add]) button.setAttribute("aria-expanded", "false");
    if (returnFocus && opener?.isConnected && !opener.hidden && !opener.closest("[hidden]")) opener.focus({ preventScroll: true });
    else if (returnFocus) surfaces[0]?.focus?.({ preventScroll: true });
  };
  const syncDataEditor = (state) => {
    const data = getData();
    Object.assign(state, { panels: data.annotationPanels, panel: data.annotationPanels?.find((panel) => panel.uid === state.editor.value), clusters: data.clusters });
    state.editor.state = { data, clusters: data.clusters, annotationApi,
      patch: (operations) => { patch(operations); syncDataEditor(state); } };
  };
  const beginMenu = (kind, title, button, uid = null) => {
    hideTooltip();
    // Keep the menu anchored when creating a panel moves its opener offscreen.
    const anchor = button.closest("[hidden]") ? menuState?.anchor : button.getBoundingClientRect();
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
        defineAnnotationEditor();
        dataState.editor = document.createElement("clinker-annotation-editor");
        syncDataEditor(dataState);
        dataState.editor.select(uid); menu.append(dataState.editor); positionMenu();
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
    defineAnnotationDataForm();
    const form = document.createElement("clinker-annotation-data-form"); form.clusters = getData().clusters;
    form.addEventListener("data-submit", (event) => {
      try {
        const panel = createAnnotationPanel(event.detail, getPanels());
        patch([{ type: "annotationPanels.create", panel }]); openPanel(panel.uid, add);
      } catch (exception) { form.error = exception.message; }
    });
    menu.append(form); showAddFrame(); positionMenu();
    form.focus({ preventScroll: true });
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
  const refresh = (event) => {
    if (event) hideTooltip();
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
    if (menuState) { hideTooltip(); return; }
    if (event.buttons || context.isBusy()) { hideTooltip(); hideFrame(); return; }
    refresh();
    const camera = context.getCamera();
    const point = worldPoint(event.currentTarget, event, camera);
    updateTooltip(event, point);
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
    hideTooltip();
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
      if (surfacesChanged) detach();
      context = next; surfaces = nextSurfaces;
      for (const item of [frame, addFrame, menu, hiddenButton, tooltip]) item.style.fontFamily = next.fontFamily;
      if (surfacesChanged) for (const surface of surfaces) {
        surface.addEventListener("pointermove", move); surface.addEventListener("pointerleave", leave);
        surface.addEventListener("pointerdown", dismissForGesture); surface.addEventListener("wheel", dismissForGesture);
      }
      hideTooltip();
      if (menuState?.editor) {
        const data = getData(), panel = data.annotationPanels?.find((panel) => panel.uid === menuState.editor.value);
        if (menuState.panels !== data.annotationPanels || menuState.panel !== panel || menuState.clusters !== data.clusters) {
          syncDataEditor(menuState);
        }
      } else menuState?.controls?.update();
      refresh();
    },
    dispose() {
      detach(); window.removeEventListener("click", outside); window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", refresh); window.removeEventListener("scroll", refresh, true);
      frame.remove(); addFrame.remove(); menu.remove(); hiddenButton.remove(); tooltip.remove();
    },
  };
}
