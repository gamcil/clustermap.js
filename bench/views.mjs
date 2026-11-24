// Shared by the browser adapter and runner so geometry and gestures stay matched.
export const views = {
  standard: {
    viewport: { width: 1440, height: 900 },
    camera: { x: 330, y: 70, k: 1 },
    dragSteps: 24, panDistance: -160, locusDistance: 80, reorderIndex: 5,
    wheelSteps: 1, wheelDelta: 600, trimGenes: 20,
  },
  overview: {
    viewport: { width: 1440, height: 900 },
    // At this zoom all 100 rows and both synthetic gene widths fit in the shared viewport.
    camera: { x: 330, y: 70, k: .13 },
    dragSteps: 72, panDistance: 360, locusDistance: 240, reorderIndex: 30,
    wheelSteps: 20, wheelDelta: 600, trimGenes: 20,
  },
};
