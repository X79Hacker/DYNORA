# Research V3 guide

## Twelve requested areas

| Area | Implemented tool | What needs real evidence |
|---|---|---|
| Robot calibration | Radius, effective track, RPM and coast-test calculators; evidence JSON; editable mass/COM/motor/inertia parameters | Actual distances, encoder counts, timing, weight and COM measurements |
| Real vs simulated runs | CSV column/unit mapping, relative-time alignment, offset, bounded interpolation, plots, RMSE/MAE/bias/max | A real run made under matched commands and conditions |
| Synchronization | Run/frame IDs, simulation capture timestamps, sensor acquisition/delivery stamps and late counters | Real collector acquisition timestamps rather than only file-save times |
| Sensor realism | ToF latency/jitter/bias/scale/noise/dropout; approximate dark-material loss; IMU and encoder errors | Error distributions measured at several distances/materials |
| Quality checks | CSV shape/time/finite checks, image references, decoding, uniform/clipping audits and SHA-256 manifest | Visual review of flagged frames and real GPU captures |
| Geometry | Persistent local STL overrides with unit selection, bounds and hash audit | The six actual missing meshes; measured dimensions/inertias |
| Contact physics | Four patch normal loads, combined traction limits, lateral motion, wall response and geometry-aware gate size | Matched traction/turn/braking/ramp experiments |
| Camera calibration | FOV/principal point, body mount, exported K/D matrices, distortion and image effects | Real camera calibration and mount measurements |
| Ground truth separation | `gt_*`, ground_truth.csv, inputs.csv, commands.csv and explicit label roles | Task-specific prevention of target leakage |
| Reproducibility | Seeded streams, source build ID, settings, experiment snapshots, initial scene archive and input replay | Hardware replay and independent environment/contact state where needed |
| Environment variation | Bounded seeded mass/friction/exposure/light/material/object perturbations | Plausible ranges; randomization does not certify realism |
| Dataset splits | Stable environment/run group split assignment and cross-dataset manifest builder | Enough independent environments and held-out real-world tests |

## Measurement workflow

Use the standalone research page even if WebGL is unavailable. Import the existing calibration first. Otherwise unmeasured fields remain defaults. Enter real measurements and repeat trials.

- Radius: `r = distance * ticks_per_revolution / (2π * mean_absolute_ticks)`. Straight level motion with negligible slip is assumed.
- Effective track: `b = |right_ticks - left_ticks| * 2πr / (ticks_per_revolution * measured_angle_rad)`. This is floor- and skid-dependent, not necessarily the CAD track.
- No-load RPM: `60 * ticks / (ticks_per_revolution * duration_s)`. Measure at the stated nominal voltage.
- Coast estimate: `Crr = initial_speed² / (2g * stopping_distance)`. This lumps motor drag into an effective resistance.
- Weigh the full robot including battery and payload. Enter total mass under Physics. Torque, inertia, tyre stiffness and battery response remain estimates until independently identified.

Download the measured profile and import it under Physics. Evidence is preserved in subsequent exports. A manual parameter edit clears previous evidence from the active profile; keep the evidence file.

## Timing, noise and sensor validity

Dynamics uses 1/120 s substeps. Renderer stalls are capped and dropped wall time is reported. Samples are generated from actual available physics snapshots, not interpolated or copied to pretend a requested rate was met. Sensor ray acquisition is render-triggered; sensor rate is a target, not a separate hard-real-time thread.

Configure telemetry rate independently of image interval. Images are taken on the next recorded sample at or after the image deadline, so image rate cannot exceed telemetry/rendering rate. Both the image and its row use the same simulation snapshot. Encoding/file saving can finish later without changing the acquisition timestamp.

ToF returns values only with `ok` status. `pending`, `dropout` and `out_of_range` have empty numeric measurements. Do not interpret an empty field as zero. The capped geometric result is stored separately under `gt_tof_*`. A maximum-range geometric result does not establish the true distance beyond the sensor range. Range noise uses a Gaussian baseline plus a distance-squared component, with millimetre quantization; this is a tunable approximation, not a manufacturer-validated optical model.

IMU includes noisy accelerometer components, gyro bias/noise and integrated yaw. A stationary level accelerometer measures approximately +g on z. Measured encoder ticks can miss a configured fraction; odometry integrates the measured tick changes and is anchored to the known simulation start pose. Truth and encoder drift stay separate.

Coordinate frames: world x east/y north/z up; robot x forward/y left/z up; camera optical x right/y down/z forward. Angles in CSV are degrees unless the name says radians. ToF mount yaw configuration is radians.

## Four-contact reduced-order physics

The model retains two motor-side angular states representing four motors, with explicit wheel inertia and torque-speed response. There are four contact load estimates in FL/FR/RL/RR order. Longitudinal/lateral load transfer uses the configured COM height, forward acceleration and lateral acceleration. Negative estimated support loads trigger a risk flag; remaining loads are renormalized to total support force.

At each patch, combined longitudinal/lateral forces are limited by the friction circle `sqrt(Fx² + Fy²) <= μN`. Lateral patch forces oppose body lateral motion and yaw scrub. Body planar motion includes lateral momentum and rotating-frame coupling. Walls reject blocked translation and project/restitute velocity; gate dimensions follow the current rover envelope. Fixed substeps reduce displacement per collision query.

This is NOT a full rigid-body contact solver: no articulated suspension, arbitrary 3D mesh contact manifold or dynamic rollover is implemented. Terrain pitch/roll remains quasistatic. The support-risk flag does not simulate a real overturn. Room object and gate dynamics retain explicit approximations. Do not describe numerical checks as physics proof.

## Camera and labels

The live camera uses the configured mount, FOV and principal point. `K`, `D` and optical-frame conventions are exported. Saved frames can receive radial/tangential distortion, exposure gain, pixel noise and optional previous-frame blending. Distortion maps are cached. Frame blending approximates blur between sampled images; it is not an integrated shutter model. Keep it off for baseline geometric measurements.

Object boxes are projected 3D axis-aligned bounds with heuristic visibility. They are not exact masks, and distorted images make them approximate. When ToF is unavailable, range-based safety Q&A is omitted instead of inventing a zero-distance obstacle. Generated captions/actions are simulator-derived annotations, not independent human labels. The route follower/safety logic is a geometric teacher controller; it does not become a learned real-world policy by adding noise to exported measurements.

## CAD import

The original source files are unchanged. Missing files are: wheel.stl, johnson_motor.stl, aluminium_sheet.stl, holder1.stl, holder.stl and motor_bracket.stl. Supply your actual exports with exact filenames, select source units, and inspect the reported dimensions. Imports are held in browser IndexedDB and included in datasets with SHA-256 hashes. Re-open the CAD inspector and select my_bot.urdf. It will use the supplied geometry through the original URDF link/joint transforms.

The driven rover keeps its parametric replacement visuals; the complete reference assembly robot.urdf is a different model. Importing an STL does not identify mass, inertia or collision accuracy. Missing files cannot be faithfully reconstructed from joint metadata alone.

## Reproducibility and replay

Save an experiment before a run. It contains seed/profile, route, existing labelled-object transforms, people route state, lights/curtains and random states. A frozen lighting hour is enabled by default for repeatable capture; disable it to use the existing live clock controls. Seed alone does not override every prior browser preference, so retain the complete experiment.

The compact experiment restore does not recreate arbitrary spawned geometry or internal gate/rolling contact history. Dataset `scene.json` archives the initial complete Three.js scene separately. `replays.json` stores 120 Hz motor inputs/options and post-contact states. The replay verifier re-executes the drive model, measures pre-correction discrepancy, then restores recorded contact corrections. That is useful for inspecting commands/drift, but is not an independent replay of all room physics. The 180,000-step per-run limit is explicit through a truncated flag. Browser/GPU bitwise determinism is not promised.

Randomization is off by default. Bounds are validated; selected movable-object overlaps are rejected. Each applied perturbation is recorded. Calibration remains distinct from sampled runtime parameters. Keep floor, payload, camera and lighting ranges plausible. Repeated variants of the same room should keep the same environment ID for split grouping.

## Exports and training

Stop, Export, wait for packaging, then click the green ZIP link. Folder mode writes the same files after checking referenced images. Asynchronous image writes are awaited; errors are reported. Clear waits for pending encoding and then clears recording buffers. ZIP checkpoints are cumulative to prevent dangling references across batches.

- data.csv: compatibility telemetry plus all appended research fields.
- inputs.csv: measured sensors/odometry and image references; excludes true pose, true ToF, true velocity and current command.
- ground_truth.csv: simulator truth and selected diagnostics.
- commands.csv: applied control signals; useful as targets for imitation learning, not automatically safe to include as inputs.
- metadata.json: calibration/evidence, frames, settings, run identity, assumptions and source build fingerprint.
- quality.json: consistency result and image audit. Warnings require review; a genuinely dark scene may be uniform.
- manifest.json: bytes and SHA-256 for each other file; self hash excluded. This detects corruption/changes, not authenticity.
- annotations/events: simulator-derived labels and event-image associations. Events refer to the nearest preceding recorded image, not a new simultaneous capture.
- splits/: row/frame/image indices for whole-group train/validation/test assignments.
- experiments.json/replays.json/scene.json/cad/: reproducibility evidence.

Build sequences within one run. Preserve sensor acquisition/delivery stamps and validity. Do not backfill invalid values with zero or attach a later image to an earlier row. Choose targets according to the task; separated files alone cannot prevent all leakage.

Comparison accepts ISO timestamps or numeric seconds/milliseconds, and selectable metres/centimetres/millimetres or radians/degrees. It aligns relative times, removes initial translation/yaw offsets, interpolates within a maximum gap and never extrapolates. This alignment is not full trajectory registration or a proof of physical agreement.

Group splitting uses a stable avalanche-mixed hash of seed and group, with 70/15/15 probabilities. Whole environments remain together by default. Small collections can have empty splits; collect more independent groups rather than moving nearby frames. The split builder combines metadata from multiple recordings and deduplicates run IDs. Use a held-out real dataset for final sim-to-real claims.

## Practical laptop use

Start with a short 640×480/JPG recording at 4 Hz and images every 0.25 s. Inspect it before scaling up. Increase resolution only if timing/quality remains acceptable. Long high-resolution PNG recordings can consume substantial browser RAM; use folder mode or shorter recordings. Dataset browser inspection accepts ZIPs up to 250 MB and 700 MB declared uncompressed size. All parsing, hashing, CAD storage and image processing remains local. Keep exported files if clearing browser data.
