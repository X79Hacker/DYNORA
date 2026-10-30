# Understanding the code from start to finish

## The central idea: state, update, observation

Think of the simulator as a small world described by numbers. The robot has a position, heading, body velocity, wheel rotation and battery energy. A person has a scene transform, route and animation phase. A camera has a position, orientation, field of view and image size. JavaScript updates those numbers; Three.js turns scene geometry into pixels. An attractive picture is an observation of that state, not proof that all of its physics is exact.

The same distinction helps when reading the code. A command says what a motor should attempt. A dynamic state says what the approximate model actually did. A sensor measurement adds sampling time, noise and validity. Ground truth is the internal simulated state. Keep these four things separate when training a model or checking accuracy.

## 1. How the laptop starts the website

The BAT file changes into its own directory and tries the Windows Python launcher, then Python. server.py serves only the built dist directory. It binds to 127.0.0.1 so another computer cannot normally open it over your network. That address is your own machine; it is not a deployed cloud service. Closing the server terminal stops serving new page requests.

The browser loads index.html, its CSS and compiled JavaScript. boot.js creates or checks the local UI account, chooses an environment, loads the two detailed character templates, then dynamically imports main.js, canteen.js or track.js. Dynamic import means the selected room's code can be loaded when needed. A missing character produces a visible warning and the old fallback person; it does not silently download an online replacement.

Source JavaScript lives in src. Vite builds browser bundles into dist. Therefore a source edit in VS Code does not change the prebuilt app until you rebuild. During development, npm run dev serves current modules with automatic refresh. This distinction explains why copying an older source file into a folder can still show a newer interface: the BAT is serving whatever is in dist.

## 2. Reading JavaScript without getting lost

An import line connects modules. An exported function is a named entry point another module can use. A class groups related state and operations, such as DriveDynamics or SensorSuite. A callback is a function passed to another component to run later. The physics callback is run once per fixed step; an image-encoding callback can finish after its capture time.

An object literal holds named fields: a parameter object can contain mass, radius and friction. An array holds ordered values: four contact loads always have a specific wheel order. A Map associates an ID with a record. Set membership avoids registering the same mesh twice. A Promise represents an operation that will finish later. Await pauses that asynchronous function until the result is available; it does not turn the entire browser into a physics thread.

Start by reading the module's exported functions and their parameters. Follow the function called by the room, then inspect helpers it calls. Do not try to understand every decorative mesh before understanding the frame loop and data flow. Many older files use dense lines, so editor formatting or code folding is useful. Keep a clean source copy before making changes.

## 3. One frame through the program

The browser requests the next animation frame. The room admits a bounded amount of elapsed time. Robot dynamics uses a 1/120-second accumulator: admitted time is spent in small equal substeps. Fixed substeps make the equations less dependent on display frame rate. Excess wall-clock time can be dropped rather than making the browser perform an arbitrarily long catch-up loop.

At each drive substep, the current commands, surface and attitude determine motor torque, wheel acceleration, tyre forces, body acceleration and pose. The room resolves its simplified blocking/contact response and updates terrain support. Added props can be stepped through Rapier. The resulting state is available to research recording. The rendered camera and ToF acquisition are still triggered from the room loop; requesting 120 physics steps per second does not give 120 independent rendered sensor acquisitions per second.

Then the browser draws the orbit scene and the robot camera. At a recording deadline, it captures the actual available snapshot. Encoding the resulting pixels as PNG or JPG is asynchronous. The recorder preserves the capture snapshot and waits for pending encodes before final packaging. A timestamp should describe when a frame was observed, not merely when disk writing finished.

## 4. Units and coordinate conversions

Research world coordinates use x east, y north and z up. Three.js scene coordinates use x, height and z south. Consequently a scene position at x=2, z=-3 corresponds to research x=2, y=3. The sign change is intentional. A camera's optical coordinates use x right, y down and z forward, which are different again.

The body frame uses x forward, y left, z up. A positive research yaw rotates the forward direction toward north. Internally trigonometric functions use radians; many exported human-readable angle columns use degrees. Multiplying radians by 180/pi gives degrees. Never combine a degree value with a radian value because their numbers look plausible.

Distance is metres, time seconds, mass kilograms, torque newton-metres, force newtons, angular velocity radians per second unless a field says otherwise, current amperes and energy watt-hours. A 135 mm wheel diameter is 0.135 m, so the radius is 0.0675 m. Confusing diameter with radius doubles peripheral speed and can contaminate every odometry result.

## 5. Kinematics before dynamics

For a differential robot, the two side speeds suggest forward speed v=(vR+vL)/2 and yaw rate w=(vR-vL)/track. These are kinematic relationships: they describe geometry if rolling assumptions hold. A force model adds the question of whether the motor can actually produce those speeds on the selected surface.

For constant v and w over a short interval h, the robot follows an arc. integratePose uses a midpoint direction and a sinc correction to integrate that arc smoothly, including the nearly straight case. The sinc function here is sin(a)/a, approaching 1 as a approaches zero. The small-angle expression avoids division problems near a straight line.

At the default radius and 60 RPM, peripheral no-load speed is 2*pi*0.0675*60/60 = about 0.424 m/s. That is a theoretical wheel-edge speed, not a guaranteed robot cruise speed. Motor torque, voltage sag, rolling resistance, slip and the speed controller can all reduce body speed.

## 6. Motor, tyre and body are different states

DriveDynamics stores two motor-side angular speeds, representing the two wheels and motors on each side. Motor torque decreases with increasing shaft speed and changes with applied duty and terminal voltage. Wheel inertia means a command changes angular acceleration rather than teleporting wheel speed to its target.

A tyre's peripheral speed is radius multiplied by angular speed. Subtract the local body speed to find contact mismatch. The model asks for a force proportional to this mismatch, then limits it according to available friction and normal load. With too little grip, the wheels can spin while the chassis travels much less. This is why encoder odometry is integrated from wheels independently of the ground pose.

Slip ratio divides the mismatch by the largest of a minimum speed and the absolute wheel/body speeds. The minimum denominator is 0.05 m/s, keeping near-zero divisions bounded. Near standstill, this diagnostic is especially sensitive and should not be treated as a directly measured material constant.

Battery energy integrates voltage times estimated current times seconds, divided by 3600 to obtain watt-hours. A 12 V, 2 A load for one minute uses approximately 0.4 Wh. The model's current and voltage are approximate estimates; this is not a detailed battery chemistry, thermal or regenerative braking simulation.

## 7. Why four contact patches matter

Under acceleration, load tends to transfer rearward; when turning, it tends to transfer toward the outside. The model estimates four wheel-patch normal loads from supported weight, centre-of-mass height, forward acceleration and lateral acceleration. A negative estimated load sets a support-risk flag. Remaining positive loads are normalized to the supported total.

The combined longitudinal and lateral force at a patch obeys sqrt(Fx*Fx+Fy*Fy) <= mu*N. A tyre already using much of its available grip to turn cannot simultaneously supply unlimited acceleration. This is the practical purpose of the friction-circle approximation. It is more informative than assigning a speed directly to the route.

For a level 3.99822528 kg robot, supported weight is approximately 39.21 N. At mu=0.75, the total ideal horizontal friction budget is around 29.41 N if all patches contribute. Motor torque may impose a much lower limit. These numbers are model calculations, not measured tractive force.

The system does not simulate dynamic rollover or articulated suspension. A risk flag means the reduced load estimate has crossed a condition, not that a real robot has fallen over. Body pitch and roll on terrain are quasistatic approximations.

## 8. The route is a teacher, not a rail

research.js converts a path target into commands. It looks around the robot's nearest route progress, chooses a point ahead, computes heading error and requests a forward/yaw speed. A large heading error can request a pivot. Wheel-speed feedback converts the requested motion to bounded left/right duties.

The route curve is therefore a target. It does not overwrite the robot position on every step. Low grip, blocked motion or insufficient torque can produce tracking error or a stall. Moving the robot deliberately to a task start is a separate setup action. This distinction is essential if you later train a learned controller: the current route follower is a geometric teacher, not a trained neural network.

SpeedReference adds target-speed profiles and acceleration/braking limits. Adaptive factors reduce route speed in pothole, bump, gravel, slippery or narrow zones. Manual duty driving is a different control mode and does not become equivalent to the route speed reference simply because both move the rover.

## 9. Potholes: surface versus support

track-geometry.js defines a smooth, irregular elliptical depression. The rendering mesh follows the analytic height profile, and the relevant floor mesh has a real opening rather than a dark circular sticker over flat ground. Adjustable radius, depth, aspect and edge shape change the test geometry.

A wheel is not a mathematical point. tyreSupportHeight samples the upper envelope of a rolling circle at several longitudinal and lateral positions. A wheel can bridge a narrow gap instead of dropping to the lowest point directly under its centre. The support envelope captures part of that geometric behaviour without modelling deformable rubber or suspension.

Rapier props interact with a sampled heightfield of the track. The drive rover uses its own terrain-support calculation. A successful simulated crossing does not establish a safe real-world speed for a physical pothole. Compare repeated trial metrics at matched settings before drawing even simulator-only conclusions.

## 10. What the sensors mean

The geometric ToF query casts nine rays over a horizontal fan and chooses the nearest hit. SensorSuite adds rate, latency, jitter, offset, scale error, noise, dropout and approximate material-related loss. It keeps acquisition time separate from delivery time and prevents an old, late packet from replacing a newer reading.

An unavailable reading is null or an empty numeric export with an explicit status. Zero means zero distance; it does not mean missing. Keep a validity mask for learning. The separate capped geometric distance is useful for debugging but cannot tell you how far beyond the sensor's maximum range an unseen object really lies.

The IMU adds bias/noise to simplified accelerometer and gyro quantities. A level stationary accelerometer includes approximately +g in its vertical component. It is not zero merely because the robot is not moving. Measured encoder ticks can lose a configured fraction; the exported measured odometry is integrated from those tick changes.

## 11. A worked camera example

For a vertical field of view F and image height H, fy=(H/2)/tan(F/2). The implementation assumes square pixels so fx=fy. At 640x480 and 70 degrees, fx and fy are approximately 342.756 pixels. A centred principal point is cx=320, cy=240. K is a matrix containing these focal lengths and principal-point coordinates.

The distortion model uses radial and tangential coefficients. Changing FOV changes projection; changing exposure changes brightness. A normal texture changes surface shading, not collision geometry. Previous-frame blending approximates blur between samples; it does not simulate a real shutter integrating continuously over time or rolling-shutter row timing.

An annotation box comes from projected 3D bounds and heuristic visibility. It is not a SAM segmentation mask or an exact outline. SAM boundary tracing and Fourier epicycles belonged to the separate earlier application; they are not silently included in this robot simulator's labels.

## 12. What goes into a dataset ZIP

data.csv preserves the legacy combined table. inputs.csv selects observations and identifiers; commands.csv holds applied control fields; ground_truth.csv selects internal truth and diagnostic fields. metadata.json records software version, source fingerprint, parameters, timing conventions and limitations. annotations.jsonl and event files carry generated labels. quality.json records audit results.

Images are actual encoded captures. The exporter converts binary Blobs to bytes, waits for pending work, validates image references and constructs a ZIP. A SHA-256 manifest records bytes and hashes for the other files. Hashes help detect changes or incomplete transfer; they do not prove that a simulated scene matches real hardware.

Splits group frames by environment or run rather than shuffling adjacent frames indiscriminately. Adjacent frames from one route are strongly correlated. Putting the same scene and nearly identical viewpoints into both train and test can produce deceptively good results. A 70/15/15 grouping rule is a probability assignment, so a tiny dataset can have an empty split.

## 13. Calibration numbers you can reproduce

If a straight two-metre travel produces a mean 5700 ticks at 1200 ticks per revolution, the effective rolling radius is 2*1200/(2*pi*5700)=0.067013 m, about 67.01 mm. This assumes negligible slip, accurate ticks-per-revolution and an accurate distance measurement.

For a full 360-degree turn with left=-2230 and right=2230 ticks, radius 0.0675 m and 1200 ticks per revolution, effective track is about 0.250875 m. A skid-steer effective track can depend on floor and motion, so agreement with CAD alone does not fully identify the real turning behaviour.

If 12000 ticks arrive in ten seconds at 1200 ticks per revolution, shaft speed is 60 RPM. If a robot coasts from 0.4 m/s to rest over 0.32 m on a level floor, the simple effective Crr estimate is v^2/(2*g*d)=0.02549. Motor drag and other losses are lumped into this estimate. Use several repeated measurements and retain raw evidence.

## 14. Comparing a real run with a simulated run

First match units and choose acquisition-time columns. Convert to relative time so different wall-clock start dates do not dominate. An explicit offset accounts for a known synchronization difference. The comparison interpolates only within an allowed gap and does not extrapolate beyond available data. Yaw must be unwrapped before interpolation so 359 to 1 degrees is a small rotation rather than a large jump.

Bias is the mean signed error, MAE is the mean absolute error, RMSE is the square root of mean squared error, and max error shows the worst aligned difference. RMSE is more sensitive to large outliers. Report the signal, unit, alignment rule, number of samples and allowed gaps alongside the score. Removing initial pose offsets changes the question from absolute localization to relative trajectory agreement; disclose that choice.

## 15. A repeatable research session

Begin with a named environment, saved layout, route and calibration. Use a fixed seed and record the complete randomization profile. Keep one baseline with effects disabled, then change one factor at a time: grip, payload, noise, lighting, speed or pothole depth. Do a short recording first and inspect images, timestamps, statuses and missing files.

Use 640x480 JPG while checking the pipeline. Choose telemetry and image intervals deliberately: a 4 Hz target means a 0.25-second interval. The legacy initial image interval is two seconds, so do not assume every telemetry row automatically contains a new image. Keep the browser tab active and inspect missed/late counters before increasing resolution or scene complexity.

Export the dataset, scene, calibration and trial report. Keep your hardware logs separately with the same experimental identifier. Inspect flagged images manually. Hold out entire environments and real-world runs for evaluation. Numerical consistency checks support software correctness; only matched hardware evidence supports claims about physical accuracy.

## 16. Extending the project safely

To add a sensor error, put the model in SensorSuite and export its parameters, status and timestamps. Test missing/late observations rather than only the happy path. To add a furniture asset, keep its ID stable, set reasonable nominal dimensions, retain licensing and make its source geometry available. A material texture should not alter collider dimensions accidentally.

To change drive equations, work in dynamics.js first and run its numerical tests. Verify straight symmetry, turning sign, fixed-step consistency, finite state, friction/energy limits and adverse settings. Then inspect the room integration. To change an export field, follow it through column definitions, row construction, split selectors, metadata and tests. A new field that is never filled or is placed in the wrong training partition can be worse than no field.

To add a person, preserve the synchronous human API and clone skeletons independently. To change layouts, use the scene editor's commit path so collision state and persistence follow the visual transform. After any source change, rebuild dist before packaging a launcher-based download.

## 17. What remains approximate

The reduced rover does not have articulated suspension, deformable tyres, realistic battery chemistry, full optical ToF behaviour or calibrated human biomechanics. Rapier governs added props; the rover's motor/tyre model, older room objects, walkers and gates are not all unified into one six-degree-of-freedom solver. Visual realism and physical fidelity are separate properties.

A seed is not a complete experiment. Retain model files, settings, scene objects, source version and initial states. Replay includes corrections from recorded contact snapshots; that is useful for inspection but should not be described as an entirely independent recreation of every environment interaction. The provided tests and CPU previews do not certify GPU performance on your Lenovo, nor do they replace real recordings.

Use these limitations constructively: identify which observation matters for your task, measure that observation on hardware, and improve the smallest model component that explains the error. Better evidence usually improves a research simulator more than adding another decorative effect.
