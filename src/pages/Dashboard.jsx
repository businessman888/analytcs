import { useQuery } from '@tanstack/react-query';
import { getInjuries, getSchedule } from '../services/api';
import { Activity, Flame, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const { data: injuries } = useQuery({ queryKey: ['injuries'], queryFn: getInjuries });
    const { data: schedule } = useQuery({ queryKey: ['schedule'], queryFn: getSchedule });

    const gameOfTheDay = schedule?.games?.[0]; // Mock logic: First game is GOTD

    return (
        <div className="space-y-8">
            {/* Hero Section */}
            <section className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-nba-blue to-nba-dark aspect-[21/9] flex items-center p-8 md:p-12 shadow-2xl border border-white/10">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1546519638-68e109498ffc?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay" />
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-2 text-nba-red font-bold mb-2">
                        <Flame size={20} />
                        <span>GAME OF THE DAY</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
                        {gameOfTheDay ? `${gameOfTheDay.away} vs ${gameOfTheDay.home}` : 'Loading...'}
                    </h1>
                    <p className="text-gray-300 text-lg mb-8 max-w-lg">
                        High volatility matchup. {gameOfTheDay?.isB2B_away ? `${gameOfTheDay.away} is on a B2B.` : ''}
                        Analysis suggests potential defensive breakdown in the paint.
                    </p>
                    <Link
                        to="/analysis"
                        className="inline-flex items-center gap-2 bg-white text-nba-blue px-6 py-3 rounded-full font-bold hover:scale-105 transition-transform"
                    >
                        View Prediction <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Injury Feed */}
                <section className="md:col-span-2 bg-nba-card rounded-2xl border border-white/5 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Activity className="text-nba-red" />
                            Daily Injury Report
                        </h2>
                        <span className="text-xs font-mono text-gray-500">{new Date().toLocaleDateString()}</span>
                    </div>

                    <div className="space-y-4">
                        {injuries?.daily ? injuries.daily.map(inj => (
                            <div key={inj.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-nba-dark flex items-center justify-center font-bold text-gray-400">
                                        {inj.team}
                                    </div>
                                    <div>
                                        <div className="font-bold">{inj.name}</div>
                                        <div className="text-xs text-gray-400">{inj.note || 'No details'}</div>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${inj.status === 'Out' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                    {inj.status}
                                </span>
                            </div>
                        )) : <p className="text-gray-500 italic">No critical injuries reported.</p>}
                    </div>
                </section>

                {/* System Status / Quick Stats */}
                <section className="space-y-6">
                    <div className="bg-gradient-to-br from-green-500/10 to-transparent p-6 rounded-2xl border border-green-500/20">
                        <h3 className="text-sm font-bold text-green-400 mb-1">SYSTEM STATUS</h3>
                        <div className="text-2xl font-bold mb-2">Operational</div>
                        <div className="text-xs text-gray-400">APIs Connected: Synergy, NBA Standard</div>
                    </div>

                    <div className="p-6 rounded-2xl border border-white/10 bg-nba-card">
                        <h3 className="font-bold mb-4">Precision Leaderboard</h3>
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span className="text-gray-400">LBJ Proj. Accuracy</span>
                                    <span className="font-mono text-green-400">94.{i}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
