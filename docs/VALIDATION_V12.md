# DYNORA V12 validation

Validated on 26 October 2026. This file records CPU/solver checks separately
from GPU rendering; no laptop FPS guarantee is implied.

## Repeatable apartment CPU benchmark

`tools/benchmark-apartment.mjs` loads the actual bundled Sam GLB: 65,056
vertices in 14 meshes. It animates the rig, updates its matrices, and issues
the same 36 rays from four supplied-URDF sensor mounts, at height 0.1419894 m,
with a 2 m range. It warms eight frames and measures 56 frames per scenario.
V11 source was retained and run sequentially with V12 on the same host.

| Person position | V11 median sensor batch | V12 median | V11 p95 | V12 p95 |
| --- | ---: | ---: | ---: | ---: |
| 4 m away, beyond sensor range | 29.885 ms | 0.518 ms | 78.003 ms | 1.308 ms |
| 1 m away, within range | 28.799 ms | 0.936 ms | 44.892 ms | 2.371 ms |

This measures CPU ray work against a real detailed person, not the whole
apartment, GPU time, screen FPS or the user's laptop. Raw data and animation
costs are in `performance-v12.json`. Host load and garbage collection affect
timings. The benchmark's improvement should not be read as a proportional
increase in total application FPS.

## Correctness and regressions

The full suite contains 161 passing tests. Full output is in
`test-results-v12.txt`. New checks include:

- Ray near/far clipping with origins inside bounds, parallel rays and backward
  rays. A real detailed person beyond ToF range skins zero candidate vertices.
- 240 ray comparisons against fully frozen Sam/Maya geometry in walking and
  sitting poses, with rotation and nonuniform scale. Hit counts, face IDs,
  distances and UVs agree within numerical tolerance.
- Main view, camera preview and capture share one fresh shadow pass. The
  pipeline restores clean camera visibility and projection aspect, and recovers
  renderer state after capture failure. These are scheduling/state checks,
  not a GPU pixel-comparison test.
- The actual two-leaf gate with fixed square posts opens under motor-driven
  rover contact from both sides. The rover traverses the passage; hinges stay
  anchored within 3 mm. Only the posts are static; no leaf ghost boxes remain.
- A clear gate stays shut before impact. Its spring returns both leaves to
  within 0.08 rad of rest after the robot is removed. Post-diagonal clearance is
  checked, and decorative hinge straps cannot add jamming colliders.
- Retained collision/CCD, terrain, human walking/seating, curved-depth, removal,
  dataset export, airflow and report checks pass.

## Browser verification

The browser's WebGL context is unavailable, so the apartment's full 3D frame
rate and appearance on an RTX 4060 were not measured. An explicit 2D contact
verification page used the actual production gate factory and rover/contact
solver; it did not animate a mock gate.

- Forward approach: rover cleared to X = 1.359 m; the gate at X = 0.750 m
  reached a peak opening of about 42.4 degrees, with both posts remaining fixed.
- Opposite approach: rover cleared to X = 0.149 m and peak opening was about
  43.5 degrees. Each direction recorded physical contact events.
- After releasing/moving the rover clear, a 20-second solver observation
  returned both leaves to approximately 0.0 degrees. The browser displayed PASS.

The source QA page is `tests/gate-render-check.html` when running the Vite
development server. The ordinary ready-built app uses the corrected same gate
inside its obstacle tracks. No test-only view replaces its 3D renderer.

## Build, package and limits

The production build includes the new shared rendering and skinned-query core.
The display FPS counter uses wall-clock elapsed time; simulation timestamps and
recording sample scheduling retain the original fixed-step clock.
The app archive is reopened for CRC checks and required source/build files.
Previous V11 validation still describes the coarse 2D airflow and reduced-order
rover model. Human movement remains kinematic/IK, and contact geometry is an
approximation of the visible models. Gate friction and closer parameters need
real hardware calibration for quantitative predictions.

Extract V12 into a fresh folder after stopping the old server. The app header
shows **DYNORA V12** so the running version can be checked directly. Default
graphics quality is retained; Balanced/High remain available in Visuals.
