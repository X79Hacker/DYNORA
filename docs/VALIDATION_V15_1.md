# V15.1 motion regression checks

All 227 Node regression tests and three Python HTTP checks pass. Production
build succeeds. All 88 original public assets retain their sizes and hashes.

The actual apartment app was driven through its model-selector and keyboard UI.
Every model moved after switching: Scout 0.203 m, Carrier 0.103 m, Courier
0.135 m, Utility 0.200 m and Research 0.185 m in the sampled intervals. The
measurements use actual scene/drive/contacts state, not a separate test rover.
The software-WebGL drawing buffer was reduced for this input/physics test;
these are functional checks, not GPU FPS measurements.

Checks also pass for: deliberately paused model selection followed by Resume;
Stop followed by Pause (including the inner icon); Stop followed by Drive;
and restoring a saved Utility Rover after reloading, without HOLD blocking it.

The ready-built app separately accepts keyboard drive after switching all five
models in the apartment. Scout also moves in canteen and obstacle track. Its
live physics readout reports nonzero speeds, and the Pause button resumes an
explicit Stop in all three environments. These checks use the shipped build.

See motion-browser-v15.1.json and production-motion-v15.1.json for the values.
V15 recording/depth verification remains historical evidence for those unchanged
subsystems. UPDATE_V15_1.md explains the corrected controls and V15.0 workaround.
