#!/usr/bin/env node

import { gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function fail(message) {
  throw new Error(`Cannot import Clinker render data: ${message}`);
}

function requiredString(value, path) {
  if (typeof value !== "string" || value.length === 0) fail(`${path} must be a non-empty string`);
  return value;
}

function requiredNumber(value, path) {
  if (!Number.isFinite(value)) fail(`${path} must be a finite number`);
  return value;
}

function importGene(gene, path) {
  const name = gene.label || gene.name || gene.uid;
  return {
    uid: requiredString(gene.uid, `${path}.uid`),
    name: requiredString(name, `${path}.label`),
    ...(gene.names ? { names: gene.names } : {}),
    start: requiredNumber(gene.start, `${path}.start`),
    end: requiredNumber(gene.end, `${path}.end`),
    strand: requiredNumber(gene.strand, `${path}.strand`),
  };
}

function importLocus(locus, path) {
  const start = requiredNumber(locus.start, `${path}.start`);
  const end = requiredNumber(locus.end, `${path}.end`);
  if (!Array.isArray(locus.genes)) fail(`${path}.genes must be an array`);

  return {
    uid: requiredString(locus.uid, `${path}.uid`),
    name: requiredString(locus.name, `${path}.name`),
    start,
    end,
    genes: locus.genes.map((gene, index) => importGene(gene, `${path}.genes[${index}]`)),
  };
}

function importCluster(cluster, path) {
  if (!Array.isArray(cluster.loci)) fail(`${path}.loci must be an array`);
  return {
    uid: requiredString(cluster.uid, `${path}.uid`),
    name: requiredString(cluster.name, `${path}.name`),
    loci: cluster.loci.map((locus, index) => importLocus(locus, `${path}.loci[${index}]`)),
  };
}

function importLink(link, index) {
  const queryUid = requiredString(link.q, `links[${index}].q`);
  const targetUid = requiredString(link.t, `links[${index}].t`);
  return {
    uid: `clinker-link-${index}`,
    query: { uid: queryUid },
    target: { uid: targetUid },
    identity: requiredNumber(link.i, `links[${index}].i`),
    ...(Number.isFinite(link.s) ? { similarity: link.s } : {}),
  };
}

function importGroup(group, index) {
  if (!Array.isArray(group.genes)) fail(`groups[${index}].genes must be an array`);
  return {
    uid: requiredString(group.uid, `groups[${index}].uid`),
    label: requiredString(group.label, `groups[${index}].label`),
    genes: group.genes.map((geneUid, geneIndex) =>
      requiredString(geneUid, `groups[${index}].genes[${geneIndex}]`)
    ),
    hidden: Boolean(group.hidden),
    colour: group.colour || null,
  };
}

function verifyReferences(data) {
  const genes = new Set(
    data.clusters.flatMap((cluster) =>
      cluster.loci.flatMap((locus) => locus.genes.map((gene) => gene.uid))
    )
  );
  if (genes.size === 0) fail("the data contains no genes");

  for (const [index, link] of data.links.entries()) {
    if (!genes.has(link.query.uid) || !genes.has(link.target.uid)) {
      fail(`links[${index}] refers to a missing gene`);
    }
  }
  for (const [index, group] of data.groups.entries()) {
    for (const geneUid of group.genes) {
      if (!genes.has(geneUid)) fail(`groups[${index}] refers to missing gene ${geneUid}`);
    }
  }
}

export function importClinkerRender(render) {
  if (!Array.isArray(render.clusters)) fail("clusters must be an array");
  if (!Array.isArray(render.links)) fail("links must be an array");
  if (!Array.isArray(render.groups)) fail("groups must be an array");

  const clustersByUid = new Map(
    render.clusters.map((cluster, index) => [
      requiredString(cluster.uid, `clusters[${index}].uid`),
      cluster,
    ])
  );
  const order = render.order || render.clusters.map((cluster) => cluster.uid);
  if (!Array.isArray(order)) fail("order must be an array");

  const data = {
    schemaVersion: 1,
    coordinateSystem: "locus-relative",
    // Clinker already supplies explicit homology groups. Recomputing connected
    // components from eleven thousand links is both incorrect for this source
    // and unnecessarily quadratic for a demo fixture.
    config: { updateGroups: false },
    clusters: order.map((uid, index) => {
      const cluster = clustersByUid.get(uid);
      if (!cluster) fail(`order[${index}] refers to missing cluster ${uid}`);
      return importCluster(cluster, `clusters[${uid}]`);
    }),
    links: render.links.map(importLink),
    groups: render.groups.map(importGroup),
  };
  verifyReferences(data);
  return data;
}

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    throw new Error("Usage: node scripts/import-clinker-render.mjs <clv_render.json.gz> <fixture.json>");
  }

  const compressed = await readFile(resolve(inputPath));
  const render = JSON.parse(gunzipSync(compressed));
  const data = importClinkerRender(render);
  const destination = resolve(outputPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(data)}\n`);
  console.log(
    `Wrote ${destination}: ${data.clusters.length} clusters, ${data.links.length} links, ${data.groups.length} groups`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
