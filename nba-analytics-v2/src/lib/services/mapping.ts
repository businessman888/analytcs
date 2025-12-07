/**
 * Mapping Service v3
 * Direct approach: Instead of trying to map UUIDs to URNs,
 * we'll fetch player props from the Schedule API's sport event IDs directly
 * 
 * The key insight is that the Sportradar NBA Standard API already uses URN format
 * for game IDs (sr:sport_event:xxxxx), we just need to extract them properly
 */

import { cache } from 'react';

// Correct base URL (api.sportradar.com, not .us)
const ODDS_BASE_URL = 'https://api.sportradar.com/oddscomparison-prematch/trial/v2/en';
const NBA_STANDARD_URL = 'https://api.sportradar.us/nba/trial/v8/en';

// In-memory cache for game mappings
const gameIdToUrnCache = new Map<string, string>();

/**
 * Check if an ID is already in URN format
 */
export function isUrn(id: string): boolean {
    return id.startsWith('sr:');
}

/**
 * Fetch today's NBA schedule from Standard API to get URN-style IDs
 */
async function fetchNbaSchedule(): Promise<Array<{ id: string, home: string, away: string }>> {
    const apiKey = process.env.SPORTRADAR_API_KEY;

    if (!apiKey) {
        console.error('[Mapping] Missing SPORTRADAR_API_KEY');
        return [];
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    // Use NBA Standard API to get schedule with URN-format IDs
    const url = `${NBA_STANDARD_URL}/games/${year}/${month}/${day}/schedule.json?api_key=${apiKey}`;

    console.log('[Mapping] Fetching NBA schedule for URN mapping...');

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 3600 },
        });

        if (!response.ok) {
            console.error(`[Mapping] Failed to fetch NBA schedule: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const games = data.games || [];

        return games.map((game: { id: string; sr_id?: string; home: { name: string }; away: { name: string } }) => ({
            id: game.id,
            srId: game.sr_id, // This might have the sr: format
            home: game.home?.name || '',
            away: game.away?.name || '',
        }));
    } catch (error) {
        console.error('[Mapping] Error fetching NBA schedule:', error);
        return [];
    }
}

/**
 * Try to find URN from Odds API events list
 */
async function fetchOddsApiEvents(): Promise<Array<{ id: string, home: string, away: string }>> {
    const apiKey = process.env.SPORTRADAR_API_KEY;
    if (!apiKey) return [];

    // Try fetching from odds API schedule
    const url = `${ODDS_BASE_URL}/sports/sr:sport:2/schedules/live/sport_events.json?api_key=${apiKey}`;

    console.log('[Mapping] Fetching from Odds API...');

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 1800 },
        });

        if (!response.ok) {
            console.error(`[Mapping] Odds API schedule failed: ${response.status}`);
            return [];
        }

        interface OddsEvent {
            id: string;
            competitors: Array<{ name: string; qualifier: 'home' | 'away' }>;
        }

        const data: { sport_events?: OddsEvent[] } = await response.json();
        const events = data.sport_events || [];

        return events.map(event => {
            const home = event.competitors?.find((c: { qualifier: string }) => c.qualifier === 'home')?.name || '';
            const away = event.competitors?.find((c: { qualifier: string }) => c.qualifier === 'away')?.name || '';
            return { id: event.id, home, away };
        });
    } catch (error) {
        console.error('[Mapping] Odds API error:', error);
        return [];
    }
}

/**
 * Normalize team name for matching
 */
function normalizeTeamName(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/^(the\s+)/i, '')
        .trim();
}

/**
 * Check if two team names match (fuzzy)
 */
function teamsMatch(name1: string, name2: string): boolean {
    const n1 = normalizeTeamName(name1);
    const n2 = normalizeTeamName(name2);

    if (!n1 || !n2) return false;
    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;

    // Match by city or nickname
    const parts1 = n1.split(' ');
    const parts2 = n2.split(' ');

    // Check if last word (nickname) matches
    if (parts1.length > 0 && parts2.length > 0 &&
        parts1[parts1.length - 1] === parts2[parts2.length - 1]) return true;

    return false;
}

/**
 * Find URN for a game by team names - searches both APIs
 */
export const findUrnByTeams = cache(async (
    homeTeam: string,
    awayTeam: string
): Promise<string | null> => {
    console.log(`[Mapping] Looking for URN: ${awayTeam} @ ${homeTeam}`);

    // First try Odds API events
    const oddsEvents = await fetchOddsApiEvents();
    for (const event of oddsEvents) {
        if (teamsMatch(event.home, homeTeam) && teamsMatch(event.away, awayTeam)) {
            console.log(`[Mapping] Found in Odds API: ${event.id}`);
            return event.id;
        }
    }

    // Then try NBA Standard API
    const nbaGames = await fetchNbaSchedule();
    for (const game of nbaGames) {
        if (teamsMatch(game.home, homeTeam) && teamsMatch(game.away, awayTeam)) {
            // Standard API IDs are also UUIDs, but might have sr_id
            const urnId = game.id.startsWith('sr:') ? game.id : `sr:sport_event:${game.id}`;
            console.log(`[Mapping] Found in NBA API: ${urnId}`);
            return urnId;
        }
    }

    console.warn(`[Mapping] No URN found for ${awayTeam} @ ${homeTeam}`);
    return null;
});

/**
 * Get all events for debugging
 */
export async function getAllOddsEvents() {
    return await fetchOddsApiEvents();
}

/**
 * Map game ID to URN - main entry point
 */
export const mapGameIdToUrn = cache(async (
    gameId: string,
    gameInfo?: { homeTeam: string; awayTeam: string }
): Promise<string | null> => {
    // Already URN format
    if (isUrn(gameId)) {
        return gameId;
    }

    // Check cache
    if (gameIdToUrnCache.has(gameId)) {
        return gameIdToUrnCache.get(gameId) || null;
    }

    // Need game info for team-based matching
    if (gameInfo && gameInfo.homeTeam && gameInfo.awayTeam) {
        const urn = await findUrnByTeams(gameInfo.homeTeam, gameInfo.awayTeam);
        if (urn) {
            gameIdToUrnCache.set(gameId, urn);
            return urn;
        }
    }

    console.warn(`[Mapping] Cannot map UUID ${gameId} - no game info provided`);
    return null;
});
