# Asset Studio V6

V6 adds 20 original room models to the existing eight, for **28 selectable furniture/prop models plus the rover**. All V5 terrain tests, speed controls, visible navigation, V4 PBR assets and V3 research tools are retained. The complete modelling source, 29 standalone GLBs, geometry previews and prebuilt app are included.

## New models

| Category | Models |
| --- | --- |
| Bedroom | Full-length standing mirror; double bed with duvet and pillows; two-drawer bedside cabinet; wardrobe |
| Office | Writing desk with drawer/cable tray; bookcase with books and decor |
| Living room | Lounge armchair; six-seat dining table; media console with television |
| Kitchen | Upholstered counter stool; refrigerator; oven/hob; sink cabinet and worktop |
| Appliances | Front-load washing machine |
| Lighting | Floor lamp with fabric shade; ceramic table lamp |
| Bathroom | Vanity with basin; close-coupled toilet |
| Fixtures | Panel radiator with fins/valves; coat rack with hanging jacket |

These are original parametric models, with rounded forms, hardware, trim and material roles. Dimensions and masses are editable starting assumptions. Verify measurements for your actual objects before treating a scene as hardware evidence. Bulb meshes, screens and appliance controls are visual details; the models do not add functioning appliances or new room lights.

## Choose and place

1. Open a room, then **Visuals**. The model library appears near the top.
2. Search names such as `bed` or `mirror`, or filter by category. The picker shows the selected model's actual GLB geometry preview, nominal dimensions and mass.
3. Click **Add model near robot**. New objects are offset using their footprint to avoid initially overlapping the rover where space permits.
4. Select **Place in 3D**. The app opens Orbit view; click the floor to position the selected object. Esc cancels. **Snap placement** rounds X/Z to a 10 cm grid. Track placement uses the local terrain height.
5. Use **Rotate −15° / +15°**, or enter exact X, vertical height, Z and yaw in the object editor. Set width/height/depth in metres, then **Apply object**. The fields specify the object's overall bounds.
6. **Duplicate object** creates an independent copy that you can place separately. **Remove object** deletes only the selected scene addition. Use the scene-object menu to switch between added objects.

All placements, dimensions, rotations, mass, material/contact settings and mirror preference persist locally per room. Export a **scene ZIP** for a portable backup. Existing scene ZIPs remain compatible; scenes using V6 model IDs require V6 or later. The scene limit remains 40 added props, so the expanded catalogue does not load all 28 meshes at once.

## Mirror

The standing mirror includes a frame, back panel, hinges, stand and mirror surface. By default it uses the bundled environment reflection. Select it and enable **Live room reflection** for a planar reflection of the room:

- Only one mirror is live at a time; enabling another disables the previous one.
- Balanced uses a 512 px render target, High 1024 px. Low disables live reflections while retaining the preference.
- A live mirror adds rendering cost. Leave it off when you need higher capture throughput.
- The standalone GLB carries the reflective material and surface metadata; the simulator supplies the optional live-reflection behaviour.
- ToF still intersects geometric surfaces. Reflected sensor-light paths, glass transmission and real mirror range failures are not modelled.

Generated reflection render targets are omitted from scene archives; the base model and preference are retained. GPU reflection appearance still needs checking on the laptop.

## Source and offline operation

`src/room-models.js` contains the 20 new models; `src/visual-models.js` retains the original eight and rover. `tools/build-visual-models.mjs` rebuilds the GLBs. The optional CPU preview tool uses NumPy/Pillow/trimesh and renders actual triangle depth, with no network requests. These build dependencies are not needed to run the prebuilt app.

The app and all visual assets run locally. Python 3 serves `dist/` through ` .\start-windows.bat `. Source edits need `npm ci` and `npm run build`. Stop the old server, extract this ZIP into a fresh folder and look for **Asset Studio V6** in the header. Default local login remains `admin / robot123`.

Original model source and GLBs use the project MIT license. Bundled texture/HDRI credits remain in `public/visual/ASSET_CREDITS.md`. Read `VALIDATION_V6.md` for checks and limits.
