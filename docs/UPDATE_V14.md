# V14.0 apartment core update

Date: 2026-10-27. This updates V13.1 with all current features retained.
The attached V9 source was inspected as the user's faster apartment reference.
Its simpler AABB/contact path is not substituted for corrected real contacts.

## Main lag bug

The room's decorative contact-shadow planes were being convexified into prop
collision shapes. They also enlarged bounding-box fallback shapes. Coplanar
shadow hulls created fake floor/nearby-object contacts and extra solver work.

Contact shadows now remain visible but carry explicit no-contact/no-depth helper
flags. Registration skips them. Physical bounds use source contact meshes only,
including correct transforms for instanced geometry. This also removes the
shadow footprint from the bookshelf's fallback box and other early contacts.
The actual rover/prop shapes, 120 Hz integration, 10 solver iterations and four
CCD substeps remain. No solver accuracy was removed to obtain the speedup.

A deterministic real-room contact benchmark reproduces the issue: median steady
contact-step CPU time dropped from **61.39 ms** to
**6.66 ms**, with 168 versus
158 prop/actor shape parts; the removed parts are decorative
shadows. Both cases have 191 fixed triangle meshes.
Some furniture is still settling after two simulation seconds, so this is not
an all-asleep or fully calibrated room benchmark. Native Node timings are not
laptop browser FPS.

## Rendering and query work

- A frame-shared sensor BVH rejects distant objects and uses conservative posed
  skin bounds. Accepted candidates still use the same exact triangle raycasts,
  four mounts, nine rays per mount, distance limits and physical units.
- Animated-mesh camera and shadow frustums share conservative posed bounds with
  ray queries. Every deformed vertex is contained in the tested bounds. The
  model, UVs, skin weights and animation detail remain unchanged.
- Fixed room models can share a spatial draw batch across their original model
  parents. Selection temporarily unbatches a fixed model. Moving props retain
  separate roots. Original IDs remain for picking, depth, removal and exports.
- Compatible pairs can now form a batch. Normalized or unsupported vertex-colour
  formats remain unbatched to preserve their appearance.
- Preview/depth rectangles are shared within each frame, before UI writes.
  ToF display text updates at 10 Hz only when changed; truth sampling continues
  each simulation frame. Depth still supports five simultaneous live anchors.
- Switched-off lights are removed from the render light list. At zero sunlight,
  its zero-contribution shadow pass is skipped. Enabled-light quality remains.

On the deterministic construction fixture, the orbit view submits
**359 → 331 meshes**.
The corridor bot view submits **129 →
102 meshes**; offscreen people no longer
submit their skin triangles. The complete fixture still has
**388,882 triangles** before and after. Ceiling pendants,
editor gizmos and UI are excluded from this structural fixture.

Living-room sensor CPU time is **3.73 →
0.78 ms** in this run, including index updates.
`performance-v14.json` contains all cases and tails. These are structural and CPU
measurements. They do not establish a 30 FPS result on the user's RTX 4060.

## Validation

- 190 Node regression tests pass, including both human rigs and seated/walking
  posed bounds, exact sensor hits, edited/removed surfaces, source identity and
  exports, real floor-shadow settling, scaled physical instances, contact
  clearance, hinged gates, potholes, airflow and five-live-depth behaviour.
- Vite production build passes. The existing large Rapier chunk warning remains;
  it is not a build failure.
- Actual Chromium software-WebGL UI smoke: apartment starts, five targets read
  live, their CSV shares one batch, and removing/restoring a chair works.
- Clicking the Record icon and Stop text produces an automatic ZIP download.
  The short smoke recording has 3 telemetry rows and
  1 decoded PNG frame; quality is PASS. All
  25 manifest hashes and ZIP CRC checks pass.
- Original 88 public-asset hashes remain identical to V13.1. Assets are packaged
  once in `dist`; npm hooks restore missing development copies. No texture or
  model downsampling was used for this update.

The final package is re-extracted and checked before delivery. See the separate
package-validation result and browser UI JSON for exact verification details.

The ready-built production app was independently served by Python and passed
the same five-live-target, removal/undo and recording-download smoke. Its
recording also passes all manifest hashes and image decoding. Night lighting
was checked in the development UI: zero sun/shadow contribution, nine bulbs on.
