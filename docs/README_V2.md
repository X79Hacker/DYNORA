# DYNORA Physics V2

Improved local rover geometry, source CAD inspection, calibrated dynamics and numerical verification, while preserving the original dark interface, rooms, tasks and dataset tools.

**Windows: Extract All, then double-click `start-windows.bat`.** Python 3 serves the included build; npm is not needed to run it. Open http://127.0.0.1:8774/ and use the existing default local account `admin / robot123`.

- [Start instructions](START_HERE.txt)
- [Physics, equations, geometry provenance and limitations](docs/PHYSICS_V2.md)
- [Validation evidence](docs/VALIDATION_V2.md)
- [Audit of original model assets](docs/SOURCE_AUDIT.json)
- [Previous README and controls](docs/ORIGINAL_README.md)

New: 120 Hz tyre/motor dynamics, wheelspin and independent encoder odometry, battery sag estimates, motor/geometry calibration import and export, 68-column dataset, CAD/URDF/STL inspector, body-attached sensor transforms, and a standalone verification lab.

Six meshes referenced by my_bot.urdf are absent in the original upload. The driven rover uses its joint layout with parametric visuals; the source CAD inspector explicitly marks missing geometry. This is an approximate simulator requiring physical calibration, not a claim of proven real-world accuracy.

Development:

```sh
npm ci
npm run dev
npm test
python -m unittest discover -s tests -p "test_*.py"
npm run build
```

The Python launcher serves `dist/`. Rebuild after editing source. Vite and the launcher use different local ports. Browser state and datasets from old versions are not migrated automatically; keep your old folder and export recordings before upgrading.
