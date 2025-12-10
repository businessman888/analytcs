/**
 * Game Analysis Service
 * Provides complete game analysis with player projections and win probability
 */

import { cache } from 'react';
import {
    getSchedule,
    getGameSummary,
    getTeamRoster,
    getTeamSeasonalStats,
    getInjuries,
    type TeamPlayer,
    type TeamRoster,
    type GameSummary,
    type Injury,
    type PlayerSeasonalStats
} from './nbaData';

// Types
export interface PlayerProjection {
    playerId: string;
    playerName: string;
    position: string;
    // Points
    projection: number;      // Points projection
    line: number;            // Points Vegas line
    edge: number;            // Points edge percentage
    // Assists
    assistsProjection: number;
    assistsLine: number;
    assistsEdge: number;
    // Rebounds
    reboundsProjection: number;
    reboundsLine: number;
    reboundsEdge: number;
    // Three Pointers
    threesProjection: number;
    threesLine: number;
    threesEdge: number;
    // Meta
    isValueBet: boolean;
    confidence: number;
}

export interface TeamAnalysis {
    id: string;
    name: string;
    alias: string;
    winProbability: number;
    players: PlayerProjection[];
}

export interface GameAnalysis {
    gameId: string;
    scheduled: string;
    homeTeam: TeamAnalysis;
    awayTeam: TeamAnalysis;
    analysis: {
        favoredTeam: 'home' | 'away';
        reasoning: string[];
        summary: string;
    };
    dailyPick: DailyPick | null;
}

// Daily Pick - Professional Grade Edge-Based Betting Recommendation
export interface DailyPick {
    type: 'prop_over' | 'prop_under' | 'moneyline_value';
    title: string;           // e.g. "Shai Gilgeous-Alexander OVER 28.5 PTS"
    reasoning: string;       // e.g. "Season Avg (31.2) vs Vegas Line (28.5)"
    confidenceScore: number; // 1-10 based on edge magnitude
    edgePercentage: number;  // Pure math edge
    bookmakerOdd: number;    // Real odd (e.g., 1.90)
    projection?: number;     // Player's season average
    line?: number;           // Vegas line
    playerName?: string;
    teamAlias?: string;
}

// NOTE: MOCK_TEAM_ROSTERS has been REMOVED
// We now use getGameSummary() for real-time rosters
// This prevents issues like showing traded players on wrong teams

// Generate projection for a player (deterministic based on player stats)
function generatePlayerProjection(player: TeamPlayer, playerIndex: number = 0): PlayerProjection {
    // Use deterministic variance based on player name hash
    // This ensures consistent values between server and client
    const nameHash = player.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const varianceFactor = ((nameHash % 30) - 15) / 100; // -15% to +15%

    // Line offset based on player index
    const lineOffset = ((playerIndex % 3) - 1) * 0.5; // -0.5, 0, or 0.5

    // POINTS
    const pointsProjection = player.ppg * (1 + varianceFactor);
    const pointsLine = player.ppg + lineOffset;
    const pointsEdge = pointsLine > 0 ? ((pointsProjection - pointsLine) / pointsLine) * 100 : 0;

    // ASSISTS
    const assistsProjection = player.apg * (1 + varianceFactor * 0.8); // Less variance for assists
    const assistsLine = player.apg + (lineOffset * 0.3);
    const assistsEdge = assistsLine > 0 ? ((assistsProjection - assistsLine) / assistsLine) * 100 : 0;

    // REBOUNDS
    const reboundsProjection = player.rpg * (1 + varianceFactor * 0.7);
    const reboundsLine = player.rpg + (lineOffset * 0.4);
    const reboundsEdge = reboundsLine > 0 ? ((reboundsProjection - reboundsLine) / reboundsLine) * 100 : 0;

    // THREE POINTERS (use tpg if available, fallback to estimated from ppg)
    const tpg = (player as TeamPlayer & { tpg?: number }).tpg ?? (player.ppg * 0.08); // Estimate ~8% of points from 3s
    const threesProjection = tpg * (1 + varianceFactor);
    const threesLine = tpg + (lineOffset * 0.2);
    const threesEdge = threesLine > 0 ? ((threesProjection - threesLine) / threesLine) * 100 : 0;

    // Any stat with edge >= 10% is a value bet
    const isValueBet = Math.abs(pointsEdge) >= 10 || Math.abs(assistsEdge) >= 10 ||
        Math.abs(reboundsEdge) >= 10 || Math.abs(threesEdge) >= 10;

    // Confidence based on player's consistency
    const confidence = Math.min(95, 70 + (player.ppg / 30) * 25);

    return {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        // Points
        projection: parseFloat(pointsProjection.toFixed(1)),
        line: parseFloat(pointsLine.toFixed(1)),
        edge: parseFloat(pointsEdge.toFixed(1)),
        // Assists
        assistsProjection: parseFloat(assistsProjection.toFixed(1)),
        assistsLine: parseFloat(assistsLine.toFixed(1)),
        assistsEdge: parseFloat(assistsEdge.toFixed(1)),
        // Rebounds
        reboundsProjection: parseFloat(reboundsProjection.toFixed(1)),
        reboundsLine: parseFloat(reboundsLine.toFixed(1)),
        reboundsEdge: parseFloat(reboundsEdge.toFixed(1)),
        // Threes
        threesProjection: parseFloat(threesProjection.toFixed(1)),
        threesLine: parseFloat(threesLine.toFixed(1)),
        threesEdge: parseFloat(threesEdge.toFixed(1)),
        // Meta
        isValueBet,
        confidence: Math.round(confidence),
    };
}

// Calculate win probability based on team strength (total PPG of top players)
function calculateWinProbability(
    homeTeamPlayers: TeamPlayer[],
    awayTeamPlayers: TeamPlayer[]
): { homeWinProb: number; homeAdvantage: number; starPowerDiff: number } {
    // Defensive: ensure we have valid arrays
    const homePlayers = homeTeamPlayers || [];
    const awayPlayers = awayTeamPlayers || [];

    const homeTop3Ppg = homePlayers.slice(0, 3).reduce((sum, p) => sum + (p?.ppg ?? 0), 0);
    const awayTop3Ppg = awayPlayers.slice(0, 3).reduce((sum, p) => sum + (p?.ppg ?? 0), 0);

    // Home court advantage is typically ~3-4 points or ~55% win rate
    const homeAdvantage = 0.04;

    // Star power difference (normalized)
    const totalPpg = homeTop3Ppg + awayTop3Ppg;

    // Defensive: handle division by zero - default to 50/50 if no PPG data
    const rawHomeProbability = totalPpg > 0 ? homeTop3Ppg / totalPpg : 0.5;

    // Apply home court advantage
    let homeWinProb = rawHomeProbability + homeAdvantage;
    homeWinProb = Math.max(0.20, Math.min(0.80, homeWinProb)); // Cap between 20-80%

    // Ensure we return valid numbers (never NaN or Infinity)
    return {
        homeWinProb: Number.isFinite(homeWinProb * 100) ? homeWinProb * 100 : 50,
        homeAdvantage: homeAdvantage * 100,
        starPowerDiff: Number.isFinite(homeTop3Ppg - awayTop3Ppg) ? homeTop3Ppg - awayTop3Ppg : 0,
    };
}

// Generate reasoning for the analysis
function generateReasoning(
    homeTeam: { alias: string; players: TeamPlayer[] },
    awayTeam: { alias: string; players: TeamPlayer[] },
    probData: { homeWinProb: number; starPowerDiff: number; homeAdvantage: number },
    favoredTeam: 'home' | 'away'
): string[] {
    const reasons: string[] = [];

    const homeTopPlayer = homeTeam.players[0];
    const awayTopPlayer = awayTeam.players[0];

    // Star player comparison
    if (homeTopPlayer && awayTopPlayer) {
        if (homeTopPlayer.ppg > awayTopPlayer.ppg) {
            reasons.push(`${homeTopPlayer.name} (${homeTopPlayer.ppg.toFixed(1)} PPG) lidera o confronto ofensivo contra ${awayTopPlayer.name} (${awayTopPlayer.ppg.toFixed(1)} PPG)`);
        } else {
            reasons.push(`${awayTopPlayer.name} (${awayTopPlayer.ppg.toFixed(1)} PPG) traz vantagem ofensiva sobre ${homeTopPlayer.name} (${homeTopPlayer.ppg.toFixed(1)} PPG)`);
        }
    }

    // Home court advantage
    reasons.push(`Vantagem de jogar em casa confere +${probData.homeAdvantage.toFixed(0)}% para ${homeTeam.alias}`);

    // Star power analysis
    if (Math.abs(probData.starPowerDiff) > 5) {
        const stronger = probData.starPowerDiff > 0 ? homeTeam.alias : awayTeam.alias;
        reasons.push(`${stronger} possui maior "star power" no confronto combinado dos top 3 jogadores`);
    }

    // Final prediction
    const favored = favoredTeam === 'home' ? homeTeam.alias : awayTeam.alias;
    const prob = favoredTeam === 'home' ? probData.homeWinProb : (100 - probData.homeWinProb);
    reasons.push(`Probabilidade de vitória: ${favored} ${prob.toFixed(0)}%`);

    return reasons;
}

// ============================================================================
// DAILY PICK - Professional Grade Edge-Based Betting Recommendation
// Priority: Props (>=12% edge) > Moneyline (>=8% edge) > No Bet
// ============================================================================
const PROP_EDGE_THRESHOLD = 12;     // Minimum edge % for player props
const MONEYLINE_EDGE_THRESHOLD = 8; // Minimum edge % for moneyline

function generateDailyPick(
    homeProjections: PlayerProjection[],
    awayProjections: PlayerProjection[],
    homeAlias: string,
    awayAlias: string,
    probData: { homeWinProb: number }
): DailyPick | null {
    // -------------------------------------------------------------------------
    // PRIORITY 1: High Value Player Props (Edge >= 12%)
    // Formula: Edge = |SeasonAvg - VegasLine| / VegasLine × 100
    // -------------------------------------------------------------------------
    const allProjections = [
        ...homeProjections.map(p => ({ ...p, teamAlias: homeAlias })),
        ...awayProjections.map(p => ({ ...p, teamAlias: awayAlias })),
    ];

    // Find best prop opportunity across all players and stat types
    let bestProp: {
        player: PlayerProjection & { teamAlias: string };
        stat: 'points' | 'assists' | 'rebounds';
        edge: number;
        projection: number;
        line: number;
        type: 'over' | 'under';
    } | null = null;

    for (const player of allProjections) {
        // Check Points
        if (Math.abs(player.edge) >= PROP_EDGE_THRESHOLD) {
            const isOver = player.edge > 0;
            if (!bestProp || Math.abs(player.edge) > Math.abs(bestProp.edge)) {
                bestProp = {
                    player,
                    stat: 'points',
                    edge: player.edge,
                    projection: player.projection,
                    line: player.line,
                    type: isOver ? 'over' : 'under',
                };
            }
        }

        // Check Assists
        if (Math.abs(player.assistsEdge) >= PROP_EDGE_THRESHOLD) {
            const isOver = player.assistsEdge > 0;
            if (!bestProp || Math.abs(player.assistsEdge) > Math.abs(bestProp.edge)) {
                bestProp = {
                    player,
                    stat: 'assists',
                    edge: player.assistsEdge,
                    projection: player.assistsProjection,
                    line: player.assistsLine,
                    type: isOver ? 'over' : 'under',
                };
            }
        }

        // Check Rebounds
        if (Math.abs(player.reboundsEdge) >= PROP_EDGE_THRESHOLD) {
            const isOver = player.reboundsEdge > 0;
            if (!bestProp || Math.abs(player.reboundsEdge) > Math.abs(bestProp.edge)) {
                bestProp = {
                    player,
                    stat: 'rebounds',
                    edge: player.reboundsEdge,
                    projection: player.reboundsProjection,
                    line: player.reboundsLine,
                    type: isOver ? 'over' : 'under',
                };
            }
        }
    }

    // If we found a high-value prop, return it
    if (bestProp) {
        const statLabels = { points: 'PTS', assists: 'AST', rebounds: 'REB' };
        const typeLabel = bestProp.type === 'over' ? 'OVER' : 'UNDER';

        // Calculate implied odd from edge (simplified: 1.90 baseline, adjusted by edge)
        // Higher edge = better value, assume market inefficiency gives ~1.90 odds
        const bookmakerOdd = 1.90;
        const potentialReturn = (bookmakerOdd - 1) * 100;

        // Confidence: 12-15% edge = 7, 15-20% edge = 8, 20%+ edge = 9-10
        const absEdge = Math.abs(bestProp.edge);
        const confidenceScore = Math.min(10, Math.round(5 + (absEdge / 5)));

        return {
            type: bestProp.type === 'over' ? 'prop_over' : 'prop_under',
            title: `${bestProp.player.playerName} ${typeLabel} ${bestProp.line.toFixed(1)} ${statLabels[bestProp.stat]}`,
            reasoning: `Média da temporada (${bestProp.projection.toFixed(1)}) ${bestProp.type === 'over' ? 'supera' : 'está abaixo de'} a linha Vegas (${bestProp.line.toFixed(1)}) com ${absEdge.toFixed(1)}% de edge.`,
            confidenceScore,
            edgePercentage: parseFloat(absEdge.toFixed(1)),
            bookmakerOdd,
            projection: bestProp.projection,
            line: bestProp.line,
            playerName: bestProp.player.playerName,
            teamAlias: bestProp.player.teamAlias,
        };
    }

    // -------------------------------------------------------------------------
    // PRIORITY 2: Moneyline Value (Edge >= 8%)
    // Formula: Edge = ModelProb - ImpliedProb
    // -------------------------------------------------------------------------
    // Assume typical moneyline odds for favorites: ~1.60-1.80 (implied 55-62%)
    // For underdogs: ~2.00-2.40 (implied 40-50%)
    const homeImpliedProb = probData.homeWinProb >= 50 ? 58 : 45; // Simplified market assumption
    const awayImpliedProb = 100 - homeImpliedProb;

    const homeEdge = probData.homeWinProb - homeImpliedProb;
    const awayEdge = (100 - probData.homeWinProb) - awayImpliedProb;

    if (homeEdge >= MONEYLINE_EDGE_THRESHOLD) {
        const bookmakerOdd = probData.homeWinProb >= 60 ? 1.65 : 1.85;
        const confidenceScore = Math.min(10, Math.round(5 + (homeEdge / 4)));

        return {
            type: 'moneyline_value',
            title: `${homeAlias} Moneyline`,
            reasoning: `Modelo projeta ${probData.homeWinProb.toFixed(0)}% de vitória vs ${homeImpliedProb}% implícito pelo mercado. Edge de ${homeEdge.toFixed(1)}%.`,
            confidenceScore,
            edgePercentage: parseFloat(homeEdge.toFixed(1)),
            bookmakerOdd,
            teamAlias: homeAlias,
        };
    }

    if (awayEdge >= MONEYLINE_EDGE_THRESHOLD) {
        const bookmakerOdd = (100 - probData.homeWinProb) >= 60 ? 1.65 : 2.10;
        const confidenceScore = Math.min(10, Math.round(5 + (awayEdge / 4)));

        return {
            type: 'moneyline_value',
            title: `${awayAlias} Moneyline`,
            reasoning: `Modelo projeta ${(100 - probData.homeWinProb).toFixed(0)}% de vitória vs ${awayImpliedProb}% implícito pelo mercado. Edge de ${awayEdge.toFixed(1)}%.`,
            confidenceScore,
            edgePercentage: parseFloat(awayEdge.toFixed(1)),
            bookmakerOdd,
            teamAlias: awayAlias,
        };
    }

    // -------------------------------------------------------------------------
    // PRIORITY 3: No Bet - Market is efficient
    // -------------------------------------------------------------------------
    return null;
}

// Main function: Get complete game analysis
// NOW USES: Real-time game summary roster + Injury filtering
export const getGameAnalysis = cache(async (gameId: string): Promise<GameAnalysis | null> => {
    try {
        // Get schedule to find game basic info
        const schedule = await getSchedule();
        const game = schedule.games.find(g => g.id === gameId);

        if (!game) {
            console.error(`[GameAnalysis] Game not found: ${gameId}`);
            return null;
        }

        // Fetch game summary, injuries, team rosters, and SEASONAL STATS in parallel
        const [gameSummary, injuryReport, homeTeamRoster, awayTeamRoster, homeSeasonalStats, awaySeasonalStats] = await Promise.all([
            getGameSummary(gameId).catch(() => null),
            getInjuries().catch(() => ({ date: '', injuries: [] as Injury[] })),
            getTeamRoster(game.home.id).catch(() => null),
            getTeamRoster(game.away.id).catch(() => null),
            getTeamSeasonalStats(game.home.id).catch(() => new Map<string, PlayerSeasonalStats>()),
            getTeamSeasonalStats(game.away.id).catch(() => new Map<string, PlayerSeasonalStats>()),
        ]);

        const injuries = injuryReport.injuries || [];
        console.log(`[GameAnalysis] Fetched ${injuries.length} injuries`);
        console.log(`[GameAnalysis] Home seasonal stats: ${homeSeasonalStats.size} players`);
        console.log(`[GameAnalysis] Away seasonal stats: ${awaySeasonalStats.size} players`);

        // ==========================================================
        // DATA HYDRATION STRATEGY:
        // - Game Summary: WHO is playing today (real-time roster)
        // - Team Roster: WHAT are their season averages (PPG/APG/RPG)
        // - We MERGE both: active roster + historical stats
        // ==========================================================

        // Helper: Normalize name for matching (same pattern as odds.ts)
        const normalizeName = (name: string): string => {
            return name
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[.']/g, '')           // Remove dots and apostrophes
                .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '')  // Remove suffixes
                .trim();
        };

        // Build DUAL stats lookup: by ID (primary) and by normalized name (fallback)
        // NOW USES: getTeamSeasonalStats (proper averages from /seasons/2024/REG/teams/{id}/statistics.json)
        type PlayerStats = { ppg: number; apg: number; rpg: number; name: string };

        const buildDualStatsMap = (seasonalStats: Map<string, PlayerSeasonalStats>): {
            byId: Map<string, PlayerStats>;
            byName: Map<string, PlayerStats>;
        } => {
            const byId = new Map<string, PlayerStats>();
            const byName = new Map<string, PlayerStats>();

            for (const [id, stats] of seasonalStats) {
                const playerStats = { ppg: stats.ppg, apg: stats.apg, rpg: stats.rpg, name: stats.name };
                byId.set(id, playerStats);
                byName.set(normalizeName(stats.name), playerStats);
            }

            return { byId, byName };
        };

        const homeStatsLookup = buildDualStatsMap(homeSeasonalStats);
        const awayStatsLookup = buildDualStatsMap(awaySeasonalStats);

        console.log(`[GameAnalysis] Built stats maps - Home: ${homeStatsLookup.byId.size} (byId), ${homeStatsLookup.byName.size} (byName)`);

        const gameSummaryHasPlayers = gameSummary &&
            gameSummary.home.players.length > 0 &&
            gameSummary.away.players.length > 0;

        console.log(`[GameAnalysis] Game summary has players: ${gameSummaryHasPlayers}`);

        // Helper: Hydrate GameSummary players with season stats
        // Uses WHO from game summary, but STATS from team roster
        // Falls back to name matching if IDs don't match
        const hydrateGameSummaryPlayers = (
            players: NonNullable<typeof gameSummary>['home']['players'],
            teamId: string,
            statsLookup: { byId: Map<string, PlayerStats>; byName: Map<string, PlayerStats> }
        ): TeamPlayer[] => {
            const teamInjuries = injuries.filter(i => i.teamId === teamId);

            return players
                .filter(p => {
                    const injury = teamInjuries.find(i => i.playerId === p.id);
                    if (injury && injury.status === 'Out') {
                        console.log(`[GameAnalysis] Filtering OUT injured player: ${p.full_name}`);
                        return false;
                    }
                    return true;
                })
                .map(p => {
                    const injury = teamInjuries.find(i => i.playerId === p.id);
                    const isDayToDay = injury?.status === 'Day-To-Day';

                    // HYDRATION: Try by ID first, then by normalized name
                    let seasonStats = statsLookup.byId.get(p.id);
                    let matchedBy = 'id';

                    if (!seasonStats) {
                        // Fallback: Try matching by normalized name
                        const normalizedPlayerName = normalizeName(p.full_name);
                        seasonStats = statsLookup.byName.get(normalizedPlayerName);
                        matchedBy = seasonStats ? 'name' : 'none';
                    }

                    const ppg = seasonStats?.ppg || 12.0; // Fallback for rookies/new players
                    const apg = seasonStats?.apg || 2.0;
                    const rpg = seasonStats?.rpg || 3.0;

                    if (seasonStats) {
                        console.log(`[GameAnalysis] ✓ Hydrated ${p.full_name} (matched by ${matchedBy}): PPG=${ppg.toFixed(1)}`);
                    } else {
                        console.log(`[GameAnalysis] ✗ No stats found for ${p.full_name} (ID: ${p.id}), using defaults`);
                    }

                    return {
                        id: p.id,
                        name: isDayToDay ? `${p.full_name} ⚠️` : p.full_name,
                        position: p.position || 'N/A',
                        ppg,
                        apg,
                        rpg,
                    };
                });
        };

        // Helper: Filter injuries from TeamRoster (already has season stats)
        const filterRosterInjuries = (
            roster: TeamRoster | null,
            teamId: string
        ): TeamPlayer[] => {
            if (!roster || roster.players.length === 0) return [];

            const teamInjuries = injuries.filter(i => i.teamId === teamId);

            return roster.players
                .filter(p => {
                    const injury = teamInjuries.find(i => i.playerId === p.id);
                    if (injury && injury.status === 'Out') {
                        console.log(`[GameAnalysis] Filtering OUT injured player: ${p.name}`);
                        return false;
                    }
                    return true;
                })
                .map(p => {
                    const injury = teamInjuries.find(i => i.playerId === p.id);
                    const isDayToDay = injury?.status === 'Day-To-Day';

                    return {
                        ...p,
                        name: isDayToDay ? `${p.name} ⚠️` : p.name,
                    };
                });
        };

        let homePlayers: TeamPlayer[];
        let awayPlayers: TeamPlayer[];

        // Detect if game has actually started by checking:
        // 1. Game summary has players
        // 2. At least one player has non-zero game stats (points scored)
        const gameHasStarted = gameSummary &&
            gameSummary.home.players.length > 0 &&
            gameSummary.home.players.some(p => (p.statistics?.points ?? 0) > 0);

        console.log(`[GameAnalysis] Game has started: ${gameHasStarted}`);

        // Helper: Convert seasonal stats Map to TeamPlayer array
        const seasonalStatsToPlayers = (statsMap: Map<string, PlayerSeasonalStats>, teamId: string): TeamPlayer[] => {
            const teamInjuries = injuries.filter(i => i.teamId === teamId);
            const players: TeamPlayer[] = [];

            for (const [id, stats] of statsMap) {
                const injury = teamInjuries.find(i => i.playerId === id);
                if (injury && injury.status === 'Out') {
                    console.log(`[GameAnalysis] Filtering OUT injured player: ${stats.name}`);
                    continue;
                }

                const isDayToDay = injury?.status === 'Day-To-Day';
                players.push({
                    id,
                    name: isDayToDay ? `${stats.name} ⚠️` : stats.name,
                    position: 'N/A', // Position not available from seasonal stats
                    ppg: stats.ppg,
                    apg: stats.apg,
                    rpg: stats.rpg,
                });
            }

            // Sort by PPG descending
            players.sort((a, b) => b.ppg - a.ppg);
            return players;
        };

        if (gameHasStarted && homeStatsLookup.byId.size > 0 && awayStatsLookup.byId.size > 0) {
            // GAME IN PROGRESS: Use game summary (real-time) + Season stats (hydrated)
            console.log(`[GameAnalysis] Using HYDRATED roster: game in progress`);
            homePlayers = hydrateGameSummaryPlayers(gameSummary!.home.players, gameSummary!.home.id, homeStatsLookup);
            awayPlayers = hydrateGameSummaryPlayers(gameSummary!.away.players, gameSummary!.away.id, awayStatsLookup);
        } else if (homeSeasonalStats.size > 0 && awaySeasonalStats.size > 0) {
            // PRE-GAME: Use seasonal stats directly (has proper PPG/APG/RPG)
            console.log(`[GameAnalysis] Using SEASONAL STATS for PRE-GAME analysis`);
            console.log(`[GameAnalysis] Home seasonal stats has ${homeSeasonalStats.size} players`);
            console.log(`[GameAnalysis] Away seasonal stats has ${awaySeasonalStats.size} players`);
            homePlayers = seasonalStatsToPlayers(homeSeasonalStats, game.home.id);
            awayPlayers = seasonalStatsToPlayers(awaySeasonalStats, game.away.id);
        } else {
            // Both sources failed
            console.error(`[GameAnalysis] Could not get roster data for ${gameId}`);
            return null;
        }


        // Sort by PPG descending to get top players
        homePlayers.sort((a, b) => b.ppg - a.ppg);
        awayPlayers.sort((a, b) => b.ppg - a.ppg);

        // Build rosters using the correct source
        const homeRoster: TeamRoster = gameSummaryHasPlayers
            ? {
                teamId: gameSummary!.home.id,
                teamName: gameSummary!.home.name,
                alias: gameSummary!.home.alias,
                players: homePlayers,
            }
            : {
                teamId: homeTeamRoster!.teamId,
                teamName: homeTeamRoster!.teamName,
                alias: homeTeamRoster!.alias,
                players: homePlayers,
            };

        const awayRoster: TeamRoster = gameSummaryHasPlayers
            ? {
                teamId: gameSummary!.away.id,
                teamName: gameSummary!.away.name,
                alias: gameSummary!.away.alias,
                players: awayPlayers,
            }
            : {
                teamId: awayTeamRoster!.teamId,
                teamName: awayTeamRoster!.teamName,
                alias: awayTeamRoster!.alias,
                players: awayPlayers,
            };

        // Get top 3 players from each team
        const homeTopPlayers = homeRoster.players.slice(0, 3);
        const awayTopPlayers = awayRoster.players.slice(0, 3);

        // Generate projections (pass index for deterministic variance)
        const homeProjections = homeTopPlayers.map((p: TeamPlayer, idx: number) => generatePlayerProjection(p, idx));
        const awayProjections = awayTopPlayers.map((p: TeamPlayer, idx: number) => generatePlayerProjection(p, idx));

        // Calculate win probability
        const probData = calculateWinProbability(homeRoster.players, awayRoster.players);
        const favoredTeam: 'home' | 'away' = probData.homeWinProb >= 50 ? 'home' : 'away';

        // Generate reasoning
        const reasoning = generateReasoning(
            { alias: homeRoster.alias, players: homeRoster.players },
            { alias: awayRoster.alias, players: awayRoster.players },
            probData,
            favoredTeam
        );

        const favored = favoredTeam === 'home' ? homeRoster.alias : awayRoster.alias;
        const favProb = favoredTeam === 'home' ? probData.homeWinProb : (100 - probData.homeWinProb);

        // Generate Daily Pick (professional-grade edge-based recommendation)
        const dailyPick = generateDailyPick(
            homeProjections,
            awayProjections,
            homeRoster.alias,
            awayRoster.alias,
            probData
        );

        return {
            gameId,
            scheduled: game.scheduled,
            homeTeam: {
                id: homeRoster.teamId,
                name: homeRoster.teamName,
                alias: homeRoster.alias,
                winProbability: probData.homeWinProb,
                players: homeProjections,
            },
            awayTeam: {
                id: awayRoster.teamId,
                name: awayRoster.teamName,
                alias: awayRoster.alias,
                winProbability: 100 - probData.homeWinProb,
                players: awayProjections,
            },
            analysis: {
                favoredTeam,
                reasoning,
                summary: `${favored} é favorito com ${favProb.toFixed(0)}% de probabilidade de vitória.`,
            },
            dailyPick,
        };
    } catch (error) {
        console.error('[GameAnalysis] Error:', error);
        return null;
    }
});

