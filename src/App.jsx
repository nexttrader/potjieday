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
  AlertCircle
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
    } catch {
      return 'home'
    }
  })
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('pq_name') || '' } catch { return '' }
  })
  const [votes, setVotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pq_votes') || '{}') } catch { return {} }
  })
  const [bd, setBd] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pq_bd') || '{ "winner": null, "runnerup": null }') } catch { return { "winner": null, "runnerup": null } }
  })
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [draftScores, setDraftScores] = useState({})
  const [adminPin, setAdminPin] = useState('')
  const [shakeAdmin, setShakeAdmin] = useState(false)
  const [potTapCount, setPotTapCount] = useState(0)
  const [showAdminLogin, setShowAdminLogin] = useState(false)

  // Persist local state
  useEffect(() => {
    localStorage.setItem('pq_screen', screen)
    localStorage.setItem('pq_name', name)
    localStorage.setItem('pq_votes', JSON.stringify(votes))
    localStorage.setItem('pq_bd', JSON.stringify(bd))
  }, [screen, name, votes, bd])

  // Real-time synchronization effects
  useEffect(() => {
    if (sharedState?.timerEnd && Date.now() > sharedState.timerEnd && sharedState.votingOpen) {
      if (syncStatus === 'live') {
        updateSharedState({ ...sharedState, votingOpen: false, timerEnd: null })
      }
    }
  }, [sharedState])

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
    } else {
      setShakeAdmin(true)
      setTimeout(() => setShakeAdmin(false), 500)
    }
  }

  const handleVoteTeam = (teamId) => {
    if (!sharedState.votingOpen) return
    setActiveTeamId(teamId)
    setDraftScores(votes[teamId] || { taste: 5, tenderness: 5, presentation: 5, aroma: 5, gees: 5 })
    navigate('vote')
  }

  const submitVote = async () => {
    const newVotes = { ...votes, [activeTeamId]: draftScores }
    setVotes(newVotes)
    
    localStorage.setItem('pq_votes', JSON.stringify(newVotes))

    // Atomic backend update via RPC
    if (supabase) {
      await supabase.rpc('submit_potjie_vote', {
        p_judge_name: name,
        p_team_id: activeTeamId,
        p_scores: draftScores
      })
    }
    
    navigate('list')
  }

  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitBestDressed = async () => {
    if (!bd.winner || isSubmitting) return
    setIsSubmitting(true)
    
    // Local persistence
    const newBd = { winner: bd.winner }
    setBd(newBd)
    localStorage.setItem('pq_bd', JSON.stringify(newBd))

    // Atomic backend update via RPC
    if (supabase) {
      try {
        await supabase.rpc('submit_potjie_vote', {
          p_judge_name: name,
          p_team_id: bd.winner,
          p_scores: {},
          p_is_best_dressed: true
        })
        await fetchState() // Force refresh after vote
      } catch (e) {
        console.error("Vote submission error:", e)
      }
    }
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#003764', '#E11B22', '#009AC7']
    })
    setIsSubmitting(false)
    navigate('done')
  }

  const resetApp = async () => {
    if (confirm('FULL SYSTEM RESET? This wipes ALL data including Supabase settings.')) {
      await updateSharedState(INITIAL_STATE)
      localStorage.clear()
      window.location.reload()
    }
  }

  const softReset = async () => {
    if (confirm('ALLOW REVOTE? This wipes all scores and judge names, but keeps app settings.')) {
      await updateSharedState({
        ...sharedState,
        allVotes: {},
        allBD: { winner: {}, runnerup: {} },
        voterNames: [],
        stationCounts: {},
        updatedAt: Date.now()
      })
      localStorage.removeItem('pq_votes')
      localStorage.removeItem('pq_bd')
      localStorage.removeItem('pq_screen')
      alert('Scores cleared. You can now refresh and revote.')
      window.location.reload()
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
            <div 
              style={{ fontSize: '80px', marginBottom: '10px', cursor: 'pointer' }} 
              onClick={handlePotTap}
            >🫕</div>
            <div className="app-team-title">THE APP TEAM'S</div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', marginTop: '-2px', color: 'var(--primary-dark)' }}>Potjie Cook-Off</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '5px' }}>7 stations · 5 criteria · 1 champion</p>
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
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden', marginTop: '40px' }}
              >
                <div className="card" style={{ background: 'rgba(0, 55, 100, 0.05)', borderColor: 'var(--primary-dark)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Lock size={14} className="text-muted" />
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-dark)' }}>ADMIN CONSOLE</span>
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
                      style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', color: 'black' }}
                    />
                    <button 
                      className="btn btn-primary" 
                      style={{ width: 'auto', padding: '12px 24px' }}
                      onClick={handleAdminEnter}
                    >Enter</button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
               <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {stationsVoted === TEAMS.length ? '✅ All stations complete!' : `${TEAMS.length - stationsVoted} stations remaining`}
               </span>
               <span className="text-muted" style={{ fontSize: '14px' }}>{stationsVoted}/{TEAMS.length}</span>
            </div>
            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '24px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.5s ease' }} />
            </div>

            {!sharedState?.votingOpen && (
              <div className="card" style={{ borderColor: 'var(--error)', background: 'rgba(225, 27, 34, 0.05)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <AlertCircle className="text-error" />
                  <div style={{ fontWeight: 'bold' }}>Voting has been closed by the admin</div>
                </div>
              </div>
            )}

            <TimerDisplay timerEnd={sharedState?.timerEnd} />

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
                    cursor: voted || !sharedState.votingOpen ? 'default' : 'pointer',
                    pointerEvents: voted || !sharedState.votingOpen ? 'none' : 'auto'
                  }}
                  onClick={() => handleVoteTeam(team.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '32px' }}>{team.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{team.name}</div>
                      {voted ? (
                        <div className="text-success" style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> Voted · avg {getUserTeamAvg(team.id)}
                        </div>
                      ) : (
                        <div className="text-muted" style={{ fontSize: '14px' }}>Tap to judge &rarr;</div>
                      )}
                    </div>
                  </div>
                  <div className="status-badge" style={{ background: 'var(--border)', color: 'var(--text-primary)' }}>
                    <Users size={12} /> {totalVoters}
                  </div>
                </div>
              )
            })}

            <button 
              className={`btn ${stationsVoted === TEAMS.length && (sharedState?.votingOpen || screen !== 'list') ? 'btn-primary' : 'btn-secondary btn-disabled'}`}
              style={{ marginTop: '20px' }}
              disabled={stationsVoted !== TEAMS.length || !sharedState?.votingOpen}
              onClick={() => navigate('dressed')}
            >
              Submit Votes & Pick Best Dressed &rarr;
            </button>

            <button 
              className={`btn ${sharedState?.leaderboardOn ? 'btn-primary' : 'btn-secondary btn-disabled'}`}
              style={{ marginTop: '12px', marginBottom: '40px' }}
              disabled={!sharedState?.leaderboardOn}
              onClick={() => navigate('leaderboard')}
            >
              <BarChart3 size={20} style={{ marginRight: '10px' }} />
              {sharedState?.leaderboardOn ? 'View Live Leaderboard' : 'Leaderboard Locked'}
            </button>
          </div>
        </motion.div>
      )}

      {screen === 'vote' && activeTeamId && (
        <motion.div key="vote" className="fade-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {(() => {
            const team = TEAMS.find(t => t.id === activeTeamId)
            const draftAvg = (Object.values(draftScores).reduce((a, b) => a + b, 0) / CRITERIA.length).toFixed(1)
            return (
              <>
                <Header 
                  title={team.name} 
                  subtitle={`STATION ${activeTeamId} · ${TEAMS.length - stationsVoted - 1} more after this`}
                  left={<span style={{ fontSize: '32px' }}>{team.emoji}</span>}
                  right={<button onClick={() => navigate('list')}><X size={24} /></button>}
                />
                <div style={{ padding: '16px' }}>
                  <div className="card" style={{ background: 'rgba(48, 209, 88, 0.05)', borderColor: 'rgba(48, 209, 88, 0.2)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '12px', fontWeight: 'bold' }}>
                      <CheckCircle2 size={14} /> SCORES AUTO-SAVED AS YOU DRAG
                    </div>
                  </div>

                  {CRITERIA.map(c => (
                    <CriterionSlider 
                      key={c.id} 
                      criterion={c} 
                      value={draftScores[c.id]} 
                      onChange={(val) => setDraftScores({...draftScores, [c.id]: val})} 
                    />
                  ))}

                  <div className="card glass" style={{ position: 'sticky', bottom: '16px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '2px solid var(--primary)' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 'bold' }}>TEAM AVERAGE</div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{draftAvg}</div>
                    </div>
                    <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 24px' }} onClick={submitVote}>
                      Lock In Scores
                    </button>
                  </div>
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Progress auto-saved · Safe to close
                  </div>
                </div>
              </>
            )
          })()}
        </motion.div>
      )}

      {screen === 'dressed' && (
        <motion.div key="dressed" className="fade-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Header title="Best Dressed" subtitle="VIBE & DRIP" />
          <div style={{ padding: '16px' }}>
             <div className="card" style={{ background: 'rgba(10, 132, 255, 0.05)', borderColor: 'rgba(10, 132, 255, 0.2)' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>👗</span>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Best Dressed Award</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Separate from food scoring. Who had the best team spirit and stall setup?</div>
                  </div>
                </div>
             </div>

              <h3 style={{ margin: '24px 0 12px', fontSize: '20px', color: 'var(--primary-dark)' }}>🏆 Pick Best Dressed Station</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                 {TEAMS.map(t => (
                   <button 
                     key={t.id}
                     className={`btn ${bd.winner === t.id ? 'btn-primary' : 'btn-secondary'}`}
                     style={{ fontSize: '14px', justifyContent: 'flex-start', padding: '12px' }}
                     onClick={() => setBd({ winner: t.id })}
                   >
                     <span style={{ marginRight: '12px', fontSize: '20px' }}>{t.emoji}</span>
                     {t.name}
                   </button>
                 ))}
              </div>

             <button 
              className={`btn ${bd.winner ? 'btn-primary' : 'btn-secondary btn-disabled'}`}
              style={{ marginBottom: '60px' }}
              disabled={!bd.winner}
              onClick={submitBestDressed}
             >
              Submit Best Dressed Vote
             </button>
          </div>
        </motion.div>
      )}

      {screen === 'done' && (
        <motion.div key="done" className="fade-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ marginTop: '60px', marginBottom: '40px' }}>
            <div style={{ fontSize: '100px', marginBottom: '20px' }}>🏅</div>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>You're done, {name}!</h1>
            <p className="text-muted" style={{ padding: '0 20px', marginTop: '10px' }}>All 7 stations judged & best dressed voted. Results will be revealed by the admin.</p>
          </div>

          <TimerDisplay timerEnd={sharedState.timerEnd} />

          <button 
            className={`btn ${sharedState.leaderboardOn ? 'btn-primary' : 'btn-secondary btn-disabled'}`}
            style={{ marginBottom: '16px' }}
            disabled={!sharedState.leaderboardOn}
            onClick={() => navigate('leaderboard')}
          >
            <BarChart3 size={20} style={{ marginRight: '10px' }} />
            {sharedState.leaderboardOn ? 'View Live Leaderboard' : 'Leaderboard not yet released'}
          </button>

          <button className="btn btn-secondary" onClick={() => navigate('home')}>
            Return to Home
          </button>

          <div className="card" style={{ marginTop: '40px', textAlign: 'left' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 'bold' }}>YOUR SCORES SUMMARY</h3>
            {TEAMS.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span className="text-muted">{t.emoji} {t.name}</span>
                <span style={{ fontWeight: 'bold' }}>{getUserTeamAvg(t.id)}</span>
              </div>
            ))}
            <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
               <span className="text-muted">👗 Best Dressed Pick</span>
               <span style={{ fontWeight: 'bold' }}>{TEAMS.find(t => t.id === bd.winner)?.name}</span>
            </div>
          </div>
        </motion.div>
      )}

      {screen === 'leaderboard' && (
        <motion.div key="leaderboard" className="fade-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Header 
            title="Leaderboard" 
            subtitle={`${sharedState?.voterNames?.length || 0} JUDGES VOTED`} 
            showBadge 
            syncStatus={syncStatus}
            left={<Trophy className="text-orange" />}
            right={<button onClick={() => navigate('home')}><Home size={24} /></button>}
          />
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <div className="dot dot-live" style={{ width: '10px', height: '10px' }} />
              <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>LIVE RANKINGS</span>
            </div>

            {(() => {
              const rankedTeams = [...TEAMS].sort((a, b) => parseFloat(getTeamAvg(b.id)) - parseFloat(getTeamAvg(a.id)))
              return rankedTeams.map((team, index) => {
                const avg = getTeamAvg(team.id)
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null
                const voteData = sharedState.allVotes[team.id] || { sums: {}, count: 0 }
                return (
                  <div key={team.id} className="card" style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: index < 3 ? 'var(--primary)' : 'var(--text-muted)', width: '20px' }}>
                          {medal || index + 1}
                        </span>
                        <span style={{ fontSize: '24px' }}>{team.emoji}</span>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--primary-dark)' }}>{team.name}</div>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: index === 0 ? 'var(--accent)' : 'var(--primary-dark)' }}>{avg}</div>
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                       {CRITERIA.map(c => {
                         const cAvg = voteData.count ? (voteData.sums[c.id] / voteData.count).toFixed(1) : '–'
                         return (
                           <div key={c.id} style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                             {c.emoji} {cAvg}
                           </div>
                         )
                       })}
                       <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--primary)' }}>👤 {voteData.count} votes</div>
                    </div>
                  </div>
                )
              })
            })()}

            <div className="card" style={{ marginTop: '24px', marginBottom: '40px' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--primary-dark)' }}>👗 Best Dressed Results</h3>
              {TEAMS.map(t => {
                const votes = sharedState?.allBD?.[t.id] || 0
                
                // Show ONLY winner to normal users, show all to admin
                const isWinner = votes > 0 && votes === Math.max(...Object.values(sharedState?.allBD || { 'none': 0 }))
                
                if (votes === 0) return null
                if (screen !== 'admin' && !isWinner) return null
                
                return (
                  <div key={t.id} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: isWinner ? '900' : 'normal' }}>{t.emoji} {t.name}</span>
                      <span>{votes} 🎖️</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                       <div style={{ width: `${(votes / (sharedState?.voterNames?.length || 1)) * 100}%`, height: '100%', background: 'var(--primary)' }} />
                    </div>
                    {isWinner && <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 'bold', marginTop: '4px' }}>CURRENT LEADER</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}

      {screen === 'admin' && (
        <motion.div key="admin" className="fade-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Header 
            title="Admin Dashboard" 
            subtitle="COMMAND CENTER" 
            showBadge 
            syncStatus={syncStatus}
            left={<Settings className="text-orange" />}
            right={<button onClick={() => navigate('home')}><X size={24} /></button>}
          />
          <div style={{ padding: '16px' }}>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SUPABASE SYNC</div>
                <div style={{ fontWeight: 'bold', color: syncStatus === 'live' ? 'var(--success)' : 'var(--error)' }}>
                  {syncStatus === 'live' ? 'Connected & Live' : 'Not Connected'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: '12px' }} onClick={fetchState}>Refresh Data</button>
                <button className="btn btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: '12px' }} onClick={() => navigate('setup')}>API Settings</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
               <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
                  <Users size={16} className="text-primary" style={{ marginBottom: '4px' }} />
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{sharedState?.voterNames?.length || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>VOTERS</div>
               </div>
               <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
                  <Flame size={16} className="text-primary" style={{ marginBottom: '4px' }} />
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{Object.keys(sharedState?.stationCounts || {}).length}/7</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>STATIONS</div>
               </div>
               <div className="card" style={{ textAlign: 'center', marginBottom: 0 }}>
                  <CheckCircle2 size={16} className="text-primary" style={{ marginBottom: '4px' }} />
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{Object.values(sharedState?.allBD || {}).reduce((a, b) => a + (Number(b) || 0), 0)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BD VOTES</div>
               </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Voting Control</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div className={`dot ${sharedState.votingOpen ? 'dot-live' : 'dot-offline'}`} />
                <span style={{ fontWeight: 'bold' }}>STATUS: {sharedState.votingOpen ? 'OPEN' : 'CLOSED'}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                 <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => updateSharedState({...sharedState, votingOpen: true})}>Open</button>
                 <button className="btn btn-secondary" style={{ flex: 1, borderColor: 'var(--error)', color: 'var(--error)' }} onClick={() => updateSharedState({...sharedState, votingOpen: false, timerEnd: null})}>Close</button>
              </div>
            </div>

            <div className="card">
               <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Countdown Timer</h3>
               {sharedState.timerEnd ? (
                 <div style={{ textAlign: 'center' }}>
                    <TimerDisplay timerEnd={sharedState.timerEnd} />
                    <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => updateSharedState({...sharedState, timerEnd: null})}>Cancel Timer</button>
                 </div>
               ) : (
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[15, 30, 45, 60, 90, 120].map(m => (
                      <button key={m} className="btn btn-secondary" style={{ padding: '8px', fontSize: '12px' }} onClick={() => updateSharedState({...sharedState, timerEnd: Date.now() + m * 60 * 1000, votingOpen: true})}>{m}m</button>
                    ))}
                 </div>
               )}
            </div>

            <div className="card">
               <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Leaderboard Visibility</h3>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div className={`dot ${sharedState.leaderboardOn ? 'dot-live' : 'dot-offline'}`} />
                <span style={{ fontWeight: 'bold' }}>STATUS: {sharedState.leaderboardOn ? 'PUBLIC' : 'HIDDEN'}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                 <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => updateSharedState({...sharedState, leaderboardOn: true})}>Enable</button>
                 <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => updateSharedState({...sharedState, leaderboardOn: false})}>Disable</button>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Live Rankings (Private)</h3>
              {[...TEAMS].sort((a,b) => parseFloat(getTeamAvg(b.id)) - parseFloat(getTeamAvg(a.id))).map((t, i) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>{i+1}. {t.emoji} {t.name} (👤{sharedState.stationCounts[t.id] || 0})</span>
                  <span style={{ fontWeight: 'bold' }}>{getTeamAvg(t.id)}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ direction: 'ltr' }}>
               <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Completed Judges ({sharedState?.voterNames?.length || 0})</h3>
               <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {sharedState?.voterNames?.map((n, i) => <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>{n}</div>)}
               </div>
            </div>

            <div className="card" style={{ borderColor: 'var(--error)', background: 'rgba(225, 27, 34, 0.05)', marginTop: '40px' }}>
               <h3 style={{ color: 'var(--error)', marginBottom: '12px' }}>DANGER ZONE</h3>
               <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }} onClick={softReset}>
                    Soft Reset (Revotes)
                  </button>
                  <button className="btn btn-secondary" style={{ borderColor: 'var(--error)', color: 'var(--error)' }} onClick={resetApp}>
                    Full wipe
                  </button>
               </div>
               <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '12px' }}>
                 Soft reset clears votes but keeps timer & leaderboard settings.
               </p>
            </div>
            <div style={{ height: '60px' }} />
          </div>
        </motion.div>
      )}

      {screen === 'setup' && (
        <motion.div key="setup" className="fade-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Header title="Setup" subtitle="SUPABASE CONNECTION" right={<button onClick={() => navigate('admin')}><X size={24} /></button>} />
          <div style={{ padding: '16px' }}>
            <div className="card shadow-sm">
              <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--primary-dark)' }}>Supabase Configuration</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>These credentials allow your app to sync scores in real-time.</p>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--primary-dark)', display: 'block', marginBottom: '4px' }}>PROJECT URL</label>
                <input 
                  type="text" 
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="glass"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', color: 'black' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--primary-dark)', display: 'block', marginBottom: '4px' }}>ANON KEY</label>
                <textarea 
                  rows={3}
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  placeholder="Supabase Anon Key"
                  className="glass"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', color: 'black', fontSize: '12px' }}
                />
              </div>

              <button className="btn btn-primary" onClick={() => navigate('admin')}>
                Save & Continue
              </button>
            </div>

            <div className="card">
               <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Database Schema (Run in Supabase SQL)</h3>
               <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Run this code in your Supabase SQL Editor to enable real-time scoring and data integrity.</p>
               <pre style={{ fontSize: '10px', background: 'black', padding: '12px', borderRadius: '8px', overflowX: 'auto', color: '#0f0' }}>
{`create table potjie_state (
  id text primary key,
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter publication supabase_realtime add table potjie_state;
create policy "Public Access" on potjie_state for all using (true);

-- Initialize
insert into potjie_state (id, data) 
values ('main', '{"votingOpen": true, "leaderboardOn": false, "allVotes": {}, "allBD": {}, "voterNames": [], "stationCounts": {}, "timerEnd": null}')
on conflict (id) do nothing;

-- ATOMIC VOTE FUNCTION (Fixes integrity issues)
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
  
  -- Add judge name if not exists
  if not (current_data->'voterNames' @> jsonb_build_array(p_judge_name)) then
    current_data := jsonb_set(current_data, '{voterNames}', (current_data->'voterNames') || jsonb_build_array(p_judge_name));
  end if;

  if p_is_best_dressed then
     -- Update Best Dressed (increment count)
     current_data := jsonb_set(
       current_data, 
       array['allBD', p_team_id], 
       to_jsonb(coalesce((current_data->'allBD'->>p_team_id)::int, 0) + 1)
     );
  else
     -- Update normal scores (increment counts and sums)
     declare
       team_path text[] := array['allVotes', p_team_id];
       team_data jsonb := coalesce(current_data->'allVotes'->p_team_id, '{"sums": {}, "count": 0}'::jsonb);
       criterion text;
       score int;
     begin
       team_data := jsonb_set(team_data, '{count}', to_jsonb((team_data->>'count')::int + 1));
       for criterion, score in select * from jsonb_each_text(p_scores) loop
         team_data := jsonb_set(
           team_data, 
           array['sums', criterion], 
           to_jsonb(coalesce((team_data->'sums'->>criterion)::int, 0) + score::int)
         );
       end loop;
       current_data := jsonb_set(current_data, team_path, team_data);
       
       -- Update station count
       current_data := jsonb_set(
         current_data, 
         array['stationCounts', p_team_id], 
         to_jsonb(coalesce((current_data->'stationCounts'->>p_team_id)::int, 0) + 1)
       );
     end;
  end if;

  update potjie_state set data = current_data, updated_at = now() where id = 'main';
end;
$$ language plpgsql;`}
              </pre>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Step 2: Connect</h3>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PROJECT URL</label>
                <input type="text" value={sbUrl} onChange={(e) => setSbUrl(e.target.value)} className="glass" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ANON KEY</label>
                <input type="password" value={sbKey} onChange={(e) => setSbKey(e.target.value)} className="glass" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} />
              </div>
              <button className="btn btn-primary" onClick={() => navigate('admin')}>Save & Connect</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App
