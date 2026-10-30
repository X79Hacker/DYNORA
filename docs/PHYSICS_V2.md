> Historical V2 reference. Current behaviour and verification are documented in RESEARCH_V3.md and VALIDATION_V3.md.

# DYNORA Physics V2 — 25 October 2026

This update preserves the original dark simulator and its three environments. It replaces the generic robot with a parametric rover using the wheel-joint spacing from `my_bot.urdf`. It adds a source CAD inspector, shared force-based driving, calibration, and numerical verification. The full source and a prebuilt local app are included.

## Geometry and provenance

| Quantity | Starting value | Basis |
|---|---:|---|
| Total robot mass | 3.99822528 kg | Sum of inertials in my_bot.urdf; not a physical weighing |
| Wheel centre track | 0.251018 m | Left/right wheel joint origins in my_bot.urdf |
| Wheelbase | 0.151022 m | Front/rear wheel joint origins in my_bot.urdf |
| Wheel radius | 0.0675 m | Starting assumption of 135 mm diameter; editable |
| Output no-load speed | 60 RPM | Starting assumption; editable |
| Torque / current / friction / battery | See Physics tab | Engineering estimates requiring calibration |

Six referenced meshes are absent from the uploaded project: `wheel.stl`, `johnson_motor.stl`, `aluminium_sheet.stl`, `holder1.stl`, `holder.stl`, `motor_bracket.stl`. Their shapes cannot be recovered from the URDF joint layout alone. The driven robot uses labelled parametric replacement visuals. No missing mesh is claimed to be reconstructed exactly.

The separate `robot.urdf` assembly has its complete referenced STL set. The inspector uses the actual visual/collision geometry, URDF origins, fixed-axis RPY rotations and hierarchy, in metres. It can show collisions, joint axes and the source centre of mass. `my_bot.urdf` can also be inspected: missing geometry is marked by amber wire boxes. Both original URDF files and every original STL remain unchanged. See SOURCE_AUDIT.json.

## Drive model

The drive state advances at a fixed 1/120 s. A frame accumulator gives identical results at ordinary 24/30/60/144 Hz frame rates for the same admitted time and commands. Frames over 50 ms are capped by the room loop to keep contact work bounded; discarded wall time is reported. Simulation time is explicit and can run slower than real time on a slow or backgrounded tab.

There are two wheel-side angular states (two motors on each side), body forward velocity and yaw rate. The approximate equations are:

- Motor torque decreases linearly with shaft speed, scaled by motor duty and available battery voltage. Zero duty coasts unless electrical braking is selected.
- Longitudinal tyre contact force is proportional to peripheral-wheel / ground-speed mismatch and is limited to ±μN/2 per side.
- Wheel angular acceleration follows `(motor torque − contact force × radius − viscous drag) / side inertia`.
- Body acceleration follows net tyre force, rolling resistance and downhill gravity divided by mass.
- Yaw acceleration follows the difference between left/right traction moments minus skid damping divided by yaw inertia.
- The ground pose is integrated from body motion. Encoder odometry is independently integrated from wheel rotation. Wheelspin therefore creates real simulated odometry error rather than copying ground truth into encoder values.
- Battery energy integrates estimated terminal voltage × current × time. Voltage sag depends on empirical internal resistance. These are estimates, not an electrical, regenerative or thermal motor model.

Manual keys apply open-loop motor duty. Route driving uses lookahead steering and wheel-speed feedback. The curve is a target, not a pose constraint, so robots can drift, stall or fail to follow a path under adverse conditions. Turn-in-place is subject to the same torque and friction model. Original task placement still intentionally relocates the robot at the beginning of a task.

Wall sweeps and object contacts retain the room's simplified collision approach. The planar collision envelope now follows rover dimensions. Object normal impacts share the tested restitution/momentum function. Falling uses time-of-impact integration against the supporting surface. Terrain attitude remains quasistatic and the gate retains the earlier approximate hinged-plate model.

## Calibration workflow

1. Measure wheel diameter under load, wheel-centre track, wheelbase, total mass with payload, and output RPM at a recorded supply voltage.
2. Enter these in Physics. Stop recording before applying a new calibration.
3. Record a straight acceleration test, coast-down test, turn-in-place test and low-grip wheelspin test on hardware.
4. Fit torque/current, wheel inertia, rolling resistance and yaw damping to those recordings. A visually smooth path is not sufficient calibration.
5. Export calibration JSON and retain it with the real recordings. All dataset metadata includes parameters, provenance, selected surface and model limitations.

Calibration is validated and saved in this browser. Applying it resets motion and wheel odometry; simulation clock and battery energy remain continuous. Original room mass controls are also respected. Defaults restore the starting assumptions.

## Data and tools

The original 58 CSV columns retain their positions; ten new physics columns bring the total to 68. Wheel-side velocity and RPM now come from simulated shaft rotation, PWM from the applied motor commands, and odometry from independent wheel integration. New fields contain motor angular speed, slip ratio, traction, normal force, fixed step, model identifier and wheel-odometry error. Slip ratio is signed and normalised by at least 0.05 m/s; it is an engineering diagnostic near standstill.

Camera and ToF transforms follow body attitude and the updated rover dimensions. The four ToF mounts come from the supplied URDF. ToF still uses nine rays over a 25° horizontal field and nearest-hit logic with synthetic noise. It does not simulate reflectance, exposure-dependent ranging or real sensor failure modes.

The Physics tab offers live diagnostics, calibration import/export, a conservative collision-envelope overlay, wheel-odometry marker and JSON report. `verification.html` runs without WebGL or login and contains eight numerical checks, a dimensioned top view, a wheelspin plot, source STL/URDF audit and report export.

## Limits

This is a reduced-order research prototype, not a full 6-DOF rigid-body, suspension, deformable tyre, optical sensor or thermal simulator. It does not physically validate your robot. It cannot reproduce absent CAD geometry. Existing generated scene textures, people, curtains and other decorative animations remain synthetic. A real dataset comparison is required before making accuracy claims.

Local operation: Python serves the prebuilt app on 127.0.0.1:8774. Node/Vite is only needed for source development and rebuilding. All runtime libraries are bundled; remote Google font requests and the optional legacy cloud-download route were removed. Files export through browser downloads. The original local-storage login remains a UI convenience; the local server itself has no account-based access control and binds only to loopback.

## References

- ROS URDF physical/collision properties: https://docs.ros.org/en/rolling/Tutorials/Intermediate/URDF/Adding-Physical-and-Collision-Properties-to-a-URDF-Model.html
- Gazebo physics parameters and solver modelling: https://classic.gazebosim.org/tutorials?tut=physics_params
- Source geometry and inertials: robot.urdf, my_bot.urdf and assets/ in this project.

ZIP export packages a snapshot of the selected records and converts image Blobs to binary buffers explicitly. Progress and errors are visible. When ready, click a ZIP link in the left dock to start the browser download. Separate batch links are retained until the tab closes. CSV fields escape commas, quotes and line breaks.
