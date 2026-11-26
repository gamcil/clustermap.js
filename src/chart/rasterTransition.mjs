import { animate as runAnimation } from "../renderers/animation.mjs";
import { isWebGpuRenderer } from "../renderers/mode.mjs";
import { createLocusFlipTransition, locusFlipTransitionFrame, interpolateScene } from "../scene/preview.mjs";

// Own the retained raster scene and its active transition. Gesture previews
// are shared with the chart, so a transition clears only the preview it owns.
export function createRasterTransition({ getPreview, setPreview, paint, adopt,
  animate = runAnimation, flipTransition = createLocusFlipTransition,
  flipFrame = locusFlipTransitionFrame, interpolate = interpolateScene }) {
  let scene = null, active = null;
  function clearPreview(transition) {
    if (transition?.flipPreview && getPreview() === transition.flipPreview) setPreview(null);
  }
  function stop() {
    const previous = active;
    active = null;
    clearPreview(previous);
    previous?.cancel?.();
  }
  return {
    get scene() { return scene; },
    set scene(value) { scene = value; },
    get animation() { return active; },
    stop,
    start({ target, enabled, source, treeMotion, flippedLoci, renderer, duration,
      clusterLabelText, alignLabels, labelWidthFor }) {
      const useWebGpu = isWebGpuRenderer(renderer);
      const previousScene = useWebGpu ? scene : active?.previousScene || scene;
      stop();
      const flip = useWebGpu && previousScene === source && flippedLoci?.length
        ? flipTransition(previousScene, target, flippedLoci, {
            clusterLabelTexts: new Map(flippedLoci.flatMap((uid) => {
              const cluster = previousScene.loci.get(uid)?.cluster.uid;
              return cluster === undefined ? [] : [[cluster, clusterLabelText(cluster)]];
            })),
          }) : null;
      const finish = () => {
        clearPreview(active);
        active = null;
        scene = target;
        if (useWebGpu) adopt(target, source);
        paint();
      };
      if (!enabled || !previousScene || !duration) { finish(); return; }
      if (!useWebGpu) scene = target;
      const transition = active = { renderer, previousScene, progress: 0, cancel: null,
        tree: treeMotion ? { ...treeMotion, targetScene: target } : null };
      transition.cancel = animate(duration, (progress) => {
        if (active !== transition || progress >= 1) return;
        transition.progress = progress;
        if (flip) {
          const preview = transition.flipPreview = flipFrame(previousScene, flip, progress, { alignLabels, labelWidthFor });
          setPreview(preview);
          scene = previousScene;
        } else if (useWebGpu) scene = interpolate(previousScene, target, progress);
        paint();
      }, () => { if (active === transition) finish(); });
    },
  };
}
