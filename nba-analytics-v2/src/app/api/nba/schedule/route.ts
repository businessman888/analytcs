/**
 * API Route: GET /api/nba/schedule
 * Returns today's NBA games
 */

import { NextResponse } from 'next/server';
import { getSchedule } from '@/lib/services/nbaData';

export async function GET() {
    try {
        const schedule = await getSchedule();
        return NextResponse.json(schedule);
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
                { error: 'API key expired or invalid.', code: 'FORBIDDEN' },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
