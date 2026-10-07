'use client'

import type {
  Attribute,
  AttributeType,
  DisplayFormat,
  PivotMode,
  PreferenceDirection,
} from '@/lib/schema'
import type { AltIdentity } from '@/lib/altIdentity'
import { altStyle } from '@/lib/altIdentity'
import { paramCount, priorLabels } from '@/lib/dOptimal'
import { formatNumeric } from '@/lib/format'
import { changeAttributeType } from '@/lib/typeChange'
import { defaultToken, tokenFor } from '@/lib/wiringGuide'
import { AltGlyph, Button, Checkbox, Field, Input, NumberInput, Seg, Select, cx } from '../../ui'
import ImageUrlInput from '../ImageUrlInput'
import { LevelsTable, H4, type PriorColumn } from './LevelsTable'
import { PerAltLevels } from './PerAltLevels'
import { TrashIcon } from './icons'
import { PREF_TEXT, trueMinus } from './model'
import { appliesTo, toggleApplies } from './AttributeRow'

const TYPES: { value: AttributeType; label: string }[] = [
  { value: 'numeric', label: 'Numeric' },
  { value: 'categorical', label: 'Categorical' },
  { value: 'boolean', label: 'Boolean' },
]

const FORMATS: { value: DisplayFormat; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'duration', label: 'Duration' },
]

const DIRECTIONS: PreferenceDirection[] = ['lower', 'higher', 'none']

const PIVOT_OPTIONS: { value: PivotMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'absolute', label: 'Delta (+Δ)' },
  { value: 'relative', label: 'Multiplier (×)' },
]

const PIVOT_EXPLAIN: Record<PivotMode, string> = {
  none: 'Levels are absolute values.',
  absolute:
    'Levels are changes added to each respondent’s own value. The wiring guide shows how to pipe that value into Qualtrics and LimeSurvey.',
  relative:
    'Levels are multipliers of each respondent’s own value. The wiring guide shows how to pipe that value into Qualtrics and LimeSurvey.',
}

function AppliesEditor({
  attribute,
  active,
  labeled,
  onUpdate,
}: {
  attribute: Attribute
  active: AltIdentity[]
  labeled: boolean
  onUpdate: (changes: Partial<Attribute>) => void
}) {
  const all = attribute.appliesTo === 'all'
  const excluded = active.filter((a) => !appliesTo(attribute, a.altId))

  if (!labeled) {
    return (
      <div>
        <h4 className={H4}>Applies to</h4>
        <p className="text-13 text-ink-3">Unlabeled experiment: every attribute applies to all alternatives.</p>
        {excluded.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-12 text-ink-2">
              This attribute is still limited to {active.length - excluded.length} of {active.length} alternatives
              from a labeled setup.
            </p>
            <Button size="sm" onClick={() => onUpdate({ appliesTo: 'all' })}>
              Apply to all
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h4 className={H4}>Applies to</h4>
      <Checkbox
        checked={all}
        onChange={(checked) => onUpdate({ appliesTo: checked ? 'all' : active.map((a) => a.altId) })}
        label="All alternatives, including ones added later"
      />
      {active.length === 0 ? (
        <p className="mt-2 text-13 text-ink-3">No alternatives yet.</p>
      ) : (
        <div role="group" aria-label="Alternatives" className="mt-3 flex flex-wrap gap-1.5">
          {active.map((id) => {
            const on = appliesTo(attribute, id.altId)
            return (
              <button
                key={id.altId}
                type="button"
                aria-pressed={on}
                onClick={() => onUpdate({ appliesTo: toggleApplies(attribute, active, id.altId) })}
                style={altStyle(id)}
                className={cx(
                  'focus-ring inline-flex h-7 max-w-full items-center gap-1.5 rounded-pill px-2.5 text-13 font-medium transition-colors',
                  on
                    ? 'bg-alt-tint-8 text-ink shadow-[inset_0_0_0_1px_rgb(var(--alt)/0.45)]'
                    : 'text-ink-3 shadow-[inset_0_0_0_1px_rgb(var(--line-2))] hover:text-ink-2',
                )}
              >
                <AltGlyph identity={id} size={12} ghost={!on} />
                <span className="truncate">{id.label}</span>
              </button>
            )
          })}
        </div>
      )}
      {!all && active.length > 0 && excluded.length === active.length && (
        <p className="mt-2 text-12 font-medium text-caution">Applies to no alternative. Select at least one.</p>
      )}
    </div>
  )
}

function PivotEditor({
  attribute,
  onUpdate,
}: {
  attribute: Attribute
  onUpdate: (changes: Partial<Attribute>) => void
}) {
  const pivot = attribute.pivot
  const mode: PivotMode = pivot?.mode ?? 'none'

  const setMode = (newMode: PivotMode) => {
    if (newMode === 'none') {
      onUpdate({ pivot: { mode: 'none' } })
    } else {
      onUpdate({
        pivot: {
          mode: newMode,
          previewReference: pivot?.previewReference ?? 1,
          // Left unset by default, so the token follows the attribute's name.
          referenceToken: pivot?.referenceToken,
        },
      })
    }
  }

  const ref = pivot?.previewReference
  return (
    <div>
      <h4 className={H4}>Pivot on the respondent&rsquo;s own value</h4>
      <Seg ariaLabel="Pivot mode" options={PIVOT_OPTIONS} value={mode} onChange={setMode} className="max-w-full flex-wrap" />
      <p className="mt-2 text-12 text-ink-3">{PIVOT_EXPLAIN[mode]}</p>
      {mode !== 'none' && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field
            label="Reference token"
            hint={
              pivot?.referenceToken && tokenFor(attribute) !== pivot.referenceToken.trim()
                ? `Written ${tokenFor(attribute)}: letters and digits only, starting with a letter.`
                : 'The LimeSurvey question code and Qualtrics embedded-data name the wiring guide uses.'
            }
          >
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                mono
                value={pivot?.referenceToken ?? ''}
                placeholder={defaultToken(attribute)}
                onChange={(e) =>
                  onUpdate({
                    pivot: { ...(pivot ?? { mode }), mode, referenceToken: e.target.value || undefined },
                  })
                }
              />
            )}
          </Field>
          <Field
            label="Preview reference"
            hint={
              ref !== undefined
                ? `Shown as ${trueMinus(formatNumeric(ref, attribute.unit, attribute.displayFormat))} in the preview and exports.`
                : 'Resolves the levels in the preview and exports.'
            }
          >
            {(id, describedBy) => (
              <NumberInput
                id={id}
                aria-describedby={describedBy}
                emptyBehavior="clear"
                value={ref}
                placeholder={mode === 'relative' ? 'e.g. 5.0' : 'e.g. 30'}
                onValueChange={(v) =>
                  onUpdate({ pivot: { ...(pivot ?? { mode }), mode, previewReference: v } })
                }
                className="tnum"
              />
            )}
          </Field>
        </div>
      )}
    </div>
  )
}

export function AttributeDetail({
  id,
  attribute,
  active,
  labeled,
  autoFocusName,
  onUpdate,
  onRemove,
}: {
  id: string
  attribute: Attribute
  active: AltIdentity[]
  labeled: boolean
  autoFocusName: boolean
  onUpdate: (changes: Partial<Attribute>) => void
  onRemove: () => void
}) {
  const isNumeric = attribute.type === 'numeric'
  const name = attribute.name.trim() || 'Untitled attribute'
  const k = paramCount(attribute)
  const labels = priorLabels(attribute)
  const priorValues = Array.from({ length: k }, (_, i) => attribute.priors?.[i] ?? 0)
  const setPrior = (i: number, v: number) => {
    const next = [...priorValues]
    next[i] = v
    onUpdate({ priors: next })
  }
  const perLevelPriors = attribute.type === 'categorical' && attribute.levels.length >= 2
  const priorColumn: PriorColumn | null = perLevelPriors ? { values: priorValues, labels, set: setPrior } : null
  const priorHint =
    attribute.type === 'numeric'
      ? 'Per unit of the level value, for the D-efficient search. Leave at 0 if unknown.'
      : `${labels[0] && labels[0] !== '—' ? `${labels[0]}. ` : ''}Used by the D-efficient search; leave at 0 if unknown.`

  const confirmRemove = () => {
    if (window.confirm(`Remove the attribute “${name}” and its levels? This cannot be undone.`)) onRemove()
  }

  return (
    <div id={id} role="group" aria-label={`${name} settings`} className="space-y-7 px-4 pb-5 pt-2 xl:pl-[38px]">
      <div className="grid gap-x-8 gap-y-7 md:grid-cols-2">
        <div className="min-w-0">
          <h4 className={H4}>Definition</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" className="col-span-2">
              {(fid, describedBy) => (
                <Input
                  id={fid}
                  aria-describedby={describedBy}
                  value={attribute.name}
                  placeholder="Attribute name"
                  autoFocus={autoFocusName}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Type">
              {(fid) => (
                <Select
                  id={fid}
                  value={attribute.type}
                  onChange={(e) => onUpdate(changeAttributeType(attribute, e.target.value as AttributeType))}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Unit" optional>
              {(fid) => (
                <Input
                  id={fid}
                  value={attribute.unit ?? ''}
                  placeholder="e.g. min, EUR, %"
                  onChange={(e) => onUpdate({ unit: e.target.value || undefined })}
                />
              )}
            </Field>
            {isNumeric && (
              <Field label="Display format">
                {(fid) => (
                  <Select
                    id={fid}
                    value={attribute.displayFormat ?? 'plain'}
                    onChange={(e) => {
                      const v = e.target.value as DisplayFormat
                      onUpdate({ displayFormat: v === 'plain' ? undefined : v })
                    }}
                  >
                    {FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {!perLevelPriors && (
              <Field label="Prior β" optional className={isNumeric ? undefined : 'col-span-2'} hint={priorHint}>
                {(fid, describedBy) => (
                  <NumberInput
                    id={fid}
                    aria-describedby={describedBy}
                    step={0.1}
                    emptyBehavior={0}
                    value={priorValues[0]}
                    onValueChange={(v) => setPrior(0, v)}
                    className="tnum font-mono"
                  />
                )}
              </Field>
            )}
            <Field
              label="Preference direction"
              className="col-span-2"
              hint="Used by the dominance check. For a categorical attribute it follows the level order."
            >
              {(fid, describedBy) => (
                <Select
                  id={fid}
                  aria-describedby={describedBy}
                  value={attribute.preferenceDirection ?? 'none'}
                  onChange={(e) => onUpdate({ preferenceDirection: e.target.value as PreferenceDirection })}
                >
                  {DIRECTIONS.map((d) => (
                    <option key={d} value={d}>
                      {PREF_TEXT[d]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Image"
              optional
              className="col-span-2"
              hint="Shown next to the attribute name in the preview and exports."
            >
              {(fid) => (
                <div className="min-w-0">
                  <ImageUrlInput
                    id={fid}
                    name={name}
                    value={attribute.imageUrl}
                    onChange={(v) => onUpdate({ imageUrl: v })}
                    size={28}
                  />
                </div>
              )}
            </Field>
          </div>
        </div>

        <div className="min-w-0 space-y-7">
          <AppliesEditor attribute={attribute} active={active} labeled={labeled} onUpdate={onUpdate} />
          {isNumeric && <PivotEditor attribute={attribute} onUpdate={onUpdate} />}
        </div>
      </div>

      <LevelsTable attribute={attribute} onUpdate={onUpdate} priors={priorColumn} active={active} />

      {isNumeric && <PerAltLevels attribute={attribute} active={active} onUpdate={onUpdate} />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-12 text-ink-3">
          <span className="font-mono">{attribute.id}</span> · {k} {k === 1 ? 'parameter' : 'parameters'} in the
          utility function
        </p>
        <Button variant="danger" size="sm" icon={<TrashIcon />} onClick={confirmRemove}>
          Remove attribute
        </Button>
      </div>
    </div>
  )
}
