import Link from 'next/link';
import { getSchedule } from '@/lib/services/nbaData';
import { ArrowRight, Clock } from 'lucide-react';

export default async function AnalysisIndexPage() {
    let games: { id: string; scheduled: string; home: { alias: string }; away: { alias: string } }[] = [];

    try {
        const schedule = await getSchedule();
        games = schedule.games || [];
    } catch {
        // Handle error silently, show empty state
    }

    const formatGameTime = (scheduled: string) => {
        const date = new Date(scheduled);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Análise de Jogos</h1>
                <p className="text-gray-400">Selecione um jogo para ver projeções detalhadas e Value Bets</p>
            </div>

            {games.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {games.map(game => (
                        <Link
                            key={game.id}
                            href={`/analysis/${game.id}`}
                            className="block p-6 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-orange-500/30 hover:bg-slate-900 transition-all group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                                    <Clock size={12} />
                                    {formatGameTime(game.scheduled)}
                                </span>
                                <ArrowRight size={16} className="text-gray-600 group-hover:text-orange-500 transition-colors" />
                            </div>
                            <div className="text-center space-y-2">
                                <div className="text-2xl font-bold">{game.away.alias}</div>
                                <div className="text-gray-600 text-sm">vs</div>
                                <div className="text-2xl font-bold">{game.home.alias}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 text-gray-500">
                    <p className="text-xl mb-2">Nenhum jogo disponível</p>
                    <p className="text-sm">Verifique novamente mais tarde</p>
                </div>
            )}
        </div>
    );
}
