# DYNORA V15.3 — select the surface first

Open Depth in the left dock. The image opens clear, without a full-screen grid.
Rectangle is the initial tool. Object / Part, Rectangle, Polygon and Point are
visible buttons at the top. The original snapshot, attached curved surface,
five live anchors, dashed guides, calibration and recording tools remain.

## 1. Select an object or shape

- Object / Part: click the intended visible part, for example one table leg or
  one leaf. Under Saved anchors / snapshot tools, Object click scope can select
  all mesh parts of the nearest labelled object instead.
- Rectangle: drag around the part of the image you want to measure.
- Polygon: click outline vertices; press Enter or Finish polygon.
- Point: use the existing point and five-live-anchor interface. Its controls
  expand automatically; the region/patch panel is hidden in this mode.
- Discover visible parts: optionally preview dotted visible-part contours,
  then click a part. Discovery clears the prior region so another can be chosen.

Pause robot while selecting is visible above the measurements. Disable it if
you want to keep driving while drawing a region. Clear target removes the
region. A new shape starts a new region; it does not erase other saved anchors.

## 2. Optionally choose patches

The grid always has **16 rows × 16 columns**, with ID `(row - 1) * 16 + column`.
Vertical lines continue through every row. It partitions the actual source
camera image, not the control panel's available space. Source pixel bounds are
integer, half-open rectangles `[x0, y0, x1, y1)`, using floor(i * size / 16).
Every source pixel belongs to exactly one patch. There is no crop or stretch.

Examples: 896 × 896 has 56 × 56 pixel cells. Full HD 1920 × 1080 has 120-pixel
wide cells, with heights of 67 or 68 pixels. UHD 3840 × 2160 has 240 × 135 cells.
Widescreen image cells are rectangular; square images have square cells.

The full camera image fits inside the viewport with unused space outside it
when necessary. Resizing the window only scales this display; IDs, source
bounds and patch choices stay unchanged. Changing capture resolution rebuilds
the source bounds while preserving the fixed row/column identity.

After selecting a shape, Choose patches inside target displays the relevant
grid and enables filtering. Click to toggle a cell. Drag replaces the patch
list; Ctrl/Cmd-drag adds and Shift-drag removes. Enter IDs such as `85-87,101`.
IDs outside the target region are ignored. All patches in target removes the
filter; Clear patches leaves the target but stops region depth queries.
Back to shape selection restores drawing input without losing the target.
Show target grid hides or shows the overlay independently of measurements.

Full-image measurement is still available under the snapshot tools as Select
full image. This is an explicit choice, rather than the initial depth workflow.

## Live depth, heatmap and dotted boundaries

Live region depth refreshes samples automatically. With it off, Measure now
captures individual snapshots and preserves the latest result. The status and
on-screen label give capture time, camera range, forward Z, validity and batch
latency. Patch labels use the chosen metric. Boundary, heatmap, grid and depth
labels have separate visibility controls.

Rectangle/polygon selection can attach to the clipped triangles of a rigid
curved surface. Follow the attached rigid surface uses its local coordinates
and originally selected face IDs as it moves; the image patch grid stays fixed.
Its projected selection may intersect different global patch IDs as the camera
or object moves. Turn following off for a fixed image-space polygon. Animated
skins use fresh posed queries; a rigid face attachment is not fabricated for
deforming geometry.

Dotted contours come from an optional ID/visibility raster pass using the
same camera projection, visible geometry, depth test and alpha cutouts. They
are part silhouettes, not bounding rectangles or AI-generated guesses. The
default preview caps the longest region edge at 384 pixels; 768 and source
pixel detail are available. Source detail costs more time and memory.

The heatmap colors each visible part using the nearest valid sample from that
same part and patch. It is a sampled visualization, not dense measured depth.
The blue/red legend gives its sample range. Mask and ray samples are captured
in the same synchronous scene instant before sampling yields. Stale screen
masks are hidden when the camera projection or pose changes until a new batch
matches the view. The depth readout retains its capture timestamp rather than
pretending to have zero latency. Occluded parts produce no valid target depth;
missing samples are not filled from neighbouring objects or patches.

Depth values come from actual visible triangle intersections, including posed
skin geometry. Alpha-tested texture holes are evaluated at texture base level
for the geometric ray, respecting UV transforms. Contours evaluate the GPU's
alpha test. Preview raster resolution and texture filtering can affect boundary
edges; exported sampled coordinates and geometric depths remain explicit.

## Rates, exports and training coordinates

Choose 1, 9, 25 or adaptive 9–25 samples per selected patch, and request 1, 2, 5
or 10 updates per second. There is one batch in flight; slow batches do not
queue a backlog. Sampling yields between short chunks. Actual throughput is
reported and depends on scene, detail and hardware. Closing Depth stops this
work. Preview masks are optional and are not rendered during ordinary driving.

CSV includes global patch ID, row/column, source pixel bounds, native image
size, per-part statistics, validity, capture timestamp and source display-frame
index. Raw sample CSV/JSON carries UV and camera/world coordinates. Region and
history JSON retains the selected polygon, surface attachment, object identity,
camera pose and projection. Masks/contours are labelled as preview data; their
quantized preview Z is not exported as a training depth measurement.

Region capture now runs after scene/fault updates and uses the opaque Bot Cam
wall policy, immediately before display rendering. Recording image audits also
contain the source display-frame index. Join only matching frame indices or
capture times; best-effort rates do not imply a depth batch for every image.
Patch coordinates refer to the undistorted camera render. If RGB lens
distortion, blur or camera-freeze faults are enabled, recorded RGB can differ
from that geometric view; matching frame indices alone does not undo those
effects. Keep them off for direct RGB/patch alignment or use their calibration
and fault metadata in your training pipeline.

Dataset and scene ZIPs include the region/patch files under visual/. Retained
history is capped at 50 batches and 10,000 surface rows; dropped batches are
reported. Original assets, collision systems, Test Lab and the V15.1 rover
movement fix are retained. This update does not add ROS 2.
