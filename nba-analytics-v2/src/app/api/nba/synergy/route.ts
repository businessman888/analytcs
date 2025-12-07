/**
 * API Route: GET /api/nba/synergy
 * Returns player Synergy stats and team defensive rankings
 */

import { NextResponse } from 'next/server';
import { getPlayerSynergyStats, getTeamDefensiveStats } from '@/lib/services/nbaData';

export async function GET() {
    try {
        const [players, teams] = await Promise.all([
            getPlayerSynergyStats(),
            getTeamDefensiveStats(),
        ]);

        return NextResponse.json({ players, teams });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        if (message.includes('RATE_LIMIT')) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMIT' },
                { status: 429 }
            );
        }

        if (message.includes('FORBIDDEN')) {
            return NextResponse.json(
                { error: 'API key expired or invalid for Synergy API.', code: 'FORBIDDEN' },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
