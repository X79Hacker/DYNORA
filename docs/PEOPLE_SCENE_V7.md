# DYNORA V7: detailed people and editable scenes

## Run the updated download

1. Extract the entire ZIP into a **new folder**, for example `Downloads\dynora-v7`.
2. Open that folder in PowerShell. Run the launcher using this PowerShell syntax:

   ```powershell
   .\start-windows.bat
   ```

3. Open the local URL printed in the terminal. Default: `http://127.0.0.1:8774/`.
4. Default local UI login: `admin` / `robot123`. Choose your environment.
5. Keep the terminal open. Use Ctrl+F5 once if an old tab still shows V6.

The ZIP contains current **source code and a rebuilt `dist`**. Running the BAT uses `dist`; changing source in VS Code requires `npm ci` then `npm run dev`, or `npm run build` to update `dist`. Opening `index.html` directly is not supported. Python 3 is required for the BAT. No SAM, CUDA, Isaac, Blender or AI account is needed to run this update. Python image tools are only needed to regenerate asset previews, not to run the app.

## What changed

- Primitive people are replaced by bundled, textured anatomical character meshes with skinned rigs. Sam and Maya include authored walking motion. Sam also has a seated pose. Existing room walkers and the controlled human use this system.
- Six People catalogue entries: Sam, Maya, their walking-in-place presets, seated Sam and a detailed static laboratory researcher. The original 28 furniture/prop models remain.
- The original dark studio layout remains. In **Visuals**, use **Browse realistic people** to jump to the People category.
- **Arrange your scene** edits both original furniture groups and added models with coloured Move / Rotate / Scale handles, exact numbers, snapping, undo/redo and reset.
- Room layouts auto-save per environment. Scene ZIP export/import also contains original-furniture transforms, alongside the existing added-model data.

## Add and place a person

1. Open **Visuals → Browse realistic people**.
2. Choose **Sam · realistic person** or **Maya · realistic person**. Click **Add model near robot**.
3. In **Arrange your scene**, choose the added person from **Editable scene object**.
4. Click **Enable scene editing**. The robot is paused. Use Move handles: red X, green Y (height), blue Z. Drag empty space to orbit.
5. Use **Rotate** for orientation and **Scale** for size. Hold on to a handle and drag; these are real scene transforms, not changes to a flat image.
6. **Place on floor** aligns the model's lowest bounding point to the local terrain. **Finish scene editing** hides the handles. Press **Pause** to resume the robot when ready.

The regular **Object editor** remains available for mass, material, contact shape, duplicate, remove, and dynamic prop settings. Select the added human there before using the **Human pose** card. Walk in place animates the figure without inventing a path. To make an existing pedestrian travel, use **Build → People → Set position / Walk to / Set route**.

## Rearrange original furniture

Choose an entry beginning **Room ·** in Arrange your scene, or enable editing and click its visible geometry. Move sofas, desks, tables, chairs and other furniture groups. The canteen's table-with-chairs groups move together as originally constructed. This editor preserves that grouping; it does not split every mesh into independent furniture pieces.

Exact position, angles and scale are inside an expandable section to keep the panel compact. X and Z are horizontal scene coordinates; Y is up. Rotation numbers are degrees. Scale factors are positive multipliers. Non-uniform scaling changes proportions: use equal X/Y/Z factors to preserve a person's anatomy. Exact dimensions for added models are still in Object editor.

Snapping uses 10 cm translation, 15-degree rotation and 0.1 scale increments. Turn snapping off for fine placement. Ctrl+Z undoes a transform; Ctrl+Shift+Z redoes it. T, R and S select Move, Rotate and Scale while editing. Esc during a drag cancels it; otherwise Esc exits editing. Reset transform returns to the pose first selected in the current session. It is not a destructive factory reset of all saved data.

Walls, scripted gates/doors, moving carts and pedestrians are deliberately excluded from this furniture list because other code owns their movement. People already have position and route controls in Build. Added people are ordinary selectable scene models. Imported GLBs remain editable through the same object controls. This is scene arrangement, not polygon sculpting, automatic house reconstruction or a full skeleton-pose editor.

## Saving and restoring a layout

The added-model store remains IndexedDB, scoped to the current browser origin and environment. Original-room transforms use a separate per-environment localStorage key. A changed original piece is held at its chosen height to avoid legacy gravity immediately undoing placement. **Export scene ZIP** is the portable backup; it includes a layout array in `visual/scene.json`. Import it into the same environment to restore those transforms and add its models.

Scene imports are additive for added models, as in V6. Importing the same ZIP twice creates two copies of added models. Original furniture transforms are applied to their stable room IDs. Older V6 scene ZIPs without a layout array continue to import. The 40-added-object and embedded-GLB import limits remain. A different browser or port has different local storage, so keep a scene ZIP backup.

## How the human code works

`boot.js` loads two local GLBs before creating a room. `realistic-human.js` holds reusable templates. `SkeletonUtils.clone` gives each character an independent skeleton; its immutable geometry and textures are shared. Materials are cloned so changing one person's shirt does not recolour another person. `human.js` retains its original synchronous API: `g`, `meshes`, `pose`, `sit`, `mats`. Existing callers can therefore register actual mesh triangles for sensing and animate people without replacing their routes.

An AnimationMixer samples the original walking clip. The old controller advances gait phase in proportion to travel speed; the new sampling converts that phase using the source clip's stated 1.2 m/s nominal travel equivalent. This is a practical animation synchronization rule, not calibrated foot-contact dynamics. Stopping samples a standing pose. Sam's matching Sit_Stand clip was merged into his GLB without copying a second complete texture set. Maya has no seated clip in this package. The researcher is a static, textured figure.

These are authored anatomical models built from MakeHuman/MPFB CC0 assets, with original styling and authored motion by Innerscene. They are **not scans of real people**, medical anatomy models or motion-capture validation. Skin, face, hair and clothing have much more detail than the old primitive figures. The app does not add soft-tissue physics, cloth simulation, finger control, facial expressions, ragdolls or human balance dynamics. Dynamic Rapier props still use approximate rigid colliders; making a person a dynamic prop does not create a biomechanical human.

## How editing works

`scene-transform.js` validates finite position, unit quaternion and positive scale, and stores transform history. `scene-editor.js` owns selection, raycasting, TransformControls handles, keyboard shortcuts and compact number fields. Its event handler is registered before legacy room-drag handlers, so an enabled edit gesture is not also interpreted as camera orbit or old furniture dragging. Editor visuals use the main-view layer and are omitted from robot-camera images. Generated gizmos are marked editorAuxiliary for scene archival.

`visual-studio.js` combines added-object records with a list of original furniture. Added-model commits rebuild their Rapier contact shape and persist their object record. Original-room commits save a layout and refresh environment proxies. While the direct editor is enabled, its added-prop physics steps and old move gizmo are suspended. Recording guards prevent geometry changes during a recording. Close editing and resume the robot before collecting a new run.

## Source map

| File | Purpose |
| --- | --- |
| `src/realistic-human.js` | Offline loading, independent rigs, walking/standing/seated samples, People catalogue |
| `src/human.js` | Original API preserved; fallback geometry if asset loading fails |
| `src/boot.js` | Preloads local characters before room construction; visible fallback warning |
| `src/scene-transform.js` | Finite transform validation and bounded undo/redo history |
| `src/scene-editor.js` | Direct selection, handles, exact fields, floor placement, shortcuts |
| `src/visual-studio.js` | Furniture/people catalogue, room-layout persistence, existing prop physics and scene ZIP |
| `src/main.js`, `canteen.js`, `track.js` | Supply editable furniture groups; retain room-specific behaviour |
| `tools/build-human-assets.py` | Reproducible source downloads, embedded 1K textures, merged Sam sit animation |
| `tools/human-gltf-tools.mjs` | Node geometry/rig inspection without DOM image decoding |
| `tools/bake-human-previews.mjs` | Samples actual geometry for CPU preview generation |
| `tools/render-human-previews.py` | Static UV-textured CPU previews, independent of browser graphics |
| `tests/people-editor.test.mjs` | Offline rig, animation independence, transform round-trip and history checks |
| `public/visual/humans/` | Bundled GLBs, source URLs, license credits and SHA-256 hashes |

## Performance and privacy

Embedded textures are limited to 1024 pixels on the longest edge. The complete visual asset collection is about 48.4 MiB uncompressed, including the original furniture/materials; its V7 regression ceiling is 64 MiB. These human meshes are more detailed than the original figures, so adding many people increases draw and skinning work. Start with a few people and Balanced graphics; lower graphics settings and capture resolution if recording misses deadlines. A universal FPS guarantee is not possible. Existing sensor/physics simplifications remain unchanged.

All character loading uses local paths inside the extracted download. Runtime does not send your recordings or scenes to an asset service or AI endpoint. Build-time asset regeneration downloads public assets; the source URLs in the credits are documentation. Keep the default loopback server binding for laptop-only use. The local UI login is a convenience screen, not a network security boundary.

## If you still see old people

Make sure the top bar says **People & Scene Studio V7**. Close the previous server, run the BAT from the newly extracted folder and use the printed URL. If its port is busy, use a different port:

```powershell
.\start-windows.bat 8775
```

Do not copy only `src` over an old build: the BAT serves `dist`. Ctrl+F5 refreshes an already-open tab. A visible human-load warning means the model files could not be loaded; verify that `dist/visual/humans/sam.glb` and `maya.glb` are present. Enable browser graphics acceleration if WebGL cannot start. The showroom can display static geometry previews when WebGL is unavailable, but its interactive controls require working WebGL.
