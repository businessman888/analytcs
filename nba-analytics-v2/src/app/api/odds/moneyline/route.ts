/**
 * API Route: GET /api/odds/moneyline
 * Query params: gameId (required)
 * Returns moneyline odds for home/away teams
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMoneylineOdds } from '@/lib/services/odds';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const gameId = searchParams.get('gameId');

    if (!gameId) {
        return NextResponse.json(
            { error: 'Missing required parameter: gameId', code: 'BAD_REQUEST' },
            { status: 400 }
        );
    }

    try {
        const odds = await getMoneylineOdds(gameId);
        return NextResponse.json(odds);
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
                { error: 'API key expired or invalid for Odds API.', code: 'FORBIDDEN' },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
