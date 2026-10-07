# Pivot Designs — Spec Notes

Status: static pivots and the wiring guide are implemented; automatic per-respondent piping in the exports, the reference alternative, categorical pivots and range clamping are still deferred. The sections from "What" onwards are the original spec notes, kept so the deferred parts can be picked up without re-deciding.

## Current state

### Implemented

- **Per-attribute pivot mode** `none | absolute | relative` on numeric attributes (`AttributePivot` in `lib/schema.ts`; edited in 01 Structure). Levels of a pivoted attribute are offsets from (`absolute`) or multipliers of (`relative`) a reference value.
- **Preview reference.** Each pivoted attribute carries a fixed `previewReference`. `resolvePivotValue` and `levelDisplayText` in `lib/format.ts` resolve every level against it (`reference + offset` or `reference × multiplier`) and append the change in brackets. The choice-task preview and the Qualtrics (TXT, QSF) and LimeSurvey (LSS, push) exports all render levels through this one function, so they show the same resolved values to every respondent. The Sawtooth CSV carries level positions and is unaffected.
- **Wiring guide** (`lib/wiringGuide.ts`). A Markdown file, offered in 05 Export when the study has pivoted attributes with a preview reference, that lists each pivoted attribute's reference token (`referenceToken`, default `REF_<ATTRIBUTE_ID>`) and, per level, the Qualtrics piped-text or LimeSurvey Expression Manager expression to substitute for the preview value. The Qualtrics TXT export also opens with a setup-notes block pointing to it. The guide covers an attribute's default levels; per-alternative level overrides are not listed.
- **Generators, D-error, diagnostics and constraints are unchanged.** They work on level IDs and on the level values as entered (the offsets or multipliers), not on resolved values.

### Still deferred

- **Automatic per-respondent piping in the exports.** The exported files contain the resolved preview values; replacing them with piped expressions is done by hand in the survey platform, following the wiring guide.
- **Reference alternative.** No alternative can be marked as the reference (there is no `referenceAlternativeId`), so no alternative is shown at the respondent's unmodified values.
- **Categorical pivots** (ordinal step moves). Only numeric attributes can pivot.
- **Range clamping** of resolved values.

The schema that shipped differs from the sketch below: `pivot` holds `mode`, `previewReference` and `referenceToken` (not `reference`).

## What

A pivot design encodes choice tasks as **deltas relative to a reference state**, not absolute attribute levels. The reference is typically the respondent's current behavior ("your current commute") or a designated status-quo alternative.

Instead of "Bus: 30 min, $5, Med comfort", a respondent sees "Bus: 5 min faster than now, $2 more, same comfort."

## Why

1. **Behavioral realism** — anchored scenarios reduce hypothetical bias.
2. **Per-respondent customization** — same design, resolved to each respondent's reality.
3. **Reference effects** — choices framed as gains/losses from a reference are not the same as choices in absolutes (loss aversion, status-quo bias).

Common in transport, health (plan switching), energy (tariff switching).

## Two flavors

- **Per-respondent pivot** — reference values come from the respondent (captured upstream in the survey). Survey platform substitutes their numbers at runtime. *Canonical use case.*
- **Class-based / fixed pivot** — one representative reference baked in at design time. Simpler, no per-respondent customization.

## Decisions that drive implementation

1. **Reference resolution time.** Design time (one fixed reference) is simple. Survey time (per-respondent via Qualtrics piped text) is the real value but substantial integration work.
2. **Delta type per attribute.** Absolute (`-5 min, 0, +5 min`) vs relative multiplier (`0.8×, 1.0×, 1.2×`). Real designs need both — typically time absolute, cost relative.
3. **Categorical attributes.** Pivots don't naturally apply ("+20% Comfort" is meaningless). Three options: skip pivots for categoricals, treat as ordinal step moves, or disallow categoricals in pivots.
4. **Reference alternative.** Convention: one of the existing alternatives is marked as reference. Could also support a "ghost" reference that's never shown.
5. **Constraint + pivot interaction.** Constraints likely on absolute values; pivots produce relative values. Constraint evaluation needs to use *resolved* absolutes.
6. **Renderer.** Show resolved absolute only? Resolved + delta in subtext? Reference values alongside?

## Recommended MVP scope

### In scope

- One alternative marked as the *reference* (existing alts; user picks).
- Per-attribute *pivot mode*: `none | absolute | relative`. Default `none` so existing projects unaffected.
- Per-attribute *reference value* (single number/string, baked in at design time).
- Levels under pivot mode are interpreted as **deltas** (absolute or multiplicative). Renderer shows resolved values.
- Only numeric attributes can pivot; categorical/boolean stay absolute.
- Generators (random / balanced / D-efficient) unchanged — they pick level IDs, resolution happens at render/export time.
- Constraints evaluate on level IDs as today.

### Deferred to v2

- **Per-respondent customization** via Qualtrics piped-text emission.
- **Categorical pivots** (ordinal step moves).
- **Range clamping** of resolved values.

### Time estimate

Roughly 1 day. Schema additions, attribute editor extension, renderer update, export update.

## Schema additions (sketch)

```ts
type Project = {
  ...
  referenceAlternativeId?: string  // alt id, must be active
}

type Attribute = {
  ...
  pivot?: {
    mode: 'none' | 'absolute' | 'relative'
    reference?: number  // baked-in reference value (numeric attrs only for v1)
  }
}

// Levels are interpreted differently based on pivot mode:
//   - 'none':     level.value is the absolute attribute value
//   - 'absolute': level.value is a delta from pivot.reference
//   - 'relative': level.value is a multiplier (1.0 = no change)
```

## UI changes

- **ProjectInfoEditor**: dropdown "Reference alternative" (none / Car / Bus / …).
- **AttributesEditor card**: when expanded, "Pivot mode" picker + "Reference value" field (numeric only).
- **LevelsEditor**: when pivot mode is set, show level value with sign affordance ("−5", "+5") and a small computed-resolved hint ("→ 25 min"). Reference column shows the unmodified reference value.

## Renderer changes

- **ChoiceTaskTable**: when an attribute has pivot mode set, render the *resolved* absolute value for non-reference alternatives (`reference + delta` or `reference × delta`), and the unmodified `reference` for the reference alternative. Optionally show delta in small subtext.

## Export changes

- **TXT/QSF**: bake in resolved absolute values (single reference shared across respondents). MVP path.
- **v2**: emit Qualtrics with piped-text placeholders (`${e://Field/current_cost}`) so the survey resolves per-respondent. Requires the survey platform to capture reference values upstream.

## Open questions to settle before coding

1. Design-time vs survey-time resolution for v1? *Lean: design-time.*
2. Both absolute and relative delta types per attribute? *Lean: yes.*
3. Skip categorical pivots in v1? *Lean: yes.*
4. Renderer shows resolved value only, or with delta? *Lean: resolved value with delta in tooltip/subtext.*
