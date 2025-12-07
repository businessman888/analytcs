'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Target,
    BarChart3,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';
import { clsx } from 'clsx';

interface Bet {
    id: string;
    date: string;
    game: string;
    selection: string;
    stake: number;
    odds: number;
    status: 'pending' | 'win' | 'loss';
    pnl?: number;
}

const STORAGE_KEY = 'nba-precision-bankroll';

function loadBets(): Bet[] {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
}

function saveBets(bets: Bet[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

export default function ProfilePage() {
    const [bets, setBets] = useState<Bet[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        game: '',
        selection: '',
        stake: '',
        odds: '',
    });

    useEffect(() => {
        setBets(loadBets());
    }, []);

    useEffect(() => {
        if (bets.length > 0) {
            saveBets(bets);
        }
    }, [bets]);

    const addBet = () => {
        if (!form.game || !form.selection || !form.stake || !form.odds) return;

        const newBet: Bet = {
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            game: form.game,
            selection: form.selection,
            stake: parseFloat(form.stake),
            odds: parseFloat(form.odds),
            status: 'pending',
        };

        setBets(prev => [newBet, ...prev]);
        setForm({ game: '', selection: '', stake: '', odds: '' });
        setShowForm(false);
    };

    const updateBetStatus = (id: string, status: 'win' | 'loss') => {
        setBets(prev => prev.map(bet => {
            if (bet.id !== id) return bet;
            const pnl = status === 'win'
                ? bet.stake * (bet.odds - 1)
                : -bet.stake;
            return { ...bet, status, pnl };
        }));
    };

    const deleteBet = (id: string) => {
        setBets(prev => prev.filter(b => b.id !== id));
    };

    // Calculate KPIs
    const completedBets = bets.filter(b => b.status !== 'pending');
    const wins = completedBets.filter(b => b.status === 'win').length;
    const losses = completedBets.filter(b => b.status === 'loss').length;
    const winRate = completedBets.length > 0 ? (wins / completedBets.length) * 100 : 0;
    const totalPnL = completedBets.reduce((sum, b) => sum + (b.pnl || 0), 0);
    const totalStaked = completedBets.reduce((sum, b) => sum + b.stake, 0);
    const roi = totalStaked > 0 ? (totalPnL / totalStaked) * 100 : 0;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Gestão de Banca</h1>
                <p className="text-gray-400">Controle suas apostas e monitore seu desempenho</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <DollarSign size={20} className="text-green-500" />
                        </div>
                        <span className="text-sm text-gray-400">Lucro/Prejuízo</span>
                    </div>
                    <div className={clsx(
                        "text-3xl font-bold",
                        totalPnL >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                        {totalPnL >= 0 ? '+' : ''}R$ {totalPnL.toFixed(2)}
                    </div>
                </div>

                <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <BarChart3 size={20} className="text-blue-500" />
                        </div>
                        <span className="text-sm text-gray-400">ROI</span>
                    </div>
                    <div className={clsx(
                        "text-3xl font-bold",
                        roi >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                    </div>
                </div>

                <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <Target size={20} className="text-orange-500" />
                        </div>
                        <span className="text-sm text-gray-400">Win Rate</span>
                    </div>
                    <div className="text-3xl font-bold">
                        {winRate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        {wins}W - {losses}L
                    </div>
                </div>

                <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <TrendingUp size={20} className="text-purple-500" />
                        </div>
                        <span className="text-sm text-gray-400">Total Apostado</span>
                    </div>
                    <div className="text-3xl font-bold">
                        R$ {totalStaked.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Bankroll Table */}
            <section className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">Histórico de Apostas</h2>
                        <p className="text-sm text-gray-400">Registre e acompanhe suas apostas</p>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
                    >
                        <Plus size={18} />
                        Nova Aposta
                    </button>
                </div>

                {/* Add Form */}
                {showForm && (
                    <div className="p-6 border-b border-white/5 bg-white/5">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <input
                                type="text"
                                placeholder="Jogo (ex: LAL vs BOS)"
                                value={form.game}
                                onChange={e => setForm(prev => ({ ...prev, game: e.target.value }))}
                                className="bg-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <input
                                type="text"
                                placeholder="Seleção (ex: Tatum Over 26.5)"
                                value={form.selection}
                                onChange={e => setForm(prev => ({ ...prev, selection: e.target.value }))}
                                className="bg-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <input
                                type="number"
                                placeholder="Stake (R$)"
                                value={form.stake}
                                onChange={e => setForm(prev => ({ ...prev, stake: e.target.value }))}
                                className="bg-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <input
                                type="number"
                                step="0.01"
                                placeholder="Odd"
                                value={form.odds}
                                onChange={e => setForm(prev => ({ ...prev, odds: e.target.value }))}
                                className="bg-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <button
                                onClick={addBet}
                                className="bg-green-500 rounded-lg px-4 py-2 hover:bg-green-600 transition-colors font-semibold"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                {bets.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5 text-left text-sm text-gray-400">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Data</th>
                                    <th className="px-6 py-4 font-medium">Jogo</th>
                                    <th className="px-6 py-4 font-medium">Seleção</th>
                                    <th className="px-6 py-4 font-medium text-right">Stake</th>
                                    <th className="px-6 py-4 font-medium text-center">Odd</th>
                                    <th className="px-6 py-4 font-medium text-center">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">P/L</th>
                                    <th className="px-6 py-4 font-medium text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {bets.map(bet => (
                                    <tr key={bet.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-400">{bet.date}</td>
                                        <td className="px-6 py-4 font-semibold">{bet.game}</td>
                                        <td className="px-6 py-4">{bet.selection}</td>
                                        <td className="px-6 py-4 text-right font-mono">R$ {bet.stake.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center font-mono text-orange-400">{bet.odds.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center">
                                            {bet.status === 'pending' ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => updateBetStatus(bet.id, 'win')}
                                                        className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center"
                                                        title="Marcar como Ganho"
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => updateBetStatus(bet.id, 'loss')}
                                                        className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center"
                                                        title="Marcar como Perda"
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={clsx(
                                                    "px-3 py-1 rounded-full text-xs font-bold",
                                                    bet.status === 'win'
                                                        ? "bg-green-500/20 text-green-400"
                                                        : "bg-red-500/20 text-red-400"
                                                )}>
                                                    {bet.status === 'win' ? 'WIN' : 'LOSS'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            {bet.pnl !== undefined ? (
                                                <span className={bet.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                                                    {bet.pnl >= 0 ? '+' : ''}R$ {bet.pnl.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-500 flex items-center justify-end gap-1">
                                                    <Clock size={14} />
                                                    Pendente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => deleteBet(bet.id)}
                                                className="text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-500">
                        <TrendingDown size={32} className="mx-auto mb-3 opacity-50" />
                        <p>Nenhuma aposta registrada</p>
                        <p className="text-sm mt-1">Clique em &quot;Nova Aposta&quot; para começar</p>
                    </div>
                )}
            </section>
        </div>
    );
}
