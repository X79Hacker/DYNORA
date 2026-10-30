> Historical V2 reference. Current behaviour and verification are documented in RESEARCH_V3.md and VALIDATION_V3.md.

# Validation — 25 October 2026

- 18 JavaScript tests pass: analytic free fall, time-of-impact restitution, impact momentum and non-increasing collision energy, independent circular integration, straight/reverse symmetry, differential rotation, payload acceleration, downhill coasting, grip limits, slip/odometry divergence, motor mismatch, frame-rate agreement, timestep stalls, pause holding, parameter rejection, long-run finite states, CSV escaping and binary ZIP record preservation.
- Four Python tests pass: complete CAD mesh set, exact list of six missing rover mesh files, wheel-joint spacing, and positive-definite supplied inertia tensors.
- Production Vite build passes. Included dist/ contains both the simulator and verification lab with local JS/CSS/STL assets.
- Python loopback launcher serves both built pages, disables caching, and rejects an occupied port.
- Browser verification page: 8/8 numerical checks passed; all four wheel groups exist; front ToF ray follows 0.2 rad body pitch; real URDF/STL parsing reports 5-link / 2.297970 kg complete reference assembly and 34-link / 3.998225 kg rover with six missing meshes.
- Browser UI integration: all three rooms initialized and live force-model readings updated using an isolated test renderer. Calibration changed and reset successfully. Changes were blocked during recording. Physics report JSON downloaded and was parsed with all eight numerical checks passing. The mock renderer was only used in the isolated QA copy; no mock renderer, test login fixture or recorded test data is included in the deliverable.
- Dataset ZIP packaging reached the ready state in the UI. Browser download-event capture timed out, including an explicit ready-link click, so the final browser-downloaded dataset bytes were not independently recovered. Binary ZIP assembly and CSV quoting are separately covered by automated tests. Real camera image content was not validated with the test renderer.

## Material verification limits

This preview browser could not create a WebGL context. The rendered 3D scene, real GPU camera capture and interactive CAD renderer are therefore unverified here. Geometry parsing, transforms, source audit, compilation and renderer-independent logic were checked. Startup reports a WebGL failure clearly and links to the verification page. Test on the user's Chrome/Edge with graphics acceleration enabled.

These are numerical and software checks, not physical robot validation. Motor, friction, battery and inertia estimates require calibration against real measurements. Terrain attitude, object collisions and gate contacts retain explicit reduced-order assumptions. Missing source meshes cannot be reconstructed from joint metadata alone.
