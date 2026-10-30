# DYNORA V15.3 validation

- 253 Node tests passed; no failures or skips. This includes ten new selection,
  alignment, cutout, contour, attachment and training-coordinate tests.
- Three Python controller HTTP integration checks passed.
- Vite production build passed; the existing large-chunk notice remains.
- 13 rendered browser checks passed without JavaScript or shader errors:
  region-first opening, curved rectangles, concave polygons, optional patch
  filtering, CSV download, source-grid stability under window resizing, live
  camera-motion updates, occlusion, alpha-cutout leaves, HD aspect, legacy
  point/anchor controls, dotted-part discovery and explicit all-256 sampling.
- The built production app was checked in apartment, canteen and obstacle track.
  Each selected a shape first, filtered patches, downloaded CSV and verified
  exact row/column IDs and half-open source-pixel bounds at 640 x 480.
- All five rover profiles moved through the production selector and keyboard.
- Stopping a real recording automatically downloaded a ZIP and retained its
  verified download link. Independent reopening passed CRC and all
  37 manifest SHA-256 hashes, decoded all 1 PNG image(s),
  and verified all 5 chosen patches and 12 valid geometric samples.
- The raw sample positions were checked against each patch's source pixel
  bounds. Range and forward Z were recomputed from the exported camera matrix
  and world hit positions. Per-part medians and support fractions also match.
- Dataset quality is PASS_WITH_WARNINGS, with no validation errors.
  ToF dropout/out-of-range readings remain explicitly unavailable.

The recording check retained a manual depth snapshot taken before recording.
Its source display-frame index is 97; the recorded RGB image index is
[123]. They are intentionally identified as different frames,
not presented as synchronized training labels. Live measurements use the same
explicit indices and timestamps; join only matching captures.

Browser checks used headless software WebGL. They verify behavior and downloads,
not RTX 4060 performance. The 384-pixel boundary preview is approximate; measured
depth comes from the recorded geometric ray samples. Sampling rates are best
effort, with one batch in flight and no backlog. Detailed/full-image work costs
more than a small selected region. Closing Depth stops region query/mask work.

Source images are partitioned into an aligned 16 x 16 grid without cropping.
Widescreen cells are rectangular. Tests include 896-square, Full HD, UHD 4K and
odd source dimensions; integer cell widths/heights differ by at most one pixel.

Packaging checks preserve all 88 original public assets and all original CAD
source files byte-for-byte. Assets occur once in dist; source commands restore
their public copies from that checked bundle. Fresh-extraction restoration is
verified. The archive includes both complete editable source and ready-built
app; model and texture detail have not been reduced for this update.

See UPDATE_V15_3.md for controls, preview limitations, capture coordinates and
the difference between geometric samples and heatmap visualization.
