import { createClient } from '@supabase/supabase-js'

export const TEAMS = [
  { id: '1', name: 'NAPT Potjie Team', emoji: '🥘' },
  { id: '2', name: 'Winer Winer Chicken Diner', emoji: '🍗' },
  { id: '3', name: 'The Potjie Bootjies', emoji: '🫕' },
  { id: '4', name: 'Chef de Ops', emoji: '👨‍🍳' },
  { id: '5', name: 'The Bread Winners', emoji: '🍞' },
  { id: '6', name: 'Risky Potatoes', emoji: '🥔' },
  { id: '7', name: 'The Rec Yard Rebels', emoji: '🔥' }
]

export const CRITERIA = [
  { id: 'taste', name: 'Taste', emoji: '👅', desc: 'How does it taste?' },
  { id: 'tenderness', name: 'Tenderness', emoji: '🥩', desc: 'Meat texture & softness' },
  { id: 'aroma', name: 'Aroma', emoji: '🌿', desc: 'Smell & fragrance' },
  { id: 'gees', name: 'Gees (Spirit)', emoji: '🤙', desc: 'Team energy & vibe' }
]

export const PIN = 'LEKKER2026'

let supabase = null

export const getSupabase = (url, key) => {
  if (!url || !key) return null
  if (supabase && supabase.supabaseUrl === url) return supabase
  supabase = createClient(url, key)
  return supabase
}

export const INITIAL_STATE = {
  votingOpen: true,
  timerEnd: null,
  leaderboardOn: false,
  allVotes: {}, // { teamId: { sums: { taste, ... }, count } }
  allBD: {}, // { teamId: count }
  voterNames: [],
  stationCounts: {}, // { teamId: count }
  updatedAt: Date.now()
}
