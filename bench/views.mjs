// Shared by the browser adapter and runner so geometry and gestures stay matched.
export const views = {
  standard: {
    viewport: { width: 1440, height: 900 },
    camera: { x: 330, y: 70, k: 1 },
    dragSteps: 24, panDistance: -160, locusDistance: 80, reorderIndex: 5,
    wheelSteps: 1, wheelDelta: 600,
  },
  overview: {
    viewport: { width: 1920, height: 1080 },
    // All 100 rows (62 world units apart) and both synthetic gene widths fit here.
    camera: { x: 330, y: 70, k: .15 },
    dragSteps: 72, panDistance: 360, locusDistance: 240, reorderIndex: 30,
    wheelSteps: 20, wheelDelta: 600,
  },
};
