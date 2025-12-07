'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
    TrendingUp,
    TrendingDown,
    MessageCircle,
    X,
    Send,
    AlertTriangle,
    CheckCircle,
    Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '@/components/ui/toast';

interface PlayerProp {
    playerId: string;
    playerName: string;
    market: string;
    line: number;
    bestOverOdd: { odds: number; bookmaker: string } | null;
    bestUnderOdd: { odds: number; bookmaker: string } | null;
}

interface PropsResponse {
    gameId: string;
    props: PlayerProp[];
    message?: string;
}

interface Game {
    id: string;
    home: { name: string; alias: string };
    away: { name: string; alias: string };
    scheduled: string;
}

interface ScheduleResponse {
    games: Game[];
}

async function fetchSchedule(): Promise<ScheduleResponse> {
    const res = await fetch('/api/nba/schedule');
    if (!res.ok) throw new Error('Failed to fetch schedule');
    return res.json();
}

async function fetchProps(gameId: string, homeTeam?: string, awayTeam?: string): Promise<PropsResponse> {
    let url = `/api/odds/props?gameId=${gameId}`;
    if (homeTeam && awayTeam) {
        url += `&homeTeam=${encodeURIComponent(homeTeam)}&awayTeam=${encodeURIComponent(awayTeam)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch props');
    }
    return res.json();
}

// Mock projection calculation (in real app, this would come from prediction engine)
function calculateProjection(prop: PlayerProp): { projection: number; edge: number; isValue: boolean } {
    // Simulate projection slightly above/below line for demo
    const variance = (Math.random() - 0.5) * 6; // -3 to +3 points variance
    const projection = prop.line + variance;
    const edge = ((projection - prop.line) / prop.line) * 100;
    const isValue = edge >= 10;

    return {
        projection: parseFloat(projection.toFixed(1)),
        edge: parseFloat(edge.toFixed(1)),
        isValue,
    };
}

function ChatWidget({ gameId }: { gameId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', content: userMessage }],
                    gameId,
                }),
            });

            if (!res.ok) throw new Error('Failed to get response');

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                assistantMessage += chunk;

                setMessages(prev => [
                    ...prev.slice(0, -1),
                    { role: 'assistant', content: assistantMessage },
                ]);
            }
        } catch {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: 'Erro ao processar sua pergunta. Tente novamente.' },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={clsx(
                    "fixed bottom-6 right-6 w-14 h-14 rounded-full",
                    "bg-gradient-to-r from-orange-500 to-red-600",
                    "flex items-center justify-center shadow-lg shadow-orange-500/30",
                    "hover:scale-110 transition-transform z-50",
                    isOpen && "hidden"
                )}
            >
                <MessageCircle size={24} />
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-slate-900 rounded-2xl border border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div>
                            <h3 className="font-bold">Precision Trader</h3>
                            <p className="text-xs text-gray-400">Análise com contexto deste jogo</p>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center text-gray-500 py-8">
                                <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
                                <p>Pergunte sobre Value Bets, projeções ou matchups deste jogo</p>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={clsx(
                                    "max-w-[85%] p-3 rounded-xl text-sm",
                                    msg.role === 'user'
                                        ? "ml-auto bg-orange-500/20 text-orange-100"
                                        : "bg-white/5"
                                )}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-gray-400">
                                <Loader2 size={16} className="animate-spin" />
                                <span>Analisando...</span>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-white/10">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                placeholder="Pergunte sobre o jogo..."
                                className="flex-1 bg-white/5 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={isLoading || !input.trim()}
                                className="px-4 py-2 bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function AnalysisPage() {
    const params = useParams();
    const gameId = params.gameId as string;
    const { addToast } = useToast();

    // First fetch schedule to get team names
    const { data: scheduleData } = useQuery({
        queryKey: ['schedule'],
        queryFn: fetchSchedule,
    });

    // Find the current game
    const game = scheduleData?.games.find(g => g.id === gameId);

    // Then fetch props with team names for proper mapping
    const { data, isLoading, error } = useQuery({
        queryKey: ['props', gameId, game?.home.name, game?.away.name],
        queryFn: () => fetchProps(gameId, game?.home.name, game?.away.name),
        enabled: !!gameId,
        retry: false,
    });

    // Show error toast in useEffect to avoid React state update during render
    useEffect(() => {
        if (error) {
            addToast({
                type: 'error',
                title: 'Erro ao carregar props',
                message: error.message,
            });
        }
    }, [error, addToast]);

    const props = data?.props || [];

    // Group props by market
    const pointsProps = props.filter(p => p.market === 'points');

    // Game title
    const gameTitle = game
        ? `${game.away.alias} @ ${game.home.alias}`
        : gameId;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Análise de Jogo</h1>
                <p className="text-gray-400 font-mono text-sm">{gameTitle}</p>
            </div>

            {/* Player Props Table */}
            <section className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="text-green-500" />
                        Props de Pontos - Value Bets
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Projeção vs Linha Vegas • Edge &gt; 10% = Value Bet
                    </p>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center">
                        <Loader2 size={32} className="animate-spin mx-auto text-gray-500" />
                        <p className="text-gray-500 mt-3">Carregando props...</p>
                    </div>
                ) : pointsProps.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5 text-left text-sm text-gray-400">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Jogador</th>
                                    <th className="px-6 py-4 font-medium text-center">Projeção</th>
                                    <th className="px-6 py-4 font-medium text-center">Linha Vegas</th>
                                    <th className="px-6 py-4 font-medium text-center">Melhor Odd</th>
                                    <th className="px-6 py-4 font-medium text-center">Edge</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {pointsProps.map(prop => {
                                    const { projection, edge, isValue } = calculateProjection(prop);
                                    return (
                                        <tr
                                            key={`${prop.playerId}-${prop.market}`}
                                            className={clsx(
                                                "hover:bg-white/5 transition-colors",
                                                isValue && "value-glow bg-green-500/5"
                                            )}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-semibold">{prop.playerName}</div>
                                                <div className="text-xs text-gray-500 capitalize">{prop.market}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-2xl font-bold">{projection}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-lg">{prop.line}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {prop.bestOverOdd ? (
                                                    <div>
                                                        <span className="font-mono text-orange-400">{prop.bestOverOdd.odds.toFixed(2)}</span>
                                                        <div className="text-xs text-gray-500">{prop.bestOverOdd.bookmaker}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-500">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className={clsx(
                                                    "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold",
                                                    isValue
                                                        ? "bg-green-500/20 text-green-400"
                                                        : edge > 0
                                                            ? "bg-yellow-500/20 text-yellow-400"
                                                            : "bg-red-500/20 text-red-400"
                                                )}>
                                                    {isValue && <CheckCircle size={14} />}
                                                    {edge > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                    {edge > 0 ? '+' : ''}{edge}%
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-500">
                        <AlertTriangle size={32} className="mx-auto mb-3 opacity-50" />
                        <p>Nenhuma prop disponível para este jogo</p>
                        <p className="text-sm mt-1">As odds podem não estar disponíveis ainda</p>
                    </div>
                )}
            </section>

            {/* Chat Widget */}
            <ChatWidget gameId={gameId} />
        </div>
    );
}
