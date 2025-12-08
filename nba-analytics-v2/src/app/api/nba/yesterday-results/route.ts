/**
 * Yesterday's Game Results API
 * GET /api/nba/yesterday-results
 * Fetches games from the previous day with final scores
 */

import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.sportradar.us/nba/trial/v8/en';

export interface YesterdayGame {
    id: string;
    status: string;
    home: {
        alias: string;
        name: string;
        score: number;
    };
    away: {
        alias: string;
        name: string;
        score: number;
    };
}

export async function GET() {
    try {
        // Use the same key as nbaData.ts
        const STATS_API_KEY = process.env.SPORTRADAR_API_KEY;

        if (!STATS_API_KEY) {
            console.error('[YesterdayResults] Missing SPORTRADAR_API_KEY');
            return NextResponse.json(
                { error: 'Sportradar API key not configured' },
                { status: 500 }
            );
        }

        // Calculate yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');

        // Fetch daily schedule for yesterday
        const scheduleUrl = `${BASE_URL}/games/${year}/${month}/${day}/schedule.json?api_key=${STATS_API_KEY}`;
        console.log(`[YesterdayResults] Fetching games for ${year}-${month}-${day}`);

        const scheduleResponse = await fetch(scheduleUrl, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 3600 }, // Cache for 1 hour
        });

        if (!scheduleResponse.ok) {
            console.error(`[YesterdayResults] Schedule API error: ${scheduleResponse.status}`);
            return NextResponse.json({ games: [] });
        }

        const scheduleData = await scheduleResponse.json();
        const allGames = scheduleData.games || [];

        console.log(`[YesterdayResults] Total games from schedule: ${allGames.length}`);

        if (allGames.length === 0) {
            return NextResponse.json({ date: `${year}-${month}-${day}`, games: [] });
        }

        // Log statuses for debugging
        const statuses = allGames.map((g: { status: string }) => g.status);
        console.log(`[YesterdayResults] Game statuses: ${JSON.stringify(statuses)}`);

        // Filter for completed games
        const completedStatuses = ['closed', 'complete', 'final'];
        const completedGames = allGames.filter((g: { status: string }) =>
            completedStatuses.includes(g.status.toLowerCase())
        );

        // For each completed game, try to get scores from the boxscore
        const gamesWithScores: YesterdayGame[] = [];

        for (const game of completedGames.slice(0, 10)) { // Limit to 10 to avoid rate limits
            try {
                const boxscoreUrl = `${BASE_URL}/games/${game.id}/boxscore.json?api_key=${STATS_API_KEY}`;
                const boxscoreResponse = await fetch(boxscoreUrl, {
                    headers: { 'Accept': 'application/json' },
                    next: { revalidate: 3600 },
                });

                if (boxscoreResponse.ok) {
                    const boxscore = await boxscoreResponse.json();
                    gamesWithScores.push({
                        id: game.id,
                        status: game.status,
                        home: {
                            alias: boxscore.home?.alias || game.home?.alias || 'TBD',
                            name: boxscore.home?.name || game.home?.name || 'Unknown',
                            score: boxscore.home?.points || 0,
                        },
                        away: {
                            alias: boxscore.away?.alias || game.away?.alias || 'TBD',
                            name: boxscore.away?.name || game.away?.name || 'Unknown',
                            score: boxscore.away?.points || 0,
                        },
                    });
                } else {
                    // Fallback to schedule data (will have 0 scores)
                    gamesWithScores.push({
                        id: game.id,
                        status: game.status,
                        home: {
                            alias: game.home?.alias || 'TBD',
                            name: game.home?.name || 'Unknown',
                            score: game.home?.points || 0,
                        },
                        away: {
                            alias: game.away?.alias || 'TBD',
                            name: game.away?.name || 'Unknown',
                            score: game.away?.points || 0,
                        },
                    });
                }

                // Small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 100));
            } catch (err) {
                console.error(`[YesterdayResults] Error fetching boxscore for ${game.id}:`, err);
            }
        }

        console.log(`[YesterdayResults] Found ${gamesWithScores.length} games with scores`);

        return NextResponse.json({
            date: `${year}-${month}-${day}`,
            games: gamesWithScores,
        });
    } catch (error) {
        console.error('[YesterdayResults] Error:', error);
        return NextResponse.json({ games: [] });
    }
}
