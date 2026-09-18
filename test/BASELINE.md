# SVG baseline

`testing.json` is the baseline data fixture used while the SVG renderer is
refactored. Run `npm run test:baseline` to verify its referential integrity.

Before and after each structural refactor, open `index.html` with a local web
server and verify the following behaviours using this fixture:

1. Initial clusters, gene arrows, links, legend, scale bar, and colour bar render.
2. Pan and zoom preserve the expected marks.
3. A cluster can be reordered by dragging its label.
4. A locus can be moved, trimmed from either end, and flipped by double-clicking.
5. Anchoring a gene changes cluster offsets and preserves link placement.
6. Gene/group edits update colours, labels, visibility, and the legend.

The first refactor phase is complete only when this checklist and the baseline
test still pass without changing the expected behaviour.
