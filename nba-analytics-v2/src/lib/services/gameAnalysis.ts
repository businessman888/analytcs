/**
 * Game Analysis Service
 * Provides complete game analysis with player projections and win probability
 */

import { cache } from 'react';
import { getSchedule, getTeamRoster, type TeamPlayer, type TeamRoster } from './nbaData';

// Types
export interface PlayerProjection {
    playerId: string;
    playerName: string;
    position: string;
    projection: number;
    line: number;
    edge: number;
    isValueBet: boolean;
    confidence: number;
}

export interface TeamAnalysis {
    id: string;
    name: string;
    alias: string;
    winProbability: number;
    players: PlayerProjection[];
}

export interface GameAnalysis {
    gameId: string;
    scheduled: string;
    homeTeam: TeamAnalysis;
    awayTeam: TeamAnalysis;
    analysis: {
        favoredTeam: 'home' | 'away';
        reasoning: string[];
        summary: string;
    };
}

// Mock NBA rosters for when API fails or during development
const MOCK_TEAM_ROSTERS: Record<string, { name: string; alias: string; players: TeamPlayer[] }> = {
    // Western Conference
    'GSW': {
        name: 'Golden State Warriors',
        alias: 'GSW',
        players: [
            { id: 'curry', name: 'Stephen Curry', position: 'G', ppg: 26.4, apg: 5.1, rpg: 4.5 },
            { id: 'wiggins', name: 'Andrew Wiggins', position: 'F', ppg: 17.1, apg: 2.3, rpg: 5.0 },
            { id: 'kuminga', name: 'Jonathan Kuminga', position: 'F', ppg: 14.2, apg: 2.2, rpg: 4.8 },
            { id: 'green', name: 'Draymond Green', position: 'F', ppg: 8.6, apg: 6.0, rpg: 7.2 },
            { id: 'looney', name: 'Kevon Looney', position: 'C', ppg: 5.1, apg: 2.5, rpg: 7.3 },
        ]
    },
    'LAL': {
        name: 'Los Angeles Lakers',
        alias: 'LAL',
        players: [
            { id: 'lebron', name: 'LeBron James', position: 'F', ppg: 25.7, apg: 8.3, rpg: 7.3 },
            { id: 'ad', name: 'Anthony Davis', position: 'C', ppg: 24.1, apg: 3.5, rpg: 12.6 },
            { id: 'reaves', name: 'Austin Reaves', position: 'G', ppg: 15.9, apg: 5.5, rpg: 4.3 },
            { id: 'russell', name: "D'Angelo Russell", position: 'G', ppg: 14.3, apg: 4.8, rpg: 2.5 },
            { id: 'hachimura', name: 'Rui Hachimura', position: 'F', ppg: 11.8, apg: 1.2, rpg: 4.3 },
        ]
    },
    'DEN': {
        name: 'Denver Nuggets',
        alias: 'DEN',
        players: [
            { id: 'jokic', name: 'Nikola Jokic', position: 'C', ppg: 26.4, apg: 9.0, rpg: 12.4 },
            { id: 'murray', name: 'Jamal Murray', position: 'G', ppg: 21.2, apg: 6.5, rpg: 4.1 },
            { id: 'mpj', name: 'Michael Porter Jr.', position: 'F', ppg: 17.1, apg: 1.4, rpg: 7.0 },
            { id: 'gordon', name: 'Aaron Gordon', position: 'F', ppg: 13.9, apg: 3.0, rpg: 6.5 },
            { id: 'caldwell', name: 'Kentavious Caldwell-Pope', position: 'G', ppg: 10.1, apg: 2.4, rpg: 2.4 },
        ]
    },
    'PHX': {
        name: 'Phoenix Suns',
        alias: 'PHX',
        players: [
            { id: 'booker', name: 'Devin Booker', position: 'G', ppg: 27.1, apg: 6.9, rpg: 4.5 },
            { id: 'beal', name: 'Bradley Beal', position: 'G', ppg: 18.2, apg: 5.0, rpg: 4.4 },
            { id: 'durant', name: 'Kevin Durant', position: 'F', ppg: 27.1, apg: 5.0, rpg: 6.6 },
            { id: 'nurkic', name: 'Jusuf Nurkic', position: 'C', ppg: 9.2, apg: 3.2, rpg: 10.1 },
            { id: 'allen', name: 'Grayson Allen', position: 'G', ppg: 11.3, apg: 3.0, rpg: 3.1 },
        ]
    },
    'LAC': {
        name: 'Los Angeles Clippers',
        alias: 'LAC',
        players: [
            { id: 'kawhi', name: 'Kawhi Leonard', position: 'F', ppg: 23.7, apg: 3.6, rpg: 6.1 },
            { id: 'harden', name: 'James Harden', position: 'G', ppg: 16.6, apg: 8.5, rpg: 5.1 },
            { id: 'powell', name: 'Norman Powell', position: 'G', ppg: 14.3, apg: 1.9, rpg: 2.6 },
            { id: 'zubac', name: 'Ivica Zubac', position: 'C', ppg: 11.7, apg: 1.3, rpg: 9.2 },
            { id: 'mann', name: 'Terance Mann', position: 'G', ppg: 7.2, apg: 2.1, rpg: 3.1 },
        ]
    },
    'MIN': {
        name: 'Minnesota Timberwolves',
        alias: 'MIN',
        players: [
            { id: 'ant', name: 'Anthony Edwards', position: 'G', ppg: 25.9, apg: 5.1, rpg: 5.4 },
            { id: 'kat', name: 'Karl-Anthony Towns', position: 'C', ppg: 22.3, apg: 3.0, rpg: 8.3 },
            { id: 'gobert', name: 'Rudy Gobert', position: 'C', ppg: 13.4, apg: 1.3, rpg: 12.9 },
            { id: 'conley', name: 'Mike Conley', position: 'G', ppg: 9.8, apg: 5.9, rpg: 3.0 },
            { id: 'mcdaniels', name: "Jaden McDaniels", position: 'F', ppg: 10.5, apg: 1.4, rpg: 3.5 },
        ]
    },
    'OKC': {
        name: 'Oklahoma City Thunder',
        alias: 'OKC',
        players: [
            { id: 'sga', name: 'Shai Gilgeous-Alexander', position: 'G', ppg: 30.1, apg: 6.2, rpg: 5.5 },
            { id: 'chet', name: 'Chet Holmgren', position: 'C', ppg: 16.5, apg: 2.4, rpg: 7.9 },
            { id: 'jdub', name: 'Jalen Williams', position: 'F', ppg: 19.1, apg: 4.5, rpg: 4.0 },
            { id: 'dort', name: 'Luguentz Dort', position: 'G', ppg: 10.8, apg: 1.7, rpg: 4.0 },
            { id: 'giddey', name: 'Josh Giddey', position: 'G', ppg: 12.3, apg: 4.8, rpg: 6.4 },
        ]
    },
    'DAL': {
        name: 'Dallas Mavericks',
        alias: 'DAL',
        players: [
            { id: 'luka', name: 'Luka Doncic', position: 'G', ppg: 33.9, apg: 9.8, rpg: 9.2 },
            { id: 'kyrie', name: 'Kyrie Irving', position: 'G', ppg: 25.6, apg: 5.2, rpg: 5.0 },
            { id: 'pj', name: 'P.J. Washington', position: 'F', ppg: 12.8, apg: 2.1, rpg: 5.5 },
            { id: 'lively', name: 'Dereck Lively II', position: 'C', ppg: 8.8, apg: 1.1, rpg: 6.9 },
            { id: 'jones', name: 'Derrick Jones Jr.', position: 'F', ppg: 8.6, apg: 1.0, rpg: 3.3 },
        ]
    },
    'SAC': {
        name: 'Sacramento Kings',
        alias: 'SAC',
        players: [
            { id: 'fox', name: "De'Aaron Fox", position: 'G', ppg: 26.6, apg: 5.6, rpg: 4.6 },
            { id: 'sabonis', name: 'Domantas Sabonis', position: 'C', ppg: 19.4, apg: 8.2, rpg: 13.7 },
            { id: 'monk', name: 'Malik Monk', position: 'G', ppg: 15.4, apg: 5.1, rpg: 2.9 },
            { id: 'huerter', name: 'Kevin Huerter', position: 'G', ppg: 10.2, apg: 2.8, rpg: 3.3 },
            { id: 'barnes', name: 'Harrison Barnes', position: 'F', ppg: 11.8, apg: 1.8, rpg: 4.3 },
        ]
    },
    // Eastern Conference
    'CHI': {
        name: 'Chicago Bulls',
        alias: 'CHI',
        players: [
            { id: 'lavine', name: 'Zach LaVine', position: 'G', ppg: 22.3, apg: 4.2, rpg: 4.5 },
            { id: 'derozan', name: 'DeMar DeRozan', position: 'F', ppg: 22.5, apg: 5.3, rpg: 4.6 },
            { id: 'vucevic', name: 'Nikola Vucevic', position: 'C', ppg: 18.3, apg: 3.3, rpg: 10.5 },
            { id: 'coby', name: 'Coby White', position: 'G', ppg: 12.4, apg: 3.6, rpg: 3.1 },
            { id: 'pwill', name: 'Patrick Williams', position: 'F', ppg: 8.5, apg: 1.5, rpg: 3.9 },
        ]
    },
    'BOS': {
        name: 'Boston Celtics',
        alias: 'BOS',
        players: [
            { id: 'tatum', name: 'Jayson Tatum', position: 'F', ppg: 26.9, apg: 4.9, rpg: 8.1 },
            { id: 'brown', name: 'Jaylen Brown', position: 'G', ppg: 23.0, apg: 3.6, rpg: 5.5 },
            { id: 'white', name: 'Derrick White', position: 'G', ppg: 15.6, apg: 5.2, rpg: 4.2 },
            { id: 'porzingis', name: 'Kristaps Porzingis', position: 'C', ppg: 20.1, apg: 1.9, rpg: 7.2 },
            { id: 'holiday', name: 'Jrue Holiday', position: 'G', ppg: 12.5, apg: 4.8, rpg: 5.4 },
        ]
    },
    'MIL': {
        name: 'Milwaukee Bucks',
        alias: 'MIL',
        players: [
            { id: 'giannis', name: 'Giannis Antetokounmpo', position: 'F', ppg: 30.4, apg: 6.5, rpg: 11.5 },
            { id: 'dame', name: 'Damian Lillard', position: 'G', ppg: 24.3, apg: 7.0, rpg: 4.4 },
            { id: 'middleton', name: 'Khris Middleton', position: 'F', ppg: 15.1, apg: 5.3, rpg: 4.7 },
            { id: 'portis', name: 'Bobby Portis', position: 'C', ppg: 13.8, apg: 1.5, rpg: 7.4 },
            { id: 'lopez', name: 'Brook Lopez', position: 'C', ppg: 12.5, apg: 1.6, rpg: 5.2 },
        ]
    },
    'NYK': {
        name: 'New York Knicks',
        alias: 'NYK',
        players: [
            { id: 'brunson', name: 'Jalen Brunson', position: 'G', ppg: 28.7, apg: 6.7, rpg: 3.5 },
            { id: 'anunoby', name: 'OG Anunoby', position: 'F', ppg: 14.1, apg: 1.5, rpg: 4.4 },
            { id: 'randle', name: 'Julius Randle', position: 'F', ppg: 24.0, apg: 5.0, rpg: 9.2 },
            { id: 'robinson', name: 'Mitchell Robinson', position: 'C', ppg: 7.5, apg: 0.6, rpg: 8.5 },
            { id: 'hart', name: 'Josh Hart', position: 'G', ppg: 9.4, apg: 4.1, rpg: 8.3 },
        ]
    },
    'PHI': {
        name: 'Philadelphia 76ers',
        alias: 'PHI',
        players: [
            { id: 'embiid', name: 'Joel Embiid', position: 'C', ppg: 34.7, apg: 5.6, rpg: 11.0 },
            { id: 'maxey', name: 'Tyrese Maxey', position: 'G', ppg: 25.9, apg: 6.2, rpg: 3.7 },
            { id: 'harris', name: 'Tobias Harris', position: 'F', ppg: 14.0, apg: 3.1, rpg: 5.4 },
            { id: 'melton', name: 'De\'Anthony Melton', position: 'G', ppg: 9.8, apg: 2.8, rpg: 3.6 },
            { id: 'oubre', name: 'Kelly Oubre Jr.', position: 'F', ppg: 15.4, apg: 1.4, rpg: 5.0 },
        ]
    },
    'MIA': {
        name: 'Miami Heat',
        alias: 'MIA',
        players: [
            { id: 'butler', name: 'Jimmy Butler', position: 'F', ppg: 20.8, apg: 5.0, rpg: 5.3 },
            { id: 'herro', name: 'Tyler Herro', position: 'G', ppg: 20.8, apg: 4.5, rpg: 5.3 },
            { id: 'adebayo', name: 'Bam Adebayo', position: 'C', ppg: 19.3, apg: 3.2, rpg: 10.4 },
            { id: 'robinson', name: 'Duncan Robinson', position: 'G', ppg: 10.9, apg: 2.2, rpg: 3.0 },
            { id: 'lowry', name: 'Kyle Lowry', position: 'G', ppg: 8.3, apg: 4.7, rpg: 3.6 },
        ]
    },
    'CLE': {
        name: 'Cleveland Cavaliers',
        alias: 'CLE',
        players: [
            { id: 'mitchell', name: 'Donovan Mitchell', position: 'G', ppg: 26.6, apg: 6.1, rpg: 5.1 },
            { id: 'garland', name: 'Darius Garland', position: 'G', ppg: 18.0, apg: 6.5, rpg: 2.7 },
            { id: 'mobley', name: 'Evan Mobley', position: 'F', ppg: 15.7, apg: 3.2, rpg: 9.4 },
            { id: 'allen', name: 'Jarrett Allen', position: 'C', ppg: 14.8, apg: 2.7, rpg: 10.5 },
            { id: 'strus', name: 'Max Strus', position: 'G', ppg: 12.4, apg: 2.6, rpg: 3.8 },
        ]
    },
    'ORL': {
        name: 'Orlando Magic',
        alias: 'ORL',
        players: [
            { id: 'paolo', name: 'Paolo Banchero', position: 'F', ppg: 22.6, apg: 5.4, rpg: 6.9 },
            { id: 'franz', name: 'Franz Wagner', position: 'F', ppg: 19.7, apg: 3.7, rpg: 5.3 },
            { id: 'wcj', name: 'Wendell Carter Jr.', position: 'C', ppg: 13.1, apg: 2.4, rpg: 8.7 },
            { id: 'suggs', name: 'Jalen Suggs', position: 'G', ppg: 12.6, apg: 3.8, rpg: 3.1 },
            { id: 'fultz', name: 'Markelle Fultz', position: 'G', ppg: 8.5, apg: 4.5, rpg: 3.6 },
        ]
    },
    'IND': {
        name: 'Indiana Pacers',
        alias: 'IND',
        players: [
            { id: 'haliburton', name: 'Tyrese Haliburton', position: 'G', ppg: 20.1, apg: 10.9, rpg: 3.9 },
            { id: 'siakam', name: 'Pascal Siakam', position: 'F', ppg: 21.3, apg: 3.8, rpg: 7.8 },
            { id: 'turner', name: 'Myles Turner', position: 'C', ppg: 17.1, apg: 1.4, rpg: 6.9 },
            { id: 'nembhard', name: 'Andrew Nembhard', position: 'G', ppg: 9.2, apg: 4.8, rpg: 3.1 },
            { id: 'mathurin', name: 'Bennedict Mathurin', position: 'G', ppg: 14.5, apg: 1.5, rpg: 4.1 },
        ]
    },
    'ATL': {
        name: 'Atlanta Hawks',
        alias: 'ATL',
        players: [
            { id: 'trae', name: 'Trae Young', position: 'G', ppg: 25.7, apg: 10.8, rpg: 2.8 },
            { id: 'murray', name: 'Dejounte Murray', position: 'G', ppg: 22.1, apg: 6.1, rpg: 5.3 },
            { id: 'hunter', name: "De'Andre Hunter", position: 'F', ppg: 15.4, apg: 1.7, rpg: 4.5 },
            { id: 'capela', name: 'Clint Capela', position: 'C', ppg: 11.5, apg: 1.0, rpg: 10.7 },
            { id: 'johnson', name: 'Jalen Johnson', position: 'F', ppg: 9.6, apg: 2.3, rpg: 4.8 },
        ]
    },
    'BKN': {
        name: 'Brooklyn Nets',
        alias: 'BKN',
        players: [
            { id: 'bridges', name: 'Mikal Bridges', position: 'F', ppg: 19.6, apg: 3.3, rpg: 4.5 },
            { id: 'cam', name: 'Cameron Johnson', position: 'F', ppg: 13.4, apg: 1.9, rpg: 4.3 },
            { id: 'dinwiddie', name: 'Spencer Dinwiddie', position: 'G', ppg: 12.6, apg: 5.2, rpg: 3.1 },
            { id: 'claxton', name: 'Nic Claxton', position: 'C', ppg: 12.1, apg: 2.3, rpg: 9.0 },
            { id: 'schroder', name: 'Dennis Schroder', position: 'G', ppg: 14.8, apg: 4.5, rpg: 2.8 },
        ]
    },
    'TOR': {
        name: 'Toronto Raptors',
        alias: 'TOR',
        players: [
            { id: 'barnes', name: 'Scottie Barnes', position: 'F', ppg: 19.9, apg: 6.1, rpg: 8.2 },
            { id: 'quickley', name: 'Immanuel Quickley', position: 'G', ppg: 18.6, apg: 6.8, rpg: 4.8 },
            { id: 'poeltl', name: 'Jakob Poeltl', position: 'C', ppg: 11.1, apg: 2.6, rpg: 8.6 },
            { id: 'anunoby', name: 'OG Anunoby', position: 'F', ppg: 17.1, apg: 1.9, rpg: 5.0 },
            { id: 'barrett', name: 'RJ Barrett', position: 'G', ppg: 21.8, apg: 3.4, rpg: 6.4 },
        ]
    },
    'WAS': {
        name: 'Washington Wizards',
        alias: 'WAS',
        players: [
            { id: 'poole', name: 'Jordan Poole', position: 'G', ppg: 17.4, apg: 4.4, rpg: 2.7 },
            { id: 'kuzma', name: 'Kyle Kuzma', position: 'F', ppg: 22.2, apg: 4.2, rpg: 6.6 },
            { id: 'deni', name: 'Deni Avdija', position: 'F', ppg: 14.0, apg: 4.2, rpg: 7.2 },
            { id: 'kispert', name: 'Corey Kispert', position: 'F', ppg: 10.4, apg: 1.7, rpg: 2.5 },
            { id: 'gafford', name: 'Daniel Gafford', position: 'C', ppg: 9.8, apg: 0.8, rpg: 5.6 },
        ]
    },
    'CHA': {
        name: 'Charlotte Hornets',
        alias: 'CHA',
        players: [
            { id: 'lamelo', name: 'LaMelo Ball', position: 'G', ppg: 23.9, apg: 8.0, rpg: 5.1 },
            { id: 'rozier', name: 'Terry Rozier', position: 'G', ppg: 21.1, apg: 5.4, rpg: 4.0 },
            { id: 'hayward', name: 'Gordon Hayward', position: 'F', ppg: 14.7, apg: 4.6, rpg: 4.2 },
            { id: 'pj', name: 'P.J. Washington', position: 'F', ppg: 13.6, apg: 2.5, rpg: 5.3 },
            { id: 'williams', name: 'Mark Williams', position: 'C', ppg: 9.7, apg: 0.9, rpg: 8.1 },
        ]
    },
    'DET': {
        name: 'Detroit Pistons',
        alias: 'DET',
        players: [
            { id: 'cade', name: 'Cade Cunningham', position: 'G', ppg: 22.7, apg: 7.5, rpg: 4.3 },
            { id: 'ivey', name: 'Jaden Ivey', position: 'G', ppg: 16.3, apg: 4.4, rpg: 3.9 },
            { id: 'duren', name: 'Jalen Duren', position: 'C', ppg: 13.0, apg: 2.4, rpg: 11.6 },
            { id: 'bogdanovic', name: 'Bojan Bogdanovic', position: 'F', ppg: 16.0, apg: 2.3, rpg: 3.8 },
            { id: 'stewart', name: 'Isaiah Stewart', position: 'C', ppg: 8.5, apg: 1.5, rpg: 6.5 },
        ]
    },
    'HOU': {
        name: 'Houston Rockets',
        alias: 'HOU',
        players: [
            { id: 'green', name: 'Jalen Green', position: 'G', ppg: 22.1, apg: 3.7, rpg: 5.2 },
            { id: 'sengun', name: 'Alperen Sengun', position: 'C', ppg: 18.3, apg: 4.5, rpg: 9.3 },
            { id: 'vanandr', name: 'Fred VanVleet', position: 'G', ppg: 14.5, apg: 7.2, rpg: 3.8 },
            { id: 'whitmore', name: 'Cam Whitmore', position: 'F', ppg: 9.4, apg: 1.3, rpg: 3.5 },
            { id: 'eason', name: 'Tari Eason', position: 'F', ppg: 8.7, apg: 1.0, rpg: 5.3 },
        ]
    },
    'MEM': {
        name: 'Memphis Grizzlies',
        alias: 'MEM',
        players: [
            { id: 'ja', name: 'Ja Morant', position: 'G', ppg: 25.1, apg: 8.1, rpg: 5.6 },
            { id: 'jjj', name: 'Jaren Jackson Jr.', position: 'C', ppg: 22.0, apg: 1.2, rpg: 5.5 },
            { id: 'smart', name: 'Marcus Smart', position: 'G', ppg: 14.4, apg: 5.3, rpg: 3.5 },
            { id: 'bane', name: 'Desmond Bane', position: 'G', ppg: 21.5, apg: 4.5, rpg: 4.4 },
            { id: 'aldama', name: 'Santi Aldama', position: 'F', ppg: 9.2, apg: 2.1, rpg: 5.4 },
        ]
    },
    'NOP': {
        name: 'New Orleans Pelicans',
        alias: 'NOP',
        players: [
            { id: 'zion', name: 'Zion Williamson', position: 'F', ppg: 22.9, apg: 5.0, rpg: 5.8 },
            { id: 'bi', name: 'Brandon Ingram', position: 'F', ppg: 24.7, apg: 5.8, rpg: 5.1 },
            { id: 'cj', name: 'CJ McCollum', position: 'G', ppg: 17.1, apg: 3.7, rpg: 3.8 },
            { id: 'herb', name: 'Herb Jones', position: 'F', ppg: 11.4, apg: 2.6, rpg: 4.1 },
            { id: 'valanciunas', name: 'Jonas Valančiunas', position: 'C', ppg: 13.1, apg: 2.0, rpg: 8.8 },
        ]
    },
    'POR': {
        name: 'Portland Trail Blazers',
        alias: 'POR',
        players: [
            { id: 'anfernee', name: 'Anfernee Simons', position: 'G', ppg: 22.6, apg: 5.5, rpg: 2.8 },
            { id: 'grant', name: 'Jerami Grant', position: 'F', ppg: 20.1, apg: 2.4, rpg: 4.5 },
            { id: 'sharpe', name: 'Shaedon Sharpe', position: 'G', ppg: 15.9, apg: 2.1, rpg: 3.9 },
            { id: 'ayton', name: 'Deandre Ayton', position: 'C', ppg: 16.7, apg: 1.7, rpg: 10.8 },
            { id: 'brogdon', name: 'Malcolm Brogdon', position: 'G', ppg: 12.1, apg: 3.7, rpg: 3.4 },
        ]
    },
    'SAS': {
        name: 'San Antonio Spurs',
        alias: 'SAS',
        players: [
            { id: 'wemby', name: 'Victor Wembanyama', position: 'C', ppg: 21.4, apg: 3.7, rpg: 10.6 },
            { id: 'vassell', name: 'Devin Vassell', position: 'G', ppg: 18.5, apg: 3.8, rpg: 3.8 },
            { id: 'keldon', name: 'Keldon Johnson', position: 'F', ppg: 15.0, apg: 2.4, rpg: 5.0 },
            { id: 'sochan', name: 'Jeremy Sochan', position: 'F', ppg: 11.0, apg: 3.3, rpg: 5.9 },
            { id: 'tre', name: 'Tre Jones', position: 'G', ppg: 10.3, apg: 5.4, rpg: 2.9 },
        ]
    },
    'UTA': {
        name: 'Utah Jazz',
        alias: 'UTA',
        players: [
            { id: 'lauri', name: 'Lauri Markkanen', position: 'F', ppg: 25.6, apg: 1.9, rpg: 8.2 },
            { id: 'sexton', name: 'Collin Sexton', position: 'G', ppg: 18.7, apg: 3.2, rpg: 3.0 },
            { id: 'kessler', name: 'Walker Kessler', position: 'C', ppg: 8.1, apg: 0.9, rpg: 7.5 },
            { id: 'clarkson', name: 'Jordan Clarkson', position: 'G', ppg: 16.0, apg: 3.6, rpg: 3.2 },
            { id: 'hendricks', name: 'Taylor Hendricks', position: 'F', ppg: 7.1, apg: 0.9, rpg: 4.5 },
        ]
    },
};

// Helper: Get roster from mock data based on team alias
function getMockRoster(alias: string): { name: string; alias: string; players: TeamPlayer[] } | null {
    // First try exact match
    if (MOCK_TEAM_ROSTERS[alias]) {
        return MOCK_TEAM_ROSTERS[alias];
    }
    // Try to find by partial match
    const upperAlias = alias.toUpperCase();
    for (const [key, roster] of Object.entries(MOCK_TEAM_ROSTERS)) {
        if (key.toUpperCase() === upperAlias || roster.alias.toUpperCase() === upperAlias) {
            return roster;
        }
    }
    return null;
}

// Generate projection for a player (deterministic based on player stats)
function generatePlayerProjection(player: TeamPlayer, playerIndex: number = 0): PlayerProjection {
    // Base projection is the player's PPG
    const baseProjection = player.ppg;

    // Use deterministic variance based on player name hash and PPG
    // This ensures consistent values between server and client
    const nameHash = player.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const varianceFactor = ((nameHash % 30) - 15) / 100; // -15% to +15%
    const projection = baseProjection * (1 + varianceFactor);

    // Generate a Vegas-like line (deterministic based on index and PPG)
    const lineOffset = ((playerIndex % 3) - 1) * 0.5; // -0.5, 0, or 0.5
    const line = baseProjection + lineOffset;

    // Calculate edge
    const edge = ((projection - line) / line) * 100;
    const isValueBet = Math.abs(edge) >= 10;

    // Confidence based on player's consistency (higher PPG = typically more reliable)
    const confidence = Math.min(95, 70 + (player.ppg / 30) * 25);

    return {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        projection: parseFloat(projection.toFixed(1)),
        line: parseFloat(line.toFixed(1)),
        edge: parseFloat(edge.toFixed(1)),
        isValueBet,
        confidence: Math.round(confidence),
    };
}

// Calculate win probability based on team strength (total PPG of top players)
function calculateWinProbability(
    homeTeamPlayers: TeamPlayer[],
    awayTeamPlayers: TeamPlayer[]
): { homeWinProb: number; homeAdvantage: number; starPowerDiff: number } {
    // Defensive: ensure we have valid arrays
    const homePlayers = homeTeamPlayers || [];
    const awayPlayers = awayTeamPlayers || [];

    const homeTop3Ppg = homePlayers.slice(0, 3).reduce((sum, p) => sum + (p?.ppg ?? 0), 0);
    const awayTop3Ppg = awayPlayers.slice(0, 3).reduce((sum, p) => sum + (p?.ppg ?? 0), 0);

    // Home court advantage is typically ~3-4 points or ~55% win rate
    const homeAdvantage = 0.04;

    // Star power difference (normalized)
    const totalPpg = homeTop3Ppg + awayTop3Ppg;

    // Defensive: handle division by zero - default to 50/50 if no PPG data
    const rawHomeProbability = totalPpg > 0 ? homeTop3Ppg / totalPpg : 0.5;

    // Apply home court advantage
    let homeWinProb = rawHomeProbability + homeAdvantage;
    homeWinProb = Math.max(0.20, Math.min(0.80, homeWinProb)); // Cap between 20-80%

    // Ensure we return valid numbers (never NaN or Infinity)
    return {
        homeWinProb: Number.isFinite(homeWinProb * 100) ? homeWinProb * 100 : 50,
        homeAdvantage: homeAdvantage * 100,
        starPowerDiff: Number.isFinite(homeTop3Ppg - awayTop3Ppg) ? homeTop3Ppg - awayTop3Ppg : 0,
    };
}

// Generate reasoning for the analysis
function generateReasoning(
    homeTeam: { alias: string; players: TeamPlayer[] },
    awayTeam: { alias: string; players: TeamPlayer[] },
    probData: { homeWinProb: number; starPowerDiff: number; homeAdvantage: number },
    favoredTeam: 'home' | 'away'
): string[] {
    const reasons: string[] = [];

    const homeTopPlayer = homeTeam.players[0];
    const awayTopPlayer = awayTeam.players[0];

    // Star player comparison
    if (homeTopPlayer && awayTopPlayer) {
        if (homeTopPlayer.ppg > awayTopPlayer.ppg) {
            reasons.push(`${homeTopPlayer.name} (${homeTopPlayer.ppg.toFixed(1)} PPG) lidera o confronto ofensivo contra ${awayTopPlayer.name} (${awayTopPlayer.ppg.toFixed(1)} PPG)`);
        } else {
            reasons.push(`${awayTopPlayer.name} (${awayTopPlayer.ppg.toFixed(1)} PPG) traz vantagem ofensiva sobre ${homeTopPlayer.name} (${homeTopPlayer.ppg.toFixed(1)} PPG)`);
        }
    }

    // Home court advantage
    reasons.push(`Vantagem de jogar em casa confere +${probData.homeAdvantage.toFixed(0)}% para ${homeTeam.alias}`);

    // Star power analysis
    if (Math.abs(probData.starPowerDiff) > 5) {
        const stronger = probData.starPowerDiff > 0 ? homeTeam.alias : awayTeam.alias;
        reasons.push(`${stronger} possui maior "star power" no confronto combinado dos top 3 jogadores`);
    }

    // Final prediction
    const favored = favoredTeam === 'home' ? homeTeam.alias : awayTeam.alias;
    const prob = favoredTeam === 'home' ? probData.homeWinProb : (100 - probData.homeWinProb);
    reasons.push(`Probabilidade de vitória: ${favored} ${prob.toFixed(0)}%`);

    return reasons;
}

// Main function: Get complete game analysis
export const getGameAnalysis = cache(async (gameId: string): Promise<GameAnalysis | null> => {
    try {
        // Get schedule to find game info
        const schedule = await getSchedule();
        const game = schedule.games.find(g => g.id === gameId);

        if (!game) {
            console.error(`[GameAnalysis] Game not found: ${gameId}`);
            return null;
        }

        // Try to get real rosters first, fallback to mock data
        let homeRoster = await getTeamRoster(game.home.id);
        let awayRoster = await getTeamRoster(game.away.id);

        // Helper: Check if roster has meaningful stats (at least one player with PPG > 0)
        const hasValidStats = (roster: TeamRoster | null): boolean => {
            if (!roster || roster.players.length === 0) return false;
            return roster.players.slice(0, 3).some(p => p.ppg > 0);
        };

        // Use mock data if API fails, returns empty, or has no stats
        if (!hasValidStats(homeRoster)) {
            console.log(`[GameAnalysis] Using mock for home team: ${game.home.alias}`);
            const mockHome = getMockRoster(game.home.alias);
            if (mockHome) {
                homeRoster = {
                    teamId: game.home.id,
                    teamName: mockHome.name,
                    alias: mockHome.alias,
                    players: mockHome.players,
                };
            }
        }

        if (!hasValidStats(awayRoster)) {
            console.log(`[GameAnalysis] Using mock for away team: ${game.away.alias}`);
            const mockAway = getMockRoster(game.away.alias);
            if (mockAway) {
                awayRoster = {
                    teamId: game.away.id,
                    teamName: mockAway.name,
                    alias: mockAway.alias,
                    players: mockAway.players,
                };
            }
        }

        // If we still don't have rosters, create generic ones
        if (!homeRoster) {
            console.log(`[GameAnalysis] Creating generic roster for: ${game.home.alias}`);
            homeRoster = createGenericRoster(game.home.id, game.home.name, game.home.alias);
        }
        if (!awayRoster) {
            console.log(`[GameAnalysis] Creating generic roster for: ${game.away.alias}`);
            awayRoster = createGenericRoster(game.away.id, game.away.name, game.away.alias);
        }

        // Get top 3 players from each team (with non-null assertion since we create fallbacks above)
        const homeTopPlayers = homeRoster!.players.slice(0, 3);
        const awayTopPlayers = awayRoster!.players.slice(0, 3);

        // Generate projections (pass index for deterministic variance)
        const homeProjections = homeTopPlayers.map((p, idx) => generatePlayerProjection(p, idx));
        const awayProjections = awayTopPlayers.map((p, idx) => generatePlayerProjection(p, idx));

        // Calculate win probability
        const probData = calculateWinProbability(homeRoster!.players, awayRoster!.players);
        const favoredTeam: 'home' | 'away' = probData.homeWinProb >= 50 ? 'home' : 'away';

        // Generate reasoning
        const reasoning = generateReasoning(
            { alias: homeRoster!.alias, players: homeRoster!.players },
            { alias: awayRoster!.alias, players: awayRoster!.players },
            probData,
            favoredTeam
        );

        const favored = favoredTeam === 'home' ? homeRoster!.alias : awayRoster!.alias;
        const favProb = favoredTeam === 'home' ? probData.homeWinProb : (100 - probData.homeWinProb);

        return {
            gameId,
            scheduled: game.scheduled,
            homeTeam: {
                id: homeRoster!.teamId,
                name: homeRoster!.teamName,
                alias: homeRoster!.alias,
                winProbability: probData.homeWinProb,
                players: homeProjections,
            },
            awayTeam: {
                id: awayRoster!.teamId,
                name: awayRoster!.teamName,
                alias: awayRoster!.alias,
                winProbability: 100 - probData.homeWinProb,
                players: awayProjections,
            },
            analysis: {
                favoredTeam,
                reasoning,
                summary: `${favored} é favorito com ${favProb.toFixed(0)}% de probabilidade de vitória.`,
            },
        };
    } catch (error) {
        console.error('[GameAnalysis] Error:', error);
        return null;
    }
});

// Create a generic roster when we have no data
function createGenericRoster(teamId: string, teamName: string, alias: string): TeamRoster {
    return {
        teamId,
        teamName,
        alias,
        players: [
            { id: `${alias}-1`, name: `${alias} Star Player`, position: 'G', ppg: 22.0, apg: 5.0, rpg: 4.0 },
            { id: `${alias}-2`, name: `${alias} Second Option`, position: 'F', ppg: 18.0, apg: 3.0, rpg: 6.0 },
            { id: `${alias}-3`, name: `${alias} Third Scorer`, position: 'C', ppg: 14.0, apg: 2.0, rpg: 8.0 },
        ],
    };
}
