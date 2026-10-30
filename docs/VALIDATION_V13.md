# DYNORA V13 validation

Validated on 26 October 2026. This update reduces repeated work and adds
diagnostics; full apartment GPU FPS on the user's computer remains unmeasured.

## Automated correctness

The full Node suite passes: 175 tests, zero failures. Exact output is in
`test-results-v13.txt`.
New checks cover:

- Rigid batching preserves all triangles and per-source RGB. Picking and depth
  keep original identities through batching and root movement. Source exports
  contain original geometry/layers without runtime proxies or object references.
- Paint/visibility edits rebuild once. Transparent, deforming and animated
  content stays separate. Before/after contact part vertices agree within
  numerical tolerance, with no derived-mesh colliders.
- Points beyond five metres work; chosen range limits reject distant hits.
  Twelve saved targets coexist and export, without retaining dense sample arrays
  per saved region. Opaque Bot Camera walls survive Orbit cutaway filtering.
- Depth viewport rendering uses the visible feed's aspect and scissor rectangle,
  submits one visible camera view, and restores the full viewport and helper state.
- Frame timing history is bounded and independent of simulation time. Visible
  stalls stay in it. Background-tab gaps are excluded. Adaptive display scale is
  bounded, disabled when requested, and avoids pure CPU-bound pixel reductions.

Existing checks retain collisions/CCD, hinged gates, terrain, human actions,
curved surface geometry, removal, airflow and recording/export integrity.

## Draw-structure and CPU check

`node tools/benchmark-render-batches.mjs` uses one of each original furniture
catalog model plus a 66-book shelf patterned after the apartment's coloured
books. This is a repeatable component fixture, not the complete apartment.
Raw results are in `performance-v13-draws.json`.

| Layer-visible draw meshes per view | Before | After |
| --- | ---: | ---: |
| Fixture submissions | 182 | 113 |
| Fixture triangles | 125,988 | 125,988 |

On this host, unchanged batch maintenance had median 0.008 ms / p95 0.016 ms.
A full validation scan had median 0.894 ms / p95 3.049 ms; production validates
periodically and after UI edits. Initial setup took about 19.5 ms. These CPU
figures vary with host load and are not measured rendering FPS or a prediction
for the user's GPU. V12's isolated skin-ray benchmark also cannot establish
full apartment performance; use the new full-frame profile for that workload.

## Browser checks

The actual depth/editor components were exercised against a software-projected
triangle scene using `tests/depth-removal-smoke.html`. This does not replace
the production WebGL renderer or measure its performance.

- The dedicated Bot Camera feed remained visible next to the panel. The centre
  table-leg face measured 2.920 m with correctly aligned input coordinates.
- Nine separate targets were saved simultaneously. A sphere centred 12 m away
  produced an approximately 11.0005 m front-surface distance. A chosen 5.1 m
  limit rejected that target and disabled the current export instead of showing
  the previous successful result.
- A dragged region on a sphere produced 1,800 valid samples and a surface patch
  of 124 clipped triangles; its depth varied with curvature.
- After translating the sphere 0.25 m, a second region produced 1,980 samples
  and 128 clipped triangles. A foreground blocker changed the active target to
  LIVE INVALID; removing it restored visibility.
- Downloading all-target CSV produced nine rows with eight snapshot states and
  one active live anchor. Model removal reduced rendering/physics entries from
  two to one; Undo removal restored both, and a saved region could be remeasured.
- Active live anchors and the existing occlusion/removal/curved controls were
  checked with the same real component code. Saved summaries remain labelled
  snapshots, rather than presented as freshly measured dense regions.

## Build/package and practical limits

The production build and archive are checked separately after code validation.
The ZIP includes source, local assets, launchers and the clean ready-built app.
It is reopened for CRC and required-file/version checks before delivery.

The full apartment smoke fixture failed at WebGL context creation in this
cloud browser. This environment cannot validate apartment GPU FPS or visual
parity on the user's RTX 4060. Do not interpret the draw reduction as an FPS multiplier or
claim the reported 6 FPS has been reproduced/fixed on that hardware. The new
full-frame profile is the evidence to collect if the slow scene persists.

Adaptive mode may reduce display sharpness; it can be disabled. Geometry,
physics step/contact shapes and capture dimensions remain independent. Depth
is simulated visible-triangle geometry, not real sensor precision. Saved
nonactive pins are snapshots; animated skin anchors require a new snapshot.
Human motion and rover contacts retain their previously documented model limits.
