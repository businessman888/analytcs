export default function Stats() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Advanced Stats</h1>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-nba-card border border-white/10 rounded-lg text-sm hover:bg-white/5">Filter</button>
                    <button className="px-4 py-2 bg-nba-card border border-white/10 rounded-lg text-sm hover:bg-white/5">Export</button>
                </div>
            </div>

            <div className="bg-nba-card border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 uppercase text-gray-400 font-bold">
                        <tr>
                            <th className="p-4">Player</th>
                            <th className="p-4">Team</th>
                            <th className="p-4 text-right">PPP (Iso)</th>
                            <th className="p-4 text-right">PPP (P&R)</th>
                            <th className="p-4 text-right">Usage %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-medium">Player Name {i}</td>
                                <td className="p-4 text-gray-400">LAL</td>
                                <td className="p-4 text-right font-mono text-green-400">1.{10 + i}</td>
                                <td className="p-4 text-right font-mono">0.{90 + i}</td>
                                <td className="p-4 text-right font-mono">2{8 + i}.5%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="p-4 text-center text-gray-500 text-xs border-t border-white/5">
                    Data provided by Sportradar Synergy API
                </div>
            </div>
        </div>
    );
}
