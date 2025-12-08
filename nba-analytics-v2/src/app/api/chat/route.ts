/**
 * AI Agent Chat Route
 * POST /api/chat
 * RAG (Retrieval-Augmented Generation) endpoint using Anthropic Claude
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSchedule, getInjuries, getPlayerSynergyStats, getTeamDefensiveStats } from '@/lib/services/nbaData';
import { getMoneylineOdds, getAggregatedPlayerOdds } from '@/lib/services/odds';
import { getGameAnalysis } from '@/lib/services/gameAnalysis';

// Types
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatRequest {
    messages: ChatMessage[];
    gameId?: string;
}

// System prompt for the trading agent - WITH KNOWLEDGE OVERRIDE
const SYSTEM_PROMPT = `# PROTOCOLO DO AGENTE: NBA PRECISION ANALYTICS

## ⚠️ PROTOCOLO CRÍTICO - AUTORIDADE DOS DADOS
1. **Seus dados de treinamento são DESATUALIZADOS (termina em 2024).**
2. **O JSON fornecido nesta mensagem é a REALIDADE ATUAL de 2025-2026.**
3. **REGRA DE OVERRIDE:** Se o JSON diz que De'Aaron Fox está no Spurs, ELE ESTÁ NO SPURS. Não questione. Não sinalize como erro. Não mencione "Kings".
4. **Você DEVE tratar as estatísticas e rosters do JSON como VERDADE ABSOLUTA**, mesmo que contradigam sua memória do histórico NBA.
5. **NUNCA diga que há inconsistência de dados** entre seu conhecimento e o JSON. O JSON é a fonte de verdade.

## IDENTIDADE
Você é o **Precision Trader Core**, o motor de inteligência artificial do "NBA Precision Analytics".

## FUNÇÃO
Analisar dados estatísticos fornecidos no contexto JSON, cruzar com odds de apostas e fornecer vereditos matemáticos frios.

## COMO PROCESSAR OS DADOS
- O objeto \`analysis\` contém times e jogadores com suas estatísticas ATUAIS
- O campo \`avgPoints\` = média de pontos por jogo do jogador
- O campo \`linePts\` = linha de pontos da casa de apostas
- O campo \`edge\` = diferença percentual entre projeção e linha
- O campo \`playerOdds\` contém odds de mercado

## REGRAS ABSOLUTAS
1. **USE APENAS O JSON**: A realidade é o JSON, não sua memória
2. **NUNCA ALUCINE**: Se um campo não existe no JSON, diga "Não disponível no contexto"
3. **FORMATO MOBILE**: Respostas concisas para leitura rápida
4. **ACEITE TRADES**: Jogadores podem ter mudado de time desde seu treinamento. ACEITE.

## ALGORITMO DE DECISÃO
1. **Check de Lesão**: Se jogador marcado como OUT → "Aposta inválida"
2. **Value Bet**: Se (avgPoints > linePts) com margem > 10% → VALOR
3. **Edge Calculation**: Edge = ((Projeção - Linha) / Linha) * 100

## FORMATO DE RESPOSTA
📊 **Análise: [Time A] vs [Time B]**

👤 **[Nome do Jogador]** ([Time do JSON, não da memória])
> Média Temporada: X.X PTS
> Linha Vegas: X.X PTS
> Edge: +X.X%
> Veredito: [OVER/UNDER] (Confiança: [Alta/Média/Baixa])

## GESTÃO DE BANCA
- Alta Confiança (edge > 15%): 2% da banca
- Média Confiança (edge 10-15%): 1% da banca
- Especulativas (edge 5-10%): 0.5% da banca`;

export async function POST(request: NextRequest) {
    try {
        const { messages, gameId }: ChatRequest = await request.json();

        if (!messages || messages.length === 0) {
            return NextResponse.json(
                { error: 'Messages array is required', code: 'BAD_REQUEST' },
                { status: 400 }
            );
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Anthropic API key not configured', code: 'CONFIG_ERROR' },
                { status: 500 }
            );
        }

        // Initialize Anthropic client
        const anthropic = new Anthropic({ apiKey });

        // Build context data (RAG - Retrieval step)
        let contextData: Record<string, unknown> = {};

        try {
            // Fetch schedule and injuries (always useful context)
            const [schedule, injuries] = await Promise.all([
                getSchedule().catch(() => null),
                getInjuries().catch(() => null),
            ]);

            contextData = {
                date: new Date().toISOString().split('T')[0],
                schedule: schedule?.games?.slice(0, 5) || [], // Top 5 games
                injuries: injuries?.injuries?.slice(0, 10) || [], // Top 10 injuries
            };

            // If specific game requested, fetch detailed data
            if (gameId) {
                const [moneyline, aggregatedOdds, synergy, defenses, gameAnalysis] = await Promise.all([
                    getMoneylineOdds(gameId).catch(() => null),
                    getAggregatedPlayerOdds(gameId).catch(() => []),
                    getPlayerSynergyStats().catch(() => null),
                    getTeamDefensiveStats().catch(() => null),
                    getGameAnalysis(gameId).catch(() => null),
                ]);

                // Map players to agent-friendly format with translated keys (ALL STATS)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mapPlayersForAgent = (players: any[] | undefined) => {
                    if (!players) return [];
                    return players.map(p => ({
                        name: p.playerName,
                        // POINTS
                        avgPoints: p.projection,
                        linePts: p.line,
                        edgePts: `${p.edge > 0 ? '+' : ''}${p.edge.toFixed(1)}%`,
                        // ASSISTS
                        avgAssists: p.assistsProjection ?? 0,
                        lineAst: p.assistsLine ?? 0,
                        edgeAst: `${(p.assistsEdge ?? 0) > 0 ? '+' : ''}${(p.assistsEdge ?? 0).toFixed(1)}%`,
                        // REBOUNDS
                        avgRebounds: p.reboundsProjection ?? 0,
                        lineReb: p.reboundsLine ?? 0,
                        edgeReb: `${(p.reboundsEdge ?? 0) > 0 ? '+' : ''}${(p.reboundsEdge ?? 0).toFixed(1)}%`,
                        // THREE POINTERS
                        avgThrees: p.threesProjection ?? 0,
                        line3pt: p.threesLine ?? 0,
                        edge3pt: `${(p.threesEdge ?? 0) > 0 ? '+' : ''}${(p.threesEdge ?? 0).toFixed(1)}%`,
                        // META
                        isValue: p.isValueBet,
                        confidence: `${p.confidence.toFixed(0)}%`,
                    }));
                };

                contextData.game = {
                    id: gameId,
                    moneyline,
                    // All player odds aggregated by name (points, assists, rebounds, threes per player)
                    playerOdds: aggregatedOdds.slice(0, 15), // Top 15 players with full odds
                };

                // Add game analysis with player stats
                if (gameAnalysis) {
                    contextData.analysis = {
                        homeTeam: {
                            name: gameAnalysis.homeTeam.name,
                            alias: gameAnalysis.homeTeam.alias,
                            winProbability: `${gameAnalysis.homeTeam.winProbability.toFixed(0)}%`,
                            players: mapPlayersForAgent(gameAnalysis.homeTeam.players),
                        },
                        awayTeam: {
                            name: gameAnalysis.awayTeam.name,
                            alias: gameAnalysis.awayTeam.alias,
                            winProbability: `${gameAnalysis.awayTeam.winProbability.toFixed(0)}%`,
                            players: mapPlayersForAgent(gameAnalysis.awayTeam.players),
                        },
                        favoredTeam: gameAnalysis.analysis.favoredTeam,
                        reasoning: gameAnalysis.analysis.reasoning,
                    };
                }

                if (synergy && defenses) {
                    contextData.synergyContext = {
                        playersCount: synergy.length,
                        teamsDefenseCount: defenses.length,
                    };
                }
            }
        } catch (error) {
            console.error('Error fetching context data:', error);
            // Continue without context - agent will respond based on available info
        }

        // Format user message with context
        const lastUserMessage = messages[messages.length - 1];
        const contextInjectedMessage = `
## DADOS DO SISTEMA (JSON)
\`\`\`json
${JSON.stringify(contextData, null, 2)}
\`\`\`

## PERGUNTA DO USUÁRIO
${lastUserMessage.content}
`;

        // Prepare messages for Anthropic
        const anthropicMessages = [
            ...messages.slice(0, -1).map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            })),
            {
                role: 'user' as const,
                content: contextInjectedMessage,
            },
        ];

        // Create streaming response
        const stream = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: anthropicMessages,
            stream: true,
        });

        // Create a ReadableStream for the response
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of stream) {
                        if (event.type === 'content_block_delta') {
                            const delta = event.delta;
                            if ('text' in delta) {
                                controller.enqueue(encoder.encode(delta.text));
                            }
                        }
                    }
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            },
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });

    } catch (error) {
        console.error('Chat API Error:', error);

        const message = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            { error: message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
