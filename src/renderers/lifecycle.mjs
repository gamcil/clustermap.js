/** Select, paint, and release renderer resources, including shared fallbacks. */
export function createRendererLifecycle(renderers) {
  let active = null;
  const release = () => {
    for (const renderer of Object.values(renderers)) renderer.destroy?.();
  };

  const select = (name) => {
    if (!Object.hasOwn(renderers, name)) throw new TypeError(`Unknown renderer: ${name}`);
    if (active === name) return;
    if (active !== null) release();
    active = name;
  };

  return {
    select,
    paint(name, request) {
      select(name);
      return renderers[name].paint(request);
    },
    destroy() {
      release();
      active = null;
    },
  };
}
