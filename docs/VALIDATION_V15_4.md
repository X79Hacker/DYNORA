# DYNORA V15.4 validation

- 263 Node tests passed, zero failures/skips. New tests cover 1–64 sample counts,
  frozen scene/camera and alpha state, image filename links, bounded capture,
  resource release on failure, missing-region states and export sync rejection.
- Three Python controller HTTP integration checks passed.
- Vite production build passed; the existing large-chunk notice remains.
- 15 rendered source-browser checks passed with no JavaScript or shader errors.
  Selection, curved surfaces, polygons, cutout leaves, occlusion, live motion,
  optional filtering, resize stability, adjustable detail and all 256 patches
  remain operational. 47 visible feed probes passed with no black frames
  using preserveDrawingBuffer=false; original source materials and visibility
  remained unchanged by the contour pass.
- Built production apartment, canteen and obstacle-track runs each recorded
  five images while moving the rover. Sampling was 3 rays per patch, preview
  requested 2 Hz, and images/telemetry requested 5 Hz. The panel was closed
  after the first image; image-linked depth recording continued correctly.
- Stopping recording in each environment downloaded its ZIP automatically and
  retained a verified download link, including on the obstacle track.
- All 15 PNGs independently decoded at 640 x 480. Reopened ZIP CRCs and all
  148 manifest SHA-256 hashes passed. Every image had exactly one filename-linked
  CSV record and its own depth JSON with matching acquisition time and source
  display-frame ID. Selected patch bounds, per-part statistics and all
  225 raw hit positions/range/Z values were independently checked.
- CSV ToF values, acquisition age and validity match the frozen per-image
  context. Realistic sensor delay is retained rather than relabelled as zero.
- Original public assets and CAD sources are checked byte-for-byte during
  packaging; the complete source and built application are both included.

The WebGL checks used a headless software renderer. They do not establish FPS
on the user's Lenovo/RTX hardware or prove that every driver-specific flash is
eliminated. A 5 Hz capture target is best effort. Actual image intervals and
deferred acquisition opportunities are included in the evidence, along with
matching frame IDs. No duplicate RGB/depth frames are invented to fill gaps.

Geometric depths refer to the current undistorted camera. Distortion, temporal
blur or camera-freeze faults set rgb_pixel_aligned=0 and a quality warning.
Use direct-alignment rows for image/depth supervision, or explicitly model
those effects. Detailed outlines and heatmap remain preview visualizations;
depth samples are visible-triangle measurements, not a dense optical sensor.

See UPDATE_V15_4.md for controls, CSV names, timing semantics and training use.
