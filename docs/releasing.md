# Releasing UtilityLab

Every GitHub release is archived on Zenodo and gets its own DOI, so papers can cite the exact version used. Zenodo reads the release metadata from [CITATION.cff](../CITATION.cff). Do not add a `.zenodo.json`: if both files exist, Zenodo ignores `CITATION.cff`.

## One-time Zenodo setup

Zenodo can only archive public repositories.

1. Make the GitHub repository public.
2. Sign in to [zenodo.org](https://zenodo.org) with GitHub (profile menu → **GitHub**) and authorise the Zenodo app.
3. Click **Sync now**, find `acesonic7/utilitylab` and switch it on.

## Cutting a release

1. Update `version` in `package.json` and `CITATION.cff` to the new version, and add `date-released: YYYY-MM-DD` to `CITATION.cff`.
2. Check the citation file:

   ```bash
   pipx run cffconvert --validate
   ```

3. Commit, merge to `main`, and create a **GitHub release** (not just a tag) named `vX.Y.Z`. Zenodo archives releases only.
4. Within a few minutes the release appears on Zenodo with a version DOI.

## After the first release

Zenodo also mints a **concept DOI** that always resolves to the latest version. Once it exists:

1. Add it to `CITATION.cff`:

   ```yaml
   doi: 10.5281/zenodo.XXXXXXX
   ```

2. Add the Zenodo DOI badge to the top of the README.
