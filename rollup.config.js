import { terser } from "rollup-plugin-terser";

export default {
  input: "src/index.js",
  external: ["d3"],
  output: [
    {
      file: "dist/clustermap.mjs",
      format: "es",
    },
    {
      file: "dist/clustermap.js",
      format: "umd",
      name: "ClusterMap",
      globals: { d3: "d3" },
    },
    {
      file: "dist/clustermap.min.js",
      format: "umd",
      name: "ClusterMap",
      plugins: [terser()],
      globals: { d3: "d3" },
    },
  ],
  plugins: [],
};
