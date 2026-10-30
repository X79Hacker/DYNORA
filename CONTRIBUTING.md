# Contributing to DYNORA

DYNORA is a research-oriented robotics simulator. Contributions that improve repeatability, physical assumptions, dataset alignment, performance, accessibility or documentation are especially valuable.

## Prepare a development environment

1. Use Node.js 22 and Python 3 if you need the local controller/server tools.
2. Run `npm ci`, then `npm run dev`.
3. Run `npm test` and `npm run build` before submitting changes.
4. If you change Python tools, run the applicable Python unit tests.

The repository deliberately includes `dist/` because it carries the prebuilt app and bundled public assets. `npm` pre-hooks restore verified copies into the ignored `public/` directory. When releasing changed source, regenerate `dist/` and ensure the source-to-asset restoration workflow still works.

## Pull requests and bug reports

- Describe expected versus actual results, with reproduction steps.
- Identify the environment, scene, rover, browser, input settings and current software version.
- For depth/outline issues, include the selection method, region IDs, patch settings and whether **Use** is checked.
- For dataset/export issues, describe manifest/CSV/JSON mismatches without sharing sensitive recordings.
- For physics/sensing issues, distinguish measured behaviour from approximate simulator predictions.
- If an asset is added, document its origin and redistribution licence.

Avoid adding private data, access tokens, downloaded personal recordings, or external copyrighted material without permission. Keep changes small and include regression coverage where feasible.

## Research claims

Report methods, experimental conditions, limitations and comparisons. Do not describe an exploratory geometry or machine-learning approach as validated unless there is reproducible evidence. DYNORA does not currently claim integrated Fourier shape tracking or a trained depth model.
