# DYNORA V12: apartment rendering and gate contact

## Apartment regression fixed

V11's ordinary sensor-ray path froze every vertex of an intersected skinned
mesh and refitted its triangle tree for each animation frame. Its conservative
human bounds also tested the infinite ray without checking the 2 m sensor
limit. A detailed person could therefore cost a full CPU skin bake even beyond
sensor range. The apartment has an active detailed walker; the obstacle track
usually keeps its people hidden. This explains a concrete CPU difference
between those environments in the recent version.

The replacement in `src/skinned-raycast.js` shares a bind-space triangle tree.
Each node keeps bounds for its influencing bones. A query transforms only
visited bounds, clips them to the ray's near/far range, and skins only vertices
of candidate triangles. Vertices and bounds are reused across a frame. Actual
triangle intersections still supply distances, face IDs, UVs and normals.
Unsupported edited weights retain the frozen-mesh fallback.

The original human meshes, textures, skin weights, arm/leg animation and seats
remain. No lower-detail human is substituted. Trees are prepared during asset
startup, trading some startup work for much cheaper repeated frames.

## Shared rendering core

`src/render-frame.js` now handles the apartment, canteen and track's main view,
Bot Cam preview and recording capture as one display frame:

- Object world matrices are reused after the physics/sensor synchronization.
- One fresh directional shadow pass serves the same instant's camera views.
  Shadow resolution, lighting, textures and screen resolution are unchanged.
- The header FPS counter uses real elapsed time, including while the simulation
  is paused; it no longer measures frames per simulated second.
- Renderer statistics reset once per display frame. The Visuals panel reports
  the frame total, including the camera views, rather than only the final pass.
- Preview/capture visibility, opaque camera walls, projection aspect, render
  target and renderer flags are restored, including an interrupted capture.
- Mirrors retain their own reflected-camera pass. Recorded image dimensions,
  output format and export validation are retained.

Physics remains at 120 Hz. All 36 ToF rays, the rover's 23 contact parts and
CCD are retained. The separate airflow lab remains isolated from room driving.

## Swing gate fixed

The old leaf began 1 cm from the centre of a 9 cm square post. It overlapped
that post and jammed against the actual fixed collider. The isolated single
leaf test had no post, so it missed this assembly problem.

`src/track-gate.js` now supplies the track and regression fixtures with the same
two-leaf gate. The visible leaf clears the post's diagonal throughout its
swing. Decorative hinge straps are excluded from contact geometry. Posts stay
solid, and the leaves retain actual mass, friction, a revolute hinge, spring,
damping and angular stops in the rover's Rapier world.

Spring-driven leaves stay awake while closing, avoiding a second failure where
slow motion fell below the physics engine's sleeping threshold before reaching
rest. Mass/spring changes update that same body; there is no proximity opening
or scripted impulse. A passing rover opens only as much clearance as its
contact needs. A strong closer or heavy leaf can still resist a weak rover.

On a track with a gate, use **Build → Ramps, stairs & gate** for leaf mass and
closer stiffness. On the test course, choose **Route → Shortcut loop (through
the gate)**, or use **Drive (M)** and arrow keys for direct contact. The full
loop does not necessarily pass through the shortcut gate.

Read [V12 validation](VALIDATION_V12.md) for measurements and checks. Previous
curved-depth, removal/undo, human actions, dataset exports and Test Lab controls
remain available; the V11 guide still describes those lab equations and limits.
