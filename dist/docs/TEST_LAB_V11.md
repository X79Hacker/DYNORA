# DYNORA V11 physics test lab

Open **Test Lab** in the simulator dock or **Visuals → Open physics test lab**.
The direct local URL is `http://localhost:8000/test-lab.html` when using the
included Windows launcher. No npm installation is needed for the built app.

The lab uses the same `DriveDynamics`, `PropPhysics`, rover contact geometry,
rolling-circle support and `TerrainRide` modules as the main simulator. It runs
its solver in a dedicated module worker. Airflow is created only for an **Air &
balloon** experiment. The normal apartment, canteen and track never create this
flow grid or start the lab worker.

## Run an experiment

1. Choose Surface traction, Collisions, Terrain response, or Air & balloon.
2. Choose the ground surface and set the motor command. A duty of 0.7 means 70%
   electrical command; it is not a guarantee of a particular ground speed.
3. Set total duration and motor-on time. The remaining time is a coast phase,
   or an electrical braking phase when that checkbox is enabled.
4. Apply & reset, then Start. Start also applies pending edits. Pause retains
   measurements. Single step advances exactly 1/120 s.
5. Choose the chart metric and inspect the live measurements. The 3D view has
   orbit/zoom controls. A 2D side projection is available when WebGL is absent.
6. Prepare report ZIP, then use its verified download link.

Parameter edits do not repeatedly rebuild the solver while you type. Changes
apply on reset/start. The worker pauses when its tab is hidden, stops at the
trial duration, and terminates when the page is left. Surface comparisons run
in chunks and can be cancelled. Sample buffers are bounded. Paused 2D scenes and unchanged charts skip redraws.

## Ground surfaces

| Surface | Tyre friction μ | Rolling resistance Crr |
| --- | ---: | ---: |
| Dry floor | 0.75 | 0.025 |
| Wet / low grip | 0.12 | 0.025 |
| Loose gravel | 0.55 | 0.07 |
| Soft grass | 0.50 | 0.20 |
| Custom | Editable robot μ | Editable robot Crr |

These are illustrative simulator presets. Gravel and grass in this lab modify
traction and rolling resistance; they are not granular-material or soil
constitutive solvers. The main track's moving gravel graphics remain separate.

Compare all four surfaces replays identical robot, drive, initial-speed and
braking settings with each preset. The result includes travelled distance,
peak speed, mean absolute slip and stopping distance. Stopping distance is reported only after speed stays below 0.005 m/s and yaw
rate below 0.03 rad/s for 0.25 s during the command-off phase. Otherwise the
comparison says Not observed; the report retains the observed coast distance
and duration. No external data is used.

## Motor and tyre model

The source robot profile starts from the supplied URDF link-mass sum
(3.99822528 kg), 67.5 mm wheel radius, 60 RPM motors, 0.151022 m wheelbase and
0.251018 m wheel-centre track. Torque, grip, current, battery and inertia values
remain engineering estimates until calibrated.

The model has four tyre patches and two motor channels. A differential steer
command adds to one channel and subtracts from the other, allowing curved
motion or an in-place turn with zero forward duty.

The longitudinal force balance is approximately

    m dv/dt = Fleft + Fright + Fexternal − m g sin(pitch) − Frolling
    Frolling = Crr N
    N ≈ m g cos(pitch) cos(roll)

Motor torque depends on duty, battery voltage and wheel angular speed. Tyre
force follows slip and is capped by a friction circle. Longitudinal and lateral
forces share μN; they are not independently allowed to exceed grip.

    vwheel = radius × wheel angular speed
    slip = (vwheel − vground) / max(0.05, |vwheel|, |vground|)
    sqrt(Fforward² + Flateral²) ≤ μN

Four approximate normal loads include longitudinal/lateral load transfer.
Negative predicted support is marked as tipping risk; the model does not solve
a full rollover. Yaw uses differential traction, inertia, lateral forces and
skid damping. Wheel encoders integrate wheel rotation and can overestimate
travel during slip. A peak slip of 100% can occur at startup; use the time plot
and mean slip as well as the peak.

The speed chart compares actual ground speed with average wheel peripheral
speed. Traction plots use newtons, attitude plots use degrees, and all exported
column names carry their units.

## Collisions

Targets include 0.2 kg, 5 kg, 80 kg, a custom moving mass and a fixed wall.
Target friction/restitution and rover restitution are adjustable. The fixed
wall cannot move regardless of its nominal mass.

Rapier resolves the same separate tyre, plate and component shapes used by the
main rover. CCD handles thin barriers. The lab target is a box; main imported
props retain their selected Box/Convex/Parts approximation.

    impulse J = integral of contact force over time
    net robot impulse estimate = mrobot × |vafter − vbefore|

The event value is the net robot momentum change over a physics step. With
multiple simultaneous contacts it is not a separately measured impulse for each
surface. Use the exported collision events together with the motion samples.
The lab reports target displacement and the largest net impact estimate.

Room collisions remain active while scene editing is enabled. Route avoidance
in the main simulator is a separate sensor brake at 70 cm; turn it off or use
manual Drive when deliberately testing impacts.

## Potholes, bumps and ramps

A pothole has adjustable radius, depth, aspect, rim-transition width and rim
irregularity. It uses the same analytic basin as the track. Speed bumps use the
shared cosine profile and adjustable height, width, spacing and count. The
ramp control makes an isolated raised platform with sloping transitions.

Each wheel queries the upper envelope of a rolling circle across its tyre
width. This bridges narrow cracks and descends into broader depressions.
Support heights drive a second-order chassis response:

    q'' + 2 ζω q' + ω² q = ω² qground
    ω = 2πf

Here q is heave, pitch or roll. Defaults are 13 Hz heave, 10 Hz attitude,
damping ratio 0.86 and 14 mm effective wheel compliance. These can be adjusted
in the lab. Downward chassis acceleration cannot exceed gravity. Compliance is
limited; wheels do not stretch arbitrarily down into an opening.

This is an effective tyre/chassis response, not a reconstructed articulated
suspension. Terrain pitch influences the drive force balance on every fixed
substep. There is no repeated multiplication of speed at a pothole rim.

Use **Open Track with this terrain** to transfer a pothole or bump configuration
to the existing isolated terrain track. It also saves ride settings. The two
features occupy their existing, separate sections on that track; this button
does not claim to transplant the lab's exact world coordinates. Ramps remain
adjustable through Track → Ramps because that route has its own geometry.

Use robot settings in simulator saves calibration for the next simulator
reload. It does not change an already running recording in another tab.

## Airflow equations

The airflow experiment is an 8 × 4 m vertical two-dimensional slice. Velocity
has horizontal and vertical components. The model approximates incompressible
Navier–Stokes:

    ∂u/∂t + (u · ∇)u = −∇p/ρ + ν ∇²u + f
    ∇ · u = 0

Velocity lives on staggered MAC-grid faces; pressure lives at cell centres.
Each flow step applies a fan-relaxation body force, an optional periodic vortex
forcing, implicit viscosity, semi-Lagrangian advection and pressure projection.
The flow update is 30 Hz; the rover and balloon integrate at 120 Hz.

    ffan = 1.4 (Uambient − u)          [m/s²]

The vortex forcing is constructed from a discrete stream function so that its
initial discrete divergence cancels. Its amplitude is in m²/s² and its temporal
frequency is in Hz. The ambient wind has speed and elevation-angle controls.

The projection solves, approximately,

    Laplacian(p/ρ) = divergence(u*) / Δt
    u = u* − Δt gradient(p/ρ)

A finite number of Jacobi iterations leaves a residual. The live divergence RMS
in 1/s shows how closely the grid satisfies incompressibility. A low residual
is a numerical diagnostic, not evidence of physical calibration.

| Quality | Grid | Pressure iterations per projection |
| --- | ---: | ---: |
| Low | 32 × 16 | 32 |
| Balanced | 48 × 24 | 48 |
| High | 72 × 36 | 72 |

Grid topology and pressure coefficients are precomputed. No field arrays grow
with elapsed time. The field is transferred for display at a bounded cadence;
force sampling does not depend on display FPS.

Tunnel edges are periodic: fluid leaving one side re-enters on the opposite
side. The optional solid baffle has zero normal face velocity. It also has a fixed
Rapier collider for the rover and circle/box contact for the balloon, with
restitution and tangential friction. The stock rover fits below its 0.3 m
lower edge; a taller rover contacts it. The displayed
CFL value estimates flow travel in grid cells per timestep. High values and a
coarse grid increase numerical diffusion and reduce detail even though the
semi-Lagrangian transport remains bounded.

The default viscosity is an illustrative molecular-air value (0.000015 m²/s).
This grid does not resolve real high-Reynolds-number turbulence. Increasing
viscosity changes diffusion in the model; it does not turn a coarse simulation
into validated CFD.

## Balloon forces

The balloon is a rigid sphere in the same vertical slice. It samples local
flow and moves under buoyancy, weight, drag and an optional tether:

    V = 4πr³ / 3
    A = πr²
    m = menvelope + mpayload + ρgas V
    meffective = m + Cadded ρair V
    meffective dv/dt = Fdrag + Fbuoyancy − mg + Ftether
    dx/dt = v

The added-mass coefficient defaults to 0.5 as an illustrative spherical-body
approximation. Envelope, payload, radius, gas density and drag coefficient are
editable. The initial gas-density value is a helium example; it is not a
measurement of local Nepal atmospheric conditions. Air density is adjustable.

    Fbuoyancy = ρair V g, upward
    w = uair − vballoon
    Fdrag = 0.5 ρair Cd A |w| w

Relative wind determines both drag magnitude and direction. Doubling relative
speed produces four times the drag for fixed density, area and Cd. Buoyancy is
the weight of displaced air; gas, envelope and payload all contribute weight.
An air-filled control balloon therefore falls when its envelope/payload add
mass beyond the displaced air.

The tether is unilateral. It cannot push:

    extension = max(0, distance_to_anchor − rest_length)
    T = max(0, k × extension + c × radial_velocity), when extended
    Ftether = −T × unit_vector_from_anchor_to_balloon

The model includes simple ground, ceiling and side limits. It does not simulate
fabric wrinkles, pressure-driven balloon inflation, heat transfer or feedback
from balloon motion into the fluid. The rover receives only horizontal wind
drag at its reference height. There is no aerodynamic lift/rollover solver.
Force arrows are scaled for visibility; use the numerical values/plots for
magnitudes. Flow glyphs display the computed local velocity field.

## Reports and reproducibility

Prepare report ZIP creates:

- `report.json`: status, settings, summary, sample columns, measurements,
  collisions, model metadata and limitations; also comparison results when present.
- `settings.json`: the applied experiment configuration.
- `samples.csv`: 20 Hz samples in SI units with force and diagnostic columns.
- `collisions.json`: timestamped simulated contact events.
- `README.txt`: interpretation and scope.
- `manifest.json`: sizes and SHA-256 hashes for the report files.

The ZIP is reopened with CRC checks and every manifest hash is verified before
the download link is offered. Exporting during a trial makes a partial snapshot;
its status is retained. This report is separate from the main image-recording
ZIP, whose existing checks and recovery controls remain available.

The Physics test lab does not create camera frames. Use Record in the main
simulator for camera/ToF datasets, then inspect their calibration and quality
metadata. A lab graph is not a replacement for measured hardware calibration.

## Curved depth selections in the main simulator

Depth rectangles/polygons now clip the selected visible mesh triangles into a
surface patch. No flat rectangle is inserted into the world. The patch follows
curvature and rigid object transforms; its border reprojects into Bot Cam when
the object or camera moves. Orbit view shows the attached surface in 3D.

Guide lines use a small display bias to avoid z-fighting. Exported patch vertices
remain on the original triangles. The patch uses centroid visibility checks,
a 24,000 considered-face cap and at most eight surface meshes. The output
indicates a detail cap when reached. Texture alpha cut-outs and sub-triangle
occluders can differ from this geometric approximation.

Region statistics remain timestamped snapshots. A live anchor updates range
and Z depth with occlusion checking. Refresh depth to update full statistics.
Stale heatmaps are hidden when the camera or measured object transform changes.
Animated-skin patches represent their captured pose and hide when that pose
changes; take a fresh snapshot for a new pose. Ordinary furniture and curved
rigid models remain attached through translation, rotation and scale.

Region/patch work yields between short chunks so the UI can respond. Dense
pixel sampling is optional and bounded; the default sampled grid is faster.

## Performance and model scope

Normal rooms gain shared geometry BVHs, reusable posed-skin ray batches,
refitting instead of rebuilding animated query trees, lazy skin snapshots,
cached static contacts and change-only material updates. Sleeping props stay
asleep. Rover contact geometry is prepared before animation starts.

These changes preserve contact geometry and sensor-ray counts. They do not
substitute lower physics rates or remove existing human/export features.
Hardware/GPU FPS still depends on scene size, graphics settings and the device.
Use the existing Low graphics preset for large scenes; use Low airflow quality
for the lightest lab run. CPU microbenchmarks in the validation notes are not
whole-app FPS measurements on the user's laptop.

## Primary references

- Jos Stam, *Stable Fluids*, SIGGRAPH 1999, DOI:
  https://doi.org/10.1145/311535.311548
- NASA Glenn, drag equation:
  https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/
- NASA Glenn, Archimedes principle / buoyancy:
  https://www.grc.nasa.gov/www/k-12/WindTunnel/Activities/buoy_Archimedes.html

The implementation is an original bounded educational solver using these
standard ideas. The cited sources do not validate this application's output.
