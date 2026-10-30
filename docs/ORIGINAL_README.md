# 🤖 DYNORA – Indoor Robot Dataset Studio

A browser-based 3D simulator for a **4-wheel indoor robot** with a **front camera** and **4 ToF distance sensors**.
Drive it (or let it patrol), walk around as a human, move furniture, draw your own robot path, and **record
camera images + 58 columns of sensor/motor data** for building datasets. Built with **Vite + three.js** – no backend needed.

> ⚠️ This is a simulation. The login is client-side only (see [Security note](#security-note)).

## ✨ Features

- **3 environments** (pick after login, switch any time from the top bar)
  - 🏠 **Apartment + S-Corridor** – 2 rooms, doorway, 1.4 m S-shaped corridor with doors/art/lamps, chicane, charging dock, kitchen, windows with curtains, walking person, tray trolley, automatic door
  - 🍽 **Canteen / Cafeteria** – 18×12 m hall, serving line with food wells, kitchen, cashier, queue, 8 tables with chairs, seated diners, walking crowd, vending machines, tray trolley, automatic entrance door
  - 🏁 **Obstacle Track** – 10×6 m room (no people) with a choice of tracks: the **Track** menu in the top bar (next to Environment), **🏁 Tracks** in the dock or **Build → Track** picks one of 7 ready-made tracks (Classic loop around a fenced island with a table and planter, Hairpins, S-bends, Kidney, Long climb, Rough course, Test course) or a **🎲 random track** from a seed (the same seed gives the same track; ⏭ Next track cycles through them). The room and its furniture stay the same. Tracks are 0.9 m wide (the Test course 1.1 m) and have features placed along them: bridges (ramp up, deck on pillars, ramp down, guard rails), stairs, speed bumps, gravel, slippery surface (plain or tiles), soft grass, a narrow passage and a swing gate, plus a start line and a blue dashed guide line (**Build → Track → Blue dashed guide line** turns it on or off). The **Test course** is a paved, fenced loop with corner cameras: stairs (3 steps), ramp up 10° onto a raised deck with gravel, a 0.8 m narrow passage and grass, ramp down 10°, tiles and a 5 cm bump area, plus two **potholes** in the middle of the asphalt, a little bigger than the robot (its wheels span about 54 × 44 cm): a 5 cm deep one (65 cm across) after the ramp down and a 10 cm deep one (70 cm across) after the bump area, so the whole robot can drop in. Their walls are never steeper than 40° (a deeper hole has wider, broken-down edges, as real ones do), so the 9 cm wheels can still climb out. A wheel drops into a pothole (a tyre rests on the highest point of its short contact arc, so it bridges part of a hole), the robot tilts, it loses speed when the wheel climbs over the far edge, and the narration and the events name the pothole. A fenced **shortcut lane** crosses the middle, from the bottom straight by the entrance to the top straight, with the **swing gate** in the side fence at its entrance; **Build → Track → Route** chooses the full loop (21 m) or the shortcut loop through the gate (12 m), and tasks use the shortcut when it is shorter. The robot's height, pitch and roll follow the surface under its wheels; it slows on gravel, grass and bumps and slides on the slippery surface. **Loose gravel** (a closed layer of about 450 stones per m² on a darker compacted base): every stone under a tyre moves. Most are ploughed out of the tyre's path to the side, so the tyres leave ruts with ridges of stones beside them; the rest are flicked (the chance and speed grow with wheel speed and wheelspin; loose gravel grips less, μ 0.6, so hard starts spin the wheels) and fly backwards and sideways, bounce, slide to a stop and stay where they land. Small stones can get caught in the tread: they ride up the back of the tyre (up to about 18 cm, the top of the wheel), let go behind the top with the speed of that point of the tyre and fall behind the robot. **Grass** is a turf of about 4000 thin, curved blades per m² (3–7 cm, mixed greens with some dry blades) on a dark turf base; the tyres press the blades flat in the direction of travel, and they stand up again over about 20 s, so the robot leaves tracks in the grass. The grass is damp: soft, wet turf gives under the wheels (rolling resistance 0.24 instead of 0.04) and grips less (μ 0.5), so the robot drives about a third slower at the same motor power, stops quickly when it coasts, and spins its wheels on hard starts. It climbs steps up to 4.5 cm (half its 9 cm wheel radius); a higher step stops it. The **swing gate** has two hinged leaves that only the robot opens: a hit is an impulse (J = (1+e)·v_rel / (1/m_robot + k²/I)), so a faster hit slows the robot more and swings the leaves further; while the robot keeps pushing, its motors open the gate further; a spring closer and hinge friction swing it back. In this room **Build → Ramps, stairs & gate** (instead of Objects) sets the up and down angle of each bridge (4–30°; heights stay the same, so steeper ramps are shorter), the step height of each set of stairs (2–8 cm) and the gate's leaf mass and closer spring; ramp and stair settings are saved per track. **Slope physics** (this room only): 4 geared DC motors (linear force–speed curve), gravity along the slope, rolling resistance, gearbox drag and tyre grip. Path following uses an encoder PI speed loop, so the robot speeds up a little downhill and slows uphill until the loop catches up; manual driving sets a fixed PWM, so downhill is clearly faster, and with no key pressed the motors coast and the robot rolls down a ramp. PWM, motor current and the IMU x-axis (which feels g·sin(pitch)) in the CSV come from this model
- **Robot**: skid-steer body, camera, 4 ToF sensors (front/left/right/back) with **25° FOV**, 9 rays each, 2 m range, distance-dependent noise
- **Autonomy**: patrols a path, smooth acceleration, ToF safety stop for moving obstacles/people
- **Manual driving**: arrow keys (↑ forward, ↓ reverse, ← → turn, Shift boost)
- **Controllable human**: WASD walk, Shift run, E pick up/drop objects, V first-person, C change shirt
- **Editing**: drag furniture, rotate it (buttons, angle slider or `R` / `Shift+R`), delete with `Delete`, spawn boxes, crates, balls, tennis balls, footballs, cans, water bottles and glass bottles, **draw your own robot path**
- **Weights (kg)**: **Build → Weights** in every room lists the robot (3.5 kg by default) and every movable object with its mass in kg (in the obstacle track also the swing gate's leaf); type a new value, click a name to select that object, **↺ Default weights** resets them. Weights are saved per room (spawned objects too while they exist) and feed all the physics: collisions, pushing, rolling, falling, the robot's acceleration and climbing, and the gate
- **Wheel speed error**: **Settings → Wheel speed error** in every room makes each wheel turn 1 to 3 % faster or slower than commanded (the largest error is a slider, **🎲 New wheel errors** picks new values). **Wheels with error** picks All, Left, Right, Front or Back; the other wheels turn at exactly the commanded speed. Driven by hand the robot drifts into a slow curve; on a path the controller keeps it on the path, so the PWM per side differs. The values are saved and written to the dataset metadata
- **Real physics**: gravity 9.8 m/s², real masses (tennis ball 58 g … crate 8 kg … dining table with 6 chairs 55 kg, editable), push impulse in N·s (light objects go faster), air drag, rolling resistance, slide-then-roll, and bounces by material. Objects land on furniture, fall off edges and never go below the floor
- **Collisions with momentum**: the robot (3.5 kg) and objects exchange momentum on impact. A lighter object is pushed away (balls roll, boxes slide and stop by friction) and the robot only slows; a heavier object barely moves and the robot is stopped or thrown back; a wall or an object pressed against a wall acts as infinitely heavy. The robot only collides when driven by hand or when **Robot stops if an object blocks it** is off; impacts are narrated and logged as `collision` events
- **Rolling objects**: balls, bottles and cans roll when you press **Roll** or walk into them; they spin, bounce off walls and furniture, and slow to a stop (bottles tip over and roll in an arc)
- **Move in 3D**: drag the red / green / blue **X / Y / Z arrows** on the selected object, or type X, Y (height) and Z; let go and it falls (or tick **Hold in air**, then **Drop**); **Roll** from a height throws it
- **Paint mode**: click any object and give it a new colour (whole object or one part); reset one or all
- **Time of day**: lighting, sun, sky and windows follow the real clock, a manual slider, or a fast day cycle whose length you set (e.g. 1 day in 30 seconds, 4 minutes or 2 hours)
- **Curtains**: open or close all with the 🪟 dock button or **Lights → Curtains**, or click a curtain to open / close that window; they slide and spread out over about 1 s, and closed curtains keep part of the daylight out (sun −60 %, sky light −40 % when all are closed)
- **Light bulbs**: pendant bulbs in every room; switch each one in the **Lights** tab, by clicking it, or with `L`; optional auto on at dusk / off at dawn
- **Tasks**: the robot spawns at a **source**, plans a path around walls and furniture, and drives to a **destination**. For each point you choose **Random**, **Pick on map** (click the floor) or **✍ Write**: type an object (sofa, swing gate), an area (kitchen, gravel patch) or "x, y" in metres (x east, y north, as in the CSV); the box suggests the names in the current room, the robot uses the nearest free floor beside an object or the middle of an area, and a place it cannot reach is reported in the dialog; random tasks can run back to back
- **Walking people** (Build → People): pick one person or all; mode **Route** (back and forth), **Random** (wander to random spots, short pauses), or **Stand**; set the **speed** (0.1–2.5 m/s), **Set position**, **Walk to…** a spot, or **Set route A→B** by clicking the floor. People walk around walls and furniture, and wait when the robot or the player is right in front of them
- **Landmark directions**: when a task starts, the narration gives directions the way a person would on the phone, using landmarks you can see (no walls in between), their colour and side: *"Start next to the brown bookshelf in the right room. Go straight for about 2 m. At the white door frame, turn right. Then go straight for about 4.5 m into the living room. The destination is right next to the brown chair, opposite the orange coffee table."* On the way it says *"Passing the grey bin on the left"*, and on arrival where the robot is; directions are saved in the task annotations and events
- **Narration**: live text (and optional speech) for what the robot does, e.g. *"Bot is bending 95° right at the corner near the door frame (living room)."* Manual driving is narrated too: moving forward, reversing, turns with their angle, stops, and close obstacles
- **Dataset recording**: images (480p → **4K**, PNG/JPG), CSV with 58 columns, `metadata.json`, auto-zip batches, or save straight to a folder (Chrome/Edge)
- **Dashboard**: live front-camera feed (plus a full-screen **Bot cam** view), speed gauge, PWM bars, ToF radar, charts, battery, pose/IMU, live log

## 🚀 Quick start

Requires [Node.js](https://nodejs.org) 18+.

```bash
git clone https://github.com/Prasha0x0/dynora-sim.git
cd dynora-sim
npm install
npm run dev
```

Open the printed `http://localhost:5173/` link. Default login: **admin / robot123** (or create an account on the login page).

Production build: `npm run build` (output in `dist/`, can be hosted on any static host).

## 🎮 Controls

| Key / action | What it does |
|---|---|
| **M** or 🕹 Drive | Drive robot with arrow keys |
| **H** or 🚶 Human | Control a human with **WASD** (Shift = run) |
| **E** | Pick up / drop a nearby object (human mode) |
| **V** | First-person view (human mode) |
| **C** | Change shirt colour (human mode) |
| Drag floor objects | Move furniture / spawned objects |
| **R** / **Shift+R**, or wheel while dragging | Rotate the selected object 15° left / right |
| **Build → Roll selected** | Roll the selected ball, bottle or can |
| X / Y / Z arrows or boxes | Move the selected object in 3D; Y is the height (falls when released unless **Hold in air**) |
| **Delete** | Remove last selected object |
| **P** or 🎨 Paint | Paint mode: click an object to change its colour (**Esc** closes) |
| **T** or 🚩 Task | New task: choose Random, Pick on map or Write (a place name or x, y) for the source and the destination (**Esc** cancels picking) |
| **L** | Switch the bulb nearest to the human (or robot) |
| **G** or 🎬 Chase | Camera follows behind the robot and turns with it; about 7.5 m behind and above it (never closer than 6 m) so you see the surroundings; walls are solid and never hide the robot (the camera rises to look over them). It is on by default and when Drive starts. Drag to look around; it swings back after 2 s |
| **B** or 🎥 Bot cam | Full-screen view from the robot's front camera |
| **Lights** tab | Time of day, clock mode, bulbs, brightness |
| Drag empty space / wheel | Orbit / zoom camera |
| **Build → Draw** | Click floor to add path waypoints → **Apply path** |

## 📷 Recording data

1. Open **Settings** to choose resolution (480p, 720p, 1080p, **2K**, **4K**), PNG/JPG, image interval, max images, noise and robot speed.
2. Press **⏺ Record** in the left dock. Stop it when done.
3. Press **⬇ Export** → `robot_dataset.zip` containing `data.csv`, `metadata.json` and `images/`.
   - Use **📁 Save to folder** (Chrome/Edge, on `localhost` or https) to stream to disk with no memory limit.
   - **Auto-zip every N images** downloads batches automatically for long sessions.

Data is sampled at 5 Hz, or faster when the image interval is shorter than 0.2 s (every image gets its own CSV row). Image interval options: 0.01 s (every frame, limited by the frame rate), 0.2, 0.3, 0.4, 1, 2 and 5 s. Camera: 70° vertical FOV. Coordinates: x east, y north, yaw 0 = +x.

### CSV columns (58)

1. `timestamp_iso`
2. `sim_time_s`
3. `sample`
4. `operator`
5. `lap`
6. `mode`
7. `x_m`
8. `y_m`
9. `yaw_deg`
10. `v_mps`
11. `omega_dps`
12. `accel_mps2`
13. `v_left_mps`
14. `v_right_mps`
15. `rpm_left`
16. `rpm_right`
17. `pwm_left`
18. `pwm_right`
19. `duty_left_pct`
20. `duty_right_pct`
21. `dir_left`
22. `dir_right`
23. `enc_left_ticks`
24. `enc_right_ticks`
25. `odom_x_m`
26. `odom_y_m`
27. `odom_yaw_deg`
28. `dist_travelled_m`
29. `imu_ax_mps2`
30. `imu_ay_mps2`
31. `imu_gz_dps`
32. `imu_yaw_deg`
33. `motor_i_left_A`
34. `motor_i_right_A`
35. `batt_v`
36. `batt_pct`
37. `tof_front_m`
38. `tof_left_m`
39. `tof_right_m`
40. `tof_back_m`
41. `tof_front_ok`
42. `tof_left_ok`
43. `tof_right_ok`
44. `tof_back_ok`
45. `tof_min_m`
46. `obstacle_stop`
47. `person_x_m`
48. `person_y_m`
49. `person_dist_m`
50. `cart_x_m`
51. `cart_y_m`
52. `door_open_pct`
53. `image`
54. `img_w`
55. `img_h`
56. `time_of_day` (HH:MM)
57. `daylight_pct`
58. `bulbs_on`

## 🧠 Language annotations (vision-language / LLM-ready)

Every recording also produces natural-language data, generated from simulator ground truth (no hallucinated facts):

| File | Content |
|---|---|
| `annotations.jsonl` | One record per image: **caption**, LLaVA-style **conversations** (describe scene, what is ahead, is it safe, where am I, how many people, what next), **visible objects** with distance, bearing and normalized **bounding boxes**, zone, robot state, ToF values, the **action** (linear/angular velocity), the latest narration **instruction**, the current **task** (instruction, source, destination, path length, done) and **lighting** (time of day, daylight, bulbs on) |
| `events.jsonl` / `events.csv` | Timestamped **comments for critical events**, each with its **own camera frame taken at that moment** (events at the same moment share one frame): obstacle stops, resumes, turns, zone changes, doors, close obstacles, people nearby, battery, laps, manual mode, custom paths, narration (`instruction`), tasks (`task`, `task_done`), bulb switches (`light`) |
| `data.csv` | 58 sensor / motor / pose / lighting columns at 5 Hz (CSV files start with a UTF-8 BOM so Excel shows ° and · correctly) |
| `metadata.json` | Sensor, camera and robot specs, lighting setup + description of the language files |

Example conversation record: `{"from":"human","value":"<image>\nDescribe what the robot camera sees..."}` → `{"from":"gpt","value":"In the dining hall, the robot camera sees ..."}`. Events also appear live in **Dataset → Language comments**.

## 📁 Project structure

```
index.html          UI layout (login, environment picker, dashboard)
src/boot.js         login + environment selection
src/main.js         Apartment environment + simulation, sensors, recording
src/canteen.js      Canteen environment (same engine, different world)
src/track.js        Obstacle track environment (ramps, bridge, bumps, gravel, slippery surface; robot follows the surface height)
src/human.js        Articulated human model (walk / sit poses)
src/lighting.js     Time of day + switchable bulbs (shared by both environments)
src/paint.js        Paint mode: click to recolour objects
src/roll.js         Round objects (balls, bottles, cans) and rolling physics
src/move3d.js       X/Y/Z arrows + position boxes, gravity and landing
src/physics.js      Shared real-world numbers: gravity, masses, drag, rolling resistance, bounce
src/collide.js      Robot ↔ object collisions with momentum (push light objects, bounce off heavy ones); robot mass
src/weights.js      Build → Weights (kg): robot and object masses, saved per room
src/wheelerr.js     Settings → Wheel speed error: 1–3 % speed error per wheel
src/curtains.js     Curtains: open / close per window or all, dims daylight when closed
src/rotate.js       Rotate controls for the selected object
src/narrate.js      Live narration of starts, bends and stops
src/task.js         Random source → destination tasks with A* path planning
src/directions.js   Landmark directions for a task route (colour, side, next to / opposite)
src/people.js       Walking people: route / random / walk to / stand, speed and position
src/style.css       Styling
```

## 🌐 Hosting

The site runs on Cloudflare Pages at **https://dynora-simulator.pages.dev**. Cloudflare builds every push to `main` with `npm run build` and serves `dist/` (see `wrangler.toml`).

## 🔒 Security note

Accounts are stored hashed (PBKDF2) in the browser's `localStorage`. This only keeps casual visitors out of the UI – it is **not** real authentication, and anyone can read the site's code. For real security you need a server-side login.

## 🛠 Tech

[Vite](https://vitejs.dev) · [three.js](https://threejs.org) r128 · [JSZip](https://stuk.github.io/jszip/)

## 📝 Known limitations

- The robot is path-following; collisions use a simple 1-D momentum model along the contact normal (no spin from off-centre hits). Tasks plan a path around furniture when they start, but the robot does not re-plan: if something moves into its way, it stops and waits.
- Painted colours, rolled positions and rotations are not saved after a page reload (lighting settings are).
- Only spawned objects and furniture can be moved; walls, the person/crowd, doors and trolleys are fixed.
- 4K capture needs a decent GPU.

## 📄 License

MIT – see [LICENSE](LICENSE). Replace `YOUR NAME` in the license file.
