# DYNORA V9 — depth, contacts and model removal

The human arm controller now keeps elbows beside the torso, uses a reachable
wrist trajectory, turns resting palms inward and seated palms downward, and
applies a relaxed finger curl. Forearm pronation is distributed before wrist
orientation so the hand does not perform the entire twist at the wrist. The
original skin weights and character assets are preserved.

The robot's planar base, movable room objects and added models now share the
Rapier contact world. Physics contact resolution replaces the early position
blocker when this world is ready. Static walls collide with the robot even if
there are no added models. Mass, friction and restitution determine pushing,
sliding, rotation and recoil. Managed objects are excluded from the older
collision and gravity updates to prevent duplicate responses. Existing fixed
room decorations retain their fixed status; occupied static seats are anchored.
Newly added/imported props are movable by default. Existing saved fixed props
retain their setting; enable **Movable on collision** in Object editor to change
it. Character capsules use a separate collision layer so sitting does not push
the seat away. Collision feedback shows the affected object and net robot
impulse. Contact events are included in `visual/collisions.json` in exports.

**Depth** in the dock opens Bot Cam and a measurement panel. Click a point,
drag a rectangle, or click polygon vertices and finish with Enter. Point readings
intersect visible mesh triangles and report Euclidean camera-centre distance
and camera-forward Z depth. Posed skin vertices are frozen for the measurement,
so a moving limb is not measured in its bind pose. Region mode can retain the
selected mesh and exclude other surfaces/background. Its default grid reports
sampled statistics; dense mode tests every display pixel within its limit.
Update depth takes a fresh snapshot. The display shows time, units, statistics
and a heat overlay. Depth CSV and measurement history are included in exports.
This is geometric ground truth of the simulator, not a physical depth sensor.

**Models** in the dock opens selection/editing. The first Visuals card and the
scene editor both expose **Remove selected model** and **Undo removal**. Delete
works while scene editing is enabled. Removal clears rendering, sensor/depth
geometry, physics bodies, model lists and persistence. Undo retains the last five
removals in the current session. Room-model removals persist with the layout;
added-model removals delete their saved record. Exported scenes omit removed
added objects and retain removed room-layout flags.

V8 recording/export recovery and timed walking/seat actions remain available.
