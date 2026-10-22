import { createTemplate } from "../uiControls.mjs";

const headingTemplate = createTemplate('<span class="cm-data-cell"></span>');
const sortTemplate = createTemplate('<button type="button" class="cm-data-cell cm-editor__sort"><span data-label></span><span aria-hidden="true"></span></button>');
export function createDataHeader(document, node) {
  let key;
  return (columns, sort) => {
    const next = JSON.stringify(columns);
    if (key !== next) {
      node.replaceChildren(...columns.map(({ label, sort }, index) => {
        const cell = (sort ? sortTemplate : headingTemplate)(document).firstElementChild;
        if (sort) { cell.dataset.sort = sort; cell.querySelector("[data-label]").textContent = label; cell.title = `Sort by ${label}`; }
        else cell.textContent = label;
        cell.classList.toggle("cm-data-cell--select", index === 0); return cell;
      })); key = next;
    }
    for (const button of node.querySelectorAll("[data-sort]")) {
      const label = button.querySelector("[data-label]").textContent, active = sort?.key === button.dataset.sort;
      button.setAttribute("aria-label", `Sort by ${label}, ${active && sort.direction < 0 ? "descending" : "ascending"}`);
      button.lastElementChild.textContent = active ? sort.direction < 0 ? "↓" : "↑" : "↕";
    }
  };
}
