import { useState, useEffect, useRef } from 'react'
import { getSupabase, INITIAL_STATE } from './supabase'

export const usePotjieState = () => {
  const [sbUrl, setSbUrl] = useState(() => localStorage.getItem('pq_sburl') || 'https://oninidfqzuxyrnoblbvu.supabase.co')
  const [sbKey, setSbKey] = useState(() => localStorage.getItem('pq_sbkey') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uaW5pZGZxenV4eXJub2JsYnZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTY2NzYsImV4cCI6MjA5MTczMjY3Nn0.XIggsgtcESwzsg0Zj_Lnnwz7GiuLqwdunaqEyzdsJ1c')
  const [sharedState, setSharedState] = useState(INITIAL_STATE)
  const [syncStatus, setSyncStatus] = useState('local') // 'live', 'connecting', 'offline', 'local'
  const [isInitialized, setIsInitialized] = useState(false)
  
  const supabase = getSupabase(sbUrl, sbKey)

  useEffect(() => {
    if (sbUrl) localStorage.setItem('pq_sburl', sbUrl)
    else localStorage.removeItem('pq_sburl')
  }, [sbUrl])

  useEffect(() => {
    if (sbKey) localStorage.setItem('pq_sbkey', sbKey)
    else localStorage.removeItem('pq_sbkey')
  }, [sbKey])

  const fetchState = async () => {
    if (!supabase) {
      setSyncStatus('local')
      return
    }
    
    setSyncStatus('connecting')
    try {
      const { data, error } = await supabase
        .from('potjie_state')
        .select('data')
        .eq('id', 'main')
        .single()
      
      if (error) throw error
      if (data && data.data) {
        setSharedState({ ...INITIAL_STATE, ...data.data })
        setSyncStatus('live')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setSyncStatus('offline')
    }
  }

  useEffect(() => {
    fetchState()

    if (!supabase) return

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'potjie_state', filter: 'id=eq.main' },
        (payload) => {
          if (payload.new && payload.new.data) {
            setSharedState(current => ({ ...INITIAL_STATE, ...payload.new.data }))
            setSyncStatus('live')
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncStatus('live')
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setSyncStatus('offline')
      })

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchState()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sbUrl, sbKey])

  const updateSharedState = async (newState) => {
    const finalState = { ...newState, updatedAt: Date.now() }
    setSharedState(finalState)
    
    if (supabase) {
      try {
        const { error } = await supabase
          .from('potjie_state')
          .update({ data: finalState })
          .eq('id', 'main')
        
        if (error) throw error
      } catch (err) {
        console.error('Update error:', err)
        setSyncStatus('offline')
      }
    }
  }

  return {
    sharedState,
    updateSharedState,
    syncStatus,
    sbUrl,
    setSbUrl,
    sbKey,
    setSbKey,
    fetchState,
    supabase
  }
}
