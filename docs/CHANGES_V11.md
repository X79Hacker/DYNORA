# DYNORA V11

## Faster repeated work

- Shared triangle-query trees accelerate camera depth, picking and sensor rays.
  Geometry edits refit the tree; ordinary rigid movement reuses it. Skinned
  meshes reuse a posed query batch for a frame. Off-ray people are not baked
  into every depth snapshot.
- Static contacts skip unchanged geometry and transforms. Physics materials,
  capsule dimensions and hinge motor properties are updated only when changed.
  Sleeping props skip redundant visual transform writes.
- Rover contact parts and ray trees are prepared during initialization.
  The 120 Hz physics step, 23 rover contact parts, 2,680 input hull vertices,
  CCD settings and sensor-ray count are retained.
- Region measurement and surface clipping yield in bounded chunks and support
  cancellation. Test Lab simulations use a separate worker with bounded sample
  and field buffers. Paused 2D views and unchanged charts skip repainting.

## Depth attached to actual surfaces

Rectangle and polygon selections clip visible mesh triangles into a local-space
surface patch. The patch can bend around curved furniture, follow rigid object
movement, and project its curved border back into Bot Cam. Dashed rays,
crosshairs, distance ticks, heatmap and the surface patch have visibility
controls. Helper geometry is excluded from depth queries and recordings.

Min/mean/max remain a labelled snapshot. A separate visible anchor updates live
at 5 Hz; occluded, removed or out-of-view targets are invalidated. Moving the
camera or target hides the stale snapshot heatmap. Update depth remeasures the
region. Animated skins require a fresh snapshot after their pose changes.

Exports include the clipped local triangle patch as
`visual/depth-surface-patch.json`, its boundary and the existing depth tables.
The stored vertices lie on source triangles; the displayed border has a small
normal bias to avoid z-fighting. Very large selections have explicit detail
caps; they do not silently claim unlimited surface resolution.

## Physics Test Lab

Open **Test Lab** in the dock, or `test-lab.html` on the same local server.

- Surface traction: dry, wet, gravel, grass and custom friction/resistance;
  actual versus wheel speed, slip, traction, braking and a four-surface replay.
- Collisions: light, medium, heavy, custom-mass and fixed-wall targets;
  friction/restitution controls, target movement and net impact estimates.
- Terrain: adjustable potholes, speed bumps and ramps; shared rolling-circle
  support, damped heave/pitch/roll and finite wheel compliance. Potholes and bumps
  can transfer to the isolated track; robot/ride calibration can be saved.
- Air and balloon: a coarse 2D incompressible Navier–Stokes approximation,
  pressure projection, viscosity, wind and vortex forcing. Adjustable gas,
  envelope and payload mass, buoyancy, quadratic drag and a unilateral tether.
  An optional baffle obstructs flow and has solid rover/balloon contact.
- Start, pause, one fixed step, reset, 2D fallback, 3D orbit where available,
  force arrows, plots, SI measurements and checked report ZIP downloads.

Reports contain settings, 20 Hz samples, forces, collision events, model limits,
summaries and available surface comparisons. Every report is reopened with CRC
checks and its manifest hashes are verified before the download link appears.
Stopping distance is reported only after a sustained stop; unfinished trials
retain an observed coast distance instead of claiming a complete stop.

Normal apartment, canteen and track driving do not start this worker or create
an airflow grid. The lab pauses when hidden and terminates its worker on exit.
The existing human walking/seating, arm poses, removal/undo and recording-to-ZIP
features remain in the app.

Read [the detailed guide](TEST_LAB_V11.md) for equations, controls and limits,
and [validation](VALIDATION_V11.md) for measured results and what was not tested.
