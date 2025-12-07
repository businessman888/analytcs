'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
    TrendingUp,
    TrendingDown,
    MessageCircle,
    X,
    Send,
    Loader2,
    Trophy,
    Users,
    Target,
    ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';

interface PlayerProjection {
    playerId: string;
    playerName: string;
    position: string;
    projection: number;
    line: number;
    edge: number;
    isValueBet: boolean;
    confidence: number;
}

interface TeamAnalysis {
    id: string;
    name: string;
    alias: string;
    winProbability: number;
    players: PlayerProjection[];
}

interface GameAnalysis {
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

async function fetchGameAnalysis(gameId: string): Promise<GameAnalysis> {
    const res = await fetch(`/api/analysis/${gameId}`);
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch analysis');
    }
    return res.json();
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

            {isOpen && (
                <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-slate-900 rounded-2xl border border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div>
                            <h3 className="font-bold">Precision Trader</h3>
                            <p className="text-xs text-gray-400">Análise com contexto deste jogo</p>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

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

function PlayerCard({ player, teamAlias }: { player: PlayerProjection; teamAlias: string }) {
    // Defensive: ensure we have valid numbers
    const edge = player?.edge ?? 0;
    const projection = player?.projection ?? 0;
    const line = player?.line ?? 0;
    const confidence = player?.confidence ?? 0;
    const isPositive = edge > 0;
    const isValueBet = player?.isValueBet ?? false;

    return (
        <div
            className={clsx(
                "p-4 rounded-xl border transition-all",
                isValueBet
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-white/5 border-white/10 hover:border-white/20"
            )}
        >
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h4 className="font-bold text-lg">{player?.playerName ?? 'Jogador'}</h4>
                    <p className="text-xs text-gray-400">{teamAlias} • {player?.position ?? '-'}</p>
                </div>
                <div className={clsx(
                    "px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1",
                    isValueBet
                        ? "bg-green-500/20 text-green-400"
                        : isPositive
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                )}>
                    {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {isPositive ? '+' : ''}{edge.toFixed(1)}%
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-xs text-gray-500 mb-1">Projeção</div>
                    <div className="text-2xl font-bold text-orange-400">{projection.toFixed(1)}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-500 mb-1">Linha Vegas</div>
                    <div className="text-2xl font-bold">{line.toFixed(1)}</div>
                </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                        className="h-full bg-orange-500"
                        style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
                    />
                </div>
                <span className="text-xs text-gray-400">{Math.round(confidence)}%</span>
            </div>
        </div>
    );
}

function WinProbabilityBar({ homeProb, awayProb, homeAlias, awayAlias }: {
    homeProb: number;
    awayProb: number;
    homeAlias: string;
    awayAlias: string;
}) {
    // Defensive: ensure valid numbers and handle null/undefined
    const safeHomeProb = Number.isFinite(homeProb) ? homeProb : 50;
    const safeAwayProb = Number.isFinite(awayProb) ? awayProb : 50;
    const safeHomeAlias = homeAlias ?? 'HOME';
    const safeAwayAlias = awayAlias ?? 'AWAY';

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="font-bold">{safeAwayAlias}</span>
                <span className="font-bold">{safeHomeAlias}</span>
            </div>
            <div className="h-4 rounded-full overflow-hidden flex">
                <div
                    className="bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-end pr-2"
                    style={{ width: `${safeAwayProb}%` }}
                >
                    <span className="text-xs font-bold">{safeAwayProb.toFixed(0)}%</span>
                </div>
                <div
                    className="bg-gradient-to-r from-orange-400 to-orange-500 flex items-center pl-2"
                    style={{ width: `${safeHomeProb}%` }}
                >
                    <span className="text-xs font-bold">{safeHomeProb.toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
}

export default function AnalysisContent() {
    const params = useParams();
    const gameId = params.gameId as string;
    const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!gameId) return;

        const loadAnalysis = async () => {
            try {
                setIsLoading(true);
                const data = await fetchGameAnalysis(gameId);
                setAnalysis(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load analysis');
            } finally {
                setIsLoading(false);
            }
        };

        loadAnalysis();
    }, [gameId]);

    const gameTitle = analysis
        ? `${analysis.awayTeam.alias} @ ${analysis.homeTeam.alias}`
        : gameId;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={48} className="animate-spin text-orange-500 mb-4" />
                <p className="text-gray-400">Carregando análise do jogo...</p>
            </div>
        );
    }

    if (error || !analysis) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Target size={48} className="text-gray-600 mb-4" />
                <h2 className="text-xl font-bold mb-2">Análise Indisponível</h2>
                <p className="text-gray-400">{error || 'Não foi possível carregar a análise para este jogo.'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-2">Análise de Jogo</h1>
                <p className="text-gray-400 font-mono text-sm">{gameTitle}</p>
            </div>

            {/* Win Probability Section */}
            <section className="bg-slate-900/50 rounded-2xl border border-white/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Trophy className="text-yellow-500" />
                    <h2 className="text-xl font-bold">Probabilidade de Vitória</h2>
                </div>

                <WinProbabilityBar
                    homeProb={analysis.homeTeam.winProbability}
                    awayProb={analysis.awayTeam.winProbability}
                    homeAlias={analysis.homeTeam.alias}
                    awayAlias={analysis.awayTeam.alias}
                />

                <div className="mt-6 p-4 bg-white/5 rounded-xl">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                        <Target size={16} className="text-orange-500" />
                        Análise
                    </h3>
                    <p className="text-orange-400 font-semibold mb-3">{analysis.analysis.summary}</p>
                    <ul className="space-y-2">
                        {analysis.analysis.reasoning.map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                                <ChevronRight size={14} className="text-orange-500 mt-0.5 shrink-0" />
                                {reason}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Away Team Players */}
            <section className="bg-slate-900/50 rounded-2xl border border-white/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="text-blue-500" />
                    <h2 className="text-xl font-bold">
                        {analysis.awayTeam.name}
                        <span className="text-gray-400 font-normal text-sm ml-2">(Visitante)</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysis.awayTeam.players.map(player => (
                        <PlayerCard
                            key={player.playerId}
                            player={player}
                            teamAlias={analysis.awayTeam.alias}
                        />
                    ))}
                </div>
            </section>

            {/* Home Team Players */}
            <section className="bg-slate-900/50 rounded-2xl border border-white/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="text-orange-500" />
                    <h2 className="text-xl font-bold">
                        {analysis.homeTeam.name}
                        <span className="text-gray-400 font-normal text-sm ml-2">(Casa)</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysis.homeTeam.players.map(player => (
                        <PlayerCard
                            key={player.playerId}
                            player={player}
                            teamAlias={analysis.homeTeam.alias}
                        />
                    ))}
                </div>
            </section>

            {/* Chat Widget */}
            <ChatWidget gameId={gameId} />
        </div>
    );
}
