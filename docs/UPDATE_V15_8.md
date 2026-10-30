# V15.8: regions, visibility, track structures and map spawning

## Multiple selected regions

Open Depth. Add each new drawing as another region is enabled by default.
Draw Rectangle/Polygon regions, or select Object/Part targets. The dropdown lists
stable region IDs. Select one to adjust its patch filter or remove it. Uncheck
Add to replace that selected region; refinement/replacement retains its ID.
Removal does not recycle IDs. Clear all regions is separate. Limit: 16 regions.

Every recorded RGB and white-background snap contains the captured region set.
All regions use one frozen scene query and one camera at the same acquisition.
Each region has its own selected cells, samples and visibility state. Switching
or redrawing after acquisition cannot alter an earlier image's measurements.
Five legacy live point anchors also remain available separately.

image_frames.csv includes region_count. depth/image-regions.csv has one row per
image/region with identity, time, visibility and depth summary. Patch and sample
CSVs include region_id and region_label. The per-frame depth JSON retains
region_readings and regions; snap metadata retains the same region definitions
and summaries. Overlapping global patch IDs remain distinguishable by region ID.

## Visible selected boundaries

The snap keeps the selected attached border, not every edge of an object.
Camera clipping retains visible portions of lines crossing image/near/far planes.
Visibility now also compares the selected surface's projected optical depth with
the nearest frozen visible triangle. A foreground blocker or a nearer face of
the same mesh removes the hidden border portion. Foreground depth is not relabelled
as the selected target: target meshes and originally selected faces are checked.
Fully hidden regions have an occluded status and no valid target samples.

Boundary visibility is sampled (nominal 4 source pixels, increased for very large
borders) with refined transitions, not an exact pixel segmentation algorithm.
Subpixel/thin blockers can be missed. The live border uses periodic visibility
checks and follows current transforms between them; exported captures use fresh
checks on their own frozen state. Skin-pose changes still require remeasurement.
Lens distortion uses the calibrated export projection. Temporal blur/frozen RGB
retain the existing alignment warning. No claim of universal pixel-perfect or
hardware-validated physical accuracy is made.

## Bridge and speed bumps

Bridge decks have connected end/mid supports and crossbeams. Their underside and
side/end surfaces have contact geometry. Barriers include a continuous lower
curb. Closed bump meshes have tapered lateral shoulders and rubber materials;
visible top vertices sample the driving height field. The shared bump profile
also shapes wheel support. Track roughness/terrain settings are preserved.

## Spawn rover on map

Open Rovers in the dock. Spawn rover on map is below Choose a bot. Click the map
to set X/Z, or type X, Z and yaw in degrees. Use current pose copies the current
pose. Spawn here pauses the robot, checks clearance against the contact scene,
settles the track wheels, clears motion and synchronizes the Rapier base and
odometry. Rejected overlapping positions restore the previous pose. Spawning is
blocked during dataset recording and replay. Use Resume driving or Keyboard
drive after spawning. The map is a scene overview, separate from the ToF map.

The planar tyre/motor model and terrain response are coupled to a contact base;
this remains a reduced-order simulator, not an articulated wheel dynamics engine.

## Recording and performance

The fresh-recording fix is retained: Record starts a new dataset and the latest
ZIP replaces the old visible download. Lean datasets retain RGB, snaps, depth,
sensor/action data and calibration without scene/CAD/model backups, physics
replays, captions or event logs. Application model assets remain installed.
Depth sampling yields independently of requestAnimationFrame so a delayed display
callback cannot by itself leave a measurement pending. Image GPU readback and
encoding still cost time; capture rates remain best effort and gaps are reported.
