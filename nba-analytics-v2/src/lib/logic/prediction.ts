/**
 * NBA Prediction Engine
 * Core logic for "NBA Precision Analytics v2"
 * TypeScript implementation with Pareto adjustment and Value Bet detection
 */

import type { Injury, PlayerSynergyStats, TeamDefenseStats } from '@/lib/services/nbaData';
import type { PlayerPropLine } from '@/lib/services/odds';

// Types
export interface PlayerData {
    id: string;
    name: string;
    team: string;
    position: string;
    usage: number; // Usage rate (0-1)
    basePoints: number; // Average PPG
    synergyStats?: PlayerSynergyStats;
}

export interface ProjectionResult {
    playerId: string;
    playerName: string;
    projectedPoints: number;
    confidence: number;
    reason: string;
    isValueBet: boolean;
    edge: number; // Percentage difference from Vegas line
    vegasLine?: number;
    vegasOdd?: number;
}

export interface TeamProjection {
    teamId: string;
    teamAlias: string;
    winProbability: number;
    playerProjections: ProjectionResult[];
}

// Constants
const PARETO_CORE_PERCENTAGE = 0.2; // Top 20% of roster
const PARETO_EFFICIENCY_PENALTY = 0.15; // -15% efficiency when core player is out
const SYNERGY_BOOST = 0.10; // +10% for favorable matchup
const SYNERGY_PENALTY = 0.10; // -10% for unfavorable matchup
const B2B_PENALTY = 0.03; // -3% for back-to-back
const VALUE_THRESHOLD = 0.10; // 10% edge required for value bet
const ELITE_DEFENSE_RANK = 5; // Top 5 = elite defense
const WEAK_DEFENSE_RANK = 25; // Bottom 5 = weak defense

/**
 * Calculate volume redistribution multipliers based on Pareto principle.
 * If a Top 20% player (Pareto Core) is OUT, their usage is redistributed.
 */
export function calculateParetoAdjustment(
    roster: PlayerData[],
    injuries: Injury[]
): Map<string, number> {
    const adjustments = new Map<string, number>();

    // Initialize all to 1.0
    roster.forEach(p => adjustments.set(p.id, 1.0));

    if (roster.length === 0) return adjustments;

    // Sort by usage to find Top 20%
    const sortedByUsage = [...roster].sort((a, b) => b.usage - a.usage);
    const top20Count = Math.max(1, Math.ceil(roster.length * PARETO_CORE_PERCENTAGE));
    const paretoCoreIds = new Set(sortedByUsage.slice(0, top20Count).map(p => p.id));

    // Identify active players and missing Pareto usage
    const activePlayers: PlayerData[] = [];
    let totalMissingUsage = 0;
    let totalActiveUsage = 0;

    for (const player of roster) {
        const injury = injuries.find(i => i.playerId === player.id);
        const isOut = injury && (injury.status === 'Out' || injury.status === 'Day-To-Day');

        if (isOut) {
            if (paretoCoreIds.has(player.id)) {
                totalMissingUsage += player.usage;
            }
            adjustments.set(player.id, 0); // Player is out
        } else {
            activePlayers.push(player);
            totalActiveUsage += player.usage;
        }
    }

    // Redistribute missing usage proportionally
    if (totalMissingUsage > 0 && totalActiveUsage > 0) {
        for (const player of activePlayers) {
            const share = player.usage / totalActiveUsage;
            const extraUsage = totalMissingUsage * share;
            const newMultiplier = (player.usage + extraUsage) / player.usage;
            adjustments.set(player.id, newMultiplier);
        }
    }

    return adjustments;
}

/**
 * Check if a team has a Pareto core player out
 * Used to apply team-wide efficiency penalty
 */
export function hasParetoPlayerOut(
    roster: PlayerData[],
    injuries: Injury[]
): boolean {
    if (roster.length === 0) return false;

    const sortedByUsage = [...roster].sort((a, b) => b.usage - a.usage);
    const top3 = sortedByUsage.slice(0, 3);

    for (const player of top3) {
        const injury = injuries.find(i => i.playerId === player.id);
        if (injury && injury.status === 'Out') {
            return true;
        }
    }

    return false;
}

/**
 * Calculate the matchup modifier based on Synergy stats
 * Compares player's offensive play types with opponent's defensive rankings
 */
export function calculateMatchupModifier(
    playerSynergy: PlayerSynergyStats | undefined,
    opponentDefense: TeamDefenseStats | undefined
): { modifier: number; reason: string } {
    if (!playerSynergy || !opponentDefense) {
        return { modifier: 1.0, reason: '' };
    }

    let totalModifier = 0;
    let totalFrequency = 0;
    const reasons: string[] = [];

    const playTypeToDefenseKey: Record<string, keyof TeamDefenseStats['defenseRanks']> = {
        'Isolation': 'iso',
        'PRBallHandler': 'pnr',
        'Spotup': 'spotup',
        'Transition': 'transition',
        'Postup': 'postup',
    };

    for (const playType of playerSynergy.playTypes) {
        const defenseKey = playTypeToDefenseKey[playType.playType];
        if (!defenseKey || playType.frequency < 0.15) continue; // Ignore low-frequency play types

        const defenseRank = opponentDefense.defenseRanks[defenseKey];

        if (defenseRank <= ELITE_DEFENSE_RANK) {
            // Elite defense - penalty
            totalModifier -= SYNERGY_PENALTY * playType.frequency;
            reasons.push(`${opponentDefense.alias} has elite ${playType.playType} defense (Rank ${defenseRank})`);
        } else if (defenseRank >= WEAK_DEFENSE_RANK) {
            // Weak defense - boost
            totalModifier += SYNERGY_BOOST * playType.frequency;
            reasons.push(`Exploiting ${opponentDefense.alias}'s weak ${playType.playType} defense (Rank ${defenseRank})`);
        }

        totalFrequency += playType.frequency;
    }

    return {
        modifier: 1 + totalModifier,
        reason: reasons.join('. '),
    };
}

/**
 * Calculate edge between model projection and Vegas line
 */
export function calculateEdge(
    projection: number,
    vegasLine: number
): { edge: number; isValue: boolean } {
    if (vegasLine <= 0) {
        return { edge: 0, isValue: false };
    }

    const edge = (projection - vegasLine) / vegasLine;
    const isValue = edge >= VALUE_THRESHOLD;

    return { edge: edge * 100, isValue };
}

/**
 * Main projection function
 * Calculates projected points for a player considering all factors
 */
export function calculatePlayerProjection(
    player: PlayerData,
    opponentDefense: TeamDefenseStats | undefined,
    injuries: Injury[],
    teamRoster: PlayerData[],
    isB2B: boolean = false,
    vegasLine?: number
): ProjectionResult {
    const reasons: string[] = [];

    // 1. Check if player is injured
    const playerInjury = injuries.find(i => i.playerId === player.id);
    if (playerInjury && playerInjury.status === 'Out') {
        return {
            playerId: player.id,
            playerName: player.name,
            projectedPoints: 0,
            confidence: 100,
            reason: 'Player is OUT (inactive)',
            isValueBet: false,
            edge: 0,
            vegasLine,
        };
    }

    // 2. Start with base projection
    let projectedPoints = player.basePoints;
    reasons.push(`Base: ${player.basePoints.toFixed(1)} PPG average`);

    // 3. Apply Pareto redistribution
    const paretoAdjustments = calculateParetoAdjustment(teamRoster, injuries);
    const volumeMultiplier = paretoAdjustments.get(player.id) || 1.0;

    if (volumeMultiplier > 1.0) {
        projectedPoints *= volumeMultiplier;
        reasons.push(`+${((volumeMultiplier - 1) * 100).toFixed(0)}% volume (teammate absence)`);
    }

    // 4. Apply Pareto efficiency penalty if core player is out
    if (hasParetoPlayerOut(teamRoster, injuries) && !injuries.find(i => i.playerId === player.id)) {
        projectedPoints *= (1 - PARETO_EFFICIENCY_PENALTY);
        reasons.push(`-${(PARETO_EFFICIENCY_PENALTY * 100).toFixed(0)}% efficiency (spacing affected)`);
    }

    // 5. Apply Synergy matchup modifier
    const matchup = calculateMatchupModifier(player.synergyStats, opponentDefense);
    if (matchup.modifier !== 1.0) {
        projectedPoints *= matchup.modifier;
        if (matchup.reason) {
            reasons.push(matchup.reason);
        }
    }

    // 6. Apply B2B fatigue penalty
    if (isB2B) {
        projectedPoints *= (1 - B2B_PENALTY);
        reasons.push('Back-to-back game fatigue');
    }

    // 7. Calculate confidence score
    let confidence = 85;
    if (isB2B) confidence -= 10;
    if (volumeMultiplier > 1.2) confidence -= 15; // High redistribution = high variance
    if (playerInjury && playerInjury.status === 'Day-To-Day') confidence -= 20;
    confidence = Math.max(30, Math.min(95, confidence));

    // 8. Calculate Value Bet edge
    const edgeResult = vegasLine ? calculateEdge(projectedPoints, vegasLine) : { edge: 0, isValue: false };

    return {
        playerId: player.id,
        playerName: player.name,
        projectedPoints: parseFloat(projectedPoints.toFixed(1)),
        confidence,
        reason: reasons.join('. '),
        isValueBet: edgeResult.isValue,
        edge: parseFloat(edgeResult.edge.toFixed(1)),
        vegasLine,
    };
}

/**
 * Match player prop lines with projections to find value bets
 */
export function matchProjectionsWithProps(
    projections: ProjectionResult[],
    props: PlayerPropLine[]
): ProjectionResult[] {
    return projections.map(projection => {
        const prop = props.find(
            p => p.playerId === projection.playerId && p.market === 'points'
        );

        if (!prop) return projection;

        const edgeResult = calculateEdge(projection.projectedPoints, prop.line);

        return {
            ...projection,
            vegasLine: prop.line,
            vegasOdd: prop.bestOverOdd?.odds,
            isValueBet: edgeResult.isValue,
            edge: parseFloat(edgeResult.edge.toFixed(1)),
        };
    });
}

/**
 * Get confidence label from score
 */
export function getConfidenceLabel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 75) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    return 'LOW';
}

/**
 * Calculate implied probability from decimal odds
 */
export function oddsToImpliedProbability(decimalOdds: number): number {
    return (1 / decimalOdds) * 100;
}

/**
 * Calculate fair odds from probability
 */
export function probabilityToFairOdds(probability: number): number {
    return 100 / probability;
}
