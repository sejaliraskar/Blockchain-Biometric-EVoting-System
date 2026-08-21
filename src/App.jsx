import { useState } from 'react'
import './App.css'

function App() {
  const [role, setRole] = useState('student')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [view, setView] = useState('login')
  const [token, setToken] = useState('')
  const [user, setUser] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [demoCode, setDemoCode] = useState('')
  const [election, setElection] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const isStudent = role === 'student'

  const selectRole = (nextRole) => {
    setRole(nextRole)
    setIdentity('')
    setPassword('')
    setErrorMessage('')
  }

  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'Request failed.')
    return result
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, identity, password }),
      }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message); return data })
      setToken(result.token)
      setUser(result.user)
      setDemoCode(result.demoCode)
      setView('mfa')
    } catch (error) {
      setErrorMessage(error.message || 'Authentication service is unavailable.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMfa = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage('')
    try {
      await api('/api/auth/mfa', { method: 'POST', body: JSON.stringify({ code: mfaCode }) })
      setView('biometric')
    } catch (error) { setErrorMessage(error.message) } finally { setIsLoading(false) }
  }

  const handleBiometric = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      await api('/api/auth/biometric', { method: 'POST', body: JSON.stringify({ method: 'platform' }) })
      if (user.role === 'student') {
        const result = await api('/api/election')
        setElection(result)
        setView('student')
      } else {
        const result = await api('/api/admin/dashboard')
        setDashboard(result)
        setView('admin')
      }
    } catch (error) { setErrorMessage(error.message) } finally { setIsLoading(false) }
  }

  const submitVote = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const result = await api('/api/election/vote', { method: 'POST', body: JSON.stringify({ candidateId: selectedCandidate }) })
      setReceipt(result.receipt)
      setElection({ ...election, hasVoted: true })
    } catch (error) { setErrorMessage(error.message) } finally { setIsLoading(false) }
  }

  const logout = () => {
    setToken('')
    setUser(null)
    setView('login')
    setMfaCode('')
    setReceipt(null)
    setDashboard(null)
    setElection(null)
    setErrorMessage('')
  }

  if (view === 'mfa' || view === 'biometric') {
    const isMfa = view === 'mfa'
    return <main className="portal-shell"><aside className="portal-rail"><div className="brand-mark"><span>V</span></div><p className="eyebrow">Identity protocol · 02</p><h1>Every layer<br /><em>counts.</em></h1><p className="brand-copy">Two independent checks protect the ballot before you ever see it.</p><div className="protocol-list"><span className={isMfa ? 'current' : 'done'}>01 <b>Multi-factor code</b></span><span className={!isMfa ? 'current' : ''}>02 <b>Biometric presence</b></span></div></aside><section className="verify-panel"><div className="verify-card"><p className="eyebrow">{isMfa ? 'Step 01 / 02' : 'Step 02 / 02'}</p><h2>{isMfa ? 'Verify your identity.' : 'Confirm it’s you.'}</h2><p className="muted">{isMfa ? `A verification code was sent for ${user?.identity}.` : 'Use the biometric sensor on this device to complete secure access.'}</p>{isMfa ? <form onSubmit={handleMfa}><label htmlFor="mfa-code">6-digit verification code</label><input className="code-input" id="mfa-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} inputMode="numeric" maxLength="6" placeholder="000000" required /><p className="demo-hint">Demo code: <strong>{demoCode}</strong></p><button className="submit-button" type="submit" disabled={isLoading}>{isLoading ? 'Checking code...' : 'Verify code'} <span>→</span></button></form> : <div><div className="biometric-orb" aria-hidden="true">⌁</div><button className="submit-button" type="button" onClick={handleBiometric} disabled={isLoading}>{isLoading ? 'Scanning device...' : 'Use device biometric'} <span>→</span></button><p className="demo-hint">Local demo mode connects this action to the biometric verification API.</p></div>}{errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}<button className="back-link" type="button" onClick={logout}>Cancel and return to sign in</button></div></section></main>
  }

  if (view === 'student') {
    return <main className="app-shell"><header className="app-header"><div className="header-brand"><div className="brand-mark"><span>V</span></div><span>VERITAS / E-VOTE</span></div><div className="user-menu"><span>{user.name}<small>Verified student</small></span><button type="button" onClick={logout}>Sign out</button></div></header><section className="content-wrap"><div className="page-intro"><div><p className="eyebrow">Student ballot · 2026</p><h1>Make your choice.</h1><p className="muted">One verified vote. Recorded transparently on the distributed ledger.</p></div><span className="status-pill"><i /> Election {election.status}</span></div><div className="election-meta"><span>Closes {new Date(election.closesAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>·</span><span>3 candidates</span></div>{receipt ? <div className="receipt-panel"><span className="receipt-icon">✓</span><p className="eyebrow">Vote confirmed</p><h2>Your ballot is sealed.</h2><p className="muted">Your anonymous vote has been added to block #{receipt.block}.</p><div className="hash-box"><small>Ledger receipt</small><code>{receipt.hash}</code></div><p className="receipt-note">Keep this receipt ID for your records: <strong>{receipt.voteId.slice(0, 8)}</strong></p></div> : <><div className="candidate-grid">{election.candidates.map((candidate, index) => <button className={`candidate-card ${selectedCandidate === candidate.id ? 'selected' : ''}`} type="button" key={candidate.id} onClick={() => setSelectedCandidate(candidate.id)}><span className="candidate-number">0{index + 1}</span><span className="candidate-avatar" style={{ background: candidate.color }}>{candidate.name.charAt(0)}</span><strong>{candidate.name}</strong><small>{candidate.role}</small><span className="select-indicator">{selectedCandidate === candidate.id ? '✓ Selected' : 'Select candidate'}</span></button>)}</div><div className="ballot-actions"><span>{election.hasVoted ? 'You have already cast your ballot.' : selectedCandidate ? 'Review your selection before submitting.' : 'Select one candidate to continue.'}</span><button className="submit-button" type="button" disabled={!selectedCandidate || election.hasVoted || isLoading} onClick={submitVote}>{isLoading ? 'Recording...' : 'Cast secure vote'} <span>→</span></button></div>{errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}</>}</section></main>
  }

  if (view === 'admin') {
    return <main className="app-shell"><header className="app-header"><div className="header-brand"><div className="brand-mark"><span>V</span></div><span>VERITAS / CONTROL</span></div><div className="user-menu"><span>{user.name}<small>Verified administrator</small></span><button type="button" onClick={logout}>Sign out</button></div></header><section className="content-wrap"><div className="page-intro"><div><p className="eyebrow">Election control · 2026</p><h1>Good evening.</h1><p className="muted">Monitor the election without exposing voter identities.</p></div><span className="status-pill"><i /> Ledger {dashboard.verified ? 'verified' : 'needs review'}</span></div><div className="metrics-grid"><div><small>Total ballots</small><strong>{dashboard.totalVotes}</strong><span>Recorded votes</span></div><div><small>Ledger status</small><strong>{dashboard.verified ? 'Valid' : 'Error'}</strong><span>Hash chain integrity</span></div><div><small>Election state</small><strong>{dashboard.election.status}</strong><span>Closes {new Date(dashboard.election.closesAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div></div><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Live results</p><h2>Candidate standing</h2></div><span>Anonymous totals only</span></div><div className="results-list">{dashboard.counts.map((candidate) => <div className="result-row" key={candidate.id}><span className="result-avatar" style={{ background: candidate.color }}>{candidate.name.charAt(0)}</span><span className="result-name"><strong>{candidate.name}</strong><small>{candidate.role}</small></span><div className="result-bar"><i style={{ width: `${dashboard.totalVotes ? Math.max(8, candidate.votes / dashboard.totalVotes * 100) : 8}%`, background: candidate.color }} /></div><strong>{candidate.votes}</strong></div>)}</div></section><section className="dashboard-section ledger-section"><div className="section-heading"><div><p className="eyebrow">Immutable record</p><h2>Recent blocks</h2></div><span>Voter identities are hashed</span></div>{dashboard.recentBlocks.length ? <div className="block-list">{dashboard.recentBlocks.map((block) => <div className="block-row" key={block.hash}><strong>#{block.index}</strong><code>{block.hash.slice(0, 18)}...</code><span>{block.voter}</span><time>{new Date(block.timestamp).toLocaleTimeString()}</time></div>)}</div> : <p className="empty-state">No votes have been recorded yet.</p>}</section></section></main>
  }

  return (
    <main className="login-shell">
      <aside className="brand-panel">
        <div className="brand-mark" aria-hidden="true"><span>V</span></div>
        <p className="eyebrow">Civic protocol · 01</p>
        <h1>Your voice,<br /><em>verified.</em></h1>
        <p className="brand-copy">A secure digital ballot built for trust, transparency, and every member of the campus community.</p>
        <div className="ledger-note"><span className="pulse-dot" /> <span>Network status</span><strong>Operational</strong></div>
        <div className="chain-lines" aria-hidden="true"><i /><i /><i /></div>
        <p className="copyright">Powered by an immutable distributed ledger<br />© 2025 Veritas Civic Systems</p>
      </aside>
      <section className="form-panel">
        <div className="form-wrap">
          <div className="mobile-brand"><div className="brand-mark"><span>V</span></div><span>VERITAS / E-VOTE</span></div>
          <div className="form-heading"><p className="eyebrow">Secure access</p><h2>Welcome.</h2><p>Sign in to continue to the election portal.</p></div>
          <div className="role-switch" role="tablist" aria-label="Choose account type">
            <button className={!isStudent ? 'active' : ''} type="button" role="tab" aria-selected={!isStudent} onClick={() => selectRole('admin')}>Administrator</button>
            <button className={isStudent ? 'active' : ''} type="button" role="tab" aria-selected={isStudent} onClick={() => selectRole('student')}>Student voter</button>
          </div>
          <form onSubmit={handleSubmit}>
            <label htmlFor="identity">{isStudent ? 'Student ID or university email' : 'Administrator ID'}</label>
            <div className="input-wrap"><span className="field-icon">{isStudent ? 'ID' : 'AD'}</span><input id="identity" type="text" value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder={isStudent ? 'e.g. BT240041IT' : 'e.g. admin-001'} required /></div>
            <div className="label-row"><label htmlFor="password">Password</label><a href="#reset">Forgot password?</a></div>
            <div className="input-wrap"><span className="field-icon lock">●</span><input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button className="show-password" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div>
            <div className="mfa-row"><span className="check-box">✓</span><span>Multi-factor authentication will be requested after sign in.</span></div>
            <button className="submit-button" type="submit" disabled={isLoading}>{isLoading ? 'Verifying credentials...' : `Continue as ${isStudent ? 'student' : 'administrator'}`} <span>→</span></button>
            {errorMessage && <p className="error-message" role="alert">{errorMessage}</p>}
          </form>
          <div className="security-footer"><span>⌁</span> End-to-end encrypted <i /> <span>◈</span> Ledger verified</div>
          <p className="help-text">Need help signing in? <a href="#support">Contact election support</a></p>
        </div>
      </section>
    </main>
  )
}

export default App
