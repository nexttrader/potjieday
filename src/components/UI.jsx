import React from 'react'

export const ProgressRing = ({ progress, size = 48, stroke = 4, color = "var(--primary)" }) => {
  const radius = (size - stroke) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        stroke="var(--border)"
        fill="transparent"
        strokeWidth={stroke}
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        stroke={color}
        fill="transparent"
        strokeWidth={stroke}
        strokeDasharray={circumference + ' ' + circumference}
        style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 0.5s ease' }}
        strokeLinecap="round"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
    </svg>
  )
}

export const Header = ({ title, subtitle, left, right, showBadge, syncStatus }) => (
  <div className="sticky-header glass">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {left}
        <div>
          <div style={{ fontSize: '10px', color: 'var(--primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>{subtitle}</div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>{title}</h2>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {right}
        {showBadge && (
          <div className="status-badge">
            <div className={`dot dot-${syncStatus}`} />
            <span style={{ textTransform: 'capitalize' }}>{syncStatus}</span>
          </div>
        )}
      </div>
    </div>
  </div>
)

export const TimerDisplay = ({ timerEnd, onEnd }) => {
  const [timeLeft, setTimeLeft] = React.useState(null)

  React.useEffect(() => {
    if (!timerEnd) {
      setTimeLeft(null)
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const diff = timerEnd - now
      if (diff <= 0) {
        clearInterval(interval)
        setTimeLeft(0)
        if (onEnd) onEnd()
      } else {
        setTimeLeft(diff)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timerEnd])

  if (timeLeft === null) return null

  const minutes = Math.floor(timeLeft / 1000 / 60)
  const seconds = Math.floor((timeLeft / 1000) % 60)
  const isUrgent = timeLeft < 5 * 60 * 1000

  return (
    <div className="card fade-in" style={{ borderColor: isUrgent ? 'var(--error)' : 'var(--primary)', textAlign: 'center' }}>
      <div style={{ fontSize: '12px', color: isUrgent ? 'var(--error)' : 'var(--primary)', fontWeight: 'bold' }}>VOTING CLOSES IN</div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: isUrgent ? 'var(--error)' : 'white' }}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
    </div>
  )
}

export const CriterionSlider = ({ criterion, value, onChange }) => (
  <div className="card" style={{ marginBottom: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '24px' }}>{criterion.emoji}</span>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{criterion.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{criterion.desc}</div>
        </div>
      </div>
      <div style={{ 
        background: 'var(--primary)', 
        width: '40px', 
        height: '40px', 
        borderRadius: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '18px'
      }}>
        {value}
      </div>
    </div>
    <input 
      type="range" 
      min="1" 
      max="10" 
      step="1" 
      value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))}
    />
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
      <span>1 — POOR</span>
      <span>10 — EXCELLENT</span>
    </div>
  </div>
)
