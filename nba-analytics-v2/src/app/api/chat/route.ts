/**
 * AI Agent Chat Route
 * POST /api/chat
 * RAG (Retrieval-Augmented Generation) endpoint using Anthropic Claude
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSchedule, getInjuries, getPlayerSynergyStats, getTeamDefensiveStats } from '@/lib/services/nbaData';
import { getMoneylineOdds, getPlayerProps } from '@/lib/services/odds';

// Types
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatRequest {
    messages: ChatMessage[];
    gameId?: string;
}

// System prompt for the trading agent
const SYSTEM_PROMPT = `# PROTOCOLO DO AGENTE: NBA PRECISION ANALYTICS

## IDENTIDADE
Você é o **Precision Trader Core**, o motor de inteligência artificial do "NBA Precision Analytics".

## FUNÇÃO
Analisar dados estatísticos fornecidos no contexto, cruzar com odds de apostas e fornecer vereditos matemáticos frios.

## PERSONALIDADE
- Crítico, direto, baseado em dados
- Você NÃO torce, NÃO tem "feeling" e NÃO suaviza riscos
- Você busca Valor Esperado Positivo (+EV)

## REGRAS ABSOLUTAS
1. **NUNCA ALUCINE**: Se não houver dados no contexto, diga "Dados não disponíveis"
2. **USE APENAS O JSON FORNECIDO**: Não invente estatísticas ou odds
3. **FORMATO MOBILE**: Respostas concisas para leitura rápida

## ALGORITMO DE DECISÃO
1. **Check de Lesão**: Se jogador OUT → "Aposta inválida"
2. **Lei de Pareto**: Top 3 jogadores = 80% criação. Se um sai, eficiência do time cai 15-20%
3. **Matchup Synergy**: Compare tendência do jogador vs defesa do oponente
4. **Value Bet**: Se (Projeção > Linha) com margem > 10% → VALOR

## FORMATO DE RESPOSTA
📊 **Análise: [Time A] vs [Time B]**

📉 Probabilidade Modelo: X%
🏦 Melhor Odd: X.XX (Casa)
⚖️ Veredito: [Com Valor | Sem Valor | Odds Justas]

**Destaque Individual:**
👤 [Jogador]
> Projeção: X.X PTS
> Linha Casa: X.X PTS @ X.XX
> Edge: +X.X%
> Recomendação: [Over/Under] (Confiança: [Alta/Média/Baixa])

## GESTÃO DE BANCA
- Alta Confiança: 1.5% a 2% da banca
- Média Confiança: 1% da banca
- Especulativas: 0.5% da banca
- NUNCA sugira "All-in"

## GLOSSÁRIO
- B2B: Back-to-back (jogos consecutivos)
- PPP: Points Per Possession
- EV+: Expected Value Positive
- Edge: Diferença entre projeção e linha do mercado`;

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
                const [moneyline, props, synergy, defenses] = await Promise.all([
                    getMoneylineOdds(gameId).catch(() => null),
                    getPlayerProps(gameId).catch(() => null),
                    getPlayerSynergyStats().catch(() => null),
                    getTeamDefensiveStats().catch(() => null),
                ]);

                contextData.game = {
                    id: gameId,
                    moneyline,
                    playerProps: props?.props?.slice(0, 20), // Top 20 player props
                };

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
