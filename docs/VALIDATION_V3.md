# Research V3 validation — 25 October 2026

## Automated checks

46 JavaScript tests and four Python tests cover analytic dynamics, fixed-step/frame-rate agreement, bounds/finite states, momentum/restitution, four-contact normal load conservation, cross-slope lateral slip, sensor bias/delay/dropout/quantization, snapshot/random-state restore, independent measured encoder integration, calibration equations, CSV parsing, timestamp/unit conversion, comparison interpolation/yaw wrapping, whole-group splits/hash distribution, pixel blank detection, invalid/missing records, camera intrinsics/exposure/distortion equations, SHA-256 standard vectors, fixed-step drive replay, file checksums, binary ZIP round-trip and CAD source invariants.

Production build and Python loopback server checks are run before packaging. Original CAD/URDF/PART/SDF source bytes are preserved. The delivered build includes all three HTML entry points and local assets. No test renderer, QA login fixture, synthetic recording or node_modules is included in the ZIP.

## Browser checks

- Standalone calibration: a known measurement recovered a 0.0675 m wheel radius and retained the measurement/assumption report.
- Comparison: synthetic example produced x/y/yaw/speed metrics and a plotted comparison. It is explicitly labelled synthetic, not hardware validation.
- ZIP inspection: an actual generated test ZIP passed CRC parsing, image decoding, timestamp/reference checks and all 14 file SHA-256 checks.
- Replay: a 240-step synthetic drive replay reported zero pre-correction position difference.
- Split UI imported eight metadata files, grouped whole environments and showed the empty-split warning for that collection. The final avalanche hash is additionally tested for reasonable distribution across 1,000 sequential group names.
- Three-room integration was tested in an isolated checkout with a non-GPU renderer fixture. Research controls initialized; live dynamics updated; sensor profile applied; profile controls were locked during recording. A recording packaged 16 rows and two test images, reporting PASS_WITH_WARNINGS for the deliberately blank renderer fixture frames. This tests wiring/packaging, not rendered 3D quality.

## Material limits

This cloud browser previously could not create a WebGL context. Real 3D rendering, GPU camera appearance, lens effects on an actual 3D scene, the interactive CAD renderer and the final browser-downloaded live recording were not independently verified here. The standalone browser tools use actual image bytes and renderer-independent code. The production app retains the real WebGL renderer.

No real robot measurements, physical trajectory or missing CAD meshes were supplied. Hardware accuracy remains unvalidated. Four-contact drive physics is reduced-order, terrain attitude is quasistatic, and object/gate contacts are approximate. Replay uses recorded scene/contact corrections. Test the delivered app on the Lenovo laptop and inspect a short real GPU recording before collecting a large dataset.
