// src/lib/stats.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- TYPES FOR RETURN DATA ---
export interface MetaStat {
    civ_name: string;
    win_rate: number;
    games_played: number;
}

export interface TimingStat {
    period: 'Early (<25m)' | 'Mid (25-40m)' | 'Late (40m+)';
    win_rate: number;
    games_played: number;
}

export interface MatchupStat {
    civ_name: string;
    vs_opponent: string;
    games_played: number;
    win_rate: number;
}

// --- TYPES FOR DB ROWS (Internal) ---
interface MatchMeta {
    map_name: string;
    average_elo: number | null;
    num_players: number | null;
}

interface MetaRow {
    civ_name: string;
    is_winner: boolean;
    matches: MatchMeta | MatchMeta[] | null;
}

interface MatchDuration {
    duration_seconds: number | null;
}

interface TimingRow {
    is_winner: boolean;
    matches: MatchDuration | MatchDuration[] | null;
}

// --- TOOL 1: META STATS (Map & Team Size) ---
export async function getMetaStats(
    mapName: string = 'arabia',
    teamSize: string = '1v1',
    minElo: number = 1000
): Promise<MetaStat[]> {

    const sizeMap: Record<string, number> = { '1v1': 2, '2v2': 4, '3v3': 6, '4v4': 8 };
    const numPlayers = sizeMap[teamSize] || 2;

    const { data, error } = await supabase
        .from('match_players')
        .select(`
      civ_name,
      is_winner,
      matches!inner ( map_name, average_elo, num_players )
    `)
        .eq('matches.map_name', mapName)
        .eq('matches.num_players', numPlayers)
        .gt('matches.average_elo', minElo)
        .limit(3000);

    if (error || !data) {
        console.error("Meta fetch error:", error);
        return [];
    }

    const rows = data as unknown as MetaRow[];
    const stats = new Map<string, { wins: number; total: number }>();

    for (const row of rows) {
        if (!row.civ_name) continue;
        const civ = row.civ_name;
        const current = stats.get(civ) || { wins: 0, total: 0 };
        current.total++;
        if (row.is_winner) current.wins++;
        stats.set(civ, current);
    }

    return Array.from(stats.entries())
        .map(([civ, s]) => ({
            civ_name: civ,
            games_played: s.total,
            win_rate: parseFloat(((s.wins / s.total) * 100).toFixed(1))
        }))
        .filter(s => s.games_played > 10)
        .sort((a, b) => b.win_rate - a.win_rate)
        .slice(0, 10);
}

// --- TOOL 2: HEAD TO HEAD (Counter Picks) ---
export async function getMatchupStats(
    myCiv: string | null,
    opponentCiv: string,
    mapName: string = 'arabia',
    minElo: number = 1000
): Promise<MatchupStat[]> {
    const oppCiv = opponentCiv.toLowerCase();

    const { data: oppMatches } = await supabase
        .from('match_players')
        .select('match_id')
        .eq('civ_name', oppCiv)
        .limit(500);

    if (!oppMatches) return [];
    const matchIds = oppMatches.map(m => m.match_id);

    const { data: myMatches } = await supabase
        .from('match_players')
        .select(`
      civ_name, is_winner,
      matches!inner ( map_name, average_elo, num_players )
    `)
        .in('match_id', matchIds)
        .neq('civ_name', oppCiv)
        .eq('matches.map_name', mapName)
        .eq('matches.num_players', 2)
        .gt('matches.average_elo', minElo);

    if (!myMatches) return [];

    const rows = myMatches as unknown as MetaRow[];
    const stats = new Map<string, { wins: number; total: number }>();

    for (const row of rows) {
        if (!row.civ_name) continue;
        const civ = row.civ_name;
        const current = stats.get(civ) || { wins: 0, total: 0 };
        current.total++;
        if (row.is_winner) current.wins++;
        stats.set(civ, current);
    }

    const results = Array.from(stats.entries())
        .map(([civ, s]) => ({
            civ_name: civ,
            vs_opponent: oppCiv,
            games_played: s.total,
            win_rate: parseFloat(((s.wins / s.total) * 100).toFixed(1))
        }))
        .filter(s => s.games_played > 5)
        .sort((a, b) => b.win_rate - a.win_rate);

    if (myCiv) {
        return results.filter(r => r.civ_name === myCiv.toLowerCase());
    }

    return results.slice(0, 5);
}

// --- TOOL 3: POWER SPIKES (Timing) ---
export async function getPowerSpikes(civName: string): Promise<TimingStat[]> {
    const civ = civName.toLowerCase();

    const { data, error } = await supabase
        .from('match_players')
        .select(`
      is_winner,
      matches!inner ( duration_seconds )
    `)
        .eq('civ_name', civ)
        .limit(1000);

    if (error || !data) return [];

    const rows = data as unknown as TimingRow[];
    const periods = {
        early: { wins: 0, total: 0 },
        mid:   { wins: 0, total: 0 },
        late:  { wins: 0, total: 0 }
    };

    for (const row of rows) {
        const matchData = Array.isArray(row.matches) ? row.matches[0] : row.matches;
        const dur = matchData?.duration_seconds;

        if (dur === null || dur === undefined) continue;

        let p = periods.early;
        if (dur > 2400) p = periods.late;
        else if (dur > 1500) p = periods.mid;

        p.total++;
        if (row.is_winner) p.wins++;
    }

    const safeCalc = (wins: number, total: number) =>
        total === 0 ? 0 : parseFloat(((wins / total) * 100).toFixed(1));

    // FIX: Using 'games_played' to match the interface
    return [
        { period: 'Early (<25m)', win_rate: safeCalc(periods.early.wins, periods.early.total), games_played: periods.early.total },
        { period: 'Mid (25-40m)', win_rate: safeCalc(periods.mid.wins, periods.mid.total), games_played: periods.mid.total },
        { period: 'Late (40m+)',  win_rate: safeCalc(periods.late.wins, periods.late.total),   games_played: periods.late.total },
    ];
}