# V15.7: export the selected boundary and retain visible clipped segments

The default snap now copies the selected surface boundary shown in green in the
camera. It does not run whole-object edge detection. A rectangle attached to a
curved object keeps that attachment; it is not replaced by a fresh flat screen
rectangle, a whole-object silhouette, internal edges or unrelated foliage.

## Controls

1. Open Depth and draw a Rectangle or Polygon. Leave Attach region to the actual
   curved surface enabled to pin the selection to the measured triangles.
2. In Snap: your selected boundary, use Your selected boundary. This is the
   default. Dashed lines are on, grid off, background white and outline black;
   colours, line width and dashing remain adjustable.
3. Move the robot. The same selected patch projects into the current camera.
   Follow the attached rigid surface selection can be turned off for a fixed
   image-region selection instead.
4. Use Snapshot RGB + outline / compare, or Snapshot in the dock. Both save a ZIP
   containing the actual RGB and its outline. The download link remains available
   if the browser declines automatic downloading.
5. In the comparison, red is decoded from the actual saved snap PNG. Cyan is the
   captured selected boundary. Hide Latest selection to inspect red alone; use
   100% pixels or the zoom and opacity controls.

Previous V15.6 preferences migrate once to the selected-boundary default. Later
explicit choices persist. All visible object edges remains an optional mode for
users who intentionally want that previous effect. Object / Part clicks select
an object/part box; draw a Rectangle/Polygon for a surface-attached patch like
those in the reference screenshots.

## Border visibility

Each border segment is clipped in homogeneous camera coordinates before
perspective division. A segment is retained when a visible part lies within the
near/far planes and image, even if one or both original endpoints are outside.
Only the visible interval is drawn. Clipped paths remain open: no invented line
closes the selection along the frame border.

The selected boundary is independent of the centre anchor's live-depth status.
An off-screen or blocked centre does not hide the entire annotation. A hidden,
removed or incompatible target still invalidates its attachment. The annotation
is a surface-attached guide, not a new per-pixel occlusion measurement.

If the selected patch fills the view but its original border is outside it, the
snap is blank with status boundary_outside_view. Depth samples can remain valid.
If the entire selected patch has left the view, status is outside_view. Do not
interpret a blank boundary image as a measured zero depth. Skinned attachments
still require remeasurement after the original selected skin pose changes.

## Frame synchronization and coordinates

The selected paths are frozen synchronously at RGB acquisition, before any
asynchronous patch sampling or PNG encoding. Later bot movement, new selections
or setting changes cannot modify an earlier frame's saved boundary. RGB and snap
have the same full dimensions; no crop, recenter or independent resize is used.
Configured geometric lens distortion is applied to exported paths consistently
with the camera model. Temporal RGB effects such as blur/frozen feed retain the
existing alignment warning rather than claiming current-geometry pixel matching.

image_frames.csv links image, snap_file and snap_meta_file, with source frame,
capture simulation time and selection revision. snaps/metadata contains
selection_outline.paths in normalized undistorted camera UV coordinates, plus
camera calibration and dimensions. projected_region_polygon is a sampling
coverage polygon; use selection_outline.paths for the actual selected border.
The shared projection is also used by the live green border and cyan comparison.

## Rendering and preservation

Boundary connectivity is cached for the active attachment. Updating the selection
projects its existing border; it does not traverse every object edge or render
an additional native-resolution ID mask in the default snap mode. Patch sampling
and optional heatmap/discovery retain their own controls and bounded recording
queue. No universal FPS or capture-rate guarantee is made for every machine.

The complete prior source, models, connected wheel/caster fixes, friend-supplied
physics/surface modifications and other application features are retained.
