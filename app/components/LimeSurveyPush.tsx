'use client'

import { useState } from 'react'
import type { Project } from '@/lib/schema'
import { buildSurveyLss } from '@/lib/limesurveyExport'
import { joinNames, plural } from '@/lib/text'
import { useLatestProject, type SetProject } from './ProjectStore'
import { Button, Field, Input, Panel, Tag, cx } from './ui'
import { Check, Download, Upload, XMark } from './Icons'
import { downloadBlob } from './export/download'
import { useProgress } from './shell/Progress'

type Status =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'pushing' }
  | { kind: 'ok'; message: string; log: string[] }
  | { kind: 'error'; message: string; log?: string[] }

export default function LimeSurveyPush({
  project,
  setProject,
  onClose,
}: {
  project: Project
  setProject: SetProject
  /** Shows a Close button in the panel header when set. */
  onClose?: () => void
}) {
  const ls = project.limesurvey ?? {}
  const [url, setUrl] = useState(ls.url ?? '')
  const [username, setUsername] = useState(ls.username ?? '')
  const [password, setPassword] = useState('')
  const [surveyId, setSurveyId] = useState<string>(ls.surveyId ? String(ls.surveyId) : '')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const getProject = useLatestProject()
  const { markReviewed } = useProgress()

  const persist = () => {
    setProject((p) => ({
      ...p,
      limesurvey: {
        url: url.trim() || undefined,
        username: username.trim() || undefined,
        surveyId: surveyId.trim() ? Number(surveyId) : undefined,
      },
      updatedAt: new Date().toISOString(),
    }))
  }

  const hasDesign = !!project.design && project.design.rows.length > 0
  const canSubmit = url.trim() && username.trim() && password.trim() && surveyId.trim() && hasDesign
  const busy = status.kind === 'testing' || status.kind === 'pushing'
  const canTest = !!url && !!username && !!password && !busy

  const callApi = async (testOnly: boolean) => {
    persist()
    setStatus({ kind: testOnly ? 'testing' : 'pushing' })
    try {
      const res = await fetch('/api/limesurvey/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          username: username.trim(),
          password,
          surveyId: Number(surveyId),
          project: getProject(),
          testOnly,
        }),
      })
      const body = await res.json()
      if (body.ok) {
        if (!testOnly) markReviewed('export')
        setStatus({
          kind: 'ok',
          message: body.message ?? (testOnly ? 'Connection OK' : 'Push complete'),
          log: body.log ?? [],
        })
      } else {
        setStatus({ kind: 'error', message: body.error ?? 'Unknown error', log: body.log })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }

  const downloadLss = () => {
    const latest = getProject()
    if (!latest.design) return
    downloadBlob(buildSurveyLss(latest), `${latest.slug}.lss`, 'application/xml')
    markReviewed('export')
  }

  const missing = [
    !url.trim() && 'URL',
    !surveyId.trim() && 'survey ID',
    !username.trim() && 'username',
    !password.trim() && 'password',
  ].filter((m): m is string => !!m)

  const summary = !hasDesign
    ? 'No design to push. Generate or upload one first.'
    : missing.length > 0
      ? `Enter the ${joinNames(missing)} to push.`
      : `Will push ${plural(project.design!.rows.length, 'choice task')} across ${plural(project.design!.numBlocks, 'block')}.`

  return (
    <Panel
      title="Push to LimeSurvey"
      actions={
        <>
          <Tag tone="muted">Beta</Tag>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </>
      }
    >
      <p className="-mt-2 max-w-[70ch] text-13 text-ink-3">
        Pushes choice tasks to an existing LimeSurvey instance via RemoteControl 2. The password is
        sent only with this request and never stored.
      </p>

      <form
        className="mt-4"
        aria-busy={busy}
        onSubmit={(e) => e.preventDefault()}
        aria-label="LimeSurvey credentials"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LimeSurvey URL" hint="Base URL of your installation, for example https://survey.example.com.">
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="url"
                inputMode="url"
                required
                autoComplete="url"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={persist}
                placeholder="https://survey.example.com"
              />
            )}
          </Field>
          <Field label="Survey ID" hint="Numeric ID of the target survey.">
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="number"
                inputMode="numeric"
                mono
                required
                value={surveyId}
                onChange={(e) => setSurveyId(e.target.value)}
                onBlur={persist}
                placeholder="123456"
              />
            )}
          </Field>
          <Field label="Username">
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={persist}
              />
            )}
          </Field>
          <Field label="Password" hint="Not stored.">
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4">
          <Button onClick={() => callApi(true)} disabled={!canTest}>
            {status.kind === 'testing' ? 'Testing…' : 'Test connection'}
          </Button>
          <Button icon={<Upload />} onClick={() => callApi(false)} disabled={!canSubmit || busy}>
            {status.kind === 'pushing' ? 'Pushing…' : 'Push to LimeSurvey'}
          </Button>
          <span className="text-13 text-ink-3 sm:ml-auto">{summary}</span>
        </div>
      </form>

      <div aria-live="polite" className="empty:hidden">
        {(status.kind === 'ok' || status.kind === 'error') && (
          <div
            className={cx(
              'mt-4 rounded-card border p-3 text-13',
              status.kind === 'ok' ? 'border-ok/30 bg-ok-bg' : 'border-risk/30 bg-risk-bg',
            )}
          >
            <p
              className={cx(
                'inline-flex items-center gap-1.5 font-semibold',
                status.kind === 'ok' ? 'text-ok' : 'text-risk',
              )}
            >
              {status.kind === 'ok' ? <Check size={13} /> : <XMark size={13} />}
              {status.kind === 'ok' ? 'Success' : 'Error'}
            </p>
            <p className="mt-1 break-words leading-snug text-ink">{status.message}</p>
            {status.log && status.log.length > 0 && (
              <details className="mt-2 text-12">
                <summary className="focus-ring cursor-pointer rounded-bar text-ink-2 hover:text-ink">
                  Log ({plural(status.log.length, 'line')})
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-well border border-line bg-surface p-2 font-mono text-12 leading-relaxed text-ink">
                  {status.log.join('\n')}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-card bg-surface-2 p-3 shadow-hairline sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-13 font-medium text-ink">Fallback: download the LSS file</p>
          <p className="mt-0.5 text-12 text-ink-3">
            If your LimeSurvey server isn’t reachable from this app, or you prefer a manual import,
            download a complete LSS and import it via Survey settings → Import.
          </p>
        </div>
        <Button size="sm" icon={<Download />} onClick={downloadLss} disabled={!hasDesign}>
          Download .lss
        </Button>
      </div>
    </Panel>
  )
}
