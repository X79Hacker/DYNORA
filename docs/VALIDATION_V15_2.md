# DYNORA V15.2 validation

- 243 Node checks passed, including the existing suite and 16 patch checks.
- Three Python controller HTTP checks passed.
- Vite production build passed. The existing large-chunk warning remains.
- Real WebGL browser interaction: click toggle, 20/40 selections, partial drag,
  exact 256-count coverage, all-256 sampling, picked curved part, occlusion,
  resize, Clear with zero subsequent queries, and the old live-anchor path.
- Native CSV download checked in the browser. All 256 IDs were present in the
  all-grid export; only 40 selected IDs were present in the apartment export.
- Built production app checked in apartment, canteen and obstacle track.
- All five rovers moved through the real selector and keyboard controls.
- Final recording ZIP independently reopened: CRC and all 33
  manifest SHA-256 hashes pass; 40 selected patches and
  360 valid depth samples; per-surface sample fractions verified.
- The recording contains 1 decoded PNG image(s), with no
  dataset validation errors. Its quality status is PASS_WITH_WARNINGS:
  unavailable/dropout/out-of-range ToF values are reported, not fabricated.

Browser checks used headless software WebGL. They verify operation, not RTX 4060
frame rates. Depth batches deliberately yield; capture timestamps, completed
rate and latency are displayed. All-256/high-detail sampling can take longer
than the requested update interval. There is one batch in flight and no backlog.

The CPU-only apartment benchmark uses the actual room and bundled posed people.
It records geometry query/setup time; it is not a GPU or laptop FPS benchmark.
Source meshes, textures and models have not been simplified for this change.
Original public assets and CAD source files are checked again during packaging.

See UPDATE_V15_2.md for selection controls, calibration and sampling limits.
