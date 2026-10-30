# V10 validation

The complete Node suite passed: **128 tests, 0 failures**. The Vite production
build passed. The ready-built app is included in `dist/`.

The new tests cover the reported failure paths:

- Sustained motor driving into a 12 mm track fence, including with scene editing
  enabled. The rover stays outside the barrier while the contact world steps.
- A 4 mm wall at 7 m/s with CCD; merged fence openings; empty corners around
  rotated rails; real wheel contact and clearance below the chassis.
- Upper chassis contact starts within 4 mm of the visible plate surface in the
  controlled fixture, rather than at an enclosing tyre-sized box.
- Moving/removing static meshes updates the next contact synchronization, with
  no geometry rebuild for translation and no leftover collider after removal.
- A dynamic gate opens on impact, remains on its revolute hinge and creates no
  duplicate static leaf collider. Explicit short robot resets synchronize pose.
- Pothole heave/pitch/roll are bounded and damped. Replays at 30, 60 and 120 display
  FPS agree exactly for the fixed trajectory and numerically for motor-driven
  traversal. The baseline hole is traversed with the default motor profile.
  A sudden support drop begins with gravity-limited descent, without snapping.
- 3D dashed-guide endpoints agree with Euclidean range and forward Z from the
  camera optical centre. Auxiliary guides are excluded from depth geometry.
- Live depth follows camera and nested object transforms. Occluded, removed and
  out-of-view anchors are rejected. Show/hide removes the guides.

Browser checks used the actual depth UI and measurement components in
`tests/depth-removal-smoke.html`, with a clearly labelled software-projected
fixture. A table-leg point measured 292.00 cm; moving the camera forward 0.5 m
updated live depth to 242.00 cm and showed a -50.00 cm change. An intervening
surface produced `LIVE INVALID`; removing it restored the reading. Guide hiding
and showing were inspected visually. A rectangle around the leg produced 282 valid
samples with min/mean/median/max forward depth all 292.00 cm, plus a live anchor.
No application errors were observed.

The existing V8/V9 human, seat, recording/export, mass-transfer, removal, terrain,
calibration and visual-model tests also pass. Those features were retained.

## Limits

This browser environment does not provide a working WebGL context. Full rendered
track traversal, GPU frame rate on the user's RTX 4060 and the 3D guide appearance
in the complete room have not been visually verified here. The proof image is a
software-projected component fixture, not a claim of full GPU validation.

The robot remains a constrained base with reduced-order motor/tyre dynamics and
limited effective wheel compliance. It is not a full suspension or rollover
solver. Props use the selected approximate Box/Convex/Parts shape. Box shapes and
convex fallback can still fill mesh cavities; use Parts for disconnected legs.
Tiny rover screws, wires and plate slots are omitted from contact geometry.

Depth is exact to the intersected simulated triangles before noise, not a claim
of physical camera accuracy. Region statistics are snapshots; live tracking
updates the pinned rigid-surface anchor at 5 Hz. Animated skin needs a fresh
snapshot. Texture transparency can differ from geometric triangle visibility.
