'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Activity,
  Flame,
  ArrowRight,
  Clock,
  AlertTriangle,
  TrendingUp,
  Zap
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useEffect } from 'react';
import { clsx } from 'clsx';

interface Game {
  id: string;
  scheduled: string;
  home: { id: string; name: string; alias: string };
  away: { id: string; name: string; alias: string };
}

interface Injury {
  id: string;
  playerName: string;
  team: string;
  position: string;
  status: string;
  description: string;
}

async function fetchSchedule(): Promise<{ games: Game[] }> {
  const res = await fetch('/api/nba/schedule');
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to fetch schedule');
  }
  return res.json();
}

async function fetchInjuries(): Promise<{ injuries: Injury[] }> {
  const res = await fetch('/api/nba/injuries');
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to fetch injuries');
  }
  return res.json();
}

function formatGameTime(scheduled: string): string {
  const date = new Date(scheduled);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const { addToast } = useToast();

  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    error: scheduleError
  } = useQuery({
    queryKey: ['schedule'],
    queryFn: fetchSchedule,
  });

  const {
    data: injuriesData,
    isLoading: injuriesLoading,
    error: injuriesError
  } = useQuery({
    queryKey: ['injuries'],
    queryFn: fetchInjuries,
  });

  // Show error toasts
  useEffect(() => {
    if (scheduleError) {
      addToast({
        type: 'error',
        title: 'Erro ao carregar jogos',
        message: scheduleError.message,
      });
    }
    if (injuriesError) {
      addToast({
        type: 'error',
        title: 'Erro ao carregar lesões',
        message: injuriesError.message,
      });
    }
  }, [scheduleError, injuriesError, addToast]);

  const games = scheduleData?.games || [];
  const injuries = injuriesData?.injuries || [];
  const gameOfTheDay = games[0];

  return (
    <div className="space-y-8">
      {/* Hero Section - Game of the Day */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#1d428a] via-slate-900 to-slate-950 aspect-[21/9] flex items-center p-8 md:p-12 shadow-2xl border border-white/10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-transparent" />

        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-orange-500 font-bold mb-3">
            <Flame size={20} className="animate-pulse" />
            <span className="text-sm tracking-wider">JOGO DO DIA</span>
          </div>

          {scheduleLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-12 w-80 bg-white/10 rounded-lg" />
              <div className="h-6 w-60 bg-white/10 rounded-lg" />
            </div>
          ) : gameOfTheDay ? (
            <>
              <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight tracking-tight">
                {gameOfTheDay.away.alias} <span className="text-gray-400 text-3xl md:text-4xl font-light">vs</span> {gameOfTheDay.home.alias}
              </h1>
              <p className="text-gray-300 text-lg mb-8 max-w-lg flex items-center gap-2">
                <Clock size={18} className="text-gray-400" />
                {formatGameTime(gameOfTheDay.scheduled)}
                <span className="text-gray-600 mx-2">•</span>
                Análise de matchups disponível
              </p>
              <Link
                href={`/analysis/${gameOfTheDay.id}`}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-full font-bold hover:scale-105 transition-transform shadow-lg shadow-orange-500/20"
              >
                Ver Projeções <ArrowRight size={18} />
              </Link>
            </>
          ) : (
            <div className="text-gray-400">
              <p className="text-xl">Nenhum jogo programado para hoje</p>
              <p className="text-sm mt-2">Verifique novamente mais tarde ou consulte a análise histórica</p>
            </div>
          )}
        </div>

        {/* Floating Stats Card */}
        <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 glass rounded-2xl p-6 w-64">
          <div className="flex items-center gap-2 text-green-400 mb-4">
            <Zap size={18} />
            <span className="text-sm font-semibold">Sistema Ativo</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">APIs Conectadas</span>
              <span className="font-mono text-green-400">3/3</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Jogos Hoje</span>
              <span className="font-mono">{games.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Lesões Críticas</span>
              <span className="font-mono text-red-400">{injuries.length}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Injury Feed */}
        <section className="lg:col-span-2 bg-slate-900/50 rounded-2xl border border-white/5 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="text-red-500" />
              Boletim de Lesões
            </h2>
            <span className="text-xs font-mono text-gray-500" suppressHydrationWarning>
              {new Date().toLocaleDateString('pt-BR')}
            </span>
          </div>

          {injuriesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-white/10 rounded" />
                    <div className="h-3 w-48 bg-white/10 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : injuries.length > 0 ? (
            <div className="space-y-3">
              {injuries.slice(0, 8).map(injury => (
                <div
                  key={injury.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-sm text-gray-300">
                      {injury.team}
                    </div>
                    <div>
                      <div className="font-semibold">{injury.playerName}</div>
                      <div className="text-xs text-gray-400">{injury.description || injury.position}</div>
                    </div>
                  </div>
                  <span className={clsx(
                    "px-3 py-1 rounded-full text-xs font-bold",
                    injury.status === 'Out'
                      ? "bg-red-500/20 text-red-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  )}>
                    {injury.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <AlertTriangle size={32} className="mx-auto mb-3 opacity-50" />
              <p>Nenhuma lesão crítica reportada</p>
            </div>
          )}
        </section>

        {/* Games List */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="text-blue-500" />
            Jogos de Hoje
          </h2>

          {scheduleLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse p-4 bg-white/5 rounded-xl h-24" />
              ))}
            </div>
          ) : games.length > 0 ? (
            <div className="space-y-3">
              {games.map(game => (
                <Link
                  key={game.id}
                  href={`/analysis/${game.id}`}
                  className="block p-4 bg-slate-900/50 rounded-xl border border-white/5 hover:border-orange-500/30 hover:bg-slate-900 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                      <Clock size={12} />
                      {formatGameTime(game.scheduled)}
                    </span>
                    <ArrowRight size={14} className="text-gray-600 group-hover:text-orange-500 transition-colors" />
                  </div>
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>{game.away.alias}</span>
                    <span className="text-gray-600 text-sm font-normal">@</span>
                    <span>{game.home.alias}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 bg-slate-900/50 rounded-xl border border-white/5">
              <p>Nenhum jogo hoje</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
