# UtilityLab

A web-based platform for designing, validating, and exporting stated-preference (SP) and discrete-choice experiments (DCEs) — connecting experimental design, survey deployment, and analysis-ready output in a single workflow.

> Made by [Ioannis Tsouros](https://github.com/acesonic7) ([@acesonic7](https://github.com/acesonic7))

---

## What it does

UtilityLab bridges the fragmented SP/DCE workflow that typically involves separate tools for design (Ngene, R, Python), surveys (Qualtrics, LimeSurvey), and analysis (Biogeme, R). One screen takes you from:

> **Experiment idea → Structured design → Survey-ready choice tasks → Analysis-ready dataset**

without manual reformatting, scripting, or tool-switching.

## Features

### 1. Structure editor
- Define **alternatives** (labeled or generic), **attributes**, **levels**
- Per-attribute settings: type (numeric / categorical / boolean), unit, preference direction, applies-to scope (for labeled experiments)
- **Constraints**: forbid implausible level combinations within an alternative
- Auto-saves to `localStorage`; reload-safe

### 2. Design source
Two paths, switchable via tabs:
- **Upload CSV** — drop a design from Ngene/R/etc., auto-detect column → (alternative, attribute) mapping, validate values against levels
- **Generate** — three methods:
  - **D-optimal** — modified Federov local search with multistarts, alt-specific constants for labeled experiments, optional priors per attribute
  - **Balanced search** — best of K random candidates by composite validation score
  - **Random** — one-shot baseline

A **target sample size** panel suggests a `(choice tasks, blocks)` split with a green/amber/red status for statistical power.

### 3. Choice task preview
Live-renders the design as the choice tables respondents will see, with opt-out and alternative-specific attributes handled correctly.

### 4. Validation
Configurable advisory checks: **dominance**, **balance**, **correlation**, **overlap**, **constraint violations**. Severity-coded findings with per-task detail.

### 5. Export
- **TXT** (Qualtrics Advanced Format) — well-documented, easy to verify
- **QSF** (Qualtrics native) — block-randomization built in

Files are generated client-side from current state.

## Stack

- Next.js 14 (App Router) + React 18
- TypeScript (strict)
- Tailwind CSS
- PapaParse for CSV
- Hand-rolled linear algebra for D-optimal computation (no heavy deps)

Fully client-rendered. State lives in `localStorage`. No backend, no auth, no database.

## Local development

```bash
npm install
npm run dev
# → http://localhost:3000
```

### Other scripts

```bash
npm run build      # production build
npm run validate   # run validation engine on the example project (CLI)
npm run export     # generate TXT + QSF for the example (CLI)
npm run preview    # generate a standalone HTML preview (CLI)
```

## Deploy to Vercel

This repo is Vercel-ready:

1. Connect the GitHub repo at [vercel.com/new](https://vercel.com/new)
2. Vercel auto-detects Next.js — no environment variables needed
3. Build command: `next build` (default)
4. Output directory: `.next` (default)

That's it. No secrets, no env vars, no backend.

## Project structure

```
app/
  page.tsx, layout.tsx, globals.css
  components/
    Designer.tsx              # top-level state container
    TopBar.tsx, Logo.tsx, Section.tsx, Icons.tsx
    DesignSource.tsx          # tabbed wrapper: Upload | Generate
    DesignGenerator.tsx       # generator UI (random / balanced / D-optimal)
    CsvUpload.tsx             # upload + column mapping
    ChoiceTaskTable.tsx       # per-task preview
    ValidationPanel.tsx
    ExportButtons.tsx
    ProjectHeader.tsx
    editors/
      ProjectInfoEditor.tsx
      AlternativesEditor.tsx
      AttributesEditor.tsx
      ConstraintsEditor.tsx
      Field.tsx               # shared field wrapper
lib/
  schema.ts                   # all data types
  example.ts                  # default project (EU urban commute)
  defaults.ts, slug.ts, persist.ts
  validation.ts               # dominance / balance / correlation / overlap
  constraints.ts              # forbidden-combination engine
  designGenerator.ts          # random + balanced + dispatch
  dOptimal.ts                 # D-optimal core (Federov, MNL Fisher info)
  linalg.ts                   # det() via LU decomposition
  sampleSize.ts               # target-sample power analysis
  csvImport.ts                # CSV parsing + auto-detect
  qualtricsExport.ts          # TXT + QSF generators
scripts/
  runValidation.ts, runExport.ts, runPreview.ts, runGenerate.ts, runConstraints.ts
docs/
  pivot-designs.md            # spec for deferred feature
out/
  sample-design.csv           # drop into the upload zone to test the import flow
  preview.html, eu-urban-commute.{txt,qsf}  # CLI script outputs
```

## Status

MVP. The four spec must-haves are shipped:
- ✅ CSV upload + column mapping
- ✅ Choice-task builder & preview
- ✅ Qualtrics export (TXT + QSF)
- ✅ Basic validation

Beyond MVP:
- ✅ D-optimal generator with priors
- ✅ Balanced search baseline
- ✅ Constraint-based generation
- ✅ Sample-size driven workflow
- ⏳ Pivot designs (spec drafted in [docs/pivot-designs.md](docs/pivot-designs.md), not yet implemented)
- ⏳ Per-respondent customization at survey time

## Terminology

Aligned to the Wang, Thorhauge, Walker & Ben-Akiva tradition (MIT/Berkeley discrete-choice):
**choice task** (single scenario), **alternative** (option in a task), **attribute** (variable describing alternatives), **level** (attribute value), **block** (subset of choice tasks shown to one respondent), **stated choice experiment** (the full instrument).

## License

MIT.
