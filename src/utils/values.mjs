export function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Clone arrays and plain records while retaining primitive and class leaves. */
export function clonePlainValue(value) {
  if (Array.isArray(value)) return value.map(clonePlainValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clonePlainValue(child)]));
}

export const sameArray = (one, two) => one === two || Array.isArray(one) && Array.isArray(two) &&
  one.length === two.length && one.every((value, index) => value === two[index]);

export const isRecordId = (value) => typeof value === "string" ? Boolean(value.trim()) : Number.isFinite(value);
