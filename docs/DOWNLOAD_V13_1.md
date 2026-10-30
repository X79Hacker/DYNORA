# DYNORA V13.1 download and validation

The restored package includes five simultaneous live point or region-anchor
depths, shared updates up to 5 Hz, range/Z/visibility, replacement slots and
bounded CSV history. The ready-built app starts with START_DYNORA.bat.

To reduce download size, the 88 bundled public assets are stored once in dist.
The npm dev/test/build commands restore missing public assets automatically
from dist, verifying their SHA-256 hashes. Existing source asset edits remain.

A fresh extraction was tested with no public folder. All 88 assets restored
with matching hashes, and all 181 tests passed. The production build passed.
ZIP CRC and every built HTML local reference are checked before delivery.
This does not establish GPU FPS on the user's computer.
