# DYNORA V13 changes

## Rendering and diagnosis

Rigid furniture gets a derived draw representation grouped by compatible PBR
material properties and textures, using vertex colours for distinct colours.
All source triangles, normals and UVs are retained. Source objects remain the
identity for selection, depth, sensors and physics. Runtime batches are omitted
from scene JSON; the source camera layers are restored in that export. Moved
rigid roots do not rebake. Changes are validated after UI edits and periodically
at 250 ms; unchanged display frames only synchronize lighting intensity.

Animated/skinned roots, deforming curtains, transparent meshes, mirrors and
custom shader materials are excluded. Derived meshes cannot add duplicate
physics colliders or depth samples. Moving a rigid group carries its batch
through the same transform.

Adaptive display resolution starts at native pixel scale and can range from
0.65× to 1.25×. It responds at bounded intervals, and avoids reducing pixel
count when measured CPU work dominates. It is optional; disabling it restores
the selected preset's pixel budget. Opaque UI composition is also optional.
Geometry detail and physics accuracy are not tied to the display scale.
Recorded camera targets retain their configured dimensions and colour pipeline.

The shared main/preview/capture pipeline remains. Depth mode uses one visible
Bot Camera pass scissored into its dedicated workspace, without an additional
camera inset render. One fresh shadow pass is reused for the display instant.

An actual display-interval profiler spans the complete frame callback, with
actors, drive/contacts, depth/controls, ToF, telemetry/UI and render submission.
It includes visible stalls and excludes known background-tab intervals. Visuals
shows the results and exports JSON. CPU submission time does not directly
measure GPU execution. A selected FPS target is not a performance guarantee.

## Depth

The camera view has its own transparent viewport beside the depth controls.
Drawing, input coordinates, camera aspect and measurement rays use that same
viewport. Closing Depth restores the ordinary room layout. Bot Camera walls
remain measurable while Orbit uses wall cutaways.

Maximum surface range is configurable from 0.1 to 250 m, default 50 m, separate
from the ToF sensor range. Saved target capacity is configurable from 1 to 256,
default 64. New measurements can save automatically, and targets can be named,
selected, removed, hidden and exported together to CSV. Inactive pins use compact
numbered markers by default. Full saved-depth labels are optional and placed
without overlapping one another or the active result. Crowded labels are hidden
while their surface markers remain. Capacity does not evict
earlier targets. Range/capacity settings persist in this browser.

Ordinary points and active live visibility checks use the shared accelerated
triangle-query path instead of cloning the whole room. Static region snapshots
still freeze their selected geometry. Heatmap pixels are rasterized once per
measurement/metric and then composited from a cached canvas.

Only the active target is checked live at 5 Hz. Other pins are explicitly SNAP
values; their markers follow rigid surface transforms. Saved regions retain
summary and anchor data, without duplicating up to 100,000 dense samples for
every pin. Update depth remeasures a saved region for its curved patch and
full pixel CSV. Failed fresh measurements clear the previous active result.

Curved surface attachment, dashed rays/ticks, optical-axis offsets, normals,
heatmaps and independent visibility controls remain available. Geometry removal,
occlusion, view bounds and range bounds invalidate live anchors explicitly.

Earlier contact-driven gates, human walk/sit/stand actions, model removal and
undo, terrain response, isolated Test Lab and verified recording ZIPs remain.
