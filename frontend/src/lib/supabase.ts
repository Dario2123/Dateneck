import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Player = {
  sofascore_id: number
  name: string
  team: string
  league: string
  position: string
  nationality: string
  age: number | null
  height: number | null
  market_value: number | null
}

export type PlayerStats = {
  sofascore_id: number
  season: string
  goals: number | null
  assists: number | null
  goals_assists_sum: number | null
  expected_goals: number | null
  expected_assists: number | null
  big_chances_created: number | null
  big_chances_missed: number | null
  total_shots: number | null
  shots_on_target: number | null
  accurate_passes: number | null
  total_passes: number | null
  accurate_passes_pct: number | null
  accurate_final_third_passes: number | null
  key_passes: number | null
  accurate_long_balls: number | null
  accurate_long_balls_pct: number | null
  accurate_crosses: number | null
  total_crosses: number | null
  successful_dribbles: number | null
  successful_dribbles_pct: number | null
  ground_duels_won: number | null
  ground_duels_won_pct: number | null
  aerial_duels_won: number | null
  aerial_duels_won_pct: number | null
  total_duels_won: number | null
  total_duels_won_pct: number | null
  tackles: number | null
  tackles_won: number | null
  tackles_won_pct: number | null
  interceptions: number | null
  clearances: number | null
  possession_lost: number | null
  ball_recovery: number | null
  touches: number | null
  yellow_cards: number | null
  red_cards: number | null
  fouls: number | null
  was_fouled: number | null
  appearances: number | null
  matches_started: number | null
  minutes_played: number | null
  rating: number | null
}

export type PlayerWithStats = Player & PlayerStats
