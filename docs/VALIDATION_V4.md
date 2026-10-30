# Visual Studio V4 validation — 25 October 2026

## Automated checks

56 JavaScript tests and eight Python tests pass. The V3 dynamics, sensor, calibration, CSV, replay, split, quality, ZIP, SHA-256 and original-CAD tests remain. V4 adds actual Rapier WASM tests for fall/settle, mass-scaled impulses, rover/prop momentum transfer and resetting tilted bodies; furniture/rover geometry bounds and batching budgets; quaternion-preserving sizing; embedded GLB headers and rejection of remote/compressed inputs; physical UV generation; all bundled map/HDR hashes; decoded image dimensions; and asset download size bounds.

All nine original GLBs are valid embedded GLB 2.0. The active rover is 25 mesh objects / about 25,400 triangles, with 144 instanced tyre treads. Every original furniture model uses at most six meshes and 6,000 triangles. These are geometry budgets, not measured GPU draw-call or FPS results.

The production build bundles four HTML entry points, the Rapier WASM code and local visual assets. Python server checks cover loopback binding, response headers and serving the built files. Original supplied CAD source bytes are retained. Packaging excludes node_modules, development QA fixtures and mock renderers.

## Browser integration

The isolated apartment UI initialized all five PBR sets and the Rapier world. Adding a dining chair populated its dimension/mass editor; width and mass edits saved; dynamic drop and impulse controls ran and physics steps advanced. Changing the graphics preset worked. Recording locked the visual controls. A recording packaged 14 rows and two fixture images and showed a ready ZIP with PASS_WITH_WARNINGS, as expected for blank non-GPU test frames. The browser download itself could not be independently completed in the cloud automation session.

Canteen and obstacle-track rooms also initialized with all five local material sets and enabled recording. Adding a service trolley and timber crate worked. A real embedded dining-chair GLB was selected through the local file input, parsed by Three.js, normalized and exposed in the object editor.

These integration checks use an explicitly labelled non-GPU renderer fixture in a separate checkout. They verify control wiring, real geometry/material loading and real CPU/WASM physics, not rendered camera appearance. The delivered app uses Three.js's real WebGL renderer and contains no fixture.

## Limits and laptop check

This cloud browser cannot provide validated real GPU rendering. Still geometry previews are CPU renders of the actual GLBs and are explicitly labelled in the showroom fallback. Real WebGL lighting, shadows, offscreen camera colour and RTX 4060 performance need a short check on the laptop. No target FPS or photorealism score is asserted.

No measured hardware trajectories, force data, photographs for calibration or six missing CAD meshes were supplied. The detailed rover is illustrative. Contact boxes/AABB proxies, stylized people, legacy gate physics and reduced-order rover dynamics remain approximations. More visual detail is not proof of physical validity.

Before collecting a large dataset: use Balanced or Low, record a short 640×480 JPG trial, inspect camera frames/quality warnings, check scale and ToF against known room measurements, and compare a measured hardware run using the retained calibration/comparison tools.
