# Visual Studio V4

This update preserves the dark simulator, three rooms, navigation, human control, original object controls, physics settings, sensors, recordings, calibration, CSV comparison, quality inspection, replay and group splits. It adds detailed geometry, offline surface materials, model editing and Rapier contacts for scene additions.

## First run

Stop the older server with Ctrl+C. Extract the full ZIP to a fresh folder and run ` .\start-windows.bat ` in PowerShell. Open `http://127.0.0.1:8774/`, sign in with the local default `admin / robot123`, choose a room and open **Visuals**. The source and the ready-to-run `dist/` are included; Python 3 is enough to run them. The server is loopback only.

If the page still looks old, check the terminal's served folder, stop any other server on port 8774 and hard-refresh with Ctrl+F5. The header says **Visual Studio V4**. Editing `src/` requires `npm run build` before restarting the Python launcher.

## Shapes and materials

- The rover has two rounded, slotted plates; four profiled tyres with 144 instanced tread blocks; hubs, bolts and standoffs; gearboxes; an illustrative battery, board, heatsink, connectors, camera and four ToF housings; and cable runs. Default visible wheel centres/radii follow the existing rover profile. Static parts are batched by material. The dynamic rover contains 25 mesh objects and about 25,400 visible triangles.
- Eight original models are included: dining chair, office chair, sofa, coffee table, sideboard, planter, service trolley and timber crate. They use 1–5 mesh objects each and fewer than 6,000 triangles each. Their illustrative dimensions and masses are editable assumptions, not a furniture measurement dataset.
- Five ambientCG material sets provide colour, OpenGL normal and roughness maps, with a metalness map where applicable. Wood, plaster, woven fabric, metal and tile are bundled at 1K. UV projection uses physical repeat distances where supported. A Poly Haven 1K studio HDR environment supplies reflection lighting.
- Source URLs, CC0 license information and hashes are in `public/visual/materials.json` and `ASSET_CREDITS.md`. Original generated GLBs and previews are under `public/visual/`. No remote asset server is used at runtime.
- People retain the articulated, stylized V3 geometry, with small clothing details. This is not a photoreal human upgrade.

Use **Open model & material showroom** to orbit the original GLBs, inspect bounds and download individual models. Without WebGL, labelled still previews show actual mesh geometry; they do not verify GPU lighting.

## Graphics and camera capture

| Preset | Pixel-ratio cap | Shadow map | Normal maps |
| --- | --- | --- | --- |
| Low | 1.0 | 1024 | Off for bundled materials |
| Balanced | 1.25 | 2048 | On |
| High | 1.75 | 4096 | On |

Balanced is the initial choice for the Lenovo LOQ / RTX 4060. Resolution, image frequency and the room's object count also affect load. Start a short test at 640×480 JPG and inspect the result before increasing resolution. The renderer's displayed FPS is diagnostic, not a guaranteed data capture rate. Browser background throttling can reduce throughput.

The simulator uses ACES filmic tone mapping and sRGB output for preview and offscreen camera textures. Exposure and environment reflections are adjustable. Camera capture temporarily restores opaque room walls so the orbit view's cutaway does not leak into robot observations. The editor's grid/selection outline is excluded from the robot camera. Existing sensor/path guides retain their visibility controls.

## Add or import an object

1. Select an included model and click **Add model near robot**, or choose an embedded `.glb` file. Imports stay on this computer.
2. Select the object in the editor. Set X/Z position, vertical position, yaw and width/height/depth in metres. Use actual measured dimensions for research.
3. Set mass in kilograms. Keep **Original / imported** to preserve an imported material, or choose a bundled material override.
4. Click **Apply object**. For gravity/contact, enable **Dynamic Rapier prop** or click **Drop / settle**. **Push** applies a 0.5 N·s horizontal impulse.
5. Click **Export scene ZIP** to keep an independent backup. The app also saves scene additions in IndexedDB, separately for each room.

Imports accept self-contained GLB 2.0, at most 40 MiB per file, 250,000 triangles, 500 meshes and 4K textures. External URLs and required Draco/Basis/Meshopt compression are rejected, avoiding remote decoders or asset requests. Export uncompressed GLB from Blender with embedded images. The scene limit is 40 added props and 200 MB of imported GLB data. Material arrays are retained. Animated GLBs play the first clip, but collision remains a conservative object box rather than per-bone collision.

The scene ZIP contains `visual/scene.json` and embedded imported models. Import adds those objects to the matching room; it does not replace the whole original room or reset existing objects. Avoid duplicate imports. Browser persistence is origin-specific: changing localhost/127.0.0.1 or the port creates separate browser storage. Export before clearing site data.

## Physics scope

Rapier 0.21.0 runs locally in WASM. Added dynamic props have gravity at 9.80665 m/s², conservative oriented box colliders, computed box inertia, damping and continuous collision detection. They settle, tilt and exchange impulses with other props, the ground and a planar rover proxy. The update is hooked to the existing 120 Hz physics steps, before data recording.

The rover retains V3's calibrated motor/tyre/contact-patch equations. It couples planar contact impulses to added props. This is not a full articulated-wheel solver. Up to 500 legacy meshes supply world-axis-aligned static proxies, refreshed periodically; thin/rotated geometry and under-table clearance can therefore be approximate. Existing walkers, rolling legacy objects, gates and quasistatic terrain attitude retain their V3 models. A more detailed mesh improves appearance and ray intersections; it does not make unmeasured physics exact.

ToF tests the registered visible mesh triangles. Added prop transforms and velocities are exported as `visual_objects` in image annotations, and visual configuration/limits are recorded in `metadata.json`. Dataset ZIPs include the scene-addition JSON and imported models. Visual metadata does not replace real camera calibration or measured geometry.

## Build and asset tools

`npm ci`, `npm test`, then `npm run build` rebuilds the site. Run `py -m unittest discover -s tests -p "test_*.py"` for CAD and visual-asset checks; the asset checks require Pillow for development only. `tools/build-visual-models.mjs` regenerates the original GLBs. `tools/render-model-previews.py` optionally generates CPU previews using NumPy/Pillow/trimesh. `tools/fetch-visual-assets.py` optionally refreshes the fixed licensed source assets using their official APIs and requires Pillow. None of these build tools are needed for normal offline operation.

Keep the original source/CAD audit and its limitations. Six missing rover STL files still require your originals; V4 illustrative details do not substitute for them. See `VALIDATION_V4.md` before using the simulator for research claims.
