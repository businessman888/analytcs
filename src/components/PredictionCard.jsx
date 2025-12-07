import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Activity, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

export default function PredictionCard({ player, projection, onToggleStatus, isOverridden }) {
    const { projectedPoints, confidenceScore, reason } = projection;
    const isOut = player.isOut; // calculated from parent override or API

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx(
                "relative p-4 rounded-xl border transition-all duration-300",
                isOut
                    ? "bg-white/5 border-white/5 opacity-60 grayscale"
                    : "bg-nba-card border-white/10 hover:border-nba-blue/50 hover:shadow-lg hover:shadow-nba-blue/10"
            )}
        >
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="text-lg font-bold text-white">{player.name}</h3>
                    <span className="text-xs text-gray-400">{player.position} • {player.team}</span>
                </div>

                {/* Toggle Switch */}
                <button
                    onClick={() => onToggleStatus(player.id)}
                    className={clsx(
                        "w-12 h-6 rounded-full flex items-center p-1 transition-colors duration-300 focus:outline-none",
                        isOut ? "bg-gray-700" : "bg-nba-blue"
                    )}
                >
                    <div className={clsx(
                        "w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300",
                        isOut ? "translate-x-0" : "translate-x-6"
                    )} />
                </button>
            </div>

            <div className="flex items-end gap-2 mb-4">
                <span className={clsx(
                    "text-4xl font-black tracking-tighter",
                    isOut ? "text-gray-500" : "text-white"
                )}>
                    {isOut ? '0.0' : projectedPoints.toFixed(1)}
                </span>
                <span className="text-sm text-gray-400 font-medium mb-1">PTS</span>

                {/* Delta/Trend Indicator (Mock for now) */}
                {!isOut && (
                    <div className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10">
                        <Activity size={12} className={confidenceScore > 70 ? "text-green-400" : "text-yellow-400"} />
                        <span>{confidenceScore}% Conf.</span>
                    </div>
                )}
            </div>

            {!isOut && (
                <div className="p-3 bg-black/20 rounded-lg text-sm border border-white/5">
                    <div className="flex items-start gap-2 text-gray-300">
                        <TrendingUp size={14} className="mt-1 text-nba-blue shrink-0" />
                        <p className="leading-snug">{reason}</p>
                    </div>
                </div>
            )}

            {isOut && (
                <div className="p-3 bg-red-500/10 rounded-lg text-sm border border-red-500/20 text-red-200 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span>Player Marked Inactive (Pareto Active)</span>
                </div>
            )}
        </motion.div>
    );
}
