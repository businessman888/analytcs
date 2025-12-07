import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSchedule, getInjuries, getPlayerStats, getTeamDefensiveStats } from '../services/api';
import { calculateParetoRedistribution, calculatePlayerProjection } from '../utils/predictionEngine';
import PredictionCard from '../components/PredictionCard';
import { ChevronRight, Calendar, Users } from 'lucide-react';
import clsx from 'clsx';

export default function Analysis() {
    const [selectedGameId, setSelectedGameId] = useState(null);
    const [userOverrides, setUserOverrides] = useState({}); // { playerId: 'Active' | 'Out' }

    // 1. Fetch Data
    const { data: schedule } = useQuery({ queryKey: ['schedule'], queryFn: getSchedule });
    const { data: injuries } = useQuery({ queryKey: ['injuries'], queryFn: getInjuries });
    const { data: players } = useQuery({ queryKey: ['players'], queryFn: getPlayerStats });
    const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: getTeamDefensiveStats });

    // 2. Derive State
    const games = schedule?.games || [];
    const selectedGame = games.find(g => g.id === selectedGameId) || games[0];

    // Update selected game if null and games exist
    if (!selectedGameId && games.length > 0) {
        setSelectedGameId(games[0].id);
    }

    // 3. Process Logic
    const processedData = useMemo(() => {
        if (!selectedGame || !players || !teams) return null;

        const homeTeamId = selectedGame.home;
        const awayTeamId = selectedGame.away;
        const homeOpponent = teams.find(t => t.id === awayTeamId) || {};
        const awayOpponent = teams.find(t => t.id === homeTeamId) || {};

        // Filter Players
        const homePlayers = players.filter(p => p.team === homeTeamId);
        const awayPlayers = players.filter(p => p.team === awayTeamId);

        // Merge Injuries & Overrides
        const getStatus = (pid) => {
            if (userOverrides[pid]) return userOverrides[pid];
            const inj = injuries?.daily?.find(i => i.id === pid);
            return inj ? inj.status : 'Active';
        };

        // Calculate Pareto Multipliers
        const homeInjuriesForCalc = homePlayers.map(p => ({ id: p.id, status: getStatus(p.id) }));
        const awayInjuriesForCalc = awayPlayers.map(p => ({ id: p.id, status: getStatus(p.id) }));

        const homeMultipliers = calculateParetoRedistribution(homePlayers, homeInjuriesForCalc);
        const awayMultipliers = calculateParetoRedistribution(awayPlayers, awayInjuriesForCalc);

        // Generate Projections
        const generateProjections = (roster, opponent, multipliers, isB2B) => {
            return roster.map(player => {
                const status = getStatus(player.id);
                const context = {
                    status,
                    isB2B,
                    volumeMultiplier: multipliers[player.id] || 1.0
                };
                const proj = calculatePlayerProjection(player, opponent, context);
                return { player: { ...player, isOut: status !== 'Active' }, projection: proj };
            });
        };

        return {
            home: {
                team: homeTeamId,
                projections: generateProjections(homePlayers, homeOpponent, homeMultipliers, selectedGame.isB2B_home)
            },
            away: {
                team: awayTeamId,
                projections: generateProjections(awayPlayers, awayOpponent, awayMultipliers, selectedGame.isB2B_away)
            }
        };
    }, [selectedGame, players, teams, injuries, userOverrides]);


    const handleToggle = (pid) => {
        setUserOverrides(prev => {
            const current = prev[pid];
            // If already in override, check logic. but simpler: toggle Active/Out
            // Initial state comes from API. We need to know current state to toggle.
            // We can just look at processedData to find current status? No, circular dependency.
            // Instead, look at raw injuries.
            const apiInj = injuries?.daily?.find(i => i.id === pid);
            const apiStatus = apiInj ? apiInj.status : 'Active';

            const currentStatus = current || apiStatus;
            const newStatus = currentStatus === 'Active' ? 'Out' : 'Active';

            return { ...prev, [pid]: newStatus };
        });
    };

    if (!schedule) return <div className="p-10 text-center animate-pulse">Loading Analytics Engine...</div>;

    return (
        <div className="space-y-8">
            {/* Game Selector */}
            <div className="flex overflow-x-auto gap-4 py-4 scrollbar-hide">
                {games.map(game => (
                    <button
                        key={game.id}
                        onClick={() => setSelectedGameId(game.id)}
                        className={clsx(
                            "flex-shrink-0 px-6 py-4 rounded-xl border transition-all min-w-[200px] text-left",
                            selectedGameId === game.id
                                ? "bg-gradient-to-br from-nba-blue to-nba-blue/50 border-white/20 text-white shadow-lg"
                                : "bg-nba-card border-white/5 text-gray-400 hover:bg-white/5"
                        )}
                    >
                        <div className="text-xs font-mono opacity-70 mb-2 flex items-center gap-2">
                            <Calendar size={12} /> {game.time}
                        </div>
                        <div className="flex justify-between items-center text-xl font-black">
                            <span>{game.away}</span>
                            <span className="text-sm font-normal text-white/50">@</span>
                            <span>{game.home}</span>
                        </div>
                        {(game.isB2B_home || game.isB2B_away) && (
                            <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] bg-white/20 text-white font-bold">
                                B2B ALERT
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {processedData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Away Team */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-1 h-8 bg-nba-red rounded-full" />
                            <h2 className="text-2xl font-bold">{processedData.away.team}</h2>
                            <span className="text-sm text-gray-500">Away</span>
                        </div>
                        {processedData.away.projections.map(({ player, projection }) => (
                            <PredictionCard
                                key={player.id}
                                player={player}
                                projection={projection}
                                onToggleStatus={handleToggle}
                            />
                        ))}
                    </div>

                    {/* Home Team */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-1 h-8 bg-nba-blue rounded-full" />
                            <h2 className="text-2xl font-bold">{processedData.home.team}</h2>
                            <span className="text-sm text-gray-500">Home</span>
                        </div>
                        {processedData.home.projections.map(({ player, projection }) => (
                            <PredictionCard
                                key={player.id}
                                player={player}
                                projection={projection}
                                onToggleStatus={handleToggle}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
