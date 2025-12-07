'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamically import the analysis content with SSR disabled to avoid hydration issues
const AnalysisContent = dynamic(
    () => import('./AnalysisContent'),
    {
        ssr: false,
        loading: () => (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={48} className="animate-spin text-orange-500 mb-4" />
                <p className="text-gray-400">Carregando análise do jogo...</p>
            </div>
        ),
    }
);

export default function AnalysisPage() {
    return <AnalysisContent />;
}
