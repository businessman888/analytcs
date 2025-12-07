/**
 * Debug API Route: GET /api/debug/mapping
 * Returns info about the mapping service for debugging
 */

import { NextResponse } from 'next/server';
import { getAllOddsEvents } from '@/lib/services/mapping';

export async function GET() {
    try {
        const events = await getAllOddsEvents();

        return NextResponse.json({
            success: true,
            eventsCount: events.length,
            events: events.slice(0, 10).map(e => ({
                id: e.id,
                scheduled: e.scheduled,
                competitors: e.competitors.map(c => ({
                    name: c.name,
                    qualifier: c.qualifier
                }))
            })),
            apiKeyPresent: !!process.env.SPORTRADAR_API_KEY,
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            apiKeyPresent: !!process.env.SPORTRADAR_API_KEY,
        });
    }
}
