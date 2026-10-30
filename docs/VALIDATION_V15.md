# V15 verification

Based on V14.1, with original assets and features retained. These checks establish
software behavior and numerical consistency, not physical hardware validation.

## Automated checks

227 Node checks pass, including the previous 211 checks. They cover five profile
visual/contact/motion models; contact manifolds; A* footprint inflation and corner
avoidance; measured ray mapping and ageing; sensor-failure braking; usable duty
near a goal; voltage fault/replay input agreement; timed events; scorecards;
replay checkpoints, pruning and scene order; NumPy files; CSV fitting/comparison
up to 150000 rows; and Python command sequence/staleness handling.

The comparison worker completes all 30 profile/case/controller combinations.
Repeating a Research seed produces identical result metrics. Three Python HTTP
integration checks pass for commands/CORS, rejected credentials/origins/packets,
and rejected nonfinite policy outputs. Vite builds successfully; its existing
large WASM/chunk warning remains.

Run `npm test`, `py tools/test_controller_server.py`, and `npm run build`.
The downloadable archive is extracted afresh and tested with its asset-restoring
npm path. The complete source and ready-built app are included.

## Browser and file checks

- All three built environments start, expose five profiles, apply Utility Rover
  and retain the Test Lab link.
- The built Test Lab applies Utility Rover and receives a successful apartment
  acknowledgement for robot/surface/ride transfer.
- Collision inspection, record/seek/exit replay, hardware CSV fit/application,
  timed ToF events, the Python stop controller and live A* were exercised.
  The live planner returned six waypoints and driving commands.
- A six-trial Research comparison completes: three successes and three timeouts.
  Blocked and underpowered cases keep their measured result.
- Analytic software-WebGL depth: rigid cube expected 2.5 m, measured 2.5000002384 m;
  posed skinned cube expected 2.3 m, measured 2.2999999523 m. Instance IDs differ.
- The production recording downloads 64114441 bytes. ZIP CRC and all 41 manifest
  hashes pass. All three 640×480 PNGs decode. Matching float32 optical-Z, uint32
  IDs and float32 radial arrays decode; dictionary IDs are valid and radial data
  matches reconstruction from pixel centres and camera intrinsics.
- The recording contains five telemetry rows without sample gaps, three labelled
  frames, 19 visible instance IDs, zero dropped labels and zero label errors.
  Quality is PASS_WITH_WARNINGS: six ToF entries are marked unavailable/out of
  range; there are no quality errors.
- Automatic, manual and after-reload download links are exercised using the
  shipped download module at 1280×900, 960×720 and 800×600. Their bytes match.
  The dock reserves download area height to prevent flex layout collapsing it.
  The large production recording is verified separately above.
- All 88 original public assets retain their byte sizes and SHA-256 hashes.

The browser uses headless Chromium and software WebGL. This verifies controls,
shader values and files; it does not measure RTX 4060 display FPS. No original
models or textures were downsampled. Additional GPU captures and worker trials
are optional; normal scenes retain the V14.1 rendering path.

See UPDATE_V15.md for usage and model limits. Machine-readable browser and
recording evidence accompanies this file.
