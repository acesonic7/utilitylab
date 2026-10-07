import type { NextRequest } from 'next/server'
import type { Project } from '@/lib/schema'
import { blockRelevance, buildBlockAssignmentLsq, buildQuestionLsq } from '@/lib/limesurveyExport'
import { exportBlocks } from '@/lib/blocks'
import { openRc2, rc2Id, resolveTarget, type Rc2Client, type Rc2Failure, type Rc2Result } from '@/lib/limesurveyRc2'
import { PRIVATE_NAME_MESSAGE, checkPushUrl, isSameOriginRequest } from '@/lib/limesurveyTarget'

// Pushes choice tasks to LimeSurvey through RemoteControl 2 (RC2).
// Endpoint: {LS_URL}/index.php/admin/remotecontrol
//
// This route runs server-side so:
//  - we avoid CORS (the client never talks to LimeSurvey directly)
//  - the user's password never leaves the request body
//  - we can sequence multiple RPC calls without user-facing latency cost
//
// It makes requests to a URL the caller supplies and has no authentication, so
// it is guarded against server-side request forgery: the URL and every address
// it resolves to are checked (lib/limesurveyTarget.ts), connections are pinned
// to the checked addresses and never follow redirects (lib/limesurveyRc2.ts),
// sizes and time are capped, and upstream error text is not passed on.

export const runtime = 'nodejs'
export const maxDuration = 60 // seconds; Vercel-friendly

const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_DESIGN_ROWS = 500
const MAX_BLOCKS = 50
const MAX_USERNAME_LENGTH = 256
const MAX_PASSWORD_LENGTH = 1024
const RPC_TIMEOUT_MS = 15_000
// Total time for upstream calls, kept under maxDuration so the caller gets an answer.
const PUSH_BUDGET_MS = 50_000
const RELEASE_TIMEOUT_MS = 3_000

const targetPolicy = () => ({
  // Plain http only off the public deployment (self-hosted, local development).
  allowHttp: !process.env.VERCEL,
  // Loopback and private-network servers only when the host opts in.
  allowPrivate: process.env.LIMESURVEY_PUSH_ALLOW_PRIVATE === '1',
})

// Fixed wording per failure; nothing the upstream server sent is included.
const FAILURE_TEXT: Record<Rc2Failure, string> = {
  unreachable:
    'the LimeSurvey server could not be reached. Check the URL, and that the server is online and reachable from the internet',
  'not-limesurvey':
    'the server at that URL did not answer as LimeSurvey RemoteControl 2. Check the URL, and that the JSON-RPC interface is switched on in LimeSurvey (Global settings → Interfaces)',
  credentials: 'LimeSurvey did not accept the username or password',
  'locked-out': 'LimeSurvey is refusing logins for now after too many failed attempts. Wait a few minutes and try again',
  session: 'LimeSurvey ended the session',
  permission: 'this LimeSurvey user does not have permission',
  survey: 'LimeSurvey has no survey with that ID',
  active: 'the survey is active, and LimeSurvey does not allow changes to an active survey',
  rejected: 'LimeSurvey rejected the request',
}

const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}.`

type PushRequest = {
  url: string
  username: string
  password: string
  surveyId: number
  project: Project
  testOnly?: boolean // if true, just authenticate and return
}

function refuse(status: number, error: string) {
  return Response.json({ ok: false, error }, { status })
}

// The request body as text, or null if it is larger than `limit` bytes.
async function readBody(req: NextRequest, limit: number): Promise<string | null> {
  if (Number(req.headers.get('content-length') ?? 0) > limit) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function POST(req: NextRequest) {
  // ── 0. who is asking, and for what ──────────────────────────────────────
  const sameOrigin = isSameOriginRequest({
    secFetchSite: req.headers.get('sec-fetch-site'),
    origin: req.headers.get('origin'),
    hosts: [req.headers.get('host'), req.headers.get('x-forwarded-host')],
  })
  if (!sameOrigin) {
    return refuse(403, 'This route only accepts requests from the UtilityLab app itself.')
  }
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return refuse(415, 'Invalid JSON request body')
  }

  const text = await readBody(req, MAX_BODY_BYTES)
  if (text === null) {
    return refuse(413, 'This study is too large to push. Download the LSS file instead.')
  }
  let body: PushRequest
  try {
    body = JSON.parse(text)
  } catch {
    return refuse(400, 'Invalid JSON request body')
  }
  if (!body || typeof body !== 'object') return refuse(400, 'Invalid JSON request body')

  const { url, username, password, surveyId, project, testOnly } = body
  if (!url || !username || !password || !surveyId) {
    return refuse(400, 'url, username, password, surveyId are all required')
  }
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length > MAX_USERNAME_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return refuse(400, 'The username or password is not valid.')
  }
  if (!Number.isSafeInteger(surveyId) || surveyId < 1) {
    return refuse(400, 'The survey ID must be a whole number.')
  }

  const design = testOnly ? undefined : project?.design
  if (design) {
    if (!Array.isArray(design.rows) || !Number.isInteger(design.numBlocks) || design.numBlocks < 1) {
      return refuse(400, 'The design in this study could not be read.')
    }
    if (design.rows.length > MAX_DESIGN_ROWS || design.numBlocks > MAX_BLOCKS) {
      return refuse(
        400,
        `This design is too large to push (the limit is ${MAX_DESIGN_ROWS} choice tasks in ${MAX_BLOCKS} blocks). Download the LSS file instead.`,
      )
    }
  }

  // ── where to: URL, then every address the name resolves to ─────────────
  const policy = targetPolicy()
  const target = checkPushUrl(url, policy)
  if (!target.ok) return refuse(400, target.error)
  const endpoint = target.endpoint
  const log: string[] = []
  log.push(`Endpoint: ${endpoint.href}`)

  const resolved = await resolveTarget(endpoint.hostname, policy.allowPrivate)
  if (!resolved.ok) {
    if (resolved.reason === 'private') return refuse(400, PRIVATE_NAME_MESSAGE)
    return Response.json({ ok: false, error: sentence(FAILURE_TEXT.unreachable), log }, { status: 200 })
  }

  const client = openRc2(endpoint, resolved.addresses)
  try {
    return await push(client, { username, password, surveyId, project, testOnly }, log)
  } finally {
    client.close()
  }
}

async function push(
  client: Rc2Client,
  { username, password, surveyId, project, testOnly }: Omit<PushRequest, 'url'>,
  log: string[],
) {
  const deadline = Date.now() + PUSH_BUDGET_MS
  const outOfTime = () => deadline - Date.now() < 1_000
  const rpc = (method: string, params: unknown[]): Promise<Rc2Result> =>
    client.call(method, params, Math.max(1_000, Math.min(RPC_TIMEOUT_MS, deadline - Date.now())))

  // ── 1. authenticate ─────────────────────────────────────────────────────
  const session = await rpc('get_session_key', [username, password])
  if (!session.ok) {
    const connected = session.failure !== 'unreachable' && session.failure !== 'not-limesurvey'
    const text = FAILURE_TEXT[session.failure]
    return Response.json(
      { ok: false, error: connected ? `Authentication failed: ${text}.` : sentence(text), log },
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

  const release = () => client.call('release_session_key', [sessionKey], RELEASE_TIMEOUT_MS)

  if (testOnly) {
    await release()
    return Response.json({ ok: true, log, message: 'Connection OK' })
  }

  // ── 2. validate survey + design ────────────────────────────────────────
  if (!project?.design || project.design.rows.length === 0) {
    await release()
    return Response.json(
      { ok: false, error: 'Project has no design rows to push', log },
      { status: 200 },
    )
  }

  const sProps = await rpc('get_survey_properties', [
    sessionKey,
    surveyId,
    ['sid', 'active'],
  ])
  if (!sProps.ok) {
    await release()
    return Response.json(
      { ok: false, error: `Survey ${surveyId} not accessible: ${FAILURE_TEXT[sProps.failure]}.`, log },
      { status: 200 },
    )
  }
  log.push(`Survey ${surveyId} verified`)

  // ── 3. block assignment + one group per block ──────────────────────────
  // A hidden equation question (BLK) draws one block per respondent; each block's
  // group is shown only when BLK equals its number. Group names stay neutral in
  // case the survey displays them.
  const { rows: designRows, numBlocks } = exportBlocks(project.design)
  const fail = async (error: string) => {
    await release()
    return Response.json({ ok: false, error, log }, { status: 200 })
  }
  const why = (r: Rc2Result) => (r.ok ? 'unexpected response' : FAILURE_TEXT[r.failure])

  if (numBlocks > 1) {
    const addAssign = await rpc('add_group', [sessionKey, surveyId, 'Block assignment', ''])
    const assignGid = addAssign.ok ? rc2Id(addAssign.result) : null
    if (!assignGid) {
      return fail(`add_group failed for block assignment: ${why(addAssign)}.`)
    }
    const lsq = buildBlockAssignmentLsq(numBlocks)
    const imp = await rpc('import_question', [
      sessionKey,
      surveyId,
      assignGid,
      Buffer.from(lsq.xml, 'utf8').toString('base64'),
      'lsq',
      lsq.mandatory,
    ])
    if (!imp.ok || !rc2Id(imp.result)) return fail(`Could not add the block assignment question: ${why(imp)}.`)
    log.push(`Created block assignment (gid=${assignGid}, question ${lsq.questionCode})`)
  }

  const blockGroupIds: Record<number, number> = {}
  for (let b = 1; b <= numBlocks; b++) {
    const add = await rpc('add_group', [sessionKey, surveyId, 'Choice tasks', ''])
    const gid = add.ok ? rc2Id(add.result) : null
    if (!gid) {
      return fail(`add_group failed for block ${b}: ${why(add)}.`)
    }
    blockGroupIds[b] = gid
    if (numBlocks > 1) {
      const setProps = await rpc('set_group_properties', [
        sessionKey,
        gid,
        { grelevance: blockRelevance(b) },
      ])
      // A field LimeSurvey refuses comes back as { grelevance: false } with no error, and the
      // group would then show to every respondent.
      const saved = setProps.ok && (setProps.result as { grelevance?: unknown } | null)?.grelevance === true
      if (!saved) {
        return fail(`Could not limit group ${gid} to block ${b}: ${setProps.ok ? 'LimeSurvey did not save the condition' : why(setProps)}.`)
      }
    }
    log.push(`Created group for block ${b} (gid=${gid})`)
  }

  // ── 4. push questions ──────────────────────────────────────────────────
  const total = designRows.length
  let questionIndex = 0
  let imported = 0
  const failed: string[] = []
  for (const row of designRows) {
    if (outOfTime()) {
      log.push('Stopped: out of time')
      return fail(
        `The push ran out of time after ${questionIndex} of ${total} choice tasks; the survey now holds part of the design. Download the LSS file instead, or remove the new question groups in LimeSurvey and push again.`,
      )
    }
    const gid = blockGroupIds[row?.block]
    if (!gid) {
      log.push(`(skip) No group for block ${row?.block}`)
      failed.push(`choice task ${row?.taskId}`)
      continue
    }
    let lsq: ReturnType<typeof buildQuestionLsq>
    try {
      lsq = buildQuestionLsq(project, row, questionIndex++)
    } catch {
      return fail('A choice task in this study could not be turned into a LimeSurvey question.')
    }
    const importData = Buffer.from(lsq.xml, 'utf8').toString('base64')
    const add = await rpc('import_question', [sessionKey, surveyId, gid, importData, 'lsq', lsq.mandatory])
    // Documented to return the new question's id; anything else means it didn't import.
    const qid = add.ok ? rc2Id(add.result) : null
    if (!qid) {
      log.push(
        `  (failed) ${lsq.questionTitle} (${lsq.questionCode}): ${add.ok ? 'no question id returned' : FAILURE_TEXT[add.failure]}`,
      )
      failed.push(`${lsq.questionTitle} (${lsq.questionCode})`)
      // Carry on, so the log names every choice task that didn't import.
      continue
    }
    imported++
    log.push(`  ✓ ${lsq.questionTitle} (${lsq.questionCode}) → qid=${qid}`)
  }

  // ── 5. release session ─────────────────────────────────────────────────
  await release()
  log.push('Session released')

  // Only a push where every choice task imported is a success; a partial survey must not read as one.
  if (failed.length > 0) {
    return Response.json(
      {
        ok: false,
        log,
        error: `Only ${imported} of ${total} choice tasks were imported into survey ${surveyId}; ${failed.length} failed (see the log). The survey now holds part of the design: remove the new question groups in LimeSurvey and push again, or import the LSS file instead.`,
      },
      { status: 200 },
    )
  }
  return Response.json({
    ok: true,
    log,
    message: `Pushed all ${imported} choice tasks across ${numBlocks} block${numBlocks === 1 ? '' : 's'} to survey ${surveyId}.`,
  })
}
