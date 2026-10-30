# DYNORA V8

Both Sam and Maya now use the same procedural joint controller. The original
textured meshes, skin weights, source clips and licenses are preserved.
Walking phase follows actual travelled distance. Stance ankles stay fixed in
world space, swing feet lift, and thigh/shin lengths remain constant. Arms use
joint targets instead of the old carried-object pose.

`human-rig.js` supplies two-bone leg and arm IK. The source rigs have detached
ankles; these are placed after aiming the thigh and calf. This avoids stretching
bone translations to chase a foot target. `human-actions.js` supplies navigation,
seat profiles, reservations and approach → turn → foot placement → sit → seated
→ stand transitions. People accelerate, brake for turns, stop for other actors,
and replan after furniture blocks a route. Swept clearance uses segment/rectangle
intersection to avoid clipping furniture corners.

Seats come from explicit profiles for dining chairs, office chairs, sofas,
armchairs, stools and bed edges. World anchors follow furniture transforms.
High stools use the footrest height. Tilted, occupied and inaccessible seats are
rejected. Added characters use a kinematic Rapier capsule instead of a fixed
collider left at their spawn position. The apartment sofa faces its coffee table.

Use Build → People for existing walkers; Visuals → Human actions for added
people; H and F for the keyboard-controlled person. `motion.html` is an isolated
interactive preview with both rigs and all supported furniture. Added person
states and seat references are retained with the browser scene.

`recording-controls.js` is shared by the apartment and canteen. Stopping recording
automatically exports. Clicking the Record icon or label works. Exports wait for
pending image encoding, retain the existing quality report, reopen the resulting
ZIP, and check CRC32 and every manifest SHA-256. Download links remain visible;
the newest ZIP is retained in IndexedDB when space is available. Failed automatic
export does not clear recording buffers. Existing folder export remains available.

All changes are local to this project. Prebuilt `dist` and a Windows launcher
are included. No PDF was generated.
