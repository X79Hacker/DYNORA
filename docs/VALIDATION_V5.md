# Terrain Studio V5 validation — 25 October 2026

## Automated coverage

71 JavaScript tests and eight Python tests pass.

The retained V4 suite is extended with tests of the actual floor opening (ray passes through the hole), cavity vertices against the analytic surface, upward normals, continuous irregular elliptical rims, exact bump dimensions, rolling-circle tyre support, passive/time-partition-consistent rim loss, speed acceleration/braking and motor caps, surface-aware versus constant strategy, frame-rate agreement of speed ramps, invalid editor configurations, trial timestamps/statistics, compound furniture hull mass and empty space, and real Rapier props settling inside a non-square heightfield depression.

A regression check covers track environment names containing spaces: run/image identifiers are safely normalized before image creation, preserving path validation.

A coupled default-motor/terrain test traverses the isolated lane baseline pothole and separately checks persistent-stall reporting.

Existing motor/contact dynamics, sensors, calibration, comparison, split, replay, quality, binary ZIP, image/asset hashes and CAD tests remain. Production builds use the real Three.js renderer and actual Rapier WASM. Supplied original CAD assets are byte-preserved.

## Browser coverage

An isolated non-GPU integration checkout exercises the same application geometry, UI, controller and Rapier physics. A renderer fixture only replaces WebGL calls; it is excluded from the download. All nine track tabs were verified inside the viewport with their centres unobscured, while the control panel was scrolled. Shallow-pothole presets and custom flat-top bump dimensions rebuilt and saved successfully. Speed controls initialized with actual/reference/cap values. The isolated lane initialized and a recording packaged 17 rows and two fixture images into a ready ZIP with PASS_WITH_WARNINGS for intentionally blank non-GPU frames. Recording locked terrain/track settings. The browser file download itself was not independently validated.

Apartment and canteen both initialized the shared fixed tab layout, speed controls, local materials and Rapier world. Keyboard navigation wrapped from Visuals back to Live without selecting the hidden track-only Tests tab.

The check is UI/CPU integration, not proof of GPU appearance. Real WebGL rendering, camera images, laptop frame rate and hardware agreement still need a short Lenovo laptop test. No physical accuracy certificate or FPS guarantee is claimed. Inspect a short local recording and its quality report before a large collection.

## Scope

Terrain attitude remains quasistatic. Rim damping is an explicitly approximate loss model. Added-prop colliders are bounded approximations; the track heightfield is sampled at 4 cm. Legacy scene collision models remain. No physical measurements or missing CAD were provided, and V5 does not invent them. Full details and the local workflow are in `TERRAIN_V5.md`.
