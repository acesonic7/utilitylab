'use client'

import { plural } from '@/lib/text'
import { useDesignHealth } from '../DesignHealth'
import { Info } from '../Icons'
import { useWorkspaceActions } from '../Workspace'
import { Button, cx } from '../ui'

export const DESIGN_FIT_NOTICE_ID = 'design-fit-notice'

/**
 * Shown wherever the design is used once the structure has been edited so that the design no
 * longer fits it: the cells it lists are blank or wrong in the preview, the checks and every export.
 */
export function DesignFitNotice({ context, className }: { context: 'design' | 'use'; className?: string }) {
  const { fit } = useDesignHealth()
  const { goTo } = useWorkspaceActions()
  if (!fit) return null

  const scope =
    fit.affectedRows === fit.totalRows
      ? `every choice task`
      : `${plural(fit.affectedRows, 'choice task')} of ${fit.totalRows}`
  const consequence =
    context === 'design'
      ? 'Generate the design again, or upload a design for the current structure.'
      : 'Respondents would see blank cells, and the checks and D-error do not describe what they would see. Generate the design again before you export it.'

  return (
    <div
      id={context === 'use' ? DESIGN_FIT_NOTICE_ID : undefined}
      role="alert"
      className={cx('mb-4 flex flex-col gap-3 rounded-card border border-risk/30 bg-risk-bg px-4 py-3 sm:flex-row sm:items-start', className)}
    >
      <div className="flex min-w-0 flex-1 gap-2">
        <Info size={14} className="mt-[3px] shrink-0 text-risk" />
        <div className="min-w-0 text-13 text-ink-2">
          <p className="font-semibold text-risk">
            The design no longer matches the structure ({scope}).
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {fit.issues.map((issue) => (
              <li key={issue.kind}>{issue.message}</li>
            ))}
          </ul>
          <p className="mt-1">{consequence}</p>
        </div>
      </div>
      <Button size="sm" className="shrink-0 self-start" onClick={() => goTo('design', { panel: 'generate' })}>
        Generate again
      </Button>
    </div>
  )
}
