import { textAsset } from "./textAsset.js";

export const controlStyles = await textAsset(new URL("./controls.css", import.meta.url));
