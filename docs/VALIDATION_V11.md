# DYNORA V11 validation

Validated on 26 October 2026. Full source and the ready-built application are
included in the V11 archive. Earlier validation files describe earlier versions.

## Automated checks

`npm test`: **153 passed, 0 failed, 0 skipped**. The full output is in
`test-results-v11.txt`. Coverage includes:

- accelerated versus original Three.js ray intersections, distances, face/UV
  data, transformed geometry and vertex-edit refits;
- lazy skinned snapshots, shared posed-skin rays and next-frame updates;
- curved triangle patches, concave polygon clipping, moving attachments,
  helper exclusion and cancellable asynchronous depth statistics;
- collision geometry, thin barriers, concave gaps, light/heavy/fixed contacts,
  scene editing, hinges, removal/restore, and the existing human action tests;
- pothole support, damped ride limits and transfer of terrain/ride settings;
- periodic uniform flow, pressure-projection convergence, baffle face flux,
  quadratic drag, buoyancy, slack tether, bounded long runs and balloon contact;
- actual shared rover models in surface/collision/terrain/air experiments;
  unfinished stopping observations and report ZIP CRC/manifest verification;
- retained dataset/export, packaged asset and model validity tests.

`npm run build` builds the normal simulator and separate Test Lab page/worker.
The final package is checked for ZIP CRC errors and required source/build files.
The clean build produced six entry pages and 39 assets. Script/style references
were checked for missing files. The flow solver metadata/implementation was
present only in the separate worker bundle. The ready-built static app also
completed the 3-second air/baffle trial in the browser with the same final
forces and diagnostics as the development preview.

## CPU measurements

`tools/benchmark-runtime.mjs` was run sequentially against the preserved V10
source and V11 on the same host. It warms each operation, then measures repeated
calls: 220 static objects, a 16,200-triangle wall, and two off-ray skinned planes
with 20,000 triangles each. The runtime and test load affect timings; these
isolated CPU measurements are not an app-FPS benchmark.

| Operation | V10 median | V11 median | V10 p95 | V11 p95 |
| --- | ---: | ---: | ---: | ---: |
| Environment/contact sync | 0.2592 ms | 0.0518 ms | 1.3423 ms | 0.1900 ms |
| Physics contact step | 0.0836 ms | 0.0415 ms | 0.4951 ms | 0.2318 ms |
| Depth snapshot + one query | 6.3339 ms | 0.0718 ms | 8.6044 ms | 0.2381 ms |
| Query in an existing snapshot | 1.1045 ms | 0.0083 ms | 2.1985 ms | 0.0345 ms |

Both versions used 23 rover colliders and 2,680 input hull vertices. Raw timing
summaries and call counts are in `performance-v11.json`. A laptop GPU and real
scene can produce different results; no RTX 4060 FPS guarantee is implied.

## Browser checks

The test browser has no WebGL context. The actual Test Lab worker, its 2D view,
the software-projected depth fixture and the real export code were exercised.
The fallback is labelled in the UI; it is not a screenshot of the GPU renderer.

- A 3-second surface trial completed and created a verified report with 60
  samples and 6 files. The four-surface comparison completed with separate
  dry/wet/gravel/grass rows and sensible stopping-observation labels.
- A 3-second balanced-grid air trial completed with the baffle enabled. It
  displayed wind deflection, balloon/tether motion, force plots and diagnostics:
  buoyancy 0.536 N, final tether tension about 0.296 N, CFL about 0.59. The
  displayed divergence residual was about 0.0714/s with the solid baffle;
  this finite residual is disclosed, not treated as exact incompressibility.
- Single step advanced one 1/120-second step and the display remained paused.
- The final air report showed 60 samples, 6 files and successful in-browser
  CRC/hash verification, with a visible Blob download link. The automation
  download APIs timed out retrieving that link; an independently downloaded
  browser report was therefore not inspected. Numerical report ZIPs were
  reopened and verified in the automated suite.
- A rectangle on a 0.70 m sphere produced 1,656 valid depth samples and a patch
  with 292 clipped triangles. Snapshot forward depth ranged from 230.03 cm
  to 273.16 cm. Translating the target and turning the camera retained the
  attached contour, hid the stale heatmap and changed the visible live depth.

Full GPU rendering, interactive walking/arm appearance and frame rate on the
user's Windows/RTX laptop could not be checked in this browser. The retained
human, prop and recording regression tests passed; earlier browser recordings
are documented in V8–V10 validation. V11 adds numerical and 2D UI verification,
not a new hardware-validated 3D recording claim.

## Practical limits

Rover contacts use convex/triangle approximations, and the drive base has
reduced-order attitude/compliance rather than a reconstructed suspension or
rollover model. Imported props keep their selected contact approximation.
Curved depth follows mesh triangles; sampled region statistics are not a real
depth-sensor calibration. Animated-pose changes require a fresh surface patch.

The air model is a coarse periodic 2D slice with one-way forcing on a rigid
balloon and horizontal rover drag. It omits fabric, thermal effects, balloon
inflation, resolved turbulence, two-way fluid coupling and aerodynamic rollover.
Use the detailed guide and report diagnostics when adjusting parameters.
