/**
 * NBA Data Service
 * Server-side only - Consumes Sportradar Standard + Synergy APIs
 */

import { cache } from 'react';

const STATS_BASE_URL = 'https://api.sportradar.us/nba/trial/v8/en';
const SYNERGY_BASE_URL = 'https://api.sportradar.us/nba-synergy/tb/v1/en';

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

    // Flatten and filter injuries (only Out or Day-To-Day)
    const injuries: Injury[] = [];

    for (const team of data.teams || []) {
        for (const player of team.players || []) {
            if (player.injury) {
                const status = player.injury.status as Injury['status'];
                if (status === 'Out' || status === 'Day-To-Day') {
                    injuries.push({
                        id: `${team.id}-${player.id}`,
                        playerId: player.id,
                        playerName: player.full_name,
                        team: team.alias,
                        teamId: team.id,
                        position: player.primary_position,
                        status,
                        description: player.injury.desc || 'No details',
                        updateDate: player.injury.update_date,
                    });
                }
            }
        }
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
