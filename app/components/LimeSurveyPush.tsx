'use client'

import { useState } from 'react'
import type { Project } from '@/lib/schema'
import { buildSurveyLss } from '@/lib/limesurveyExport'
import Field, { inputCls } from './editors/Field'
import { Check, Download, Upload, XMark } from './Icons'

type Status =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'pushing' }
  | { kind: 'ok'; message: string; log: string[] }
  | { kind: 'error'; message: string; log?: string[] }

export default function LimeSurveyPush({
  project,
  setProject,
}: {
  project: Project
  setProject: (p: Project) => void
}) {
  const ls = project.limesurvey ?? {}
  const [url, setUrl] = useState(ls.url ?? '')
  const [username, setUsername] = useState(ls.username ?? '')
  const [password, setPassword] = useState('')
  const [surveyId, setSurveyId] = useState<string>(
    ls.surveyId ? String(ls.surveyId) : '',
  )
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const persist = () => {
    setProject({
      ...project,
      limesurvey: {
        url: url.trim() || undefined,
        username: username.trim() || undefined,
        surveyId: surveyId.trim() ? Number(surveyId) : undefined,
      },
      updatedAt: new Date().toISOString(),
    })
  }

  const hasDesign = !!project.design && project.design.rows.length > 0
  const canSubmit =
    url.trim() && username.trim() && password.trim() && surveyId.trim() && hasDesign

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
          project,
          testOnly,
        }),
      })
      const body = await res.json()
      if (body.ok) {
        setStatus({
          kind: 'ok',
          message: body.message ?? (testOnly ? 'Connection OK' : 'Push complete'),
          log: body.log ?? [],
        })
      } else {
        setStatus({
          kind: 'error',
          message: body.error ?? 'Unknown error',
          log: body.log,
        })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }

  const downloadLss = () => {
    if (!project.design) return
    const xml = buildSurveyLss(project)
    const blob = new Blob([xml], { type: 'application/xml' })
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u
    a.download = `${project.slug}.lss`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(u)
  }

  const busy = status.kind === 'testing' || status.kind === 'pushing'

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-200/60 shadow-sm p-5 space-y-5">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          LimeSurvey credentials
        </h3>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          Pushes choice tasks to an existing LimeSurvey instance via RemoteControl 2.
          The password is sent only with this request and never stored.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="LimeSurvey URL"
          required
          hint="Base URL of your installation (e.g. https://survey.example.com)."
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={persist}
            placeholder="https://survey.example.com"
            className={inputCls}
          />
        </Field>
        <Field label="Survey ID" required hint="Numeric ID of the target survey.">
          <input
            type="number"
            value={surveyId}
            onChange={(e) => setSurveyId(e.target.value)}
            onBlur={persist}
            placeholder="123456"
            className={`${inputCls} font-mono`}
          />
        </Field>
        <Field label="Username" required>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={persist}
            autoComplete="username"
            className={inputCls}
          />
        </Field>
        <Field label="Password" required hint="Not stored.">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-3 pt-2 border-t border-neutral-100">
        <button
          onClick={() => callApi(true)}
          disabled={!url || !username || !password || busy}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md ring-1 ring-neutral-200 text-sm hover:bg-neutral-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Test connection
        </button>
        <button
          onClick={() => callApi(false)}
          disabled={!canSubmit || busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Upload size={14} />
          {status.kind === 'pushing' ? 'Pushing…' : 'Push to LimeSurvey'}
        </button>
        <span className="ml-auto text-xs text-neutral-500 self-center">
          {hasDesign
            ? `Will push ${project.design!.rows.length} choice tasks across ${project.design!.numBlocks} block(s).`
            : 'No design to push. Generate or upload one first.'}
        </span>
      </div>

      {(status.kind === 'ok' || status.kind === 'error') && (
        <div
          className={`rounded-lg ring-1 border-l-4 p-3 text-sm ${
            status.kind === 'ok'
              ? 'bg-emerald-50/70 ring-emerald-200 border-emerald-400 text-emerald-900'
              : 'bg-red-50/70 ring-red-200 border-red-400 text-red-900'
          }`}
        >
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold inline-flex items-center gap-1.5">
              {status.kind === 'ok' ? <Check size={13} /> : <XMark size={13} />}
              {status.kind === 'ok' ? 'Success' : 'Error'}
            </span>
          </div>
          <div className="leading-snug mb-2">{status.message}</div>
          {status.log && status.log.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer opacity-80 hover:opacity-100">
                Log ({status.log.length} line{status.log.length !== 1 ? 's' : ''})
              </summary>
              <pre className="mt-2 bg-white/60 ring-1 ring-current/10 rounded p-2 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">
                {status.log.join('\n')}
              </pre>
            </details>
          )}
        </div>
      )}

      <div className="rounded-lg ring-1 ring-neutral-200 bg-neutral-50/40 p-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-neutral-700">Fallback: download LSS file</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            If your LimeSurvey isn&apos;t reachable from this server, or you prefer
            manual import, download a complete LSS and import via Survey settings →
            Import.
          </div>
        </div>
        <button
          onClick={downloadLss}
          disabled={!hasDesign}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Download size={12} />
          Download .lss
        </button>
      </div>
    </div>
  )
}
