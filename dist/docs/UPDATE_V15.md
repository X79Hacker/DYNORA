# DYNORA V15 — five rovers and research tools

Use **Rovers** in the left dock, directly below **Test Lab**, or the Rovers tab in
the right panel. The camera feed remains above the scrolling controls. Existing
five live surface-depth targets, curved regions, removal/undo, human seats,
contacts, swinging gates, manual Test Lab and recording downloads are retained.

## Start the complete app

1. Extract the entire ZIP into a fresh folder. Stop the old server with Ctrl+C.
2. Double-click `START_DYNORA.bat`, or in PowerShell run:

   ```powershell
   py -m http.server 8000 --bind 127.0.0.1 --directory dist
   ```

3. Open http://localhost:8000 in Chrome/Edge. Confirm **V15.0** in the header.
   Ctrl+F5 refreshes an old cached tab. Default local sign-in: admin / robot123.
4. Source development: `npm install`, `npm run dev`, `npm test`, `npm run build`.
   Node 22 is supported. Python is sufficient for the ready-built app.

Keep `dist`: it contains all 88 unchanged original public assets. npm pre-hooks
restore missing source assets from it and verify hashes. The archive stores the
assets once, avoiding duplicate model/texture bytes without reducing detail.

## Five selectable bots

| Bot | Mass | Wheels | Motor speed | Body |
|---|---:|---:|---:|---|
| Research 4WD | 3.998 kg | 67.5 mm radius | 60 RPM | Original open chassis |
| Scout Mini | 2.1 kg | 45 mm radius | 95 RPM | Small blue protective cover |
| Cargo Carrier | 12 kg | 80 mm radius | 45 RPM | Amber cargo tray and side rails |
| Indoor Courier | 8 kg | 65 mm radius | 55 RPM | Tall red cabin, raised camera |
| Utility Rover | 6 kg | 90 mm radius | 65 RPM | Purple cover and front bumper |

Choose a model and **Apply model & defaults**. Applying pauses and resets motion;
it rebuilds visible geometry, matching added contact hulls, active camera and
ToF mounts. Geometry/mass/motor calibration remains editable under Physics.
Selection persists locally. Loading a preset does not establish real hardware
accuracy: these are illustrative 4WD skid-steer configurations, not calibrated
commercial robot replicas or different steering systems.

Test Lab has the same **Rover model** selector under Control & placement.
**Apply & reset** builds that bot. Transfer robot/surface/ride to the running
simulator through the existing acknowledged transfer controls. Both pages must
use the same address and port. Apply live supports compatible parameter changes;
changing model or geometry requires reset. Airflow stays in Test Lab's worker.

## Contacts and navigation

**Collision inspector** enables actual Rapier solver contacts, capped at 64.
Magenta segments start at contact points and follow contact normals. The panel
shows signed separation/penetration and per-contact normal impulse in SI units.
The existing Physics contact-shape outline shows the rover's actual hulls.
Contacts are approximate compound hulls, not deformable material simulation.
Inspection is opt-in; it adds no manifold-query loop while disabled.

Set scene **X/Z** coordinates, or **Pick ground target**, then **Navigate**.
Positive scene Z corresponds to negative exported world Y. A 10 cm occupancy grid
uses delivered noisy/delayed ToF rays; it never reads hidden room triangles.
Occupied evidence expires after five simulation seconds to permit replanning
around moved obstacles. A* inflates occupied cells by the rover's conservative
planar radius and runs in a worker about every 0.7 simulation seconds. The map
uses each sensor sequence once. The four cone sensors are sparse; projecting
range along the central ray is an approximation, not a dense lidar map.

Encoder odometry is the default pose estimate. The ground-truth option is an
explicit baseline and clears the observed map when switched. Unknown space is
allowed cautiously by default; disable it to require mapped free cells.
Dropout/pending readings brake the controller. No-return only permits slow travel
when unknown travel is enabled. Sparse sensing cannot guarantee collision-free
navigation, observe every low object, or detect all drop-offs. Contact physics
still acts on all commands. Stop/brake pauses; Return to route/manual restores
ordinary controls. Selecting a new model stops navigation and clears the map.

## Python / model connection

No additional Python package is needed for the bridge (Python 3.10+, including
3.13). From the extracted project in PowerShell:

```powershell
py tools/controller_server.py --controller examples/stop_controller.py
# Or a simple reactive baseline:
py tools/controller_server.py --controller examples/reactive_controller.py
```

The server prints `http://127.0.0.1:8766/control` and a random token. Enter both
under Rovers → Python / model controller and choose Connect & drive. The token
stays in memory; it is excluded from metadata, presets and datasets.

Your own Python module exposes:

```python
def policy(observation):
    # observation['tof']: four {value, status, acquired, delivered, sequence}
    # observation['odometry']: {x, y, yaw}, SI/radians
    # observation['encoder_ticks'], ['motor_duty'], ['sim_time_s']
    return {'left': 0.3, 'right': 0.3, 'brake': False, 'ttl_ms': 250}
```

Directions are signed motor duties -1..1. Packets include known robot parameters
and profile, never ground-truth pose or true range. Integrate PyTorch/LSTM inside
your policy module and install your model's own dependencies separately; this
ZIP does not include a trained model or claim learned performance.

Requests run at up to 10 Hz with one in flight. Commands echo request sequence;
invalid, stale, absent or >500 ms responses brake the motors. TTL is 50–500 ms
from request send time, measured on the browser's monotonic clock. A slow Python
policy can continue computing, but cannot keep the bot driving after expiry.
The server permits one policy evaluation at a time and rejects overlapping calls.

Optional 320×180 JPEG observations are captured at up to 2 Hz with their own
scaled camera intrinsics and capture times. They use raw camera renders (without Research distortion/noise effects). A
scheduled camera freeze retains the last stream image and reports its age. Disable the option to avoid added render
work. Timestamp/age fields permit a policy to reject old images. The included
reactive baseline is a demonstration and requires supervision near obstacles.

## Metric depth and instance datasets

Enable pixel ground truth before recording. Each successfully labelled RGB image
has matching files under `ground_truth/` with the same basename:

- `_z_m.npy`: H×W float32 optical-axis Z in metres; missing/background is NaN.
- `_instance.npy`: H×W uint32 owner ID; background is 0.
- `_range_m.npy`: optional float32 radial distance from the optical centre.
- `_camera.json`: intrinsics, effective camera mount and simulation time.
- `instances.json`: stable IDs/labels/UUIDs within the capture buffer.
- `metadata.json`: retained frames, skipped frames, errors and memory budget.

Read with `numpy.load(path)` (install NumPy in your analysis environment).
Rows are top-to-bottom, matching RGB. Range uses pixel centres and intrinsics;
Z is axial distance, not radial distance or a normalized screen depth buffer.
Depth is encoded at 24-bit precision to the camera far plane before float32
storage. Skinned/morphed geometry uses its posed vertices. Source object identities
are preserved across render batches. Each skinned/rigid shader variant uses an
appropriate material/program to avoid cross-object feature-cache errors.

Labels observe the first geometric triangle including transparent surfaces.
Alpha cutouts, refraction and material-based optical returns are not modelled.
Distorted, frame-blended and injected frozen RGB frames are skipped rather than
claiming aligned labels. Ordinary exposure/noise effects do not move geometry.
The 96 MiB label buffer drops additional frames when full; it does not silently
replace older frames. Lower recording resolution/rate or clear recording buffers
between runs when needed. Labels add two render/readback passes per captured
image, not per displayed frame, and are off by default. No FPS claim is made for
label-enabled capture. Files enter the existing ZIP hashing/verification path.

## Replay and evaluation

Scene recording samples transforms at 10 Hz, including bone transforms, the
rover, moving people/props, effective camera mount, delivered ToF, odometry,
last collision and injected fault IDs. View replay pauses the live simulation;
seek/play/speed controls render stored states. Exit restores pre-replay poses and
leaves the bot paused. A timeline is visual playback, **not deterministic physics
resimulation**. It needs matching environment/profile/layout and does not embed
assets. Structural edits stop recording or reject incompatible playback.
Up to 1800 frames / 24 MiB are kept; old complete checkpoint segments are removed
so remaining frames stay seekable. Save/load JSON, or include it with a dataset.

Live scorecards use the chosen goal and actual scene: success (within 15 cm and
speed below 0.08 m/s), timeout, path length, debounced collision-event count,
minimum valid measured range and estimated battery energy. Start a scorecard,
drive or navigate, then save the result. These do not imply hardware validation.

Automatic comparison runs a separate 8×3 m testbed in a worker; it does not drive
your apartment. Choose selected/all five bots and 1–5 deterministic seeds.
Each seed compares direct pursuit and a **known-map A*** baseline on flat
traction, a movable obstacle and a pothole. Cases use shared settings and range
noise. The report includes every trial, goal distance, path, contact and energy
metrics. This is an isolated numerical comparison, not an apartment performance
benchmark, learned-policy test, or test of the live observed-map estimator.
Cancel terminates the worker. No worker simulation runs until requested.

## Timed challenges and hardware comparison

Create start/duration events relative to **Arm schedule** on the simulation
clock. Available events: one-channel ToF dropout, frozen recording camera,
left/right motor loss, supply-voltage factor, human walking destination and
powered prop motion. Human walking uses the existing obstacle-aware controller;
duration end stops that injected walk, after which the person's normal behavior
can resume. A prop's position interpolates toward a destination, allowing a
controlled disturbance; it is a powered actor, not free-falling passive motion.
Normal contacts affect the bot. Do not overlap position-control events on one
prop. Disarm removes command faults and releases event control; it does not rewind
scene state. Schedule/event logs and frozen-image source times are exported.

Hardware CSV supports a measured/reference distance pair or a known distance,
with m/cm/mm units. Bias-only fitting works at one known distance; scale fitting
requires varied known distances. Applying the fit models
`measured = scale * true + bias` in the simulator's ToF settings and updates
Research fields; it is not an inverse correction applied to a physical sensor.
Separate simulated/reference logs can be matched one-to-one by nearest time with
a tolerance in seconds. Their time origins must already agree; this does not
estimate clock offset. Reports include samples, bias, MAE and RMSE. No data is
uploaded by these controls.

## Performance and verification

Existing asset detail, spatial sensor broad phase, posed human bounds, rigid
render batches, shared shadow update and camera-clearance behavior are retained.
Extra GPU label/camera passes, contacts inspection, scene replay sampling and
benchmarks are opt-in. Path planning/comparison suites use workers. UI text is
throttled to 5 Hz; the map draws at up to 4 Hz only while visible or navigating.
Do not run every optional capture/benchmark at once when judging display FPS.

`npm test` includes the prior 211 regression checks plus V15 profile/contact,
A*, map ageing, command/fault timing, voltage response, scorecard, replay, NumPy,
hardware fitting and watchdog tests. Run `py tools/test_controller_server.py` for
HTTP endpoint integration tests. See `docs/VALIDATION_V15.md` for this build's
actual results and the limits of software-rendered browser testing.

The ZIP download area reserves its height in the scrolling dock, including short
windows, so a completed download link cannot collapse behind the toolbar. The
automatic download and the explicit link use the same verified ZIP bytes.
