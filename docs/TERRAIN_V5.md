# Terrain Studio V5

V5 keeps the V4 models/materials and V3 research tools. It concentrates on the test-course potholes, speed bumps, route-speed controls and navigation visibility. Everything runs locally.

## Start

Stop the older server with Ctrl+C, extract this full ZIP to a fresh folder and run ` .\start-windows.bat ` in PowerShell. Open `http://127.0.0.1:8774/`. The header should say **Terrain Studio V5**. The included prebuilt app needs Python 3; npm is only needed to rebuild source changes. Use Ctrl+F5 if an old page remains cached.

## Visible panels

The camera and the labelled tab grid stay above a separate scrolling control area. The tabs wrap into three columns instead of squeezing into one row. Buttons have keyboard focus indicators; Left/Right/Home/End navigate tabs. **Hide feed** collapses the camera to make more room on short screens. All three environments use this layout. The **Tests** tab is available in Obstacle Track.

## Potholes

1. Choose **Obstacle Track → Tests → Use Test Course** for the mixed course, or **Use isolated lane** for a flat paved laboratory with a separate pothole and bump section. Use the isolated lane when you want to avoid approach ramps and other course features influencing measurements.
2. Select P1 or P2. Load a shallow, broken-asphalt or deep preset, or edit radius/depth in centimetres, aspect ratio, edge transition, broken-edge amount, distance along the track and side offset.
3. Click **Apply pothole**. The room floor is cut out and a real cavity mesh is rebuilt. There is no stencil/depth-buffer trick. The pavement, cavity and tyre support share the same analytic depression. Broken lips, embedded aggregate and surface cracks provide shape cues.
4. Use **Focus pothole** to move the orbit camera to it. Enable/disable the selected pothole with its checkbox. Settings persist separately per track/seed.
5. Choose a speed under Settings, then **Run pothole approach** for a repeatable short open route. It resets the robot pose and speed without rewinding the simulation clock. It preserves recorded buffers; terrain edits and trial resets are locked while recording.

Tyre support uses the upper envelope of a rolling circle sampled across the tyre width, so a narrow depression can be partly bridged. Body height, pitch and roll remain quasistatic; a passive rim-loss approximation dissipates speed while climbing out. This is not a spring/damper suspension or deformable-soil solver. A deep hole can stall the reduced-order rover.

The second default pothole is moved slightly beyond the bump section to make the short bump approach easier to isolate. Very large or overlapping openings are rejected when applying a pothole; keep the opening within the track width and away from start/finish. Features may still be near other obstacles, so inspect placement before a trial.

## Speed bumps

Select a bump section, then choose **smooth cosine hump**, **rounded rubber bump** or **flat-top speed table**. Set height, travel width, centre spacing and count. Click **Apply speed bumps**, then **Focus bumps** or **Run bump approach**.

The visible yellow/black surface uses the same height profile as the drive surface. The old intersecting cylinders are removed. Spacing must exceed width by at least 4 cm, and edits cannot overlap the next height feature or finish area. These are geometric editor limits, not road-design standards.

## Route speed

Settings now has Precision (0.12 m/s), Normal (0.28 m/s), Brisk (0.40 m/s), a custom target, acceleration and braking reference limits, and two strategies:

- **Surface aware** reduces the reference on potholes, bumps, gravel, low-grip ground and narrow passages.
- **Constant reference** keeps the same requested speed across surfaces for comparisons. The existing route controller may still slow for turns and obstacles.

The reference is capped at 85% of the calibrated no-load wheel speed; it cannot guarantee that speed under load. The panel distinguishes actual speed, ramped reference and motor/profile cap. Hazard stopping can immediately zero the reference. These settings affect automatic route driving; manual arrow-key driving keeps its existing controls. Speed settings persist per environment and lock while recording.

**Export speed report** saves reference settings, time-weighted speed/error statistics, peak speed/planar acceleration and stop counts. These are display-step diagnostics, not a replacement for fixed-step dataset logs. Reset measurements before comparing runs.

## Trial reports and recordings

Trials report duration, travelled distance, maximum speed, pitch, roll and absolute slip, with 10 Hz samples from the 120 Hz simulation hook. Export the JSON report from Tests. The isolated lane starts with a gentle 2 cm pothole and broad edges; increase severity after a baseline run. A trial can complete, be stopped, detect a persistent stall, time out, or be invalidated by a configuration/track change. It is not a physical pass/fail certification.

Trials do not automatically record camera images: use the existing Record button if you want RGB/CSV. Dataset metadata includes `terrain_tests` and `speed_control`; track ZIPs also include `track/terrain-tests.json`. Existing replay, sensor inputs/truth separation, quality checks and checksums remain.

## More useful contacts for imported props

Visuals now exposes friction, restitution and contact shape:

- **Box**: cheapest conservative bounding box.
- **One convex hull**: convex approximation of all visible mesh vertices.
- **Convex parts**: up to 48 connected triangle-island hulls, preserving gaps between disconnected parts such as furniture legs. Included original furniture uses this by default.

Mass is distributed across collider volumes and total mass is retained. Complex meshes exceeding the hull budget fall back to a box; the editor reports the actual mode and part count after applying. Convex parts are not automatic concave decomposition: a connected hollow object may still have its opening filled. Instanced imported geometry is not decomposed.

Added Rapier props in Obstacle Track use a 4 cm sampled heightfield of the actual track, including potholes and bumps. The rover still uses the shared reduced-order motor/tyre model and quasistatic support; its planar proxy couples to added props. Legacy room contacts, walkers, gates and existing AABB proxies retain their limitations. ToF intersects registered visible meshes.

## What still needs your real-world data

Measured room geometry, actual missing CAD parts, calibrated friction/COM, camera calibration photographs and hardware sensor logs were not supplied. They cannot be recovered accurately from this app alone. V5 does not add a room scan, automatic checkerboard solver, photoreal animated people, depth/instance-mask dataset export or full articulated vehicle dynamics. The existing tools for manual calibration and real/sim comparison remain available.

See `VALIDATION_V5.md` for the checks and remaining GPU verification limit. Model/material source credits remain in `public/visual/ASSET_CREDITS.md`.
