# UtilityLab

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23054576.svg)](https://doi.org/10.5281/zenodo.23054576)

A web-based tool for designing, checking and exporting stated choice experiments (stated-preference / discrete-choice experiments) — connecting the experimental design, its diagnostics and the survey deployment in a single workflow.

**Try it: [www.utilitylab.space](https://www.utilitylab.space)**. Free, open source, nothing to install.

> Made by [Ioannis Tsouros](https://github.com/acesonic7) ([@acesonic7](https://github.com/acesonic7))

---

## What it does

UtilityLab bridges the fragmented stated choice workflow that typically involves separate tools for design (Ngene, R, Python) and surveys (Qualtrics, LimeSurvey, Sawtooth). One screen takes you from:

> **Experiment idea → Structured design → Checked choice tasks → Survey-platform files and a methods paragraph**

without manual reformatting, scripting, or tool-switching.

UtilityLab stops at the survey: it does not collect responses, produce a response dataset or estimate models. Estimation stays in your own tools (Biogeme, Apollo, R, …).

## Features

The workspace is one page in five steps.

### 01 Structure
- Define **alternatives** (labeled or unlabeled, with an optional opt-out), **attributes** and **levels**
- Per-attribute settings: type (numeric / categorical / boolean), unit, display format, preference direction, applies-to scope and per-alternative levels (for labeled experiments), optional images
- **Pivoted attributes** (numeric): levels entered as offsets from, or multipliers of, a reference value — see [Pivot designs](#pivot-designs)
- **Context variables**: variables that set the scene for a whole choice task (weather, trip purpose, …) and take the same level for every alternative in it
- **Constraints**: forbid implausible level combinations within an alternative
- **Study library**: several studies side by side (new blank, new from example, duplicate, delete), auto-saved in the browser
- **Project files**: download a study as `.utilitylab.json` and open it again on any computer
- A copyable one-line **design signature** in the study header: alternatives, attributes and levels, context variables, choice tasks / blocks, D-error

### 02 Design
Two sources:
- **Upload CSV** — drop a design from Ngene/R/etc. (wide format: one row per choice task), auto-detect column → (alternative, attribute) or context-variable mapping, and match each value to a level by its value, its displayed text (e.g. `€2.00`, `15 min`) or its level number counted from 1 or 0. The design is applied only when every alternative × attribute and context variable has a column and every cell names a level; block labels (0/1, A/B, …) are numbered 1, 2, …. A template CSV can be downloaded from the current structure, and the design matrix's own CSV can be uploaded again.
- **Generate** — three methods:
  - **D-optimal** — coordinate-exchange search (Meyer & Nachtsheim 1995) with multistarts, minimising the D-error of a multinomial logit (MNL) model: dummy coding, alternative-specific constants for labeled experiments, optional priors per parameter; levels that would violate a constraint are skipped
  - **Balanced search** — best of K random candidates by a composite score (level balance, attribute correlation, dominance, overlap)
  - **Random** — one-shot baseline

All three draw context-variable levels at random for each choice task; context variables are not part of the D-error.

A **target sample** panel suggests a `(choice tasks, blocks)` split for the expected number of respondents and rates the current configuration by **observations per parameter** (respondents × choice tasks per respondent ÷ model parameters): low below 25, borderline from 25, good from 50. This is a rule of thumb, not a statistical power analysis.

The design is shown as a **design matrix**, one row per choice task grouped by block, and can be copied as CSV. **Earlier designs**: the last 10 replaced or cleared designs per study, restorable.

### 03 Choice tasks
Pages through the design as the choice tasks respondents will see (UtilityLab's own card or a Qualtrics-style preview), with opt-out, alternative-specific attributes, context variables and pivoted levels handled.

The **analyst lens** overlays what the analyst needs on the same choice task: level codes, dominated and identical alternatives, constraint violations, and the MNL choice probabilities under the current priors.

### 04 Diagnostics
- **D-error** of the current design under the MNL model and the current priors — for uploaded designs too
- **Observations per parameter** for the target sample (the same rule of thumb as in 02 Design)
- Configurable advisory checks: **dominance**, **identical alternatives (overlap)**, **attribute correlation**, **level balance** (attributes and context variables), **constraint violations** — severity-coded, with per-choice-task detail, re-run after every edit

### 05 Export
- **Qualtrics** — **TXT** (Advanced Format; blocks need a Randomizer added in Survey flow, as the file's setup notes explain) and **QSF** (native, one block per respondent built in)
- **LimeSurvey** — a complete **LSS** survey file, or a **push** of the choice tasks into an existing survey through RemoteControl 2 (beta; see [Architecture and data](#architecture-and-data))
- **Sawtooth** — design **CSV** for Lighthouse Studio's CBC "Import Design" (beta)
- **Pivot wiring guide** — Markdown instructions for piping each respondent's own reference value into Qualtrics or LimeSurvey; offered when the study has pivoted attributes
- **Methods paragraph** — a plain-text description of the experiment, the design and its checks, generated from the project, to paste into a paper

## Pivot designs

**Implemented — static pivots.** A numeric attribute can be pivoted in one of two modes: levels are offsets added to a reference value (absolute), or multipliers of it (relative). The preview and the Qualtrics and LimeSurvey exports show levels *resolved against a fixed preview reference* set per attribute, with the change in brackets (for example `€2.00 (-50%)`), so as exported every respondent sees the same values. The generators, the D-error and the diagnostics work on the level values as entered (the offsets or multipliers).

**Implemented — wiring guide.** To pivot on each respondent's own value, the wiring guide lists, per pivoted attribute, the reference token and the piped-text (Qualtrics) or Expression Manager (LimeSurvey) expression to substitute for each preview value. The substitution is done by hand in the survey platform.

**Still deferred:**
- Automatic per-respondent piping in the exports (the files carry preview values, not piped expressions)
- A reference alternative (status quo shown at the respondent's own values)
- Categorical pivots
- Range clamping of resolved values

Details in [docs/pivot-designs.md](docs/pivot-designs.md).

## Stack

- Next.js 14 (App Router) + React 18
- TypeScript (strict)
- Tailwind CSS
- PapaParse for CSV
- Hand-rolled linear algebra for the D-error (no heavy deps)
- Vitest for unit tests

## Architecture and data

The designer runs in the browser: design generation, diagnostics, previews and every file export are computed client-side. Studies live in the browser's `localStorage` (one key per study); download project files to keep copies. No database, no user accounts.

There is one server route, `POST /api/limesurvey/push` ([app/api/limesurvey/push/route.ts](app/api/limesurvey/push/route.ts)), used only by **Push to LimeSurvey** (and its "Test connection" button). When you push, the browser sends the LimeSurvey URL, username, password, survey ID and the study to this route, which relays the username and password to the RemoteControl 2 endpoint of the LimeSurvey server you entered to open a session, creates the question groups and choice-task questions, and releases the session. The route exists so the browser does not have to call RemoteControl cross-origin (CORS). It keeps nothing: its code neither stores nor logs the credentials, and the password is never saved with the study (the URL, username and survey ID are remembered in the browser; the username is left out of project files). The credentials do pass through the server that hosts the app, so on a deployment you do not control, use the LSS file download instead, or host UtilityLab yourself.

The push connects only to public LimeSurvey servers. The URL must start with `https://` (plain `http://` is also accepted when you host UtilityLab yourself, outside Vercel), must not contain a username or password, and must not be, or resolve to, a loopback, private-network or link-local address (`localhost`, `10.x`, `172.16–31.x`, `192.168.x`, `169.254.x` and their IPv6 counterparts). Redirects are not followed, so enter the address the server actually answers on. One push is limited to 500 choice tasks in 50 blocks and about 50 seconds; for a larger design, import the LSS file. The route answers only requests from the app's own pages, and its error messages are its own: text returned by the remote server is not passed back. The checks live in [lib/limesurveyTarget.ts](lib/limesurveyTarget.ts) and [lib/limesurveyRc2.ts](lib/limesurveyRc2.ts).

If you host UtilityLab yourself and your LimeSurvey server is on the same machine or private network, set `LIMESURVEY_PUSH_ALLOW_PRIVATE=1` in the server's environment to lift the address restriction. Leave it unset on any deployment that strangers can reach.

## Local development

```bash
npm install
npm run dev
# → http://localhost:3000
```

### Tests

```bash
npm test           # unit tests (vitest) for the model, generators, exports, library, methods paragraph and LimeSurvey push checks
```

### Other scripts

```bash
npm run build        # production build
npm run validate     # run the design checks on the example study (CLI)
npm run diagnostics  # diagnostics, D-error and signature for the example study, with assertions (CLI)
npm run export       # write Qualtrics TXT + QSF and Sawtooth CSV for the example study to out/ (CLI)
npm run preview      # write a standalone HTML preview to out/preview.html (CLI)
```

`scripts/runGenerate.ts` and `scripts/runConstraints.ts` compare the three generation methods on the example study; run them with `npx tsx`.

## Deploy to Vercel

This repo is Vercel-ready:

1. Connect the GitHub repo at [vercel.com/new](https://vercel.com/new)
2. Vercel auto-detects Next.js — no environment variables needed
3. Build command: `next build` (default)
4. Output directory: `.next` (default)

That's it. No secrets and no env vars. The LimeSurvey push route deploys as a serverless function (Node.js runtime); everything else is client-rendered.

## Project structure

```
app/
  page.tsx, layout.tsx, globals.css
  api/limesurvey/push/route.ts  # the one server route: relays a push to LimeSurvey RemoteControl 2
  components/
    Designer.tsx                # top level: landing screen, then the workspace
    Workspace.tsx               # workspace state: active section, navigation between sections
    ProjectStore.tsx            # project state; DesignHealth.tsx: checks + D-error shared by every view
    ProjectHeader.tsx, TopBar.tsx
    DesignSource.tsx            # Upload | Generate panels
    DesignGenerator.tsx         # generator UI (random / balanced / D-optimal), priors, target sample
    CsvUpload.tsx               # upload + column mapping
    ExportButtons.tsx, LimeSurveyPush.tsx
    sections/                   # 01 Structure, 02 Design, 03 Choice tasks, 04 Diagnostics, 05 Export
    shell/                      # rail, progress, walkthrough, theme; sections.ts lists the five steps
    editors/                    # study details, alternatives, attributes + levels, context variables, constraints
    design/                     # design matrix, earlier designs
    choice-tasks/               # respondent card, Qualtrics preview, analyst lens
    diagnostics/                # efficiency tiles, findings, correlation, level balance, choice-task map
    export/                     # platform cards, methods panel
    library/                    # study library, new-study dialog
    landing/                    # landing screen and film
    ui/                         # shared primitives
lib/
  schema.ts                     # all data types
  example.ts                    # example study (Athens, Greece mode choice)
  defaults.ts, slug.ts, text.ts, format.ts, formatDate.ts, levelLookup.ts
  altIdentity.ts, altRoles.ts   # per-alternative colour/glyph and model role
  library.ts, projectFile.ts    # browser study library, .utilitylab.json files
  designGenerator.ts            # random + balanced + dispatch
  dOptimal.ts                   # MNL coding, D-error, coordinate-exchange search
  searchTrace.ts                # records a search step by step (landing screen)
  linalg.ts                     # log-determinant via Cholesky
  choiceProbabilities.ts        # MNL probabilities for the analyst lens
  sampleSize.ts                 # observations-per-parameter heuristic, (choice tasks, blocks) suggestion
  constraints.ts                # forbidden-combination engine
  validation.ts                 # dominance / balance / correlation / overlap
  diagnostics.ts, diagnosticsView.ts, designMatrix.ts
  csvImport.ts                  # CSV parsing + auto-detect
  qualtricsExport.ts            # TXT + QSF generators
  limesurveyExport.ts           # LSS survey + LSQ questions
  sawtoothExport.ts             # Lighthouse Studio design CSV
  wiringGuide.ts                # pivot wiring guide
  methodsParagraph.ts           # generated methods paragraph
  signature.ts                  # one-line design signature
  __tests__/                    # vitest unit tests
scripts/
  runValidation.ts, runDiagnostics.ts, runExport.ts, runPreview.ts, runGenerate.ts, runConstraints.ts
docs/
  pivot-designs.md              # pivot designs: what is implemented, what is deferred
  releasing.md                  # releases and Zenodo DOIs
out/
  sample-design.csv             # drop into the upload zone to test the import flow
  preview.html, *.txt, *.qsf, *-sawtooth.csv  # CLI script outputs
```

## Status

Shipped:
- ✅ CSV upload + column mapping
- ✅ Generators: D-optimal (coordinate exchange, with priors), balanced search, random; constraint-aware
- ✅ Choice-task preview with the analyst lens
- ✅ Diagnostics: D-error, observations per parameter, design checks
- ✅ Context variables
- ✅ Static pivots + wiring guide
- ✅ Exports: Qualtrics (TXT + QSF), LimeSurvey (LSS; RemoteControl push in beta), Sawtooth CSV (beta)
- ✅ Methods paragraph and design signature

Deferred:
- ⏳ Automatic per-respondent piping of pivoted attributes in the exports, reference alternative, categorical pivots, range clamping (see [docs/pivot-designs.md](docs/pivot-designs.md))

## Terminology

Aligned to the Wang, Thorhauge, Walker & Ben-Akiva tradition (MIT/Berkeley discrete-choice):
**choice task** (single scenario), **alternative** (option in a task), **attribute** (variable describing alternatives), **level** (attribute value), **block** (subset of choice tasks shown to one respondent), **stated choice experiment** (the full instrument).

## References

- Meyer, R. K., & Nachtsheim, C. J. (1995). The coordinate-exchange algorithm for constructing exact optimal experimental designs. *Technometrics*, 37(1), 60–69. [doi:10.1080/00401706.1995.10485889](https://doi.org/10.1080/00401706.1995.10485889)

## How to cite

If you use UtilityLab in your research, please cite it. The citation metadata is in [CITATION.cff](CITATION.cff); GitHub's **Cite this repository** button turns it into APA or BibTeX. Each release is archived on Zenodo with its own DOI (see [docs/releasing.md](docs/releasing.md)).

- All versions: [10.5281/zenodo.23054576](https://doi.org/10.5281/zenodo.23054576) (always resolves to the latest release)
- v1.2.0: [10.5281/zenodo.23215027](https://doi.org/10.5281/zenodo.23215027)
- v1.1.0: [10.5281/zenodo.23069523](https://doi.org/10.5281/zenodo.23069523)
- v1.0.0: [10.5281/zenodo.23054577](https://doi.org/10.5281/zenodo.23054577)

Cite the version DOI when you report results, so readers can reproduce the exact design engine you used.

## Privacy and terms

The hosted app has no accounts, cookies or analytics; studies stay in the browser, and only the optional LimeSurvey push passes data through a server function. See the [privacy page](https://www.utilitylab.space/privacy) and the [terms and disclaimer](https://www.utilitylab.space/terms).

## Contributing and security

Bug reports and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md). Please report security problems privately as described in [SECURITY.md](SECURITY.md).

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Copyright 2026 Ioannis Tsouros.
