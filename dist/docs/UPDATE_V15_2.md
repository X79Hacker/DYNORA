# DYNORA V15.2 — selectable 256-patch depth

Open **Depth** in the left dock. **256 patches** is the initial selection mode.
The full camera view is divided into exactly 256 patches without cropping,
padding or stretching. Rows may differ by one column to keep patches close to
square. A square 896 × 896 frame uses 16 × 16 cells of 56 × 56 pixels. A full
HD 1920 × 1080 frame uses twelve rows: eight with 21 cells, four with 22.

## Choose only the patches you need

- Click a patch to toggle it.
- Drag across an area; the selected portions of boundary patches are sampled.
- Choose Add, Replace or Remove for drag selection. Shift-drag removes touched
  patches; Ctrl-drag or Cmd-drag adds.
- Enter IDs such as `1, 4, 20-40`, then Apply IDs. IDs are 1–256, reading left
  to right, top to bottom.
- Select all 256 is optional. Clear selection cancels pending work and leaves
  zero active depth queries.
- A resize preserves the normalized selected area. If the layout changes,
  result IDs can change with the new rows; the new layout accompanies exports.

## Measurements and performance

Each batch freezes the camera, rigid transforms and human bone pose at one
simulation instant. It samples visible triangles only in the chosen patches,
yielding between short chunks so the display can continue rendering. A shared
spatial index skips unrelated meshes. Indexed human queries use the frozen
pose and shared bind-space triangle trees rather than baking every skin for
each batch. No extra WebGL scene render or GPU readback is used by this tool.

Choose 1, 9 or 25 sample positions per patch. Adaptive mode starts with nine
positions and refines to at most 25 where depths vary or returns are missing.
Twenty full patches at nine samples need 180 queries; forty need 360; all 256
at 25 samples need at most 6,400. Partial selections can use fewer positions.

Live measurements request 1, 2, 5 or 10 updates per second; actual throughput
depends on scene and hardware. There is one batch in flight, no backlog. The
panel reports completed rate, simulation capture time and batch latency. Use
Measure now with Live measurements off for individual frames. Closing Depth
or changing mode cancels pending work. The ordinary app does no patch sampling
when Depth is closed, live updates are off, or the selection is empty.

Medians and sample extrema describe the sampled points, not every pixel in the
patch. A thin object can fall between samples: increase sampling or draw a
tighter region. No-hit, missing-target and mixed-surface results are explicit;
depths are never filled from neighbouring cells. Distinct mesh parts in a
patch have separate statistics. The table shows Mixed instead of an average
across different parts. Click a result ID to inspect each part.

Use Pick a part and click the intended visible mesh (for example a table leg)
to exclude background readings. An occluded target stays unavailable; the
query does not see through the foreground. The filter applies to that exact
mesh part; multi-mesh objects can produce separate entries in all-parts mode.

Measurements can show straight-line range from the camera centre or forward
optical Z, in centimetres or metres. Show grid and Show depth labels can be
toggled independently. The camera feed remains visible. Switch Selection to
Point, Rectangle or Polygon for the existing five live anchors, dashed guides
and attached curved-surface regions.

## Optional reference dimensions

Enable Reference plane calibration and enter the physical width and height
across the full reference frame in centimetres. For a square 896 × 896 frame,
54.4 × 54.4 cm gives 3.4 × 3.4 cm cells. Defaults are examples; calibration is
disabled initially. These dimensions describe that reference plane only.
Perspective and distance change the physical area subtended by image patches.
Calibration does not invent camera depth or modify geometric depth readings.

## Exports

Export patch CSV contains one row per patch and visible mesh part, including
selected IDs, range/Z median, sample min/max, validity, timestamps and optional
reference dimensions. Export sample CSV contains the actual ray hits. Values
are in metres regardless of the display unit. Export recent history retains
up to fifty completed batches and 10,000 surface rows; dropped batches are
reported in the accompanying history metadata. Only the latest batch retains
raw sample hits. An ordinary dataset or scene ZIP also includes the patch
selection, latest batch, sample CSV and retained history under `visual/`.

Patch selection is screen-based. Moving the camera measures the current rays
through those positions in the next batch. Completed values retain their
capture timestamp; they are not a promise of zero-latency tracking. The existing
point-anchor tool remains available for tracking a fixed place on an object.

V15.1 rover switching, keyboard driving, recording ZIP verification and all
earlier environments, assets, physics and research tools are retained.
