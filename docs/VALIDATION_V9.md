# V9 verification — 26 October 2026

## Completed checks

- **108 automated tests passed, zero failed.** The full result is in
  `test-results-v9.txt`.
- Production build passed, including the simulator, research tools, numerical
  verification, showroom and human motion lab.
- Light/heavy impacts, fixed objects, wall collisions without added props,
  contact-driven robot recoil, compound tabletop clearance, removal/undo and
  stale-collider cleanup were tested with the actual Rapier WASM solver.
- Character-layer tests verify that seated capsules do not push their chairs
  away and that the robot still contacts those capsules.
- Human tests cover arm and leg lengths, elbows near the torso, inward resting
  palms, downward seated palms, relaxed finger joints, walking foot planting and
  all six supported furniture seat transitions for both Sam and Maya.
- Depth tests check nearest-surface distance, range versus camera-axis depth,
  parented camera transforms, principal-point calibration, narrow table legs,
  background exclusion, dense pixel counts, concave polygon regions, posed skin
  geometry, hidden/removed geometry and metre-based CSV output.
- The browser fixture `tests/depth-removal-smoke.html` used the actual depth tool
  and scene editor with software-projected geometry. A leg with front surface at
  **Z = 2.920 m** read **292.00 cm**. Its outlined surface region returned 210
  valid samples, all with forward depth 292.00 cm. Removing an added model
  changed the visible model/body counts from **2/2 to 1/1**; undo restored **2/2**.
- Updated CPU pose checks show the actual skinned meshes with the new arms,
  forearm twist and fingers. They are geometry inspections, not browser renders.
- Existing recording, manifest-hash, ZIP-integrity and recovery control tests
  remain in the full passing suite.

## Limits

The preview browser's WebGL context was unavailable in this environment. The
complete live 3D scene and GPU camera rendering could not be visually verified
here. The software-projected browser fixture verifies controls and geometric
calculations, not 3D rendering performance or realistic appearance under all
lighting conditions.

Contact shapes approximate meshes using compound convex hulls or selected box
colliders. Legacy unmanaged static geometry uses AABB proxies. The driven robot
is a planar rigid base coupled to the tyre/motor model; suspension and full
6-DOF rollover are not solved. People remain kinematic, and the track gate keeps
its reduced hinge model. Numerical tests establish implementation behavior,
not hardware calibration or validation against a real robot.

Depth is exact to the selected triangle geometry and snapshot camera transform.
It is not a physical sensor measurement. Default region statistics are sampled;
dense mode covers each display-pixel centre within its documented size limit.
Transparent/alpha-textured materials and omitted subpixel details can differ
from rasterized appearance. Use the on-screen sampling description and capture
time when interpreting exported measurements.
