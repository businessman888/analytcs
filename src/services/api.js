import axios from 'axios';
import { MOCK_INJURIES, MOCK_SCHEDULE, MOCK_PLAYERS, MOCK_TEAMS, MOCK_CAREER } from './mockData';

const API_KEY = import.meta.env.VITE_SPORTRADAR_API_KEY;

// URLs (Placeholders - Sportradar change these often, so we use common ones)
const SYNERGY_BASE_URL = 'https://api.sportradar.us/nba-synergy/tb/v1/en';
const STANDARD_BASE_URL = 'https://api.sportradar.us/nba/trial/v8/en';

const createAxiosInstance = (baseURL) => {
    const instance = axios.create({ baseURL });

    instance.interceptors.request.use((config) => {
        config.params = config.params || {};
        config.params.api_key = API_KEY;
        return config;
    });

    // Mock Adapter for demonstration purposes
    // In a real scenario, remove this or use a proper mocking library
    instance.interceptors.response.use(
        (response) => response,
        async (error) => {
            console.warn(`API Error on ${error.config?.url}: ${error.message}. Falling back to MOCK data.`);

            // Simple mock router
            const url = error.config?.url || '';

            if (url.includes('injuries')) return { data: MOCK_INJURIES };
            if (url.includes('schedule')) return { data: MOCK_SCHEDULE };
            if (url.includes('playerplaytypestats')) return { data: Object.values(MOCK_PLAYERS) }; // Return list
            if (url.includes('teamplaytypestats')) return { data: Object.values(MOCK_TEAMS) };
            if (url.includes('playercareers')) return { data: MOCK_CAREER };

            return Promise.reject(error);
        }
    );

    return instance;
};

export const synergyApi = createAxiosInstance(SYNERGY_BASE_URL);
export const standardApi = createAxiosInstance(STANDARD_BASE_URL);

// Service Methods
export const getPlayerStats = async () => {
    // In real app, you might pass season/player IDs
    const res = await synergyApi.get('/playerplaytypestats');
    return res.data;
};

export const getTeamDefensiveStats = async () => {
    const res = await synergyApi.get('/teamplaytypestats?defensive=true');
    return res.data;
};

export const getSchedule = async () => {
    const res = await standardApi.get('/league/schedule');
    return res.data;
};

export const getInjuries = async () => {
    const res = await standardApi.get('/league/injuries');
    return res.data;
};
