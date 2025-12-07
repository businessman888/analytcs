# NBA Precision Analytics v2 - Relatório de Desenvolvimento
## Data: 06/12/2024

---

## 1. Visão Geral do Projeto

Migração completa do aplicativo NBA Precision Analytics de **Vite/React** para **Next.js 16** com integração das APIs Sportradar (Stats, Synergy, Odds) e agente de IA Anthropic Claude.

---

## 2. Páginas Construídas

### 2.1 Dashboard (`/`)
- Hero section com "Oportunidade do Dia"
- Feed de lesões em tempo real
- Grid de jogos do dia com links para análise

### 2.2 Análise de Jogo (`/analysis/[gameId]`)
- Tabela de Player Props (Pontos)
- Colunas: Jogador, Projeção do Modelo, Linha Vegas, Melhor Odd, Edge
- Destaque visual para Value Bets (Edge > 10%)
- Widget de chat flutuante com agente de IA

### 2.3 Seleção de Jogos (`/analysis`)
- Grid para selecionar jogo a analisar
- Cards com times e horário

### 2.4 Perfil/Bankroll (`/profile`)
- Bankroll Manager interativo
- Tabela de apostas com localStorage
- KPIs: ROI, Win Rate, P/L

---

## 3. Arquivos Criados

### Services (`src/lib/services/`)
| Arquivo | Função |
|---------|--------|
| `nbaData.ts` | Consome APIs Standard e Synergy da Sportradar |
| `odds.ts` | Consome API de Odds e Player Props |
| `mapping.ts` | Converte UUIDs para URNs da Sportradar |

### API Routes (`src/app/api/`)
| Rota | Função |
|------|--------|
| `/api/nba/schedule` | Calendário de jogos |
| `/api/nba/injuries` | Relatório de lesões |
| `/api/nba/synergy` | Stats Synergy |
| `/api/odds/moneyline` | Odds de vencedor |
| `/api/odds/props` | Player Props |
| `/api/chat` | Agente de IA Claude |

### Componentes (`src/components/`)
| Componente | Função |
|------------|--------|
| `providers.tsx` | React Query Provider |
| `ui/toast.tsx` | Sistema de notificações |

### Lógica (`src/lib/logic/`)
| Arquivo | Função |
|---------|--------|
| `prediction.ts` | Motor de previsão (Pareto, Matchups) |

---

## 4. Erros Encontrados e Correções

### 4.1 ❌ Prefixo `VITE_` nas Variáveis de Ambiente
**Problema:** Código usava `VITE_SPORTRADAR_API_KEY` (padrão Vite)
**Correção:** Alterado para `SPORTRADAR_API_KEY` (padrão Next.js server-side)

### 4.2 ❌ Erro de Hidratação React
**Problema:** `Cannot update component ToastProvider while rendering AnalysisPage`
**Causa:** `addToast()` chamado durante renderização
**Correção:** Movido para `useEffect`

### 4.3 ❌ Erro 500 na API de Props
**Problema:** API retornava 500 ao acessar `/api/odds/props`
**Causa:** UUID do Schedule API incompatível com URN da Odds API

| Formato | Exemplo |
|---------|---------|
| UUID (Schedule) | `8ab7f6e0-0fdc-4af9-87c4-c4b85e829f4c` |
| URN (Odds) | `sr:sport_event:428912` |

**Correção:** Criado `mapping.ts` para converter IDs + fallback para mock data

### 4.4 ❌ URL da API Incorreta
**Problema:** Base URL incorreta `api.sportradar.us`
**Correção:** Alterado para `api.sportradar.com`

**Endpoint correto:**
```
https://api.sportradar.com/oddscomparison-player-props/trial/v2/en/sport_events/{id}/players_props.json
```

### 4.5 ❌ `.env.local` no Diretório Errado
**Problema:** Usuário criou `.env` no projeto Vite antigo
**Correção:** Instruído a criar `.env.local` em `nba-analytics-v2/`

---

## 5. Configuração Atual

### `.env.local` (em `nba-analytics-v2/`)
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SPORTRADAR_API_KEY=sua_key_aqui
ANTHROPIC_API_KEY=sua_key_aqui
```

---

## 6. Estado Atual do Projeto

| Funcionalidade | Status |
|----------------|--------|
| Dashboard | ✅ Funcionando |
| Feed de Lesões | ✅ Funcionando |
| Calendário de Jogos | ✅ Funcionando |
| Página de Análise | ✅ Funcionando (com mock data) |
| Motor de Previsão | ✅ Implementado |
| Agente de IA | ✅ Implementado |
| API de Odds | ⚠️ Mock data (mapeamento UUID→URN pendente) |

---

## 7. Próximos Passos

Para ativar dados reais de Player Props:

1. **Obter endpoint de listagem de jogos** da Odds API para mapear UUIDs→URNs
2. **Testar** chamada direta com URN conhecida
3. **Validar** formato de resposta da API

---

## 8. Comandos Úteis

```bash
# Iniciar servidor de desenvolvimento
cd nba-analytics-v2
npm run dev

# Acessar aplicação
http://localhost:3000
```

---

## 9. Estrutura de Diretórios

```
nba-analytics-v2/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Dashboard
│   │   ├── layout.tsx        # Layout raiz
│   │   ├── globals.css       # Estilos globais
│   │   ├── analysis/
│   │   │   ├── page.tsx      # Seleção de jogos
│   │   │   └── [gameId]/
│   │   │       └── page.tsx  # Análise detalhada
│   │   ├── profile/
│   │   │   └── page.tsx      # Bankroll Manager
│   │   └── api/
│   │       ├── nba/          # APIs NBA
│   │       ├── odds/         # APIs Odds
│   │       └── chat/         # Agente IA
│   ├── lib/
│   │   ├── services/         # Serviços de dados
│   │   └── logic/            # Motor de previsão
│   └── components/           # Componentes React
├── .env.local                # Variáveis de ambiente
└── package.json
```

---

*Documento gerado em 06/12/2024 às 21:29*
