/**
 * NBA Prediction Engine
 * Core logic for "NBA Precision Analytics"
 */

/**
 * Calculates volume redistribution multipliers based on Pareto principle.
 * If a Top 20% player (Pareto Core) is OUT, their usage is redistributed.
 * 
 * @param {Array} teamRoster - List of players in the team
 * @param {Array} injuries - List of injury reports
 * @returns {Object} Map of playerId -> volumeMultiplier (e.g., 1.0 for normal, 1.1 for 10% boost)
 */
export const calculateParetoRedistribution = (teamRoster, injuries) => {
    // 1. Identify Status
    const activePlayers = [];
    const missingParetoUsage = [];

    // Sort by Usage to find Top 20%
    const sortedByUsage = [...teamRoster].sort((a, b) => b.usage - a.usage);
    const top20Count = Math.ceil(teamRoster.length * 0.2);
    const paretoCoreIds = sortedByUsage.slice(0, top20Count).map(p => p.id);

    let totalActiveUsage = 0;

    teamRoster.forEach(p => {
        const isOut = injuries.find(i => i.id === p.id && i.status !== 'Active');
        if (isOut) {
            if (paretoCoreIds.includes(p.id)) {
                missingParetoUsage.push(p.usage);
            }
        } else {
            activePlayers.push(p);
            totalActiveUsage += p.usage;
        }
    });

    const totalMissingUsage = missingParetoUsage.reduce((a, b) => a + b, 0);
    const adjustments = {};

    // Default to 1.0
    teamRoster.forEach(p => adjustments[p.id] = 1.0);

    if (totalMissingUsage > 0 && totalActiveUsage > 0) {
        // Redistribute proportional to current usage
        activePlayers.forEach(p => {
            const share = p.usage / totalActiveUsage;
            const extraUsage = totalMissingUsage * share;
            // New Usage = Old Usage + Extra
            // Multiplier = New / Old
            adjustments[p.id] = (p.usage + extraUsage) / p.usage;
        });
    }

    return adjustments;
};

/**
 * Calculates the final projection for a player.
 * 
 * @param {Object} player - { id, name, stats: { ppp_iso, ppp_pnr, ppp_spotup }, freq: { iso, ppp_iso_freq, ... }, base_points, usage }
 * @param {Object} opponent - { def_rank_iso, def_rank_pnr, def_rank_spotup } (1 = Best Defense, 30 = Worst)
 * @param {Object} context - { status: 'Active'|'Out', isB2B: boolean, volumeMultiplier: number }
 * @returns {Object} { projectedPoints, confidenceScore, reason }
 */
export const calculatePlayerProjection = (player, opponent, context) => {
    // 1. Injury Check
    if (context.status !== 'Active') {
        return { projectedPoints: 0, confidenceScore: 100, reason: "Player is inactive." };
    }

    // 2. Base Volume (Points) adjusted by Pareto Multiplier
    let projectedPoints = (player.base_points || 20) * (context.volumeMultiplier || 1.0);
    let reason = "Base projection based on recent form.";

    if (context.volumeMultiplier > 1.0) {
        reason += ` Increased volume due to teammate absence (+${Math.round((context.volumeMultiplier - 1) * 100)}%).`;
    }

    // 3. Matchup Adjustment (Synergy)
    // We assume player has stats like ppp_iso and freq_iso. 
    // If not present in mock, we default.
    const synergyTypes = [
        { type: 'Iso', rankKey: 'def_rank_iso', freqKey: 'freq_iso', pppKey: 'ppp_iso' },
        { type: 'Pick & Roll', rankKey: 'def_rank_pnr', freqKey: 'freq_pnr', pppKey: 'ppp_pnr' },
        { type: 'Spot Up', rankKey: 'def_rank_spotup', freqKey: 'freq_spotup', pppKey: 'ppp_spotup' }
    ];

    let efficiencyMod = 1.0;

    // Default mock freqs if missing
    const freqs = {
        freq_iso: player.freq_iso || 0.2,
        freq_pnr: player.freq_pnr || 0.4,
        freq_spotup: player.freq_spotup || 0.3
    };

    synergyTypes.forEach(play => {
        const freq = freqs[play.freqKey];
        const rank = opponent[play.rankKey] || 15; // Default to mid

        if (freq > 0.15) { // Only relevant if significant part of game
            if (rank <= 5) { // Top 5 Defense (Elite)
                // Reduce efficiency
                // Requirement: 40% usage + Rank 1 => -15%. scaling down.
                // Simple logic: If rank 1-5, punish.
                const penalty = 0.10; // -10%
                efficiencyMod -= (penalty * freq);
                reason += ` Opponent Elite ${play.type} Defense.`;
            } else if (rank >= 25) { // Bottom 5 Defense (Weak)
                const boost = 0.10; // +10%
                efficiencyMod += (boost * freq);
                reason += ` Exploiting Weak ${play.type} Defense.`;
            }
        }
    });

    // 4. Context Adjustment (B2B)
    if (context.isB2B) {
        // -5% on 3PT implies overall efficiency drop. Let's approx as -3% total points.
        efficiencyMod -= 0.03;
        reason += " Back-to-back game fatigue penalty.";
    }

    projectedPoints = projectedPoints * efficiencyMod;

    // Confidence Score 
    // Simple mock logic: Higher volume usually lower variance % but hard to model without variance data.
    // We'll give a static high confidence if no B2B and not elite defense.
    let confidence = 85;
    if (context.isB2B) confidence -= 10;
    if (context.volumeMultiplier > 1.2) confidence -= 15; // High redistribution variance

    return {
        projectedPoints: parseFloat(projectedPoints.toFixed(1)),
        confidenceScore: Math.max(50, confidence),
        reason: reason.trim()
    };
};
