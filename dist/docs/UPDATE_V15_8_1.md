# V15.8.1: simultaneous live region depth

Open Depth, leave Add each new drawing as another region checked, and select two
or more objects/regions. Enable Live depth - all regions. Every stored region
(up to 16) updates during the same measurement cycle, without switching targets.

All tracked regions shows each region's camera-centre range, optical Z depth and
visibility state together. Region to edit chooses the patch filter/inspector to
edit; it does not restrict measurement or clear other regions' values. Click a
summary row to edit that region. Each visible region also has its own labelled
range/Z readout in Bot Cam. On-screen depths hides those labels.

A cycle freezes one camera and scene for all regions, then publishes the whole
result together with one batch ID, source frame and simulation time. A target
that is blocked, outside the view or without samples is explicitly marked;
foreground depth is not reported as target depth. Removing a region removes it
from subsequent live and recorded cycles. Clearing one region's patch filter
leaves the others running. Measure all now works when live updates are off.

The sampled heatmap covers all selected regions using one optional shared mask
pass per cycle, with a common depth colour scale. The detailed patch table/grid
is still for the region being edited. Patch/sample CSV exports and history now
contain all regions, distinguished by region_id and region_label.

Recordings and RGB/white-snap pairs retain the shared captured region set,
independent of the live checkbox/rate. During recording the displayed board is
fed by completed image-linked captures. CSVs retain exact acquisition identity
and ToF acquisition timing. Previously delivered spawn, terrain, physics and
lean/fresh-export changes and all model/material assets are retained.

Live rate is a target, not a guaranteed rate. Only one live measurement can run
at once; the next cycle waits for completion. More regions and more per-patch
samples increase ray work. Optional heatmap/boundary settings and the requested
rate remain adjustable. Visibility still uses the V15.8 sampled border checks;
subpixel blockers may be missed. This update does not establish hardware FPS or
hardware-validated dynamics.
