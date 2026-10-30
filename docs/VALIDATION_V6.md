# Asset Studio V6 validation — 25 October 2026

The retained terrain, dynamics, sensor, calibration, export and asset tests are extended with catalogue uniqueness/counts, all 20 new models' dimensions and finite normals, search/category behaviour, placement snapping/bounds, mirror-surface metadata, and the one-live-mirror/render-target budget. Every bundled model is exported as an embedded GLB and every geometry preview is decoded in the Python asset checks.

Original furniture budgets remain at six meshes / 6,000 triangles. The new pack uses at most 12 material-batched meshes and 18,000 triangles per model. The most detailed model is the furnished bookcase. These are geometry budgets rather than measured GPU draw-call or frame-rate claims.

Validation completed: **78 JavaScript checks and 8 Python asset checks passed (86 total)**. These include the retained dynamics/terrain/export suite, all 29 embedded GLB files, decoded geometry previews, scene bounds, placement snapping, mirror resource limits, and archive exclusion of generated reflection targets.

A browser integration checkout was prepared with an explicitly labelled non-GPU fixture, but the browser access policy blocked the preview before the interaction workflow could be verified. No successful browser placement, persistence or live-reflection check is claimed for this update. The production ZIP contains the real WebGL renderer and no fixture. The standalone showroom retains an explicitly labelled CPU geometry-preview fallback when WebGL is unavailable.

The final Vite production build passed. A loopback HTTP smoke check served all four entry pages and the bed/mirror GLBs and PNG previews with `Cache-Control: no-store`. The occupied-port error also passed. All 27 original CAD/URDF/SDF files match V5 byte-for-byte.

Laptop acceptance check: open Visuals, search for bed, add it, use Place in 3D and click a floor area; edit the dimensions, rotate and duplicate it, export a scene ZIP, then reload and check restoration. Repeat with the mirror and test its optional reflection on Balanced. These interactions still need manual verification on the laptop.

GPU model appearance, live planar reflections and capture throughput still require a short test on the Lenovo laptop. Geometry, nominal dimensions/masses and collider shapes remain approximations; no new manufacturer CAD or hardware measurements were supplied. A larger model pack does not itself establish real-world physics accuracy.
