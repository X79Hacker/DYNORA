# Publish DYNORA to GitHub

## Upload using the GitHub website

1. Sign in to GitHub and create a repository named `DYNORA` (choose Public or Private).
2. Do **not** initialize the GitHub repo with a second README, gitignore or licence; those files are already included here.
3. Extract the DYNORA project archive locally, then upload the project **contents** to the repository. GitHub's browser upload is best for small projects; for this larger prebuilt simulator, **Git is recommended**.

## Upload using Git (recommended)

Open PowerShell (Windows) or a terminal in the extracted `DYNORA` directory:

```bash
git init
git add .
git commit -m "Initial release: DYNORA v15.8.4"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/DYNORA.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. GitHub may prompt you to authenticate using your usual GitHub credentials flow. To avoid a duplicate remote, only run `git remote add origin` on a repository that does not already have one.

`dist/` **must be committed** in this release to retain the ready-to-run app and the asset-restoration source for `npm` scripts. `node_modules/`, restored `public/`, browser-generated recordings and local secrets should not be committed.

## Repository summary you can paste into GitHub

**Description:** Browser-based robotics simulation and dataset studio for embodied AI research, featuring 3D environments, rover physics, depth-region annotation, visual/sensor recording and reproducible exports.

**Topics:** `robotics`, `embodied-ai`, `simulation`, `robot-navigation`, `dataset-generation`, `computer-vision`, `threejs`, `rapier`, `depth-estimation`, `research-tools`

## Before making the repository public

- Check source, documentation, sample outputs and Git history for private data and access tokens.
- Review all third-party asset licence notices, including human models and textures.
- Verify startup and build/tests on your own PC.
- If you enable an internet-facing demo, review the local-only sign-in and controller bridge before exposing services.
