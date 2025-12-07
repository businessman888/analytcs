/**
 * Debug API Route: GET /api/debug/props-test
 * Tests direct call to Sportradar Player Props API
 */

import { NextResponse } from 'next/server';

export async function GET() {
    const apiKey = process.env.SPORTRADAR_API_KEY;

    if (!apiKey) {
        return NextResponse.json({ error: 'No API key' });
    }

    // Try fetching NBA sport events from Odds Comparison API
    const baseUrl = 'https://api.sportradar.us/oddscomparison-prematch/v2/en';

    // Try different endpoints to see which works
    const endpoints = [
        `/sports/sr:sport:2/schedules/live/sport_events.json`,
        `/sports/sr:sport:2/sport_events.json`,
    ];

    const results: Record<string, unknown> = {};

    for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}?api_key=${apiKey}`;
        try {
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
            });

            if (response.ok) {
                const data = await response.json();
                results[endpoint] = {
                    status: response.status,
                    eventsCount: data.sport_events?.length || 0,
                    sampleEvents: (data.sport_events || []).slice(0, 3).map((e: { id: string; scheduled?: string; competitors?: Array<{ name: string; qualifier: string }> }) => ({
                        id: e.id,
                        scheduled: e.scheduled,
                        teams: e.competitors?.map((c: { name: string; qualifier: string }) => `${c.name} (${c.qualifier})`),
                    })),
                };
            } else {
                results[endpoint] = {
                    status: response.status,
                    statusText: response.statusText,
                };
            }
        } catch (error) {
            results[endpoint] = {
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    return NextResponse.json({
        apiKeyPresent: true,
        apiKeyPrefix: apiKey.substring(0, 8) + '...',
        results,
    });
}
