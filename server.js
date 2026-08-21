import { createServer } from 'node:http'
import { createHash, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

const port = Number(process.env.PORT || 4000)
const passwordSalt = 'veritas-local-demo-salt'
const mfaCode = '240041'
const sessions = new Map()
const election = {
  id: 'campus-council-2026',
  title: 'Campus Council Election 2026',
  status: 'Open',
  closesAt: '2026-08-28T18:00:00.000Z',
  candidates: [
    { id: 'maya-committee', name: 'Maya Deshpande', role: 'Progress & Innovation', color: '#6b8d5b' },
    { id: 'rohan-committee', name: 'Rohan Mehta', role: 'Student Welfare', color: '#c18452' },
    { id: 'zoya-committee', name: 'Zoya Khan', role: 'Arts & Culture', color: '#8d6b75' },
  ],
}
const ledger = []

const credentials = [
  { role: 'student', identity: 'BT240041IT', name: 'Aarav Sharma', passwordHash: scryptSync('Student@123', passwordSalt, 64).toString('hex') },
  { role: 'admin', identity: 'admin-001', name: 'Election Administrator', passwordHash: scryptSync('Admin@123', passwordSalt, 64).toString('hex') },
]

const hash = (value) => createHash('sha256').update(value).digest('hex')
const json = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'http://localhost:5173' })
  response.end(JSON.stringify(payload))
}
const readBody = (request) => new Promise((resolve, reject) => {
  let body = ''
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => { try { resolve(JSON.parse(body || '{}')) } catch { reject(new Error('Invalid JSON request.')) } })
  request.on('error', reject)
})
const getSession = (request) => sessions.get(request.headers.authorization?.replace('Bearer ', ''))
const requireSession = (request, response, role) => {
  const session = getSession(request)
  if (!session || !session.mfaVerified || !session.biometricVerified || (role && session.user.role !== role)) {
    json(response, 401, { message: 'Complete MFA and biometric verification first.' })
    return null
  }
  return session
}
const verifyLedger = () => ledger.every((block, index) => {
  const previousHash = index === 0 ? 'GENESIS' : ledger[index - 1].hash
  const blockHash = hash(`${previousHash}|${block.voteId}|${block.candidateId}|${block.timestamp}|${block.voterHash}`)
  return block.previousHash === previousHash && block.hash === blockHash
})

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' })
    response.end()
    return
  }
  if (request.method === 'GET' && request.url === '/api/health') { json(response, 200, { status: 'ok', service: 'veritas-auth' }); return }

  try {
    if (request.method === 'POST' && request.url === '/api/auth/login') {
      const { role, identity, password } = await readBody(request)
      const account = credentials.find((item) => item.role === role && item.identity.toLowerCase() === String(identity || '').trim().toLowerCase())
      const suppliedHash = password ? scryptSync(password, passwordSalt, 64) : Buffer.alloc(0)
      const storedHash = account ? Buffer.from(account.passwordHash, 'hex') : Buffer.alloc(0)
      if (!account || suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) { json(response, 401, { message: 'Invalid ID or password.' }); return }
      const token = randomUUID()
      sessions.set(token, { user: { role: account.role, name: account.name, identity: account.identity }, mfaVerified: false, biometricVerified: false })
      json(response, 200, { message: 'Credentials accepted.', token, user: { role: account.role, name: account.name, identity: account.identity }, nextStep: 'mfa', demoCode: mfaCode }); return
    }
    if (request.method === 'POST' && request.url === '/api/auth/mfa') {
      const session = getSession(request)
      const { code } = await readBody(request)
      if (!session || code !== mfaCode) { json(response, 401, { message: 'The verification code is incorrect.' }); return }
      session.mfaVerified = true
      json(response, 200, { message: 'MFA verified.', nextStep: 'biometric' }); return
    }
    if (request.method === 'POST' && request.url === '/api/auth/biometric') {
      const session = getSession(request)
      if (!session?.mfaVerified) { json(response, 401, { message: 'Verify MFA before biometric verification.' }); return }
      session.biometricVerified = true
      json(response, 200, { message: 'Biometric verification complete.', demoMode: true }); return
    }
    if (request.method === 'GET' && request.url === '/api/election') {
      const session = requireSession(request, response, 'student')
      if (!session) return
      const voterHash = hash(session.user.identity)
      json(response, 200, { ...election, hasVoted: ledger.some((block) => block.voterHash === voterHash) }); return
    }
    if (request.method === 'POST' && request.url === '/api/election/vote') {
      const session = requireSession(request, response, 'student')
      if (!session) return
      const { candidateId } = await readBody(request)
      const candidate = election.candidates.find((item) => item.id === candidateId)
      const voterHash = hash(session.user.identity)
      if (!candidate) { json(response, 400, { message: 'Select a valid candidate.' }); return }
      if (ledger.some((block) => block.voterHash === voterHash)) { json(response, 409, { message: 'This verified voter has already cast a ballot.' }); return }
      const timestamp = new Date().toISOString()
      const voteId = randomUUID()
      const previousHash = ledger.at(-1)?.hash || 'GENESIS'
      const block = { index: ledger.length + 1, voteId, candidateId, timestamp, voterHash, previousHash, hash: hash(`${previousHash}|${voteId}|${candidateId}|${timestamp}|${voterHash}`) }
      ledger.push(block)
      json(response, 201, { message: 'Vote recorded on the distributed ledger.', receipt: { voteId, block: block.index, hash: block.hash } }); return
    }
    if (request.method === 'GET' && request.url === '/api/admin/dashboard') {
      const session = requireSession(request, response, 'admin')
      if (!session) return
      const counts = election.candidates.map((candidate) => ({ ...candidate, votes: ledger.filter((block) => block.candidateId === candidate.id).length }))
      json(response, 200, { election, totalVotes: ledger.length, verified: verifyLedger(), counts, recentBlocks: ledger.slice(-5).reverse().map(({ voterHash, ...block }) => ({ ...block, voter: `${voterHash.slice(0, 10)}...` })) }); return
    }
    json(response, 404, { message: 'Route not found.' })
  } catch (error) { json(response, 400, { message: error.message }) }
})

server.listen(port, () => {
  console.log(`Veritas auth API listening on http://localhost:${port}`)
  console.log('Demo student: BT240041IT / Student@123')
  console.log('Demo admin: admin-001 / Admin@123')
  console.log('Demo MFA code: 240041')
})