# V7 validation - 26 October 2026

## Completed checks

- `npm test`: 82 JavaScript checks passed, including the existing drive, sensor, camera, terrain, dataset, assets and Rapier checks.
- New checks inspect the actual bundled human GLBs, verify SHA-256 values and embedded 1K texture metadata, load geometry/rigs through Three's GLTFLoader, sample authored walking and seated clips, verify finite skinned vertices, and check independent bones/materials between instances.
- Transform tests cover full quaternion/non-uniform-scale round-trip, invalid finite/bounds/scale rejection, undo/redo, failed-history retention and clearing a branched redo chain.
- Python asset/URDF suite: 8 checks passed. Missing source CAD remains explicitly disclosed.
- The production build succeeds. The ZIP contains that rebuilt dist as well as all source and required offline assets.
- CPU previews were rasterized from the actual geometry, UVs and embedded texture images. Sam, Maya and researcher previews were inspected. They are not generated concept pictures or screenshots of a WebGL renderer.
- The showroom catalogue and static human fallback preview were inspected in the available browser.

## Verification limits

The available preview browser cannot create a WebGL context. Its HTTP preview hostname also does not provide WebCrypto for the simulator's secure-context login. Interactive GPU rendering, drag handles in a running room, Windows execution and performance on the user's RTX 4060 were therefore not verified here. The source preserves the normal localhost login requirement; no production authentication workaround was added for this preview environment.

No new real hardware logs were supplied. These changes improve character geometry and scene arrangement, not physical validation. The new figures use authored animation and approximate rigid contact shapes; they do not add cloth dynamics, ragdolls or a biomechanical human solver.

## Local acceptance check

1. Run the complete fresh ZIP using `.\start-windows.bat`. Confirm the V7 header.
2. Open Visuals, browse People, add Sam and Maya, and verify their textures.
3. Add a walking preset and observe limb animation when simulation steps run.
4. Enable scene editing, select an existing chair, drag one axis, rotate and scale it. Check Undo and Redo. Test Esc during a drag.
5. Select an added person, set numeric X/Y/Z and equal scale factors, and place it on the floor. Finish editing, then resume the robot.
6. Reload the room and check saved placement. Export a scene ZIP and check that visual/scene.json contains layout and objects.
7. Record a short camera/telemetry run and inspect images and quality.json before starting a large data collection.
