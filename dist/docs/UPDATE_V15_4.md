# DYNORA V15.4 — an image is the recording unit

## Capture workflow

1. Extract into a new folder and start START_DYNORA.bat. Confirm V15.4.
2. Open Depth. Select an Object/Part, Rectangle or Polygon; optional patch
   filtering still happens after shape selection. The grid stays 16 by 16,
   source-pixel aligned, without crop or image stretch. Widescreen cells are
   rectangular. This update keeps that mapping unchanged.
3. Leave Record fresh patch depth with every image enabled. Choose 1–64
   samples per patch. Values 2, 3 and 4 mean exactly 2, 3 and 4 candidate rays
   per full patch; clipped polygons can accept fewer. Adaptive mode retains
   the existing 9–25 behavior. More samples can resolve smaller features but
   do not turn sampled statistics into dense depth.
4. Images and telemetry now both default to a 5 Hz target. Set images +
   telemetry to 5 Hz restores both settings together before recording. The
   Settings tab retains individual rates. Images are scheduled on telemetry
   samples, so a slower telemetry rate also limits image acquisition.
5. Record. You can close Depth: selected-region capture continues for every
   image. Stop & export automatically prepares, verifies and downloads a ZIP;
   a retained download link remains in the dock. The obstacle track now uses
   the same recording/export controller as the apartment and canteen.

No selected region produces an explicit no_region row. Clearing selected
patches produces no_selection. Turning image-linked depth off produces
disabled. These states do not manufacture depth. Point mode retains five
live anchors; choose a region for image-linked patch recording.

## Controls and the live preview

Samples per patch, Live updates / second, and Boundary detail are visible
together above the results. Live preview accepts every integer from 1–10 Hz,
including 2, 3 and 4. Recording acquisition is controlled by the image rate,
not this preview rate: a 2 Hz preview can coexist with a 5 Hz image target.

Boundary levels 1–4 cap the longest preview edge at 128, 256, 384 or 768 pixels.
The default is level 2. Source pixels remains available at higher cost. The
boundary pass now uses a separate proxy scene with shared source geometry;
it does not swap the visible scene's materials or visibility. Offscreen RGB
and mask work runs before visible rendering, and manual mask measurements
start on the simulation render loop. The visible camera is drawn last.

During image-linked recording, a second independent live region query is
suppressed. An open live depth panel displays completed recording batches;
closing the panel skips preview masks/heatmap and retains geometric recording.
Heatmap and dotted boundaries remain optional. Contours are preview rasters;
heatmap values are interpolated visualizations of actual same-part samples.
Neither is exported as a fabricated dense training-depth image.

## What is synchronized

Fault/object updates occur before sensor acquisition. Each RGB capture freezes
its scene transforms, posed skin geometry, alpha material settings and camera
projection in the same synchronous capture stack. Selected patches are then
measured from that snapshot, even if the scene moves while work yields.
Acquisition time and completion latency are separate fields.

Every retained image has an image_frames.csv row. Every measured image has
its own depth/frames/*.json, with the same image filename, capture/frame ID,
source display-frame index, camera matrix and acquisition time. No previous
preview batch is substituted into a new image. Even a batch with zero valid
hits has its own frame record and explicit no_samples state.

Current gt_tof_* values refer to the captured simulation state and the capped
geometric sensor ranges. Measured tof_* values retain configured acquisition
frequency, noise, latency, dropout and delivery timing. They can legitimately
be older than RGB. sensor_acquisition_sim_s, sensor_delivery_sim_s,
sensor_age_s, validity and each channel's detailed timestamp are retained.
"Same capture record" does not mean a delayed physical sensor acquired at
the camera instant. Do not relabel older ToF values as instantaneous truth.

The four ToF channels describe their own mounts, directions and fields of
view; they are not one value per image patch. Camera depth is geometric
simulator ground truth. Hardware accuracy still needs hardware validation.

## CSV files: find an image by name

- data.csv retains the complete telemetry stream and its image column. Added
  columns include image_source_frame_index, patch_source_frame_index,
  patch_capture_sim_s, patch_sync_delta_s, patch_status, patch_file and
  rgb_pixel_aligned.
- image_frames.csv has one row per image, including image (full relative
  path), image_name (basename), capture_id, source frame IDs, both capture
  times, patch status/counts, latency, ToF/IMU/encoder/pose/action columns,
  previous_capture_id, image_dt_s and requested_image_interval_s.
- depth/image-patches.csv has image filename/capture columns plus global
  patch IDs, rows/columns, half-open integer pixel bounds, per-part support,
  median/min/max sampled camera-centre range and forward Z depth.
- depth/image-samples.csv has the image filename, global patch ID, UV,
  continuous source pixel coordinates, world hit position, range and Z.
- depth/frames/*.json preserves each image's camera, telemetry, all ToF
  timestamps, region/selection, surface identity and raw geometric samples.
- depth/sync-report.json reports retained images, status counts, maximum
  acquisition mismatch, deferred opportunities and memory use.

Ranges and Z are metres. A pixel patch does not have a constant centimetre
footprint across different depths or curved surfaces. Existing reference
plane calibration is preserved separately from geometric depth.

## Throughput, gaps and world-model sequences

Five Hz is a target, not a hardware guarantee. Only one frozen recording query
is in flight; no unbounded backlog is created. If it is still busy at an image
opportunity, image capture is deferred while telemetry and rendering continue.
The next retained image receives a fresh snapshot. Actual image_dt_s and
deferred counts expose lower effective capture rates. Missing images are not
replaced by repeated pictures or retimed depth. Physics time and wall-clock
rendering throughput are both distinct from the requested recording rate.

Depth recording retains an estimated 128 MiB budget. Once reached, new image
acquisition pauses until export and Clear; retained frames are not discarded.
Encoding can finish after capture. Export waits for pending depth and image
jobs and checks image/depth acquisition times and source display-frame IDs.

For a world model, construct transitions from the explicit capture IDs and
actual delta time. PWM/action columns describe the command at the observation
instant; commands need not remain constant between two images. replays.json
retains fixed-step commands when you need the full intervening action trace.
Use gt_* and geometric patch depths as targets when appropriate; including
them as inputs changes what information the deployed model would require.

## RGB coordinate effects

Patch UV and source pixels refer to the undistorted current camera render.
Exposure/read-noise do not move pixels. Lens distortion, previous-frame blend
and camera-freeze faults can break direct RGB-pixel supervision. Such frames
have rgb_pixel_aligned=0 and a quality warning, while their actual timing is
still exported. Keep those effects off for directly paired geometric labels,
or explicitly transform coordinates/model their temporal behavior downstream.
Use rgb_pixel_aligned=1 for direct image/depth supervision.

All original models, textures, human actions, physics, removal controls,
Test Lab and rover choices remain. This update does not require ROS 2.
