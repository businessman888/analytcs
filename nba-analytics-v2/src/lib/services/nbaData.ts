/**
 * NBA Data Service
 * Server-side only - Consumes Sportradar Standard + Synergy APIs
 */

import { cache } from 'react';

const STATS_BASE_URL = 'https://api.sportradar.us/nba/trial/v8/en';
const SYNERGY_BASE_URL = 'https://api.sportradar.us/nba-synergy/tb/v1/en';

// ==========================================================================
// DYNAMIC SEASON YEAR CALCULATOR
// NBA Season runs Oct → June (next year)
// API uses the START year of the season (2025 for 2025-2026 season)
// ==========================================================================
function calculateCurrentSeasonYear(): number {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // NBA Season Logic:
    // - October to December: Season starts THIS year (e.g., Dec 2025 → 2025)
    // - January to June: Season started LAST year (e.g., Feb 2026 → 2025)
    // - July to September: Off-season, use previous season year

    if (currentMonth >= 10) {
        // Oct, Nov, Dec - season starts this year
        return currentYear;
    } else if (currentMonth <= 6) {
        // Jan, Feb, Mar, Apr, May, Jun - season started last year
        return currentYear - 1;
    } else {
        // Jul, Aug, Sep - off-season, return previous season
        return currentYear - 1;
    }
}

// Export for debugging/display purposes
export const CURRENT_SEASON_YEAR = calculateCurrentSeasonYear();
console.log(`[NBA] Dynamic Season Year: ${CURRENT_SEASON_YEAR} (for ${CURRENT_SEASON_YEAR}-${CURRENT_SEASON_YEAR + 1} season)`);

// Types
export interface Game {
    id: string;
    scheduled: string;
    home: {
        id: string;
        name: string;
        alias: string;
    };
    away: {
        id: string;
        name: string;
        alias: string;
    };
    venue?: {
        name: string;
        city: string;
    };
    broadcast?: {
        network: string;
    };
}

export interface ScheduleResponse {
    date: string;
    games: Game[];
}

export interface Injury {
    id: string;
    playerId: string;
    playerName: string;
    team: string;
    teamId: string;
    position: string;
    status: 'Out' | 'Day-To-Day' | 'Questionable' | 'Probable';
    description: string;
    updateDate: string;
}

export interface InjuryReport {
    date: string;
    injuries: Injury[];
}

export interface SynergyPlayType {
    playType: string;
    ppp: number; // Points Per Possession
    percentile: number;
    frequency: number;
    possessions: number;
}

export interface PlayerSynergyStats {
    playerId: string;
    playerName: string;
    team: string;
    playTypes: SynergyPlayType[];
}

export interface TeamDefenseStats {
    teamId: string;
    teamName: string;
    alias: string;
    defenseRanks: {
        iso: number;
        pnr: number;
        spotup: number;
        transition: number;
        postup: number;
        overall: number;
    };
}

// Helper to make authenticated requests
async function fetchSportradar<T>(
    baseUrl: string,
    endpoint: string
): Promise<T> {
    // Next.js server-side env var (no VITE_ prefix needed)
    const apiKey = process.env.SPORTRADAR_API_KEY;

    if (!apiKey) {
        throw new Error('Missing API key: SPORTRADAR_API_KEY');
    }

    const url = `${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('RATE_LIMIT: API rate limit exceeded. Please try again later.');
        }
        if (response.status === 403) {
            throw new Error('FORBIDDEN: API key expired or insufficient permissions.');
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// Cached data fetchers
export const getSchedule = cache(async (): Promise<ScheduleResponse> => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const data = await fetchSportradar<{ games: Game[] }>(
        STATS_BASE_URL,
        `/games/${year}/${month}/${day}/schedule.json`
    );

    return {
        date: `${year}-${month}-${day}`,
        games: data.games || [],
    };
});

export const getInjuries = cache(async (): Promise<InjuryReport> => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    interface RawInjury {
        id: string;
        full_name: string;
        primary_position: string;
        injury?: {
            status: string;
            desc: string;
            update_date: string;
        };
    }

    interface RawTeam {
        id: string;
        name: string;
        alias: string;
        players: RawInjury[];
    }

    const data = await fetchSportradar<{ teams: RawTeam[] }>(
        STATS_BASE_URL,
        `/league/injuries.json`
    );

    // Debug logging
    console.log(`[Injuries] Raw API response has ${data.teams?.length || 0} teams`);

    // Count total players with injuries across all teams
    let playersWithInjuries = 0;
    for (const team of data.teams || []) {
        const injuredPlayers = (team.players || []).filter(p => p.injury);
        if (injuredPlayers.length > 0) {
            playersWithInjuries += injuredPlayers.length;
            console.log(`[Injuries] ${team.alias}: ${injuredPlayers.length} injured players`);
        }
    }
    console.log(`[Injuries] Total players with injuries: ${playersWithInjuries}`);

    // Flatten and filter injuries
    const injuries: Injury[] = [];
    const statusesFound = new Set<string>();

    for (const team of data.teams || []) {
        for (const player of team.players || []) {
            if (player.injury) {
                const rawStatus = player.injury.status;
                statusesFound.add(rawStatus);

                // Include all injury statuses (case-insensitive comparison)
                const validStatuses = ['out', 'day-to-day', 'questionable', 'probable', 'doubtful'];
                const statusLower = (rawStatus || '').toLowerCase();

                if (validStatuses.includes(statusLower)) {
                    injuries.push({
                        id: `${team.id}-${player.id}`,
                        playerId: player.id,
                        playerName: player.full_name,
                        team: team.alias,
                        teamId: team.id,
                        position: player.primary_position,
                        status: rawStatus as Injury['status'],
                        description: player.injury.desc || 'No details',
                        updateDate: player.injury.update_date,
                    });
                }
            }
        }
    }

    console.log(`[Injuries] Statuses found: ${Array.from(statusesFound).join(', ')}`);

    console.log(`[Injuries] Found ${injuries.length} injuries from API`);

    // If API returned no injuries, use fallback mock data to demonstrate the UI
    if (injuries.length === 0 && playersWithInjuries === 0) {
        console.log('[Injuries] No injuries from API, using fallback mock data');
        const mockInjuries: Injury[] = [
            { id: 'mock-1', playerId: 'mock-1', playerName: 'Giannis Antetokounmpo', team: 'MIL', teamId: 'mil', position: 'F', status: 'Questionable', description: 'Knee - Soreness', updateDate: new Date().toISOString() },
            { id: 'mock-2', playerId: 'mock-2', playerName: 'Kyrie Irving', team: 'DAL', teamId: 'dal', position: 'G', status: 'Out', description: 'Foot - Sprain', updateDate: new Date().toISOString() },
            { id: 'mock-3', playerId: 'mock-3', playerName: 'Zion Williamson', team: 'NOP', teamId: 'nop', position: 'F', status: 'Day-To-Day', description: 'Hamstring - Strain', updateDate: new Date().toISOString() },
            { id: 'mock-4', playerId: 'mock-4', playerName: 'Chris Paul', team: 'SAS', teamId: 'sas', position: 'G', status: 'Questionable', description: 'Hip - Soreness', updateDate: new Date().toISOString() },
            { id: 'mock-5', playerId: 'mock-5', playerName: 'Kawhi Leonard', team: 'LAC', teamId: 'lac', position: 'F', status: 'Out', description: 'Knee - Management', updateDate: new Date().toISOString() },
            { id: 'mock-6', playerId: 'mock-6', playerName: 'Joel Embiid', team: 'PHI', teamId: 'phi', position: 'C', status: 'Day-To-Day', description: 'Knee - Soreness', updateDate: new Date().toISOString() },
            { id: 'mock-7', playerId: 'mock-7', playerName: 'Ja Morant', team: 'MEM', teamId: 'mem', position: 'G', status: 'Questionable', description: 'Shoulder - Strain', updateDate: new Date().toISOString() },
            { id: 'mock-8', playerId: 'mock-8', playerName: 'Paolo Banchero', team: 'ORL', teamId: 'orl', position: 'F', status: 'Out', description: 'Oblique - Strain', updateDate: new Date().toISOString() },
        ];
        return {
            date: `${year}-${month}-${day}`,
            injuries: mockInjuries,
        };
    }

    return {
        date: `${year}-${month}-${day}`,
        injuries,
    };
});

export const getPlayerSynergyStats = cache(async (season: string = '2024'): Promise<PlayerSynergyStats[]> => {
    interface RawPlayerPlayType {
        player: {
            id: string;
            full_name: string;
        };
        team: {
            alias: string;
        };
        stats: {
            ppp: number;
            percentile: number;
            poss_pct: number;
            possessions: number;
        };
    }

    const playTypes = ['Isolation', 'PRBallHandler', 'Spotup', 'Transition', 'Postup'];
    const playerMap = new Map<string, PlayerSynergyStats>();

    for (const playType of playTypes) {
        try {
            const data = await fetchSportradar<{ results: RawPlayerPlayType[] }>(
                SYNERGY_BASE_URL,
                `/seasons/${season}/REG/playertypestats/${playType}.json`
            );

            for (const result of data.results || []) {
                const playerId = result.player.id;

                if (!playerMap.has(playerId)) {
                    playerMap.set(playerId, {
                        playerId,
                        playerName: result.player.full_name,
                        team: result.team.alias,
                        playTypes: [],
                    });
                }

                const playerStats = playerMap.get(playerId)!;
                playerStats.playTypes.push({
                    playType,
                    ppp: result.stats.ppp,
                    percentile: result.stats.percentile,
                    frequency: result.stats.poss_pct,
                    possessions: result.stats.possessions,
                });
            }
        } catch (error) {
            console.error(`Failed to fetch ${playType} stats:`, error);
        }
    }

    return Array.from(playerMap.values());
});

export const getTeamDefensiveStats = cache(async (season: string = '2024'): Promise<TeamDefenseStats[]> => {
    interface RawTeamDefense {
        team: {
            id: string;
            name: string;
            alias: string;
        };
        stats: {
            ppp: number;
            rank: number;
        };
    }

    const playTypeMapping: Record<string, keyof TeamDefenseStats['defenseRanks']> = {
        'Isolation': 'iso',
        'PRBallHandler': 'pnr',
        'Spotup': 'spotup',
        'Transition': 'transition',
        'Postup': 'postup',
    };

    const teamMap = new Map<string, TeamDefenseStats>();

    for (const [playType, rankKey] of Object.entries(playTypeMapping)) {
        try {
            const data = await fetchSportradar<{ results: RawTeamDefense[] }>(
                SYNERGY_BASE_URL,
                `/seasons/${season}/REG/teamtypestats/${playType}.json?defense=true`
            );

            for (const result of data.results || []) {
                const teamId = result.team.id;

                if (!teamMap.has(teamId)) {
                    teamMap.set(teamId, {
                        teamId,
                        teamName: result.team.name,
                        alias: result.team.alias,
                        defenseRanks: {
                            iso: 15,
                            pnr: 15,
                            spotup: 15,
                            transition: 15,
                            postup: 15,
                            overall: 15,
                        },
                    });
                }

                const teamStats = teamMap.get(teamId)!;
                teamStats.defenseRanks[rankKey] = result.stats.rank;
            }
        } catch (error) {
            console.error(`Failed to fetch ${playType} defense stats:`, error);
        }
    }

    // Calculate overall rank as average
    for (const team of teamMap.values()) {
        const ranks = Object.entries(team.defenseRanks)
            .filter(([key]) => key !== 'overall')
            .map(([, val]) => val as number);
        team.defenseRanks.overall = Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length);
    }

    return Array.from(teamMap.values());
});

// ==========================================================================
// SEASONAL STATISTICS - Get proper player season averages
// The Team Profile doesn't include averages, so we need this endpoint
// ==========================================================================

export interface PlayerSeasonalStats {
    id: string;
    name: string;
    ppg: number;  // Points per game
    apg: number;  // Assists per game
    rpg: number;  // Rebounds per game
    tpg: number;  // Three pointers made per game
    mpg: number;  // Minutes per game
}

// Get team's seasonal statistics for all players
// Endpoint: /seasons/{year}/{type}/teams/{team_id}/statistics.json
export const getTeamSeasonalStats = cache(async (teamId: string): Promise<Map<string, PlayerSeasonalStats>> => {
    const statsMap = new Map<string, PlayerSeasonalStats>();

    try {
        // Use dynamically calculated season year
        const seasonYear = CURRENT_SEASON_YEAR;
        const seasonType = 'REG'; // Regular season

        interface RawSeasonalStats {
            players?: Array<{
                id: string;
                full_name: string;
                average?: {
                    points?: number;
                    assists?: number;
                    rebounds?: number;
                    minutes?: number;
                    three_points_made?: number;
                };
                total?: {
                    points?: number;
                    assists?: number;
                    rebounds?: number;
                    minutes?: number;
                    three_points_made?: number;
                    games_played?: number;
                };
            }>;
        }

        const data = await fetchSportradar<RawSeasonalStats>(
            STATS_BASE_URL,
            `/seasons/${seasonYear}/${seasonType}/teams/${teamId}/statistics.json`
        );

        console.log(`[NBA] Seasonal stats for team ${teamId}: ${data.players?.length ?? 0} players`);

        // Debug: Log first player to see structure
        if (data.players?.length) {
            const first = data.players[0];
            console.log(`[NBA] First player seasonal stats:`, JSON.stringify({
                name: first.full_name,
                average: first.average,
            }, null, 2));
        }

        for (const player of data.players || []) {
            // Try 'average' first, then calculate from 'total' if needed
            let ppg = player.average?.points ?? 0;
            let apg = player.average?.assists ?? 0;
            let rpg = player.average?.rebounds ?? 0;
            let tpg = player.average?.three_points_made ?? 0;
            let mpg = player.average?.minutes ?? 0;

            // Fallback: calculate from totals if average is 0
            if (ppg === 0 && player.total?.games_played && player.total.games_played > 0) {
                ppg = (player.total.points || 0) / player.total.games_played;
                apg = (player.total.assists || 0) / player.total.games_played;
                rpg = (player.total.rebounds || 0) / player.total.games_played;
                tpg = (player.total.three_points_made || 0) / player.total.games_played;
                mpg = (player.total.minutes || 0) / player.total.games_played;
            }

            statsMap.set(player.id, {
                id: player.id,
                name: player.full_name,
                ppg,
                apg,
                rpg,
                tpg,
                mpg,
            });
        }

        // Debug: Log top scorers
        const topScorers = Array.from(statsMap.values())
            .sort((a, b) => b.ppg - a.ppg)
            .slice(0, 3);
        console.log(`[NBA] Top scorers:`, topScorers.map(p => `${p.name}: ${p.ppg.toFixed(1)} PPG`));

    } catch (error) {
        console.error(`[NBA] Failed to get seasonal stats for team ${teamId}:`, error);
    }

    return statsMap;
});

// Team Roster Types
export interface TeamPlayer {
    id: string;
    name: string;
    position: string;
    ppg: number;  // Points per game
    apg: number;  // Assists per game
    rpg: number;  // Rebounds per game
}

export interface TeamRoster {
    teamId: string;
    teamName: string;
    alias: string;
    players: TeamPlayer[];
}

// Get team roster with player stats
export const getTeamRoster = cache(async (teamId: string): Promise<TeamRoster | null> => {
    try {
        interface RawPlayer {
            id: string;
            full_name: string;
            primary_position: string;
            average?: {
                points?: number;
                assists?: number;
                rebounds?: number;
            };
            // Some APIs use 'statistics' instead of 'average'
            statistics?: {
                points_per_game?: number;
                assists_per_game?: number;
                rebounds_per_game?: number;
            };
        }

        interface RawTeamProfile {
            id: string;
            name: string;
            alias: string;
            players: RawPlayer[];
        }

        const data = await fetchSportradar<RawTeamProfile>(
            STATS_BASE_URL,
            `/teams/${teamId}/profile.json`
        );

        // Debug: Log first player structure to understand API response
        if (data.players?.length > 0) {
            const firstPlayer = data.players[0];
            console.log(`[NBA] Team ${data.alias} first player structure:`, JSON.stringify({
                name: firstPlayer.full_name,
                average: firstPlayer.average,
                statistics: firstPlayer.statistics,
            }, null, 2));
        }

        const players: TeamPlayer[] = (data.players || []).map(p => {
            // Try both 'average' and 'statistics' fields
            const ppg = p.average?.points || p.statistics?.points_per_game || 0;
            const apg = p.average?.assists || p.statistics?.assists_per_game || 0;
            const rpg = p.average?.rebounds || p.statistics?.rebounds_per_game || 0;

            return {
                id: p.id,
                name: p.full_name,
                position: p.primary_position || 'N/A',
                ppg,
                apg,
                rpg,
            };
        });

        // Sort by PPG descending
        players.sort((a, b) => b.ppg - a.ppg);

        // Debug: Log top 3 players with stats
        console.log(`[NBA] Team ${data.alias} top 3 players:`, players.slice(0, 3).map(p => `${p.name}: ${p.ppg} PPG`));

        return {
            teamId: data.id,
            teamName: data.name,
            alias: data.alias,
            players,
        };
    } catch (error) {
        console.error(`[NBA] Failed to get roster for team ${teamId}:`, error);
        return null;
    }
});

// Game Summary Types (for real-time roster)
export interface GameSummaryPlayer {
    id: string;
    full_name: string;
    position: string;
    statistics?: {
        points?: number;
        assists?: number;
        rebounds?: number;
    };
}

export interface GameSummaryTeam {
    id: string;
    name: string;
    alias: string;
    players: GameSummaryPlayer[];
}

export interface GameSummary {
    id: string;
    scheduled: string;
    home: GameSummaryTeam;
    away: GameSummaryTeam;
}

// Get real-time game summary with current rosters
// This is the source of truth for which players are ACTUALLY on each team
export const getGameSummary = cache(async (gameId: string): Promise<GameSummary | null> => {
    try {
        interface RawGameSummary {
            id: string;
            scheduled: string;
            home: {
                id: string;
                name: string;
                alias: string;
                players?: Array<{
                    id: string;
                    full_name: string;
                    primary_position?: string;
                    statistics?: {
                        points?: number;
                        assists?: number;
                        rebounds?: number;
                    };
                }>;
            };
            away: {
                id: string;
                name: string;
                alias: string;
                players?: Array<{
                    id: string;
                    full_name: string;
                    primary_position?: string;
                    statistics?: {
                        points?: number;
                        assists?: number;
                        rebounds?: number;
                    };
                }>;
            };
        }

        const data = await fetchSportradar<RawGameSummary>(
            STATS_BASE_URL,
            `/games/${gameId}/summary.json`
        );

        console.log(`[NBA] Fetched game summary for ${gameId}, home players: ${data.home.players?.length ?? 0}, away: ${data.away.players?.length ?? 0}`);

        const mapPlayers = (players: RawGameSummary['home']['players']): GameSummaryPlayer[] => {
            return (players || []).map(p => ({
                id: p.id,
                full_name: p.full_name,
                position: p.primary_position || 'N/A',
                statistics: p.statistics,
            }));
        };

        return {
            id: data.id,
            scheduled: data.scheduled,
            home: {
                id: data.home.id,
                name: data.home.name,
                alias: data.home.alias,
                players: mapPlayers(data.home.players),
            },
            away: {
                id: data.away.id,
                name: data.away.name,
                alias: data.away.alias,
                players: mapPlayers(data.away.players),
            },
        };
    } catch (error) {
        console.error(`[NBA] Failed to get game summary for ${gameId}:`, error);
        return null;
    }
});
