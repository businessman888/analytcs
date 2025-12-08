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
  Zap,
  Trophy,
  UserX
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
  comment?: string;
}

interface YesterdayGame {
  id: string;
  status: string;
  home: { alias: string; name: string; score: number };
  away: { alias: string; name: string; score: number };
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

async function fetchYesterdayResults(): Promise<{ date: string; games: YesterdayGame[] }> {
  const res = await fetch('/api/nba/yesterday-results');
  if (!res.ok) {
    return { date: '', games: [] };
  }
  return res.json();
}

function formatGameTime(scheduled: string): string {
  const date = new Date(scheduled);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Estimate return time based on injury status
function estimateReturn(status: string, description: string): string {
  const desc = description?.toLowerCase() || '';
  if (status === 'Out') {
    if (desc.includes('acl') || desc.includes('achilles') || desc.includes('surgery')) {
      return 'Tempo indeterminado';
    }
    if (desc.includes('concussion') || desc.includes('head')) {
      return '1-2 semanas';
    }
    return '1 semana+';
  }
  if (status === 'Day-To-Day') {
    return 'Dia a dia';
  }
  if (status === 'Questionable') {
    return '1-3 dias';
  }
  if (status === 'Probable') {
    return 'Provável hoje';
  }
  return 'Incerto';
}

// Get injury type from description
function getInjuryType(description: string): string {
  if (!description) return 'Não especificado';
  // Try to extract body part
  const parts = description.split(' - ');
  if (parts.length > 1) {
    return parts[0]; // e.g., "Knee" from "Knee - Soreness"
  }
  return description.length > 25 ? description.substring(0, 22) + '...' : description;
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

  const {
    data: yesterdayData,
    isLoading: yesterdayLoading,
  } = useQuery({
    queryKey: ['yesterdayResults'],
    queryFn: fetchYesterdayResults,
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
  const yesterdayGames = yesterdayData?.games || [];
  const gameOfTheDay = games[0];

  // Filter only critical injuries (Out or Day-To-Day)
  const criticalInjuries = injuries.filter(i =>
    i.status === 'Out' || i.status === 'Day-To-Day' || i.status === 'Questionable'
  );

  return (
    <div className="space-y-6">
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
              <span className="font-mono text-red-400">{criticalInjuries.length}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Games */}
        <div className="space-y-6">
          {/* Today's Games - Horizontal */}
          <section className="bg-slate-900/50 rounded-2xl border border-white/5 p-5">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <TrendingUp className="text-blue-500" />
              Jogos de Hoje
            </h2>

            {scheduleLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse min-w-[140px] h-20 bg-white/5 rounded-xl" />
                ))}
              </div>
            ) : games.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
                {games.map(game => (
                  <Link
                    key={game.id}
                    href={`/analysis/${game.id}`}
                    className="flex-shrink-0 min-w-[150px] p-3 bg-white/5 rounded-xl border border-white/5 hover:border-orange-500/30 hover:bg-slate-800/50 transition-all group"
                  >
                    <div className="text-xs text-gray-500 font-mono mb-2 flex items-center gap-1">
                      <Clock size={10} />
                      {formatGameTime(game.scheduled)}
                    </div>
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        {game.away.alias}
                      </span>
                      <span className="text-gray-600 text-xs">@</span>
                      <span>{game.home.alias}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>Nenhum jogo hoje</p>
              </div>
            )}
          </section>

          {/* Yesterday's Results */}
          <section className="bg-slate-900/50 rounded-2xl border border-white/5 p-5">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Trophy className="text-yellow-500" />
              Resultados de Ontem
            </h2>

            {yesterdayLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-12 bg-white/5 rounded-xl" />
                ))}
              </div>
            ) : yesterdayGames.length > 0 ? (
              <div className="space-y-2">
                {yesterdayGames.map(game => {
                  const homeWon = game.home.score > game.away.score;
                  return (
                    <div
                      key={game.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"
                    >
                      <div className={clsx(
                        "flex items-center gap-2 font-semibold",
                        !homeWon && "text-green-400"
                      )}>
                        <span className={clsx(
                          "w-2 h-2 rounded-full",
                          !homeWon ? "bg-green-500" : "bg-gray-600"
                        )} />
                        {game.away.alias}
                        <span className="font-mono text-lg ml-1">{game.away.score}</span>
                      </div>
                      <span className="text-gray-600 text-xs">-</span>
                      <div className={clsx(
                        "flex items-center gap-2 font-semibold",
                        homeWon && "text-green-400"
                      )}>
                        <span className="font-mono text-lg mr-1">{game.home.score}</span>
                        {game.home.alias}
                        <span className={clsx(
                          "w-2 h-2 rounded-full",
                          homeWon ? "bg-green-500" : "bg-gray-600"
                        )} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>Nenhum resultado disponível</p>
              </div>
            )}
          </section>
        </div>

        {/* Right Column - Injury Bulletin */}
        <section className="bg-slate-900/50 rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="text-red-500" />
              Boletim de Lesões Atualizado
            </h2>
            <span className="text-xs font-mono text-gray-500" suppressHydrationWarning>
              {new Date().toLocaleDateString('pt-BR')}
            </span>
          </div>

          {injuriesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="animate-pulse h-12 bg-white/5 rounded-lg" />
              ))}
            </div>
          ) : criticalInjuries.length > 0 ? (
            <div className="overflow-x-auto">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-semibold uppercase tracking-wider pb-2 border-b border-white/10 mb-2">
                <div className="col-span-4">Jogador</div>
                <div className="col-span-2 text-center">Equipe</div>
                <div className="col-span-3 text-center">Status</div>
                <div className="col-span-3 text-right">Retorno</div>
              </div>

              {/* Table Body */}
              <div className="space-y-1 max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                {criticalInjuries.slice(0, 12).map(injury => (
                  <div
                    key={injury.id}
                    className="grid grid-cols-12 gap-2 items-center py-2 px-1 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {/* Player Name */}
                    <div className="col-span-4">
                      <div className="font-semibold text-sm truncate">{injury.playerName}</div>
                    </div>

                    {/* Team */}
                    <div className="col-span-2 text-center">
                      <span className="text-xs font-mono text-gray-400">{injury.team}</span>
                    </div>

                    {/* Status with Injury Type */}
                    <div className="col-span-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-gray-500 truncate max-w-full">
                          {getInjuryType(injury.description)}
                        </span>
                        <span className={clsx(
                          "text-xs font-bold",
                          injury.status === 'Out' && "text-red-400",
                          injury.status === 'Day-To-Day' && "text-yellow-400",
                          injury.status === 'Questionable' && "text-yellow-500",
                          injury.status === 'Probable' && "text-green-400"
                        )}>
                          {injury.status === 'Out' ? 'Fora' :
                            injury.status === 'Day-To-Day' ? 'Dia a dia' :
                              injury.status === 'Questionable' ? 'Questionável' :
                                injury.status === 'Probable' ? 'Provável' : injury.status}
                        </span>
                      </div>
                    </div>

                    {/* Return Estimate */}
                    <div className="col-span-3 text-right">
                      <span className="text-xs text-gray-400">
                        {estimateReturn(injury.status, injury.description)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {criticalInjuries.length > 12 && (
                <div className="text-center pt-3 border-t border-white/10 mt-2">
                  <span className="text-xs text-gray-500">
                    +{criticalInjuries.length - 12} lesões adicionais
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <UserX size={32} className="mx-auto mb-3 opacity-50" />
              <p>Nenhuma lesão crítica reportada</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
