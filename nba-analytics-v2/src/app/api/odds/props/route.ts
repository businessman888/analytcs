/**
 * API Route: GET /api/odds/props
 * Query params: 
 *   - gameId (required) - UUID from Schedule API
 *   - homeTeam (optional) - Home team name for mapping
 *   - awayTeam (optional) - Away team name for mapping  
 *   - playerId (optional) - Filter to specific player
 * Returns player prop lines (points, assists, 3PM, rebounds)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayerProps } from '@/lib/services/odds';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const gameId = searchParams.get('gameId');
    const homeTeam = searchParams.get('homeTeam') || undefined;
    const awayTeam = searchParams.get('awayTeam') || undefined;
    const playerId = searchParams.get('playerId') || undefined;

    if (!gameId) {
        return NextResponse.json(
            { error: 'Missing required parameter: gameId', code: 'BAD_REQUEST' },
            { status: 400 }
        );
    }

    // Build game info for mapping if team names provided
    const gameInfo = (homeTeam && awayTeam)
        ? { homeTeam, awayTeam }
        : undefined;

    try {
        const props = await getPlayerProps(gameId, gameInfo, playerId);
        return NextResponse.json(props);
    } catch (error) {
        console.error('[API /api/odds/props] Error:', error);
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

        // Return empty props instead of erroring if odds not available
        if (message.includes('404') || message.includes('Not Found') || message.includes('No URN')) {
            return NextResponse.json({
                gameId,
                props: [],
                message: 'Odds not available for this game yet'
            });
        }

        return NextResponse.json(
            { error: message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
