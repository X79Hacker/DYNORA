# V8 validation — 26 October 2026

## Executed checks

- `npm test`: **90 tests passed, zero failed**.
- `npm run build`: production build completed, including the simulator,
  research tools, showroom, verification page and human motion lab.
- The human tests exercised both Sam and Maya through approach, turn, lowering,
  seated and standing states on six furniture types. They checked finite joint
  transforms, femur/shin length preservation, planted feet during lowering,
  floor clearance, transformed seat anchors, reservations, obstacle avoidance,
  and stopping/resuming for another actor.
- Gait checks at 0.2, 0.9 and 1.8 m/s measured stationary stance contacts with
  less than 1 mm motion between consecutive ground-contact samples.
- A Rapier regression checked that an added person's kinematic capsule follows
  movement and changes height for sitting without falling under gravity.
- Recording-control tests checked icon/text clicks, stop-before-export ordering,
  exactly one automatic export, and retention of buffers after failed export.
- ZIP tests reopened the archives, checked manifest lengths and SHA-256 hashes,
  and rejected missing and altered files.
- Browser test `/tests/export-smoke.html` used the same recording controls,
  exporter, ZIP verifier and recovery module with synthetic 2D canvas frames.
  Stopping produced **282 PNG frames and 282 telemetry rows**, quality **PASS**,
  with all CRC32 and manifest SHA-256 checks passing in the browser. Reloading
  produced a **Restore ZIP** link for the retained 1.4 MB archive.
- CPU renders in `pose-checks/` show the actual transformed/skinned character
  meshes in standing, walking, half-sit and seated poses. They are geometry
  inspections with simplified software shading, not browser screenshots.

## Verification limits

The preview browser could not create a WebGL context. Live 3D animation,
robot-camera capture and the complete simulator-to-download flow could not be
visually exercised here. The isolated 2D export regression does not establish
that WebGL capture works. The browser's download API also timed out retrieving
its prepared archive, so completed transfer to disk is not claimed. Archive
integrity, preparation and retained-link recovery were verified separately.

The application uses kinematic character motion, joint IK, conservative world
AABB navigation and approximate Rapier capsules. It does not simulate muscle
forces, active balance, seated body pressure, cloth, ragdoll falls or realistic
human pushing forces. Seat profiles cover the included furniture; arbitrary
imported objects need an explicitly authored seat profile. Extreme nonuniform
scaling can produce unnatural proportions.
