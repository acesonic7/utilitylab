import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { travelModeExample } from '../example'

// Drives the push route against a fake RemoteControl 2 server on this machine, answering the way
// https://api.limesurvey.org/classes/remotecontrol_handle.html documents.
type Behaviour = { failQuestion?: number; relevanceSaved?: boolean; idsAsStrings?: boolean }
let behaviour: Behaviour = {}
let server: http.Server
let url = ''
let POST: (req: Request) => Promise<Response>

beforeAll(async () => {
  process.env.LIMESURVEY_PUSH_ALLOW_PRIVATE = '1'
  ;({ POST } = (await import('@/app/api/limesurvey/push/route')) as unknown as { POST: typeof POST })
  let nextId = 100
  let questions = 0
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const { method, id } = JSON.parse(body)
      const newId = () => (behaviour.idsAsStrings ? String(++nextId) : ++nextId)
      let result: unknown
      switch (method) {
        case 'get_session_key':
          questions = 0
          result = 'session'
          break
        case 'get_survey_properties':
          result = { sid: 1, active: 'N' }
          break
        case 'add_group':
          result = newId()
          break
        case 'set_group_properties':
          result = { grelevance: behaviour.relevanceSaved ?? true }
          break
        case 'import_question':
          questions++
          result = questions === behaviour.failQuestion ? { status: 'Error: Invalid', error_code: 'ERR_INVALID_XML' } : newId()
          break
        default:
          result = 'OK'
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ id, result, error: null }))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
  delete process.env.LIMESURVEY_PUSH_ALLOW_PRIVATE
})

beforeEach(() => {
  behaviour = {}
})

async function push() {
  const req = new Request('http://app.test/api/limesurvey/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ url, username: 'test', password: 'test', surveyId: 1, project: travelModeExample }),
  })
  return (await (await POST(req)).json()) as { ok: boolean; message?: string; error?: string; log: string[] }
}

describe('LimeSurvey push reports what really happened', () => {
  it('reports success only when every choice task imported', async () => {
    const r = await push()
    expect(r.ok).toBe(true)
    expect(r.message).toMatch(/Pushed all 6 choice tasks across 2 blocks/)
  })

  it('accepts ids sent as numeric strings', async () => {
    behaviour.idsAsStrings = true
    expect((await push()).ok).toBe(true)
  })

  it('fails, naming the count, when a question does not import', async () => {
    behaviour.failQuestion = 3
    const r = await push()
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Only 5 of 6 choice tasks were imported/)
    expect(r.log.some((l) => l.includes('(failed)'))).toBe(true)
  })

  it('fails when LimeSurvey does not save a block group condition', async () => {
    behaviour.relevanceSaved = false
    const r = await push()
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/did not save the condition/)
  })
})
