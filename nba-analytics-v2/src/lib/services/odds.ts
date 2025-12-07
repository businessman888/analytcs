/**
 * Odds Service
 * Server-side only - Consumes Sportradar Odds Comparison API v2
 * 
 * Correct endpoints:
 * - Player Props: https://api.sportradar.com/oddscomparison-player-props/trial/v2/en/sport_events/{sport_event_id}/players_props.json
 * - Prematch Odds: https://api.sportradar.com/oddscomparison-prematch/trial/v2/en/sport_events/{sport_event_id}/markets.json
 */

import { cache } from 'react';
import { mapGameIdToUrn } from './mapping';

// Correct base URLs (api.sportradar.com, not .us)
// Note: Using 'trial' access level - change to 'production' for prod keys
const ODDS_BASE_URL = 'https://api.sportradar.com/oddscomparison-prematch/trial/v2/en';
const PROPS_BASE_URL = 'https://api.sportradar.com/oddscomparison-player-props/trial/v2/en';

// Bookmaker mapping (Sportradar ID -> Display Name)
export const BOOKMAKER_MAP: Record<number, string> = {
    17324: 'BetMGM',
    17208: 'DraftKings',
    17301: 'FanDuel',
    17209: 'ESPN BET',
    17210: 'BetRivers',
    17211: 'Caesars',
    17212: 'PointsBet',
    17213: 'Bet365',
    17214: 'BetUS',
    17215: 'Bovada',
};

// Market IDs
export const MARKET_IDS = {
    WINNER: 219,        // Winner (incl. overtime)
    POINTS: 921,        // Total points
    ASSISTS: 922,       // Total assists
    THREE_POINTERS: 924,// Total 3-point field goals
    REBOUNDS: 923,      // Total rebounds
} as const;

// Types
export interface BookmakerOdd {
    bookmaker: string;
    bookmakerId: number;
    odds: number;
    line?: number;
    lastUpdated: string;
}

export interface MoneylineOdds {
    gameId: string;
    home: {
        team: string;
        odds: BookmakerOdd[];
        bestOdd: BookmakerOdd | null;
    };
    away: {
        team: string;
        odds: BookmakerOdd[];
        bestOdd: BookmakerOdd | null;
    };
}

export interface PlayerPropLine {
    playerId: string;
    playerName: string;
    market: 'points' | 'assists' | 'threes' | 'rebounds';
    marketId: number;
    line: number;
    overOdds: BookmakerOdd[];
    underOdds: BookmakerOdd[];
    bestOverOdd: BookmakerOdd | null;
    bestUnderOdd: BookmakerOdd | null;
}

export interface PlayerPropsResponse {
    gameId: string;
    props: PlayerPropLine[];
    usedMockData?: boolean;
}

// Helper to make authenticated requests
async function fetchOddsApi<T>(
    baseUrl: string,
    endpoint: string
): Promise<T> {
    const apiKey = process.env.SPORTRADAR_API_KEY;

    if (!apiKey) {
        throw new Error('Missing API key: SPORTRADAR_API_KEY');
    }

    const url = `${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;

    console.log(`[Odds] Calling: ${baseUrl}${endpoint}`);

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
        next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
        console.error(`[Odds] API Error: ${response.status} ${response.statusText}`);
        if (response.status === 429) {
            throw new Error('RATE_LIMIT: API rate limit exceeded. Please try again later.');
        }
        if (response.status === 403) {
            throw new Error('FORBIDDEN: API key expired or insufficient permissions.');
        }
        if (response.status === 404) {
            throw new Error('NOT_FOUND: Sport event not found or no props available.');
        }
        throw new Error(`Odds API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// Helper to find best odd (highest decimal odds = best for bettor)
function findBestOdd(odds: BookmakerOdd[]): BookmakerOdd | null {
    if (odds.length === 0) return null;
    return odds.reduce((best, current) =>
        current.odds > best.odds ? current : best
    );
}

// Generate mock props for demonstration when API fails
function generateMockProps(gameId: string): PlayerPropsResponse {
    const mockPlayerNames = [
        'LeBron James', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo',
        'Luka Doncic', 'Joel Embiid', 'Jayson Tatum', 'Nikola Jokic',
        'Damian Lillard', 'Devin Booker', 'Anthony Edwards', 'Ja Morant'
    ];

    const numPlayers = 6 + Math.floor(Math.random() * 3);
    const shuffled = [...mockPlayerNames].sort(() => Math.random() - 0.5);
    const gamePlayers = shuffled.slice(0, numPlayers);

    const mockProps: PlayerPropLine[] = gamePlayers.map((name, idx) => {
        const basePoints = 18 + Math.floor(Math.random() * 12);
        const overOdd = 1.85 + Math.random() * 0.20;
        const underOdd = 1.85 + Math.random() * 0.20;

        return {
            playerId: `mock-player-${idx}`,
            playerName: name,
            market: 'points' as const,
            marketId: MARKET_IDS.POINTS,
            line: basePoints + 0.5,
            overOdds: [{
                bookmaker: ['BetMGM', 'DraftKings', 'FanDuel', 'Caesars'][Math.floor(Math.random() * 4)],
                bookmakerId: 17324,
                odds: parseFloat(overOdd.toFixed(2)),
                lastUpdated: new Date().toISOString(),
            }],
            underOdds: [{
                bookmaker: ['BetMGM', 'DraftKings', 'FanDuel', 'Caesars'][Math.floor(Math.random() * 4)],
                bookmakerId: 17208,
                odds: parseFloat(underOdd.toFixed(2)),
                lastUpdated: new Date().toISOString(),
            }],
            bestOverOdd: {
                bookmaker: 'DraftKings',
                bookmakerId: 17208,
                odds: parseFloat(overOdd.toFixed(2)),
                lastUpdated: new Date().toISOString(),
            },
            bestUnderOdd: {
                bookmaker: 'FanDuel',
                bookmakerId: 17301,
                odds: parseFloat(underOdd.toFixed(2)),
                lastUpdated: new Date().toISOString(),
            },
        };
    });

    return {
        gameId,
        props: mockProps,
        usedMockData: true,
    };
}

// Get Moneyline odds for a game
export const getMoneylineOdds = cache(async (gameId: string): Promise<MoneylineOdds> => {
    // Map UUID to URN if needed
    const matchId = await mapGameIdToUrn(gameId);

    if (!matchId) {
        console.warn(`[Odds] Could not map game ID: ${gameId}`);
        return {
            gameId,
            home: { team: '', odds: [], bestOdd: null },
            away: { team: '', odds: [], bestOdd: null },
        };
    }

    interface RawMarketOutcome {
        id: string;
        name: string;
        type: 'home' | 'away';
        books: {
            id: number;
            outcomes: {
                odds: number;
                open_odds: number;
                last_updated: string;
            }[];
        }[];
    }

    interface RawMarket {
        id: number;
        name: string;
        outcomes: RawMarketOutcome[];
    }

    try {
        // Correct endpoint: /sport_events/{id}/markets.json
        const data = await fetchOddsApi<{ markets: RawMarket[] }>(
            ODDS_BASE_URL,
            `/sport_events/${matchId}/markets.json?market_id=${MARKET_IDS.WINNER}`
        );

        const market = data.markets?.find(m => m.id === MARKET_IDS.WINNER);

        const homeOdds: BookmakerOdd[] = [];
        const awayOdds: BookmakerOdd[] = [];
        let homeTeam = '';
        let awayTeam = '';

        if (market) {
            for (const outcome of market.outcomes || []) {
                if (outcome.type === 'home') {
                    homeTeam = outcome.name;
                    for (const book of outcome.books || []) {
                        for (const o of book.outcomes || []) {
                            homeOdds.push({
                                bookmaker: BOOKMAKER_MAP[book.id] || `Book ${book.id}`,
                                bookmakerId: book.id,
                                odds: o.odds,
                                lastUpdated: o.last_updated,
                            });
                        }
                    }
                } else if (outcome.type === 'away') {
                    awayTeam = outcome.name;
                    for (const book of outcome.books || []) {
                        for (const o of book.outcomes || []) {
                            awayOdds.push({
                                bookmaker: BOOKMAKER_MAP[book.id] || `Book ${book.id}`,
                                bookmakerId: book.id,
                                odds: o.odds,
                                lastUpdated: o.last_updated,
                            });
                        }
                    }
                }
            }
        }

        return {
            gameId,
            home: {
                team: homeTeam,
                odds: homeOdds,
                bestOdd: findBestOdd(homeOdds),
            },
            away: {
                team: awayTeam,
                odds: awayOdds,
                bestOdd: findBestOdd(awayOdds),
            },
        };
    } catch (error) {
        console.error('[Odds] getMoneylineOdds error:', error);
        return {
            gameId,
            home: { team: '', odds: [], bestOdd: null },
            away: { team: '', odds: [], bestOdd: null },
        };
    }
});

// Get Player Props for a game
export const getPlayerProps = cache(async (
    gameId: string,
    gameInfo?: { homeTeam: string; awayTeam: string },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    playerId?: string
): Promise<PlayerPropsResponse> => {
    // Map UUID to URN if needed
    const matchId = await mapGameIdToUrn(gameId, gameInfo);

    if (!matchId) {
        console.warn(`[Odds] Could not map game ID for props: ${gameId}, using mock data`);
        return generateMockProps(gameId);
    }

    try {
        interface RawPlayerProp {
            player: {
                id: string;
                name: string;
            };
            market: {
                id: number;
                name: string;
            };
            outcomes: {
                type: 'over' | 'under';
                line: number;
                books: {
                    id: number;
                    odds: number;
                    last_updated: string;
                }[];
            }[];
        }

        // Correct endpoint: /sport_events/{id}/players_props.json
        const data = await fetchOddsApi<{ player_props: RawPlayerProp[] }>(
            PROPS_BASE_URL,
            `/sport_events/${matchId}/players_props.json`
        );

        const marketToType: Record<number, PlayerPropLine['market']> = {
            [MARKET_IDS.POINTS]: 'points',
            [MARKET_IDS.ASSISTS]: 'assists',
            [MARKET_IDS.THREE_POINTERS]: 'threes',
            [MARKET_IDS.REBOUNDS]: 'rebounds',
        };

        const relevantMarketIds = [
            MARKET_IDS.POINTS,
            MARKET_IDS.ASSISTS,
            MARKET_IDS.THREE_POINTERS,
            MARKET_IDS.REBOUNDS,
        ];

        const props: PlayerPropLine[] = [];

        for (const prop of data.player_props || []) {
            if (!(relevantMarketIds as readonly number[]).includes(prop.market.id)) continue;

            const overOdds: BookmakerOdd[] = [];
            const underOdds: BookmakerOdd[] = [];
            let line = 0;

            for (const outcome of prop.outcomes || []) {
                line = outcome.line;
                const oddsArray = outcome.type === 'over' ? overOdds : underOdds;

                for (const book of outcome.books || []) {
                    oddsArray.push({
                        bookmaker: BOOKMAKER_MAP[book.id] || `Book ${book.id}`,
                        bookmakerId: book.id,
                        odds: book.odds,
                        lastUpdated: book.last_updated,
                    });
                }
            }

            props.push({
                playerId: prop.player.id,
                playerName: prop.player.name,
                market: marketToType[prop.market.id],
                marketId: prop.market.id,
                line,
                overOdds,
                underOdds,
                bestOverOdd: findBestOdd(overOdds),
                bestUnderOdd: findBestOdd(underOdds),
            });
        }

        console.log(`[Odds] Got ${props.length} real props for game ${gameId}`);

        // If no props found, return mock data
        if (props.length === 0) {
            console.log(`[Odds] No props from API, using mock data`);
            return generateMockProps(gameId);
        }

        return {
            gameId,
            props,
        };
    } catch (error) {
        console.error('[Odds] getPlayerProps error:', error);
        console.log(`[Odds] API failed, using mock data`);
        return generateMockProps(gameId);
    }
});

// Helper to convert decimal odds to implied probability
export function oddsToImpliedProbability(decimalOdds: number): number {
    return (1 / decimalOdds) * 100;
}

// Helper to convert probability to fair decimal odds
export function probabilityToFairOdds(probability: number): number {
    return 100 / probability;
}
