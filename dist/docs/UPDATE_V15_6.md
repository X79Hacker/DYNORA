# DYNORA V15.6 — detailed surface snaps from the current camera frame

This release is based on your uploaded project, including its surface presets,
physics changes, procedural surface appearance and Test Lab textures. The
connected chair/trolley caster assemblies and moving rover supports from the
previous update are merged into it. No model, texture, environment or CAD file
is removed. Extract into a fresh folder and run START_DYNORA.bat.

## What changes in a snap

The former snap used a 72-column ray lattice for a whole-object footprint, or
fell back to the selected rectangle. It could lose small curved details, and
closing a clipped contour could join its endpoints across the image.

**Actual visible surfaces** now captures an object-ID/depth raster at the native
camera resolution, synchronously beside RGB acquisition. Tracing and encoding
consume that frozen raster. The bot or object can move while the asynchronous
work finishes; the completed snap still corresponds to the captured RGB.
Curves, holes, visible mesh-part boundaries and optional self-occlusion/depth
gaps are retained. There is no bounding-box/rectangle fallback in surface mode.
Edges cut off by the view or selection stay open; off-screen geometry is not
invented and a surface filling the whole view does not get a fake frame border.

A newly completed rectangle or polygon becomes the active selection immediately,
before slower depth/attachment work finishes. Each capture freezes the selection,
its revision, camera pose and snap style. Later edits apply to later captures.
Attached regions reproject with their object/camera as before. For an unambiguous
whole object or individual leaf/leg, click its visible surface with Object / Part.

## Controls

Open **Depth → Snap image in the recording**:

- **Snap covers** retains the friend's object-from-shape-down scope and measured
  region scope. Object scope follows the labelled object's visible parts and
  cuts at the highest visible object point under the captured shape. Region
  scope limits visible contours to the selected projected region.
- **Outline geometry → Actual visible surfaces** is the new default. Explicit
  **Selection border only** remains available when you want the rectangle itself.
- Use **1–4 source-pixel line width**, solid or dashed lines, and optional
  **Self-occlusion / depth-gap detail**. Smooth surface gradients are not turned
  into dense contour stripes. These are geometric lines, not texture edges.
- Grid lines and **Include latest selection border** are independent optional
  guides. The grid defaults off, including migration of the former grid default,
  so its rectangular cells are not confused with the object's outline.
- **Only selected patches** optionally clips the snap to chosen measurement
  patches. Clipping does not create false object edges along patch boundaries.
- Background, outline and grid colours remain adjustable. White/black is the
  new default; existing explicitly saved colours are retained.

Thin details must cover source pixels to appear. Increasing camera resolution
can reveal more real detail; increasing sparse depth samples does not control
contour resolution. A fully occluded/off-screen target produces an empty snap
with an explicit status, never a substitute rectangle.

## Snapshot and comparison

The dock's **Snapshot** button and **Snapshot RGB + outline / compare** capture
an independent, small ZIP containing the RGB image, its `snaps/` PNG, index CSV,
patch data when enabled, capture metadata, an alignment image under `checks/`,
and a SHA-256/CRC-verified manifest. A visible Download snapshot ZIP link remains
available if the browser declines an automatic download. Snapshot downloads do
not replace the recovery copy of your last recording ZIP.

The comparison window has RGB, white-background snap and overlay views, opacity,
10–400% source-pixel zoom and a 100% pixels button. Red pixels come from decoding
the actual saved snap PNG; cyan dashes show the latest shape projected in that
captured frame. This makes shifts, missed curves and holes visually inspectable.
The comparison is frozen to that image, even while the simulation continues.
Close it with the close button or Escape.

## Recorded data and accuracy

Normal recording retains `images/`, `snaps/` and all existing dataset files.
`image_frames.csv` and telemetry now link `snap_file`, `snap_meta_file`,
`snap_status`, `snap_selection_revision`, `snap_source_frame_index`,
`snap_capture_sim_s` and `snap_pixel_aligned`. The snap metadata includes the
captured camera/projection, options and projected region. Linked patch/sample
CSV also names the snap. Snap files stay at the original RGB width, height and
position; they are never cropped, centred or stretched.

Native raster boundaries are quantized to source pixels; canvas strokes include
antialiasing. Expect roughly a source pixel of edge quantization plus configured
stroke coverage, not mathematically exact subpixel curves. Mesh silhouettes,
mesh-part seams and geometric depth gaps are supported. Smooth curvature that
fills the view need not produce a line where no actual visible boundary exists.

The native pass's 16-bit optical Z is used only for contour gap detection and
the optional shape-height cut (about far/65534 metres quantization). Actual
metric patch depths remain the existing triangle-intersection measurements.
ToF retains its delayed acquisition timestamps/ages. Lens distortion is applied
to snap coordinates; temporal blur and frozen RGB are flagged as potentially
misaligned. Prefer clean PNG camera settings for pixel supervision.

Native masks cost GPU time on capture, not on every display frame. For known
targets only their projected area plus a one-pixel margin is rendered/read back;
the exported image still has the full original dimensions. Tracing yields
between small CPU batches; the existing bounded queue defers captures under load
and records real gaps rather than duplicating an older snap. No guaranteed FPS
or 5 Hz acquisition rate is claimed. Sparse depth sampling, the aligned 16×16
no-crop grid, collision solver and approved physics remain unchanged.

## Checks scoped to this update

Focused native-contour/recording/selection tests, a small real WebGL curved-model
capture fixture, PNG/metadata pairing and a production snapshot smoke check are
used. The previously approved full physics/model test campaign is not repeated.
The build, complete ZIP and restored source assets are checked before delivery.
