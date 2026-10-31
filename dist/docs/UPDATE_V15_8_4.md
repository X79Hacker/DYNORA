# V15.8.4: choose which saved regions update and appear in snaps

Open Depth. Under **Choose regions · live + snap**, use the **Use** checkbox beside each saved region.

- Check one or several regions. All checked regions get green outlines, live depth, patch values and shared heatmap updates.
- Uncheck a region to retain it for later while excluding it from the view, sampling and subsequent snaps.
- The Region to edit dropdown changes edit focus only. It never changes the checked set.
- Check all, Uncheck all and Only edited region provide quick selection controls.
- Newly added drawings start checked. Replacing/refining a saved region keeps its checkbox.
- A snap freezes the checked definitions with its RGB acquisition. Changing checkboxes while it finishes affects the next frame.
- Per-frame depth JSON and snap metadata record selected_region_ids, saved_region_count and selection_policy. CSV rows retain image names, frame IDs, capture times and region IDs.
- With none checked, captures contain no selected-region depth and a blank white outline image (using default snap settings).
- The Point tool retains its independent saved targets. Its point guides do not appear in region mode.

Test Lab dock/Visuals shortcuts, the isolated lane controls, track-switch selection clearing, models, physics and lean recording exports are retained.
