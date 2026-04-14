import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { 
  Trophy, 
  MapPin, 
  ChevronRight, 
  CheckCircle2, 
  Lock, 
  Settings, 
  Home, 
  BarChart3, 
  X, 
  Users, 
  Flame, 
  Clock, 
  Trash2,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react'

import { TEAMS, CRITERIA, PIN, INITIAL_STATE } from './lib/supabase'
import { usePotjieState } from './lib/usePotjieState'
import { Header, ProgressRing, TimerDisplay, CriterionSlider } from './components/UI'

const App = () => {
  const { 
    sharedState, 
    updateSharedState, 
    syncStatus, 
    sbUrl, setSbUrl, 
    sbKey, setSbKey,
    fetchState,
    supabase 
  } = usePotjieState()
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    window.onerror = (msg, url, lineNo, columnNo, err) => {
      setError(`[${lineNo}:${columnNo}] ${msg}`)
      return false
    }
  }, [])

  // Local state
  const [screen, setScreen] = useState(() => {
    try {
      const saved = localStorage.getItem('pq_screen')
      const valid = ['home', 'list', 'vote', 'dressed', 'done', 'leaderboard', 'admin', 'setup']
      return valid.includes(saved) ? saved : 'home'
    } catch { return 'home' }
  })
  
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('pq_name') || '' } catch { return '' }
  })
  
  const [votes, setVotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pq_votes') || '{}') } catch { return {} }
  })
  
  const [bd, setBd] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pq_bd') || '{ "winner": null }') } catch { return { "winner": null } }
  })
  
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [draftScores, setDraftScores] = useState({})
  const [adminPin, setAdminPin] = useState('')
  const [shakeAdmin, setShakeAdmin] = useState(false)
  const [potTapCount, setPotTapCount] = useState(0)
  const [showAdminLogin, setShowAdminLogin] = useState(false)

  const [customTime, setCustomTime] = useState('30')

  // Persist local state
  useEffect(() => {
    localStorage.setItem('pq_screen', screen)
    localStorage.setItem('pq_name', name)
    localStorage.setItem('pq_votes', JSON.stringify(votes))
    localStorage.setItem('pq_bd', JSON.stringify(bd))
  }, [screen, name, votes, bd])

  // Handle cross-device local reset when admin triggers softReset
  useEffect(() => {
    if (sharedState?.resetCounter > 0) {
      const lastReset = parseInt(localStorage.getItem('pq_reset_seen') || '0')
      if (sharedState.resetCounter > lastReset) {
        localStorage.removeItem('pq_votes')
        localStorage.removeItem('pq_bd')
        localStorage.setItem('pq_reset_seen', sharedState.resetCounter.toString())
        setVotes({})
        setBd({ winner: null })
        console.log("Local votes cleared by Admin Reset")
      }
    }
  }, [sharedState?.resetCounter])

  const navigate = (s) => {
    setScreen(s)
    setPotTapCount(0)
  }

  const handleBeginJudging = () => {
    if (!name.trim()) return
    
    let uniqueName = name.trim()
    const existing = sharedState?.voterNames || []
    let count = 0
    
    // Auto-numbering for duplicate names
    while (existing.includes(count === 0 ? uniqueName : `${uniqueName} ${count}`)) {
      count++
    }
    
    const finalName = count === 0 ? uniqueName : `${uniqueName} ${count}`
    setName(finalName)
    navigate('list')
  }

  const handlePotTap = () => {
    const newCount = potTapCount + 1
    if (newCount >= 5) {
      setShowAdminLogin(true)
      setPotTapCount(0)
    } else {
      setPotTapCount(newCount)
    }
  }

  const handleAdminEnter = () => {
    if (adminPin === PIN) {
      navigate('admin')
      setAdminPin('')
      setShowAdminLogin(false)
    } else {
      setShakeAdmin(true)
      setTimeout(() => setShakeAdmin(false), 500)
    }
  }

  const handleVoteTeam = (teamId) => {
    if (!sharedState.votingOpen) return
    setActiveTeamId(teamId)
    setDraftScores(votes[teamId] || { taste: 5, tenderness: 5, aroma: 5, gees: 5 })
    navigate('vote')
  }

  const submitVote = async () => {
    if (!activeTeamId || isSubmitting) return
    setIsSubmitting(true)
    
    const newVotes = { ...votes, [activeTeamId]: draftScores }
    setVotes(newVotes)
    localStorage.setItem('pq_votes', JSON.stringify(newVotes))

    if (supabase) {
      try {
        const { error: rpcError } = await supabase.rpc('submit_potjie_vote', {
          p_judge_name: name,
          p_team_id: activeTeamId,
          p_scores: draftScores
        })
        if (rpcError) throw rpcError
        await fetchState()
      } catch (err) {
        console.error('Vote storage error:', err)
        setError(`DATABASE ERROR: ${err.message || err.details}. Please ensure you ran the latest SQL!`)
      }
    }
    
    setIsSubmitting(false)
    navigate('list')
  }

  const submitBestDressed = async () => {
    if (!bd.winner || isSubmitting) return
    setIsSubmitting(true)
    
    const newBd = { winner: bd.winner }
    setBd(newBd)
    localStorage.setItem('pq_bd', JSON.stringify(newBd))

    if (supabase) {
      try {
        const { error: rpcError } = await supabase.rpc('submit_potjie_vote', {
          p_judge_name: name,
          p_team_id: bd.winner,
          p_scores: {},
          p_is_best_dressed: true
        })
        if (rpcError) throw rpcError
        await fetchState()
      } catch (e) {
        console.error("Vote submission error:", e)
      }
    }
    
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#003764', '#E11B22', '#009AC7'] })
    setIsSubmitting(false)
    navigate('done')
  }

  const resetApp = async () => {
    if (confirm('FULL SYSTEM RESET? This wipes ALL data including Supabase settings.')) {
      localStorage.clear()
      await updateSharedState(INITIAL_STATE)
      window.location.reload()
    }
  }

  const softReset = async () => {
    if (confirm('Soft reset will clear all votes but keep your timer and leaderboard settings. Continue?')) {
      const resetState = {
        ...sharedState,
        allVotes: {},
        allBD: {},
        voterNames: [],
        stationCounts: {},
        resetCounter: (sharedState.resetCounter || 0) + 1,
        updatedAt: Date.now()
      }
      await updateSharedState(resetState)
      localStorage.removeItem('pq_votes')
      localStorage.removeItem('pq_bd')
      setVotes({})
      setBd({ winner: null })
      alert('Votes cleared successfully!')
    }
  }

  const getTeamAvg = (teamId) => {
    const data = sharedState?.allVotes?.[teamId]
    if (!data || !data.sums || data.count === 0) return "0.0"
    const total = Object.values(data.sums).reduce((a, b) => a + (Number(b) || 0), 0)
    return (total / (data.count * CRITERIA.length)).toFixed(1)
  }

  const getUserTeamAvg = (teamId) => {
    const v = votes[teamId]
    if (!v) return "0.0"
    const total = Object.values(v).reduce((a, b) => a + b, 0)
    return (total / CRITERIA.length).toFixed(1)
  }

  const stationsVoted = Object.keys(votes).length
  const isUserDone = stationsVoted === TEAMS.length && (bd.winner || localStorage.getItem('pq_bd'))
  const progressPercent = (stationsVoted / TEAMS.length) * 100

  if (error) {
    return (
      <div style={{ padding: '24px', color: 'red', fontSize: '12px', background: 'white', minHeight: '100vh' }}>
        <h1>App Error</h1>
        <pre>{error}</pre>
        <button className="btn btn-primary" onClick={() => { localStorage.clear(); window.location.reload(); }}>Reset & Force Refresh</button>
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      {screen === 'home' && (
        <motion.div key="home" className="fade-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: '24px' }}>
          <div style={{ textAlign: 'center', marginTop: '40px', marginBottom: '60px' }}>
            <div style={{ fontSize: '80px', marginBottom: '10px', cursor: 'pointer' }} onClick={handlePotTap}>🫕</div>
            <div className="app-team-title">THE APP TEAM'S</div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', marginTop: '-2px', color: 'var(--primary-dark)' }}>Potjie Cook-Off</h1>
          </div>

          <TimerDisplay timerEnd={sharedState?.timerEnd} />

          <button 
            className={`btn ${sharedState?.leaderboardOn ? 'btn-primary' : 'btn-secondary btn-disabled'}`}
            style={{ marginBottom: '40px' }}
            disabled={!sharedState?.leaderboardOn}
            onClick={() => navigate('leaderboard')}
          >
            <BarChart3 size={20} style={{ marginRight: '10px' }} />
            {sharedState?.leaderboardOn ? 'View Live Leaderboard' : 'Leaderboard not yet released'}
          </button>

          <div className="card shadow-sm">
            <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--primary-dark)' }}>Join the Jury</h3>
            <input 
              type="text" 
              placeholder="Your name..." 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass"
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: '#F9FAFB', color: 'var(--primary-dark)', marginBottom: '16px' }}
            />
            <button className={`btn ${isUserDone ? 'btn-secondary btn-disabled' : 'btn-primary'}`} onClick={isUserDone ? null : handleBeginJudging}>
              {isUserDone ? 'Judging Complete ✅' : 'Begin Judging'}
            </button>
          </div>

          <AnimatePresence>
            {showAdminLogin && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginTop: '40px' }}>
                <div className="card" style={{ background: 'rgba(0, 55, 100, 0.05)', borderColor: 'var(--primary-dark)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Lock size={14} className="text-muted" />
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>ADMIN LOGIN</span>
                    </div>
                    <button onClick={() => setShowAdminLogin(false)}><X size={16} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="password" 
                      placeholder="PIN" 
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      className={`glass ${shakeAdmin ? 'shake' : ''}`}
                      style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                    />
                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleAdminEnter}>Enter</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {screen === 'list' && (
        <motion.div key="list" className="fade-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Header 
            title={name} 
            subtitle="JUDGING PULSE" 
            showBadge 
            syncStatus={syncStatus}
            left={<ProgressRing progress={progressPercent} />}
            right={<button onClick={() => navigate('home')}><Home size={24} /></button>}
          />
          <div style={{ padding: '16px' }}>
            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '24px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.5s ease' }} />
            </div>

            {TEAMS.map(team => {
              const voted = !!votes[team.id]
              const totalVoters = sharedState?.stationCounts?.[team.id] || 0
              return (
                <div 
                  key={team.id} 
                  className="card" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    opacity: voted || !sharedState.votingOpen ? 0.6 : 1,
                    pointerEvents: voted || !sharedState.votingOpen ? 'none' : 'auto'
                  }}
                  onClick={() => handleVoteTeam(team.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '32px' }}>{team.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{team.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {voted ? `Voted · Avg ${getUserTeamAvg(team.id)}` : 'Tap to judge'}
                      </div>
                    </div>
                  </div>
                  <div className="status-badge">
                    <Users size={12} /> {totalVoters}
                  </div>
                </div>
              )
            })}

            <button 
              className={`btn ${stationsVoted === TEAMS.length ? 'btn-primary' : 'btn-secondary btn-disabled'}`}
              style={{ marginTop: '20px' }}
              disabled={stationsVoted !== TEAMS.length || !sharedState?.votingOpen}
              onClick={() => navigate('dressed')}
            >
              Submit & Pick Best Dressed &rarr;
            </button>
          </div>
        </motion.div>
      )}

      {screen === 'vote' && (
        <motion.div key="vote" className="fade-in" style={{ padding: '16px' }}>
          {(() => {
            const team = TEAMS.find(t => t.id === activeTeamId)
            const draftAvg = (Object.values(draftScores).reduce((a, b) => a + b, 0) / CRITERIA.length).toFixed(1)
            return (
              <>
                <Header title={team.name} subtitle={`STATION ${activeTeamId}`} left={<span style={{ fontSize: '32px' }}>{team.emoji}</span>} right={<button onClick={() => navigate('list')}><X size={24} /></button>} />
                {CRITERIA.map(c => (
                  <CriterionSlider key={c.id} criterion={c} value={draftScores[c.id]} onChange={(val) => setDraftScores({...draftScores, [c.id]: val})} />
                ))}
                <div className="card glass" style={{ position: 'sticky', bottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '2px solid var(--primary)' }}>
                   <div>
                     <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 'bold' }}>TEAM AVERAGE</div>
                     <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{draftAvg}</div>
                   </div>
                   <button className="btn btn-primary" style={{ width: 'auto' }} onClick={submitVote} disabled={isSubmitting}>
                     {isSubmitting ? <Loader2 className="animate-spin" /> : 'Lock In Scores'}
                   </button>
                </div>
              </>
            )
          })()}
        </motion.div>
      )}

      {screen === 'dressed' && (
        <motion.div key="dressed" className="fade-in" style={{ padding: '16px' }}>
           <Header title="Best Dressed" subtitle="PICK YOUR FAVORITE" />
           <h3 style={{ margin: '24px 0 12px', fontSize: '20px', color: 'var(--primary-dark)' }}>🏆 Best Dressed Station</h3>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '40px' }}>
              {TEAMS.map(t => (
                <button 
                  key={t.id}
                  className={`btn ${bd.winner === t.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ justifyContent: 'flex-start', padding: '12px' }}
                  onClick={() => setBd({ winner: t.id })}
                >
                  <span style={{ marginRight: '12px', fontSize: '20px' }}>{t.emoji}</span>
                  {t.name}
                </button>
              ))}
           </div>
           <button className="btn btn-primary" onClick={submitBestDressed} disabled={!bd.winner || isSubmitting}>
             {isSubmitting ? <Loader2 className="animate-spin" /> : 'Submit Final Vote'}
           </button>
        </motion.div>
      )}

      {screen === 'done' && (
        <motion.div key="done" className="fade-in" style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '80px' }}>🏅</div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>Done, {name}!</h1>
          <p className="text-muted">Your scores are locked in and synced.</p>
          <button className="btn btn-primary" style={{ marginTop: '40px' }} onClick={() => navigate('home')}>Return to Home</button>
          {sharedState?.leaderboardOn && (
            <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => navigate('leaderboard')}>View Leaderboard</button>
          )}
        </motion.div>
      )}

      {screen === 'leaderboard' && (
        <motion.div key="leaderboard" className="fade-in">
          <Header title="Leaderboard" subtitle={`${sharedState?.voterNames?.length || 0} JUDGES`} showBadge syncStatus={syncStatus} right={<button onClick={() => navigate('home')}><Home size={24} /></button>} />
          <div style={{ padding: '16px' }}>
            {[...TEAMS].sort((a,b) => parseFloat(getTeamAvg(b.id)) - parseFloat(getTeamAvg(a.id))).map((team, idx) => (
              <div key={team.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 'bold', width: '20px' }}>{idx + 1}</span>
                  <span style={{ fontSize: '24px' }}>{team.emoji}</span>
                  <span style={{ fontWeight: 'bold' }}>{team.name}</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>{getTeamAvg(team.id)}</div>
              </div>
            ))}

            <div className="card" style={{ marginTop: '24px', marginBottom: '40px', border: '2px solid var(--accent)', background: 'rgba(255, 126, 0, 0.05)' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--primary-dark)', textAlign: 'center' }}>👗 BEST DRESSED WINNER</h3>
              {(() => {
                const maxVotes = Math.max(...Object.values(sharedState?.allBD || { 'none': 0 }))
                if (maxVotes === 0) return <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>Calculating results...</div>
                
                return TEAMS.filter(t => (sharedState?.allBD?.[t.id] || 0) === maxVotes).map(t => (
                  <div key={t.id} style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: '60px', marginBottom: '12px' }}>{t.emoji}</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary-dark)' }}>{t.name}</div>
                    <div style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 'bold', marginTop: '8px' }}>{maxVotes} TOTAL VOTES</div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </motion.div>
      )}

      {screen === 'admin' && (
        <motion.div key="admin" className="fade-in">
          <Header title="Admin Dashboard" subtitle="LIVE DATA" right={<button onClick={() => navigate('home')}><X size={24} /></button>} />
          <div style={{ padding: '16px' }}>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SYNC STATUS</div>
                <div style={{ fontWeight: 'bold', color: syncStatus === 'live' ? 'var(--success)' : 'var(--error)' }}>{syncStatus === 'live' ? 'LIVE' : 'OFFLINE'}</div>
              </div>
              <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={fetchState}>Refresh</button>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>🏆 Rankings & Best Dressed</h3>
              {[...TEAMS].sort((a,b) => parseFloat(getTeamAvg(b.id)) - parseFloat(getTeamAvg(a.id))).map((t, idx) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{idx+1}. {t.emoji} {t.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>👤 {sharedState?.stationCounts?.[t.id] || 0} judges · 👗 {sharedState?.allBD?.[t.id] || 0} BD votes</div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{getTeamAvg(t.id)}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Event Control</h3>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button className={`btn ${sharedState?.votingOpen ? 'btn-secondary' : 'btn-primary'}`} style={{ flex: 1 }} onClick={() => updateSharedState({...sharedState, votingOpen: true})}>Open Voting</button>
                <button className={`btn ${!sharedState?.votingOpen ? 'btn-secondary' : 'btn-primary'}`} style={{ flex: 1, borderColor: 'var(--error)', background: !sharedState?.votingOpen ? 'transparent' : '' }} onClick={() => updateSharedState({...sharedState, votingOpen: false})}>Close Voting</button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={`btn ${sharedState?.leaderboardOn ? 'btn-secondary' : 'btn-primary'}`} style={{ flex: 1 }} onClick={() => updateSharedState({...sharedState, leaderboardOn: true})}>Show Leaderboard</button>
                <button className={`btn ${!sharedState?.leaderboardOn ? 'btn-secondary' : 'btn-primary'}`} style={{ flex: 1 }} onClick={() => updateSharedState({...sharedState, leaderboardOn: false})}>Hide Leaderboard</button>
              </div>
            </div>

            <div className="card">
               <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Voting Countdown</h3>
               {sharedState?.timerEnd ? (
                 <div style={{ textAlign: 'center' }}>
                    <TimerDisplay timerEnd={sharedState.timerEnd} />
                    <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => updateSharedState({...sharedState, timerEnd: null})}>Cancel Timer</button>
                 </div>
               ) : (
                 <>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                      {[15, 30, 45, 60].map(m => (
                        <button key={m} className="btn btn-secondary" style={{ padding: '8px', fontSize: '12px' }} onClick={() => updateSharedState({...sharedState, timerEnd: Date.now() + m * 60 * 1000, votingOpen: true})}>{m}m</button>
                      ))}
                   </div>
                   <div style={{ display: 'flex', gap: '8px' }}>
                     <input 
                       type="number" 
                       value={customTime}
                       onChange={(e) => setCustomTime(e.target.value)}
                       className="glass"
                       style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}
                       placeholder="Minutes..."
                     />
                     <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => updateSharedState({...sharedState, timerEnd: Date.now() + parseInt(customTime) * 60 * 1000, votingOpen: true})}>Set Custom</button>
                   </div>
                 </>
               )}
            </div>

            <div className="card" style={{ direction: 'ltr' }}>
               <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Completed Judges ({sharedState?.voterNames?.length || 0})</h3>
               <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {sharedState?.voterNames?.map((n, i) => <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>{n}</div>)}
               </div>
            </div>

            <div className="card" style={{ borderColor: 'var(--error)', background: 'rgba(225, 27, 34, 0.05)', marginTop: '20px' }}>
               <h3 style={{ color: 'var(--error)', marginBottom: '12px' }}>DANGER ZONE</h3>
               <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={softReset}>Soft Reset</button>
                  <button className="btn btn-secondary" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={resetApp}>Full Wipe</button>
               </div>
            </div>
            
            <button className="btn btn-secondary" style={{ marginTop: '20px' }} onClick={() => navigate('setup')}>API Connection Settings</button>
          </div>
        </motion.div>
      )}

      {screen === 'setup' && (
        <motion.div key="setup" className="fade-in" style={{ padding: '16px' }}>
          <Header title="Setup" subtitle="CONNECTION" right={<button onClick={() => navigate('admin')}><X size={24} /></button>} />
          <div className="card shadow-sm">
            <h3 style={{ marginBottom: '16px', color: 'var(--primary-dark)' }}>Supabase Config</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>URL</label>
              <input type="text" value={sbUrl} onChange={(e) => setSbUrl(e.target.value)} className="glass" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', color: 'black' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>KEY</label>
              <textarea rows={3} value={sbKey} onChange={(e) => setSbKey(e.target.value)} className="glass" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', color: 'black', fontSize: '10px' }} />
            </div>
            <button className="btn btn-primary" onClick={() => navigate('admin')}>Save & Connect</button>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>LATEST ATOMIC SQL</h3>
            <pre style={{ fontSize: '9px', background: '#000', color: '#0f0', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
{`create table if not exists potjie_state (
  id text primary key,
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter publication supabase_realtime add table potjie_state;
create policy "Public Access" on potjie_state for all using (true);
alter table potjie_state enable row level security;

insert into potjie_state (id, data) 
values ('main', '{"votingOpen": true, "leaderboardOn": false, "allVotes": {}, "allBD": {}, "voterNames": [], "stationCounts": {}, "timerEnd": null}')
on conflict (id) do nothing;

create or replace function submit_potjie_vote(
  p_judge_name text,
  p_team_id text,
  p_scores jsonb,
  p_is_best_dressed boolean default false
) returns void as $$
declare
  current_data jsonb;
begin
  select data into current_data from potjie_state where id = 'main' for update;
  if not (coalesce(current_data->'voterNames', '[]'::jsonb) @> jsonb_build_array(p_judge_name)) then
    current_data := jsonb_set(current_data, '{voterNames}', coalesce(current_data->'voterNames', '[]'::jsonb) || jsonb_build_array(p_judge_name));
  end if;
  if p_is_best_dressed then
     current_data := jsonb_set(current_data, array['allBD', p_team_id], to_jsonb(coalesce((current_data->'allBD'->>p_team_id)::int, 0) + 1));
  else
     declare
       team_data jsonb := coalesce(current_data->'allVotes'->p_team_id, '{"sums": {}, "count": 0}'::jsonb);
       criterion text;
       score int;
     begin
       team_data := jsonb_set(team_data, '{count}', to_jsonb(coalesce((team_data->>'count')::int, 0) + 1));
       if (team_data->'sums') is null then team_data := jsonb_set(team_data, '{sums}', '{}'::jsonb); end if;
       for criterion, score in select * from jsonb_each_text(p_scores) loop
         team_data := jsonb_set(team_data, array['sums', criterion], to_jsonb(coalesce((team_data->'sums'->>criterion)::int, 0) + score::int));
       end loop;
       current_data := jsonb_set(current_data, array['allVotes', p_team_id], team_data);
       current_data := jsonb_set(current_data, array['stationCounts', p_team_id], to_jsonb(coalesce((current_data->'stationCounts'->>p_team_id)::int, 0) + 1));
     end;
  end if;
  update potjie_state set data = current_data, updated_at = now() where id = 'main';
end;
$$ language plpgsql;`}
            </pre>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App
