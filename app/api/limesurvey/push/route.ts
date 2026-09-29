import type { NextRequest } from 'next/server'
import type { Project } from '@/lib/schema'
import { blockRelevance, buildBlockAssignmentLsq, buildQuestionLsq } from '@/lib/limesurveyExport'

// LimeSurvey RemoteControl 2 (RC2) JSON-RPC client.
// Endpoint: {LS_URL}/index.php/admin/remotecontrol
// Method calls are positional-arg arrays, not named params.
//
// This route runs server-side so:
//  - we avoid CORS (the client never talks to LimeSurvey directly)
//  - the user's password never leaves the request body
//  - we can sequence multiple RPC calls without user-facing latency cost

export const runtime = 'nodejs'
export const maxDuration = 60 // seconds; Vercel-friendly

type RpcResult = { ok: true; result: unknown } | { ok: false; error: string }

async function rpc(
  endpoint: string,
  method: string,
  params: unknown[],
  rpcId = 1,
): Promise<RpcResult> {
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ method, params, id: rpcId }),
    })
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}` }
  }
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status} ${res.statusText}` }
  }
  let body: { result?: unknown; error?: unknown }
  try {
    body = await res.json()
  } catch {
    return { ok: false, error: 'Non-JSON response from LimeSurvey' }
  }
  // RC2 puts errors in `error`, but successful sessions can also return objects
  // with a `status` field embedding errors (e.g. { status: 'Invalid session key' }).
  if (body.error) {
    return {
      ok: false,
      error:
        typeof body.error === 'string' ? body.error : JSON.stringify(body.error),
    }
  }
  if (
    body.result &&
    typeof body.result === 'object' &&
    body.result !== null &&
    'status' in body.result
  ) {
    const status = (body.result as { status: unknown }).status
    if (typeof status === 'string' && status !== 'OK') {
      return { ok: false, error: status }
    }
  }
  return { ok: true, result: body.result ?? null }
}

function endpointFor(url: string): string {
  // Accept both `https://example.com` and `https://example.com/`. Append the
  // standard RC2 path. Users can also pass the full endpoint; we don't double-up.
  const trimmed = url.replace(/\/+$/, '')
  if (trimmed.endsWith('/admin/remotecontrol')) return trimmed
  if (trimmed.includes('/index.php')) return `${trimmed}/admin/remotecontrol`
  return `${trimmed}/index.php/admin/remotecontrol`
}

type PushRequest = {
  url: string
  username: string
  password: string
  surveyId: number
  project: Project
  testOnly?: boolean // if true, just authenticate and return
}

export async function POST(req: NextRequest) {
  let body: PushRequest
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON request body' }, { status: 400 })
  }

  const { url, username, password, surveyId, project, testOnly } = body
  if (!url || !username || !password || !surveyId) {
    return Response.json(
      { ok: false, error: 'url, username, password, surveyId are all required' },
      { status: 400 },
    )
  }

  const endpoint = endpointFor(url)
  const log: string[] = []
  log.push(`Endpoint: ${endpoint}`)

  // ── 1. authenticate ─────────────────────────────────────────────────────
  const session = await rpc(endpoint, 'get_session_key', [username, password])
  if (!session.ok) {
    return Response.json(
      { ok: false, error: `Authentication failed: ${session.error}`, log },
      { status: 200 },
    )
  }
  const sessionKey = session.result as string
  if (typeof sessionKey !== 'string' || sessionKey.length === 0) {
    return Response.json(
      {
        ok: false,
        error: `Authentication failed: unexpected session response`,
        log,
      },
      { status: 200 },
    )
  }
  log.push(`Authenticated as ${username}`)

  if (testOnly) {
    await rpc(endpoint, 'release_session_key', [sessionKey])
    return Response.json({ ok: true, log, message: 'Connection OK' })
  }

  // ── 2. validate survey + design ────────────────────────────────────────
  if (!project.design || project.design.rows.length === 0) {
    await rpc(endpoint, 'release_session_key', [sessionKey])
    return Response.json(
      { ok: false, error: 'Project has no design rows to push', log },
      { status: 200 },
    )
  }

  const sProps = await rpc(endpoint, 'get_survey_properties', [
    sessionKey,
    surveyId,
    ['sid', 'active'],
  ])
  if (!sProps.ok) {
    await rpc(endpoint, 'release_session_key', [sessionKey])
    return Response.json(
      { ok: false, error: `Survey ${surveyId} not accessible: ${sProps.error}`, log },
      { status: 200 },
    )
  }
  log.push(`Survey ${surveyId} verified`)

  // ── 3. block assignment + one group per block ──────────────────────────
  // A hidden equation question (BLK) draws one block per respondent; each block's
  // group is shown only when BLK equals its number. Group names stay neutral in
  // case the survey displays them.
  const numBlocks = project.design.numBlocks
  const fail = async (error: string) => {
    await rpc(endpoint, 'release_session_key', [sessionKey])
    return Response.json({ ok: false, error, log }, { status: 200 })
  }

  if (numBlocks > 1) {
    const addAssign = await rpc(endpoint, 'add_group', [sessionKey, surveyId, 'Block assignment', ''])
    if (!addAssign.ok || typeof addAssign.result !== 'number') {
      return fail(`add_group failed for block assignment: ${addAssign.ok ? 'unexpected response' : addAssign.error}`)
    }
    const lsq = buildBlockAssignmentLsq(numBlocks)
    const imp = await rpc(endpoint, 'import_question', [
      sessionKey,
      surveyId,
      addAssign.result,
      Buffer.from(lsq.xml, 'utf8').toString('base64'),
      'lsq',
    ])
    if (!imp.ok) return fail(`Could not add the block assignment question: ${imp.error}`)
    log.push(`Created block assignment (gid=${addAssign.result}, question ${lsq.questionCode})`)
  }

  const blockGroupIds: Record<number, number> = {}
  for (let b = 1; b <= numBlocks; b++) {
    const add = await rpc(endpoint, 'add_group', [sessionKey, surveyId, 'Choice tasks', ''])
    if (!add.ok || typeof add.result !== 'number') {
      return fail(`add_group failed for block ${b}: ${add.ok ? 'unexpected response' : add.error}`)
    }
    const gid = add.result
    blockGroupIds[b] = gid
    if (numBlocks > 1) {
      const setProps = await rpc(endpoint, 'set_group_properties', [
        sessionKey,
        gid,
        { grelevance: blockRelevance(b) },
      ])
      if (!setProps.ok) {
        return fail(`Could not limit group ${gid} to block ${b}: ${setProps.error}`)
      }
    }
    log.push(`Created group for block ${b} (gid=${gid})`)
  }

  // ── 4. push questions ──────────────────────────────────────────────────
  let questionIndex = 0
  for (const row of project.design.rows) {
    const gid = blockGroupIds[row.block]
    if (!gid) {
      log.push(`(skip) No group for block ${row.block}`)
      continue
    }
    const lsq = buildQuestionLsq(project, row, questionIndex++)
    const importData = Buffer.from(lsq.xml, 'utf8').toString('base64')
    const add = await rpc(endpoint, 'import_question', [sessionKey, surveyId, gid, importData, 'lsq'])
    if (!add.ok) {
      log.push(
        `  (failed) ${lsq.questionTitle} (${lsq.questionCode}): ${add.error}`,
      )
      // Continue — partial success is more useful than total failure
      continue
    }
    log.push(`  ✓ ${lsq.questionTitle} (${lsq.questionCode}) → qid=${add.result}`)
  }

  // ── 5. release session ─────────────────────────────────────────────────
  await rpc(endpoint, 'release_session_key', [sessionKey])
  log.push('Session released')

  return Response.json({
    ok: true,
    log,
    message: `Pushed ${project.design.rows.length} choice tasks across ${project.design.numBlocks} block(s) to survey ${surveyId}.`,
  })
}
