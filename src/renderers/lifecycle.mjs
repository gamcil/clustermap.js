/** Route renderer paints through one setup, paint, and teardown lifecycle. */
export function createRendererLifecycle(renderers) {
  let active = null;
  let setup = false;

  const select = (name) => {
    if (!Object.hasOwn(renderers, name)) throw new TypeError(`Unknown renderer: ${name}`);
    if (active === name) return;
    if (active !== null) {
      for (const renderer of Object.values(renderers)) renderer.destroy?.();
    }
    active = name;
    setup = false;
  };

  return {
    select,
    paint(name, request) {
      select(name);
      const renderer = renderers[name];
      if (!setup) {
        renderer.setup?.(request);
        setup = true;
      }
      return renderer.paint(request);
    },
    destroy() {
      for (const renderer of Object.values(renderers)) renderer.destroy?.();
      active = null;
      setup = false;
    },
  };
}
