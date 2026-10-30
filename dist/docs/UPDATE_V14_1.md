# DYNORA V14.1 — camera clearance and a manual Test Lab

This updates V14.0. The apartment rendering improvements, original model and
texture assets, human actions, contacts, gates, five live depth targets and
recording exports remain included.

## Camera near collisions

The former Chase camera only checked a centre ray against the room walls. It
could enter furniture, and the corners of its near plane could pass through a
surface while the lens centre was still outside. The configured robot camera
could also protrude into an obstacle at very close contact.

Camera clearance now queries the existing Rapier world with a sphere large
enough to enclose the complete near plane. Follow and Chase pull in immediately
when obstructed, then ease back to the requested distance after the obstruction
clears. Movable props, compound furniture, thin two-sided legacy walls and doors
participate. The rover's own contact body is excluded. A bounded overlap solver
also handles an object newly placed around the camera. Free overview retains
its requested distance and resolves camera overlap without collapsing the whole
apartment view to its target.

The robot camera uses a short near plane and checks clearance from the body to
its configured optical mount. If a correction is necessary it is temporary;
removing the obstruction restores the configured mount without cumulative drift.
Depth, preview and recording all use that effective optical position. Camera
metadata and each image audit include configured/effective body-frame XYZ,
whether clearance adjusted it, and the near-plane/clearance radius. The image's
exported extrinsics reflect the effective camera position. The saved camera
calibration remains the configured mount. Clearance uses the same approximate
physical hulls as contacts, rather than pretending that those hulls exactly match
every visible triangle.

No model fading, contact solver reduction, extra physics steps or scene-wide
render-mesh scans were introduced by the camera guard. It reuses the physics
world's spatial queries. The former repeated Chase wall-ray loop was removed.

## Manual Test Lab

Open Test Lab from the main simulator. A first visit defaults to **Manual**.

1. Choose Surface traction, Collisions, Terrain response, or Air & balloon.
2. Choose Manual and set the rover's start X, Z and yaw. Collision targets also
   have editable X, Z and yaw. Apply & reset builds the chosen arrangement.
3. Choose Run manual, then Focus keyboard driving. Hold WASD/arrow keys to move;
   Space brakes and Shift boosts the selected duty. Holding a direction button
   also starts manual driving. The duty slider controls motor input, not a
   guaranteed ground speed.
4. Release to coast, or enable electrical braking for zero-command braking.
   Pause freezes the experiment. Brake now applies an electrical brake. Hiding
   the page pauses it, blur clears held inputs, and a missing held-command
   heartbeat makes the worker brake after 450 ms.
5. Enable Follow rover for camera tracking, or keep the 3D orbit free. The 2D
   view shows the side projection at the rover's current lateral position. The
   3D terrain follows the same two-dimensional height function as the contacts,
   including the curved pothole surface.

Manual mode has no timed drive sequence or automatic trial finish. Its sample
buffer retains the latest 1600 samples (80 seconds at 20 Hz), with explicit old
sample drop counts. Input/settings events retain the latest 400 entries with
explicit drop counts. Summary totals cover the complete run. Driving beyond the
8 × 3 m terrain testbed is indicated; it is not a terrain measurement outside
that area.

**Scripted** mode retains repeatable duty, steering, motor-on time, trial duration
and surface comparison. The comparison always uses identical scripted commands,
even when the current interactive experiment is Manual.

## Tune without restarting

**Apply live · keep position** retains pose, velocity, clock, samples and the
existing contact world. Compatible parameters include:

- Surface grip/rolling resistance, rover mass and motor/electrical parameters.
- Heave, attitude response, damping and effective wheel travel.
- Target mass, friction and restitution, including switching between movable
  target mass presets while retaining the current target pose.
- Wind, angle, gust forcing, viscosity, air density and drag parameters.
- Balloon payload, gas density, drag and tether parameters.
- Manual/scripted mode and simulation pace from 0.25× to 2×. Physics continues
  using 1/120-second steps; pace changes wall-clock scheduling.

Start positions, rover geometry, terrain geometry, fixed-wall/movable-target
changes, grid size, balloon radius and baffle geometry require **Apply & reset**.
An incompatible live edit is rejected before changing runtime parameters, with
an explanation naming the affected settings. The optional Auto-apply checkbox
applies compatible edits after a short debounce; it never resets geometry on
its own. Single stepping offers 1/120 second, 0.1 second or 1 second.

Preset JSON can be saved and loaded. A report ZIP contains the latest settings,
initial settings, input/settings events, retained samples, drop counters,
collision events and model limits. The included report hashes are checked before
the download link is offered. Initial balloon force values are now computed
before the first rendered state, preventing invalid force-arrow geometry.

## Apply to the main simulator

Keep both pages on the **same address and port**, for example both under
http://localhost:8000. Choose the destination environment in the lab:

- **Apply robot, surface & ride** changes calibration, the chosen surface override
  and zero-command brake in that running simulator. The obstacle track also
  updates its ride response live; other rooms save it for subsequent track use.
  Calibration resets motion/odometry as the existing calibration panel does.
- **Apply contact to selected model** uses the mass, friction, restitution and
  movable/fixed setting of the collision trial. First select furniture or an
  added prop with Models in the simulator. An occupied seat must be vacated.
  The model's contact settings persist with the room layout or added model.
  Room geometry and floor properties also affect the eventual impact response.
  A fixed room root made movable leaves its shared static render batch and gets
  a proxy that follows its body immediately.
- **Apply terrain to Track** transfers a pothole or bump configuration, rebuilds
  the isolated track lane and leaves the rover paused at the start. Use the
  robot-profile button separately to transfer calibration and the surface.
  Ramps remain editable in Track > Ramps; unsupported/oversized transfers are
  rejected before changing the track.

The lab shows **Applied** only after an acknowledgement from the destination.
Recording blocks these scene/calibration changes with a rejection message.
A recent pending request can be picked up by opening the chosen simulator within
five minutes. An acknowledged request is not replayed on every reload. Surface
and brake overrides persist per environment. A lab running against an older
server that lacks this receiver cannot acknowledge an application; confirm
V14.1 in both pages after extracting the new download.

Air/balloon field calculations remain isolated in Test Lab, so ordinary room
rendering never starts a flow solver. These simulations do not control hardware.

## Validation evidence

- The complete automated suite passes, including the previous human, IK,
  sitting/standing, collision, gate, terrain, depth, removal and export checks.
- New tests cover sphere clearance, both sides of rotated triangle walls, moving
  objects, overlap recovery, near-plane corners, self exclusion, free overview,
  calibrated-mount restoration, manual commands/braking, live tuning continuity,
  atomic rejection, bounded samples, balloon force/impulse behavior, transfer
  routing, acknowledgements and reload receipts.
- Real browser checks verify manual forward/reverse/turn, the lost-input brake,
  scripted completion, live tuning without state reset, report ZIP hashes,
  simulator acknowledgement, selected chair contact settings and built-app
  depth/recording/terrain paths. See the adjacent JSON evidence files.
- The CPU camera benchmark uses the real apartment fixture with 20 registered
  prop/actor bodies and 191 fixed triangle meshes. Across 2000 query pairs,
  one follow-camera guard plus one mounted-camera guard measured about
  **0.012 ms median / 0.063 ms p95** on this test host. This measures query
  overhead only; it is not laptop GPU FPS or an end-to-end frame benchmark.
- Browser rendering uses software WebGL in this environment. No new claim is
  made about RTX laptop FPS. V14.0's rendering/sensor optimizations and 120 Hz
  contact settings remain in place.

The rover is a reduced-order tyre/chassis model with approximate compound
contacts. People use kinematic controllers. Airflow is a coarse 2D educational
Navier–Stokes approximation and the balloon is a rigid sphere with a simplified
tether; these are not calibrated hardware measurements or validated CFD.
