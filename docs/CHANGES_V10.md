# V10 changes

Scene editing previously returned before stepping Rapier while the ordinary
blocking rays were already disabled. Resuming Drive with editing enabled could
therefore pass through the entire scene. Editing now freezes mixers only;
contact integration always runs. Scene contact sources synchronize before each
drive advance, removing the previous 0.75-second collider-update delay.

Fixed legacy obstacles now use triangle meshes, including rotated thin rails and
merged fence chunks. Their world bounds no longer become solid filled boxes.
Moving statics update transforms without rebuilding their geometry; removed or
hidden geometry is removed from contact. Robot geometry uses separate rounded
plate, wheel-profile/tread and component hulls, aligned with the rendered model.
The physical shape and amber Physics debug view use the same geometry generator.
Robot pitch, roll and limited wheel compliance are reflected in contact shapes.
Tiny screws, wires and plate slots are omitted. Added-prop Box/Convex/Parts choices
remain user-controlled approximations; a large Box can still enclose empty space.

The contact world uses a 0.15 mm allowed linear error, 1 mm predictive contact
range, ten solver iterations and four CCD substeps. These are numerical settings,
not a claim of real-world accuracy. The robot remains a motor/tyre model coupled
to a constrained rigid body, rather than a full six-degree-of-freedom wheel solver.

Track gate leaves now use dynamic rigid bodies, revolute joints, spring/damper
motors and angular limits in this same world. The old separate frame-based gate
response and delayed static leaf collider are removed. Rebuilding a track cleans
up the previous hinge bodies. Mass and closer settings apply to the new joints.

Track terrain now drives a 120 Hz damped heave/pitch/roll response. Four rolling
circle tyre supports feed it; wheels have at most 14 mm of effective compliance,
and a falling chassis cannot accelerate downward faster than gravity. Repeated
multiplication of speed at a pothole rim is removed. Current attitude is supplied
to every drive substep, making terrain motion independent of the display rate.

Depth adds a dashed 3D range ray from the camera optical centre to the hit point,
an optical-axis Z leg, a lateral-offset leg, distance ticks and an optional surface
normal. Orbit view reveals these rays; Bot Cam shows extended dashed image-space
crosshairs and a projected target label. Guides and heatmaps can be hidden
independently. Auxiliary geometry is excluded from camera measurements/captures.

A pinned rigid-surface point follows camera/object transforms at 5 Hz. Its ray is
checked against current geometry; occlusion, leaving the view, hiding, removal,
or animated skin makes the live target invalid. A selected region keeps its
original statistics/timestamp and tracks only its anchor live. Frozen heatmaps
are hidden when the camera no longer matches the snapshot, preventing stale
colours from being presented as current depth. CSV rows carry timestamp/state;
recording exports also retain the latest live target JSON.

The route-avoidance checkbox now fully controls its sensor brake and explicitly
states the 70 cm threshold. This anticipatory stop has a different message from
physical contact. Manual Drive remains available for impact testing. A Three.js
r128-incompatible room-removal call was also corrected to normal parent removal.
