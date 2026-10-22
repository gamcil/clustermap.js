/** Rollup embeds these files; unbundled browser modules load them by URL. */
export async function textAsset(url) {
  if (!globalThis.document?.createElement) return "";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load component asset: ${url}`);
  return response.text();
}

export function installStyle(root, id, css) {
  if (root.querySelector(`style[id="${id}"]`)) return;
  const style = (root.ownerDocument || root).createElement("style");
  style.id = id; style.textContent = css;
  (root.head || root).append(style);
}
