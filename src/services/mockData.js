export const MOCK_INJURIES = {
    daily: [
        { id: 'p1', name: 'LeBron James', status: 'Active', team: 'LAL' },
        { id: 'p2', name: 'Anthony Davis', status: 'Day-to-Day', team: 'LAL', note: 'Back Spasms' },
        { id: 'p3', name: 'Stephen Curry', status: 'Active', team: 'GSW' },
        { id: 'p4', name: 'Buddy Hield', status: 'Active', team: 'GSW' },
        { id: 'p5', name: 'Jayson Tatum', status: 'Active', team: 'BOS' },
        { id: 'p10', name: 'Luka Doncic', status: 'Out', team: 'DAL', note: 'Ankle Sprain' },
    ]
};

export const MOCK_SCHEDULE = {
    games: [
        { id: 'g1', home: 'LAL', away: 'BOS', time: '19:00', isB2B_home: false, isB2B_away: true },
        { id: 'g2', home: 'GSW', away: 'PHX', time: '21:30', isB2B_home: false, isB2B_away: false },
    ]
};

export const MOCK_PLAYERS = {
    'p1': { id: 'p1', name: 'LeBron James', team: 'LAL', position: 'F', ppp_iso: 1.12, ppp_pnr: 0.98, ppp_spotup: 1.05, usage: 28.5, base_points: 25.0 },
    'p2': { id: 'p2', name: 'Anthony Davis', team: 'LAL', position: 'C', ppp_iso: 1.05, ppp_pnr: 1.25, ppp_spotup: 0.90, usage: 25.0, base_points: 24.0 },
    'p3': { id: 'p3', name: 'Stephen Curry', team: 'GSW', position: 'G', ppp_iso: 1.15, ppp_pnr: 1.10, ppp_spotup: 1.35, usage: 30.0, base_points: 27.5 },
    'p4': { id: 'p4', name: 'Buddy Hield', team: 'GSW', position: 'G', ppp_iso: 0.95, ppp_pnr: 1.05, ppp_spotup: 1.25, usage: 20.0, base_points: 16.0 },
    'p5': { id: 'p5', name: 'Jayson Tatum', team: 'BOS', position: 'F', ppp_iso: 1.10, ppp_pnr: 1.05, ppp_spotup: 1.10, usage: 29.5, base_points: 26.5 },
    'p6': { id: 'p6', name: 'Jaylen Brown', team: 'BOS', position: 'G', ppp_iso: 1.05, ppp_pnr: 1.00, ppp_spotup: 1.15, usage: 27.0, base_points: 23.5 },
    'p7': { id: 'p7', name: 'Kevin Durant', team: 'PHX', position: 'F', ppp_iso: 1.20, ppp_pnr: 1.10, ppp_spotup: 1.30, usage: 29.0, base_points: 28.0 },
    'p8': { id: 'p8', name: 'Devin Booker', team: 'PHX', position: 'G', ppp_iso: 1.10, ppp_pnr: 1.15, ppp_spotup: 1.20, usage: 28.0, base_points: 26.0 },
};

export const MOCK_TEAMS = {
    'BOS': { id: 'BOS', name: 'Boston Celtics', def_rank_iso: 5, def_rank_pnr: 2, def_rank_spotup: 10 },
    'PHX': { id: 'PHX', name: 'Phoenix Suns', def_rank_iso: 20, def_rank_pnr: 15, def_rank_spotup: 25 },
    'LAL': { id: 'LAL', name: 'LA Lakers', def_rank_iso: 12, def_rank_pnr: 18, def_rank_spotup: 15 },
    'GSW': { id: 'GSW', name: 'Golden State', def_rank_iso: 10, def_rank_pnr: 10, def_rank_spotup: 20 },
};

export const MOCK_CAREER = {
    'p1': { points_avg: 27.2, rebounds_avg: 7.5, assists_avg: 7.3 },
    'p3': { points_avg: 26.5, rebounds_avg: 4.5, assists_avg: 6.5 }
};
