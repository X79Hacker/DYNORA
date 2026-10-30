# V15.8.2: clear selections between layouts

Changing tracks or rebuilding track geometry clears depth regions, saved point
anchors, live labels, preview masks and selection history for the old layout.
Pending live/selection work cannot repopulate those cleared selections. Already
captured recording frames keep their original frozen selection data.

Environment selection now updates the environment URL before reloading, so an
old environment query parameter cannot force the previous scene to reopen.
Every newly loaded environment starts with an empty region/anchor collection.

The extra Test Lab dock shortcut, Visuals link and isolated test-lane choice
are removed. Rovers remains accessible. Normal obstacle tracks, multi-region
live depth, recordings, snap pairs, physics and model assets are retained.
