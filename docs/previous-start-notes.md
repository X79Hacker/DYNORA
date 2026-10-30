# Previous version instructions (historical)

DYNORA V13.1 — FIVE SIMULTANEOUS LIVE DEPTHS

Run START_DYNORA.bat and open http://localhost:8000 . Confirm V13.1 in the header.
Demo login: admin / robot123. Open Depth and click five surfaces to track range,
forward/Z depth and visibility together, up to 5 Hz. A sixth saved target remains
a snapshot. Click x on a live row to free a slot, then select another saved
target and enable Track selected target live. Regions stream their anchor point.
Export live history CSV keeps the latest 1,000 updates / up to 5,000 rows.

DOWNLOAD PACKAGE
All models, textures and the ready-built app are included. Assets are stored
once inside dist to keep this ZIP smaller. The ready-built app needs no npm
installation. For source development, npm run dev / npm test / npm run build
automatically restore missing public assets from dist. Existing source assets
are preserved. No network download is needed to restore them.

Earlier version notes follow; V13.1 supersedes single-active-target live mode.

DYNORA V13 — RENDERING BUDGET & VISIBLE DEPTH WORKSPACE

1. Stop the old server with Ctrl+C. Extract ALL of V13 into a fresh folder.
2. Run START_DYNORA.bat, or in PowerShell:
   py -m http.server 8000 --bind 127.0.0.1 --directory dist
3. Open http://localhost:8000 in Chrome or Edge. Confirm DYNORA V13 in the header.
   Demo login: admin / robot123

RENDERING
- Visuals > Adaptive display pixels is on by default. It starts at native scale,
  then adjusts within 0.65x–1.25x to reduce graphics load. The target FPS is a
  control target, not a promise. Disable adaptive mode to lock the preset.
- Visuals > Opaque controls removes blur composition over the changing 3D view.
- Models, triangle detail, textures, collision shapes, sensor rays and the
  120 Hz physics step are retained. Recording resolution is unchanged.
- Frame timings show actors, contacts, depth/controls, ToF, UI and render
  submission. Download frame timings exports JSON for a slow scene.
- V13 reduces repeated work; GPU FPS on your computer has not been measured here.
  See docs/VALIDATION_V13.md for exactly what was checked.

DEPTH
- Depth opens a dedicated visible Bot Camera window beside its controls.
- Maximum depth distance: choose 0.1–250 metres, then leave the input to apply.
  This is surface range from the camera, separate from ToF's sensor limit.
- Saved target limit: default 64; increase up to 256. Keep each new target is
  checked by default. Choose a saved target to inspect, rename or remove it.
- Points, rectangles and polygons work on visible surfaces. Curved region
  boundaries follow actual mesh triangles and rigid object motion.
- Inactive pins use compact numbers; Show full saved target depth labels adds
  snapshot values with spacing. Crowded labels are hidden; markers remain.
- Dashed guides, normals, saved markers and heatmaps have individual hide controls.
- SNAP means a saved measurement. Only the selected target is checked live at
  5 Hz. Other markers follow the rigid surface but keep their snapshot values.
- Saved regions keep summary/anchor data. Update depth recreates the curved patch
  and full region pixel CSV. Export all targets CSV exports all saved anchors.
- Out-of-range or blocked targets are invalid; there is no invented depth value.

The included dist app needs no npm installation. Do not serve an old dist folder.
All earlier collision, human, removal, test-lab and export controls remain.
Earlier notes below are history; V13 display/depth settings above take precedence.

DYNORA V12 — APARTMENT RENDERING & CONTACT-DRIVEN GATES

1. Stop your old server with Ctrl+C. Extract all of V12 into a fresh folder.
2. Run START_DYNORA.bat (Python 3 must be installed).
3. Open http://localhost:8000 in Chrome or Edge. The header shows DYNORA V12.

NEW IN V12
- Detailed people no longer require full CPU skin baking for every sensor frame.
  Rays outside sensor range are rejected; exact candidate triangles are queried.
- Shared main/preview/capture rendering reuses one fresh shadow pass per frame.
  Human detail, texture quality, display resolution and 120 Hz physics remain.
- Obstacle gate leaves now clear their fixed square posts, open under rover
  contact and return under the closer spring. There is no proximity opening.
- On the test course select Route > Shortcut loop (through the gate), or use
  Drive (M) and the arrow keys. The full loop may bypass the shortcut gate.
- Build > Ramps, stairs & gate adjusts leaf mass and closer stiffness.
- Measured CPU results and verification limits: docs/VALIDATION_V12.md.

All earlier controls remain. The V11 Test Lab guide still describes its models.

DYNORA V11 — OPTIMIZED RAYS, CURVED DEPTH & PHYSICS TEST LAB

NEW IN V11
- Test Lab (dock / Visuals): isolated tests for all four surfaces and custom grip,
  mass/restitution collisions, potholes/bumps/ramps, and airflow + balloon forces.
  The direct page is http://localhost:8000/test-lab.html .
- Apply settings, Start/Pause/Single step, inspect plots, compare surfaces and
  prepare a verified report ZIP. Use robot settings in simulator saves calibration
  for reload; potholes and bumps can transfer to the isolated track.
- Airflow uses a bounded 2D Navier-Stokes approximation in a worker, created only
  in the lab's airflow experiment. It is not validated engineering CFD.
- Depth rectangles/polygons attach to visible triangles, following curved rigid
  surfaces and object movement. Statistics remain labelled snapshots; the anchor
  can track live. Refresh to remeasure the full region. Hide/show stays available.
- Optimized shared ray-query trees, posed skin batches, static contact caching,
  lazy depth skinning and change-only physics properties reduce repeated work.
  Physics rate, contact shapes, human models and recording exports are retained.
- Detailed equations, controls and model limits: docs/TEST_LAB_V11.md.

RETAINED V10 CONTROLS
- Track walls, rails and merged fences use their actual triangles. Robot contact
  uses separate tyre, chassis and component shapes rather than one large box.
- Leaving scene editing enabled no longer disables all collision physics.
- Track swing gates use rigid body hinges, spring closers and angular stops.
- Pothole motion uses a damped 120 Hz heave/pitch/roll response with small wheel
  compliance. Falling is limited by gravity; there is no repeated rim speed cut.
- Depth: Show dashed rays, crosshairs & distance ticks toggles the guides.
  Inspect rays in Orbit shows amber range, blue forward Z and purple sideways
  offset from the true optical centre. Back to Bot Cam restores the image view.
- Live depth tracks a pinned surface point as the camera or object moves (5 Hz).
  A region has a live anchor; its min/mean/max remain a labelled snapshot.
  Occluded/out-of-view/deleted targets are invalid. Update depth takes a fresh
  snapshot. Animated skins require fresh snapshots for live point following.
- Hide the guides and/or region heatmap independently. Closing Depth hides both.
- Physics > Show actual contact shapes displays the shapes used by the solver.
- Build > Route avoidance: brake before objects (70 cm) controls route braking.
  It is a sensor stop, not a collision. Switch it off, or use M + arrow keys,
  when intentionally testing physical impacts.

EXISTING CONTROLS
- Models (dock): select a model, then Remove selected model. Undo removal
  restores it. Delete works while scene editing is enabled. Added models are
  also selectable from the Visuals object list, even if off-screen or stuck.
- Depth (dock): opens Bot Cam. Click a surface point, drag a rectangle, or
  outline a polygon and press Enter / Finish polygon. Choose straight-line
  distance or forward/Z depth, and cm or m. Update depth refreshes the snapshot.
  Default region statistics are sampled; Every display pixel is an explicit
  dense option. Measurements target visible triangle surfaces, not object centres.
- Drive (M) and arrow keys: test physical contact. Light movable props slide or
  rotate; heavy/fixed objects resist and the robot can recoil. Automatic driving
  can still stop before impact when Build > Route avoidance
  is enabled. This is an obstacle-avoidance setting, separate from contact physics.
- New props are movable on collision. For previously saved fixed props, enable
  Movable on collision in Object editor and apply. Mass, friction and restitution
  are editable. Windows/attached decorations remain fixed.
- Human arms now swing naturally, with relaxed fingers and forearm/wrist turns.

RUN THE READY-BUILT APP (no npm installation needed)
1. Extract the entire ZIP.
2. On Windows, double-click START_DYNORA.bat, or open PowerShell here and run:
   py -m http.server 8000 --directory dist
3. Open http://localhost:8000 in Chrome or Edge.
   Demo login: admin / robot123
   Keep the terminal open while using the app.

HUMAN ACTIONS
- Built-in walkers: Build > People. Choose a person and seat, then
  Walk to seat & sit. Stand up reverses the transition.
- Added people: Visuals > Browse realistic people > Add model.
  Select that person in Object editor. Human actions offers walking to
  a clicked floor point, sitting on a selected seat, and standing up.
- Keyboard-controlled person: press H. WASD moves; F uses an available
  seat within 2 m of its front approach. F again stands up.
- A separate motion lab is at http://localhost:8000/motion.html .
  Both Sam and Maya support every action. Use one person for a single seat.
- Move furniture with Arrange your scene. Seat anchors follow its transforms.
  Keep seats upright and at normal seat heights (25–85 cm). Unsupported
  furniture, occupied seats and blocked approaches do not produce fake sits.

RECORD AND DOWNLOAD
- Record starts capture. Stop & export prepares the export automatically.
- Wait for ZIP verified and use Download ZIP if the browser did not start
  the download automatically. It contains PNG/JPG frames, CSV, annotations,
  metadata, scene assets, quality.json and a SHA-256 manifest.
- ZIP CRC32 and every manifest hash are checked before offering the download.
- The newest in-browser ZIP is retained when storage is available. Reloading
  shows a Restore ZIP link. Browser quota/private mode can prevent this backup;
  always download important recordings to your computer.
- Folder mode writes the dataset files into your chosen directory. It does
  not produce a second ZIP. Choose ordinary ZIP export if you need one archive.

SOURCE DEVELOPMENT
  npm ci
  npm run dev
  npm test
  npm run build

See docs/CHANGES_V11.md and docs/VALIDATION_V11.md for changes and exact checks.
Character movement is constrained kinematic animation with leg/arm IK,
obstacle clearance and approximate Rapier contact capsules. It is not a
musculoskeletal, balance-force or ragdoll simulator.
