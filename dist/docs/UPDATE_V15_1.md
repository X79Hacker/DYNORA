# V15.1 — rover switching and driving controls

V15.0 had a control bug: applying any model called Stop, which set both Pause
and an overriding HOLD command. The ordinary Pause button only removed Pause;
HOLD continued sending zero motor commands. The numerical rover tests passed,
but the UI selection path had not been tested for actual movement afterward.

## Current controls

- An active route or keyboard drive continues after applying a new model.
  Calibration still resets velocity, so the replacement accelerates from rest.
- If you paused before switching, the new rover stays paused. Use **Resume driving**
  beside the model selector or press the ordinary **Pause** button to resume.
- **Keyboard drive** beside the selector enables manual control and unpauses.
  Use **↑ / ↓** to move, **← / →** to turn, and **Shift** to boost speed.
  WASD belongs to human walking in the main scene, not rover driving.
- The ordinary **Drive** button also releases HOLD and enables driving.
- Saved non-default rovers restore without an unwanted HOLD on startup.
- Switching away from goal/Python control disconnects that controller and leaves
  normal driving available, paused until resumed. Test Lab profile transfers
  remain paused so you can inspect their settings before starting.
- The Pause button's highlight follows the actual pause state even when its
  inner icon is clicked.

Existing V15 features, original assets, physics parameters and rendering detail
are retained. The fix uses event handlers and adds no per-frame simulation work.

For an existing V15.0 installation, the immediate workaround is
**Rovers → Return to route / manual**, then **Drive** and the arrow keys.

Extract V15.1 into a fresh folder, stop the previous server with Ctrl+C, run
START_DYNORA.bat, and refresh http://localhost:8000. Confirm V15.1 in the header.
The full V15 feature guide is UPDATE_V15.md; this document supersedes its old
statement that every model application pauses the rover.
