// A presentation-only change can patch the retained source scene. Geometry
// changes may reuse its link filter when their impact explicitly permits it.
// Unknown changes must request refiltering rather than claiming reuse.
export function sceneCommitForImpact(sourceScene, impact) {
  if (!sourceScene) return null;
  if (impact.presentationOnly) return { sourceScene, changes: {
    presentationOnly: true, ...(impact.clusterLabels ? { clusterLabels: true } : {}),
  } };
  return impact.refilterLinks === false ? { changes: { reuseLinkFilter: true } } : null;
}
