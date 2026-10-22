import { createTemplate, updateSelectOptions, updateFieldValue } from "../uiControls.mjs";
import { createDataActionMenu } from "../dataEditorUi.mjs";

const headingTemplate = createTemplate('<span class="cm-data-cell"></span>');
const sortTemplate = createTemplate('<button type="button" class="cm-data-cell cm-editor__sort"><span data-label></span><span aria-hidden="true"></span></button>');
const focusTemplate = createTemplate('<button type="button" data-command="focus">Focus in plot</button>');
const assignTemplate = createTemplate(`<label>Move to <select data-assign-group></select></label>
  <button type="button" data-command="assign">Move</button><button type="button" data-command="unassign">Remove from groups</button>
  <button type="button" data-command="new-group-for-selection">New group…</button>`);
const presentationTemplate = createTemplate(`<input data-batch-label placeholder="Set label"><button type="button" data-command="batch-label">Set label</button>
  <label title="Set colour"><span class="cm-editor__sr-only">Set colour</span><input type="color" value="#888888" aria-label="Set colour" data-batch-colour></label>
  <select data-batch-visibility aria-label="Set visibility"><option value="">Visibility…</option><option value="show">Show</option><option value="hide">Hide</option></select>`);
const identityTemplate = createTemplate(`<input type="number" data-batch-identity min="0" max="100" step=".1" placeholder="Set identity (%)">
  <button type="button" data-command="batch-identity">Set identity</button>`);
const mergeTemplate = createTemplate('<select data-merge-target></select><button type="button" data-command="merge">Merge groups</button>');
const groupTemplate = createTemplate(`<button type="button" data-command="view-members">View member genes</button>
  <label>Position <input type="number" data-group-position required min="1"></label>`);
const removeTemplate = createTemplate('<button type="button" data-command="delete" class="cm-editor__danger"></button>');
const removeLociTemplate = createTemplate('<button type="button" data-command="remove-loci"></button>');
const removeClustersTemplate = createTemplate('<button type="button" data-command="remove-clusters"></button>');
const removeGroupsTemplate = createTemplate('<button type="button" data-command="delete-groups" title="Genes remain in the plot"></button>');
const groupOptions = (groups) => groups.map((group) => [group.uid, group.label || group.name || group.uid]);

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

export function createEditorActions(document, node) {
  let key;
  const menu = (label, template) => {
    const component = createDataActionMenu(document, label, template(document)); node.append(component.node); return component.body;
  };
  return ({ kind, count, groups, allGroups, loci, clusters }) => {
    const next = JSON.stringify([count > 0, kind, count > 1, Math.min(groups.length, 2), loci.length > 0, clusters.length > 0]);
    if (key !== next) {
      node.replaceChildren(); key = next;
      if (count) {
        node.append(focusTemplate(document));
        if (kind === "genes") menu("Assign…", assignTemplate);
        else if (count > 1) { const body = menu("Edit…", presentationTemplate); if (kind === "links") body.append(identityTemplate(document)); }
        if (groups.length) menu(groups.length > 1 ? "Merge…" : "Group…", groups.length > 1 ? mergeTemplate : groupTemplate);
        const remove = menu("Remove…", removeTemplate);
        if (loci.length) remove.append(removeLociTemplate(document));
        if (clusters.length) remove.append(removeClustersTemplate(document));
        if (kind === "genes" && groups.length) remove.append(removeGroupsTemplate(document));
      }
    }
    if (!count) return;
    const assign = node.querySelector("[data-assign-group]"), merge = node.querySelector("[data-merge-target]"), position = node.querySelector("[data-group-position]");
    if (assign) updateSelectOptions(assign, [["", "Choose a group…"], ...groupOptions(allGroups)]);
    if (merge) updateSelectOptions(merge, [["", "Choose group to keep…"], ...groupOptions(groups)]);
    if (position) { position.max = allGroups.length || 1; updateFieldValue(position, allGroups.findIndex((group) => group.uid === groups[0]?.uid) + 1); }
    for (const [command, label] of [["delete", `Delete selected ${kind}`], ["remove-loci", `Entire loci (${loci.length})`],
      ["remove-clusters", `Entire clusters (${clusters.length})`], ["delete-groups", `Delete groups (${groups.length})`]]) {
      const button = node.querySelector(`[data-command="${command}"]`); if (button) button.textContent = label;
    }
  };
}
