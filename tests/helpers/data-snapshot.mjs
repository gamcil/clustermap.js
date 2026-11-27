import { CompactLinkStore } from "../../src/data/linkStore.mjs";

export const dataSnapshot = (data) => structuredClone({ ...data,
  links: data.links instanceof CompactLinkStore ? [...data.links.values()] : data.links });
