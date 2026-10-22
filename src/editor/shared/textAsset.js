/** Rollup embeds these files; unbundled browser modules load them by URL. */
export async function textAsset(url) {
  if (!globalThis.document) return "";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load component asset: ${url}`);
  return response.text();
}
