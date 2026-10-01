// Public editing operations deliberately distinguish presentation updates from
// structural group edits. Group membership is exclusive: assigning a gene to
// one group removes it from every other group.
const fieldsForType = {
  "genes.update": new Set(["label", "colour", "name"]),
  "groups.update": new Set(["label", "subtitle", "colour", "hidden"]),
  "loci.update": new Set(["label", "name"]),
  "clusters.update": new Set(["label", "name"]),
  "links.update": new Set(["label", "colour", "hidden", "identity"]),
};

// Most edits change records already held by the renderer, so a redraw is
// enough. Only operations which invalidate an ID lookup or the layout state
// ask the chart controller to rebuild those derived structures.
const effectsForType = {
  "genes.delete": { reindex: true, rebuildState: true, refreshDerivedGroups: true },
  "genes.restore": { reindex: true, rebuildState: true, refreshDerivedGroups: true },
  "links.delete": { reindex: true, refreshDerivedGroups: true },
  "links.restore": { reindex: true, refreshDerivedGroups: true },
  "groups.create": { reindex: true },
  "groups.delete": { reindex: true },
  "groups.merge": { reindex: true },
};

function operationEffects(operations) {
  const effects = { reindex: false, rebuildState: false, refreshDerivedGroups: false };
  for (const { type } of operations) {
    const next = effectsForType[type];
    if (!next) continue;
    if (next.reindex) effects.reindex = true;
    if (next.rebuildState) effects.rebuildState = true;
    if (next.refreshDerivedGroups) effects.refreshDerivedGroups = true;
  }
  return effects;
}

function operationError(message) {
  return new TypeError(`Invalid chart operation: ${message}`);
}

function uniqueIds(value, description) {
  if (!Array.isArray(value) || !value.length) {
    throw operationError(`${description} requires a non-empty array`);
  }
  return [...new Set(value)];
}

function validateGeneIds(index, geneIds, description) {
  const ids = uniqueIds(geneIds, description);
  for (const uid of ids) {
    if (!index.geneById.has(uid)) throw operationError(`${description} refers to unknown gene ${uid}`);
  }
  return ids;
}

function validateOptionalGeneIds(index, geneIds, description) {
  if (!Array.isArray(geneIds)) throw operationError(`${description} requires a geneIds array`);
  const ids = [...new Set(geneIds)];
  for (const uid of ids) {
    if (!index.geneById.has(uid)) throw operationError(`${description} refers to unknown gene ${uid}`);
  }
  return ids;
}

function recordsForOperation(index, type) {
  if (type === "genes.update") return index.geneById;
  if (type === "groups.update") return index.groupById;
  if (type === "loci.update") return index.locusById;
  if (type === "links.update") return index.linkById;
  return index.clusterById;
}

function validateUpdate(operation, index, groupIds) {
  const fields = fieldsForType[operation.type];
  if (!fields) return null;
  const ids = uniqueIds(operation.ids, operation.type);
  if (!operation.changes || typeof operation.changes !== "object" || Array.isArray(operation.changes)) {
    throw operationError(`${operation.type} requires a changes object`);
  }
  const changeKeys = Object.keys(operation.changes);
  if (!changeKeys.length || changeKeys.some((key) => !fields.has(key))) {
    throw operationError(`${operation.type} contains an unsupported field`);
  }
  if (operation.type === "links.update" && "identity" in operation.changes) {
    const identity = Number(operation.changes.identity);
    if (!Number.isFinite(identity) || identity < 0 || identity > 1) {
      throw operationError("links.update identity must be a number from 0 to 1");
    }
    operation = { ...operation, changes: { ...operation.changes, identity } };
  }
  const records = recordsForOperation(index, operation.type);
  for (const uid of ids) {
    if (operation.type === "groups.update") requireKnownGroup(groupIds, uid, operation.type);
    if (!records.has(uid)) throw operationError(`${operation.type} refers to unknown ID ${uid}`);
  }
  return { type: operation.type, ids, changes: { ...operation.changes } };
}

function requireKnownGroup(groupIds, uid, type) {
  if (!groupIds.has(uid)) throw operationError(`${type} refers to unknown group ${uid}`);
}

function validateStructuralGroupOperation(operation, index, groupIds) {
  switch (operation.type) {
    case "groups.assignGenes": {
      requireKnownGroup(groupIds, operation.groupId, operation.type);
      return { type: operation.type, groupId: operation.groupId, geneIds: validateGeneIds(index, operation.geneIds, operation.type) };
    }
    case "groups.unassignGenes":
      return { type: operation.type, geneIds: validateGeneIds(index, operation.geneIds, operation.type) };
    case "groups.delete": {
      const ids = uniqueIds(operation.ids, operation.type);
      ids.forEach((uid) => requireKnownGroup(groupIds, uid, operation.type));
      ids.forEach((uid) => groupIds.delete(uid));
      return { type: operation.type, ids };
    }
    case "groups.merge": {
      requireKnownGroup(groupIds, operation.targetId, operation.type);
      const sourceIds = uniqueIds(operation.sourceIds, operation.type).filter((uid) => uid !== operation.targetId);
      if (!sourceIds.length) throw operationError(`${operation.type} requires at least one source group other than the target`);
      sourceIds.forEach((uid) => requireKnownGroup(groupIds, uid, operation.type));
      sourceIds.forEach((uid) => groupIds.delete(uid));
      return { type: operation.type, targetId: operation.targetId, sourceIds };
    }
    case "groups.reorder": {
      const ids = uniqueIds(operation.ids, operation.type);
      if (ids.length !== groupIds.size || ids.some((uid) => !groupIds.has(uid))) {
        throw operationError(`${operation.type} must contain every group exactly once`);
      }
      return { type: operation.type, ids };
    }
    case "groups.create": {
      const group = operation.group;
      if (!group || typeof group !== "object" || Array.isArray(group)) throw operationError("groups.create requires a group object");
      if (group.uid === undefined || group.uid === null || group.uid === "") throw operationError("groups.create requires group.uid");
      if (groupIds.has(group.uid)) throw operationError(`groups.create refers to existing group ${group.uid}`);
      const unsupported = Object.keys(group).filter((key) => !["uid", "label", "subtitle", "colour", "hidden"].includes(key));
      if (unsupported.length) throw operationError("groups.create contains an unsupported group field");
      groupIds.add(group.uid);
      return {
        type: operation.type,
        group: {
          uid: group.uid,
          ...(group.label !== undefined ? { label: group.label } : {}),
          ...(group.subtitle !== undefined ? { subtitle: group.subtitle } : {}),
          ...(group.colour !== undefined ? { colour: group.colour } : {}),
          ...(group.hidden !== undefined ? { hidden: Boolean(group.hidden) } : {}),
        },
        geneIds: operation.geneIds === undefined ? [] : validateOptionalGeneIds(index, operation.geneIds, operation.type),
      };
    }
    default:
      throw operationError(`unsupported type ${String(operation.type)}`);
  }
}

function validateOperation(operation, index, groupIds) {
  if (!operation || typeof operation !== "object") throw operationError("each operation must be an object");
  if (operation.type === "genes.delete") {
    return { type: operation.type, ids: validateGeneIds(index, operation.ids, operation.type) };
  }
  if (operation.type === "links.delete") {
    const ids = uniqueIds(operation.ids, operation.type);
    for (const uid of ids) {
      if (!index.linkById.has(uid)) throw operationError(`${operation.type} refers to unknown link ${uid}`);
    }
    return { type: operation.type, ids };
  }
  // Restore operations are generated by chart history. They deliberately are
  // not part of the documented editing API, but keeping them serializable
  // means undo never needs a full copy of a chart's links or genes.
  if (operation.type === "genes.restore") {
    if (!Array.isArray(operation.records) || !operation.records.length) {
      throw operationError("genes.restore requires records");
    }
    return {
      type: operation.type,
      records: operation.records.map(({ locusId, index: position, gene }) => {
        if (!index.locusById.has(locusId) || !gene || typeof gene !== "object") {
          throw operationError("genes.restore contains an invalid record");
        }
        return { locusId, index: Math.max(0, Math.trunc(position) || 0), gene: structuredClone(gene) };
      }),
    };
  }
  if (operation.type === "links.restore") {
    if (!Array.isArray(operation.records) || !operation.records.length) {
      throw operationError("links.restore requires records");
    }
    return {
      type: operation.type,
      records: operation.records.map(({ index: position, link }) => {
        if (!link || typeof link !== "object") throw operationError("links.restore contains an invalid record");
        return { index: Math.max(0, Math.trunc(position) || 0), link: structuredClone(link) };
      }),
    };
  }
  return validateUpdate(operation, index, groupIds) || validateStructuralGroupOperation(operation, index, groupIds);
}

function removeGenesFromGroups(groups, geneIds) {
  const genes = new Set(geneIds);
  groups.forEach((group) => {
    group.genes = (group.genes || []).filter((uid) => !genes.has(uid));
  });
}

function assignGenes(groups, groupId, geneIds) {
  removeGenesFromGroups(groups, geneIds);
  const group = groups.find((candidate) => candidate.uid === groupId);
  group.genes = [...new Set([...(group.genes || []), ...geneIds])];
}

function applyOperation(data, index, operation) {
  const updateRecords = fieldsForType[operation.type] && recordsForOperation(index, operation.type);
  if (updateRecords) {
    operation.ids.forEach((uid) => Object.assign(updateRecords.get(uid), operation.changes));
    return;
  }
  switch (operation.type) {
    case "genes.delete": {
      const ids = new Set(operation.ids);
      data.clusters.forEach((cluster) => cluster.loci.forEach((locus) => {
        locus.genes = locus.genes.filter((gene) => !ids.has(gene.uid));
      }));
      return;
    }
    case "genes.restore": {
      const loci = index.locusById;
      for (const { locusId, index: position, gene } of operation.records) {
        const locus = loci.get(locusId);
        locus.genes.splice(Math.min(position, locus.genes.length), 0, structuredClone(gene));
      }
      return;
    }
    case "links.delete": {
      const ids = new Set(operation.ids);
      data.links = data.links.filter((link) => !ids.has(link.uid));
      return;
    }
    case "links.restore":
      for (const { index: position, link } of operation.records) {
        data.links.splice(Math.min(position, data.links.length), 0, structuredClone(link));
      }
      return;
    case "groups.assignGenes":
      assignGenes(data.groups, operation.groupId, operation.geneIds);
      return;
    case "groups.unassignGenes":
      removeGenesFromGroups(data.groups, operation.geneIds);
      return;
    case "groups.create":
      removeGenesFromGroups(data.groups, operation.geneIds);
      data.groups.push({ ...operation.group, genes: [...operation.geneIds] });
      return;
    case "groups.delete": {
      const ids = new Set(operation.ids);
      data.groups = data.groups.filter((group) => !ids.has(group.uid));
      return;
    }
    case "groups.merge": {
      const target = data.groups.find((group) => group.uid === operation.targetId);
      const sourceIds = new Set(operation.sourceIds);
      const sourceGenes = data.groups.filter((group) => sourceIds.has(group.uid)).flatMap((group) => group.genes || []);
      target.genes = [...new Set([...(target.genes || []), ...sourceGenes])];
      data.groups = data.groups.filter((group) => !sourceIds.has(group.uid));
      return;
    }
    case "groups.reorder": {
      const groups = new Map(data.groups.map((group) => [group.uid, group]));
      data.groups = operation.ids.map((uid) => groups.get(uid));
      return;
    }
  }
}

function publicGroup(group) {
  return Object.fromEntries(["uid", "label", "subtitle", "colour", "hidden"]
    .filter((key) => key in group)
    .map((key) => [key, structuredClone(group[key])]));
}

function inverseOperation(data, index, operation) {
  const records = fieldsForType[operation.type] && recordsForOperation(index, operation.type);
  if (records) {
    const fields = Object.keys(operation.changes);
    return operation.ids.map((uid) => {
      const record = records.get(uid);
      return {
        type: operation.type,
        ids: [record.uid],
        changes: Object.fromEntries(fields.map((field) => [field, structuredClone(record[field])])),
      };
    });
  }
  if (operation.type === "genes.delete") {
    const removed = new Set(operation.ids);
    return [{
      type: "genes.restore",
      records: data.clusters.flatMap((cluster) => cluster.loci.flatMap((locus) => locus.genes
        .map((gene, position) => removed.has(gene.uid) && { locusId: locus.uid, index: position, gene: structuredClone(gene) })
        .filter(Boolean))),
    }];
  }
  if (operation.type === "links.delete") {
    const removed = new Set(operation.ids);
    return [{
      type: "links.restore",
      records: data.links.map((link, position) => removed.has(link.uid) && { index: position, link: structuredClone(link) }).filter(Boolean),
    }];
  }
  if (operation.type === "groups.reorder") {
    return [{ type: "groups.reorder", ids: data.groups.map((group) => group.uid) }];
  }
  if (operation.type === "groups.create") {
    const affected = new Set(operation.geneIds);
    const restore = data.groups
      .map((group) => ({ group, geneIds: (group.genes || []).filter((uid) => affected.has(uid)) }))
      .filter(({ geneIds }) => geneIds.length);
    return [
      { type: "groups.delete", ids: [operation.group.uid] },
      ...restore.map(({ group, geneIds }) => ({ type: "groups.assignGenes", groupId: group.uid, geneIds })),
    ];
  }
  if (operation.type === "groups.assignGenes" || operation.type === "groups.unassignGenes") {
    const affected = new Set(operation.geneIds);
    const restore = data.groups
      .map((group) => ({ group, geneIds: (group.genes || []).filter((uid) => affected.has(uid)) }))
      .filter(({ geneIds }) => geneIds.length);
    return [
      { type: "groups.unassignGenes", geneIds: operation.geneIds },
      ...restore.map(({ group, geneIds }) => ({ type: "groups.assignGenes", groupId: group.uid, geneIds })),
    ];
  }
  if (operation.type === "groups.delete") {
    const removed = new Set(operation.ids);
    const groups = data.groups.filter((group) => removed.has(group.uid));
    return [
      ...groups.map((group) => ({ type: "groups.create", group: publicGroup(group), geneIds: [...(group.genes || [])] })),
      { type: "groups.reorder", ids: data.groups.map((group) => group.uid) },
    ];
  }
  if (operation.type === "groups.merge") {
    const sourceIds = new Set(operation.sourceIds);
    const previous = data.groups.filter((group) => sourceIds.has(group.uid) || group.uid === operation.targetId);
    const target = previous.find((group) => group.uid === operation.targetId);
    const sources = previous.filter((group) => group.uid !== operation.targetId);
    const geneIds = [...new Set(previous.flatMap((group) => group.genes || []))];
    return [
      ...(geneIds.length ? [{ type: "groups.unassignGenes", geneIds }] : []),
      ...(target?.genes?.length ? [{ type: "groups.assignGenes", groupId: target.uid, geneIds: [...target.genes] }] : []),
      ...sources.map((group) => ({ type: "groups.create", group: publicGroup(group), geneIds: [...(group.genes || [])] })),
      { type: "groups.reorder", ids: data.groups.map((group) => group.uid) },
    ];
  }
  return [];
}

/**
 * Validate then apply a serializable batch of chart edits. Structural group
 * edits are validated against a virtual group ID set first, so a malformed
 * later operation cannot leave earlier records partially modified.
 */
export function applyChartOperations(data, index, operations) {
  if (!Array.isArray(operations) || !operations.length) {
    throw operationError("operations must be a non-empty array");
  }
  const groupIds = new Set(index.groupById.keys());
  const applied = operations.map((operation) => validateOperation(operation, index, groupIds));
  const hasStructuralGroupEdit = applied.some((operation) => operation.type !== "groups.update" && operation.type.startsWith("groups."));
  const inverse = [];
  for (const operation of applied) {
    inverse.unshift(...inverseOperation(data, index, operation));
    applyOperation(data, index, operation);
  }
  // Link-derived grouping is useful for an untouched chart, but a deliberate
  // membership edit makes the user's group assignments authoritative.
  if (hasStructuralGroupEdit) data.config = { ...(data.config || {}), updateGroups: false };
  return { data, operations: applied, inverse, effects: operationEffects(applied) };
}
