/**
 * API Route: GET /api/analysis/[gameId]
 * Returns complete game analysis with player projections and win probability
 */

import { NextResponse } from 'next/server';
import { getGameAnalysis } from '@/lib/services/gameAnalysis';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ gameId: string }> }
) {
    const { gameId } = await params;

    if (!gameId) {
        return NextResponse.json(
            { error: 'Missing required parameter: gameId', code: 'BAD_REQUEST' },
            { status: 400 }
        );
    }

    try {
        const analysis = await getGameAnalysis(gameId);

        if (!analysis) {
            return NextResponse.json(
                { error: 'Game not found or analysis unavailable', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        return NextResponse.json(analysis);
    } catch (error) {
        console.error('[API /api/analysis] Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';

        if (message.includes('RATE_LIMIT')) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMIT' },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
