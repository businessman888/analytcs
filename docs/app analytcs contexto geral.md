ARQUITETURA FUNCIONAL GLOBAL: NBA PRECISION ANALYTICS 

1. VISÃO GERAL DO SISTEMA 

O NBA Precision Analytics é um ecossistema de inteligência para trading 

esportivo. Diferente de apps comuns de scores, ele opera sob a premissa 

de Vantagem Matemática (Edge). 

O sistema não "chuta" resultados. Ele processa dados históricos de 

eficiência (Synergy), cruza com a disponibilidade de elenco (Standard) e 

compara com a precificação do mercado (Odds) para encontrar 

ineficiências. 

2. FLUXO DE DADOS (PIPELINE) 

O sistema op era em 4 camadas sequenciais. O Agente de IA está na 

Camada 4. 

Camada 1: Ingestão de Dados (Server -Side Proxy) 

O Frontend (Next.js) nunca consome APIs diretamente. O Backend agrega 

três fontes primárias da Sportradar: 

1.  Synergy Stats: Eficiência por tipo de jogada (PPP - Points Per 

Possession). Ex: "Eficiência de Curry em Pick & Roll". 

2.  Standard API: Contexto logístico. Ex: Calendário, Back -to -Backs, 

Boletim de Lesões (Daily Injuries). 

3.  Odds Comparison: Precificação das casas de apostas (Moneyline e 

Player Prop s). 

Camada 2: O Motor de Predição (Prediction Engine) 

Antes dos dados chegarem à UI ou ao Agente, eles passam por um 

algoritmo determinístico (JavaScript/Math): 

1.  Filtro de Disponibilidade: Se Injury Status == Out, a projeção é 

forçada a 0. 

2.  Lei de Pareto (80 /20): Identifica os 20% dos jogadores que geram 

80% do Win Share. Se um deles estiver fora, aplica -se um 

penalizador de eficiência ( -15% a -20%) nos companheiros 

restantes (piora do espaçamento). 

3.  Ajuste de Matchup:  

> o

Input: Volume do Jogador vs. Eficiência D efensiva do 

Oponente (Rank Synergy).  

> o

Output: Projeção Ajustada (ex: 28.5 Pontos). Camada 3: Comparador de Valor (The Edge) 

O sistema compara automaticamente:  

> 

[A] Projeção do Modelo  

> 

[B] Linha da Casa de Aposta (Odds)  

> 

Lógica: Se A > B com margem de segurança > 10%, o sistema 

marca o card com a flag VALUE_BET. 

Camada 4: A Interface e o Agente (Consumidores) 

A UI exibe os números frios. O Agente (Claude) recebe o JSON 

processado das Camadas 2 e 3 para gerar narrativas e responder dúvidas 

complexas. 

3. DETALHAMENTO DOS MÓDULOS (TELAS) 

Módulo A: Dashboard (Home) 

O centro nervoso do app. Não mostra apenas jogos, mostra Contexto.  

> 

Feed de Lesões Críticas: Filtra apenas jogadores "Starters" ou 

"Rotation Key" que estão Out ou Questionable. Ignora jogadores 

irr elevantes.  

> 

Jogos do Dia: Lista os confrontos ordenados por horário.  

> 

Destaque de Oportunidade: Exibe automaticamente o jogo com a 

maior discrepância entre Modelo e Odds. 

Módulo B: Estatísticas (Data Grid) 

Banco de dados exploratório para "Power Users".  

> 

Dife rencial: Permite filtrar por métricas Synergy (ex: "Listar 

jogadores com > 1.0 PPP em Isolation").  

> 

Uso: Validação manual de hipóteses antes de consultar o Agente. 

Módulo C: Analysis (O Cérebro) 

A tela principal de operação. 

1.  Seletor de Jogo: Carrega os dado s de Home vs Away. 

2.  Simulador de Cenários (Toggles):  

> o

Cada jogador possui um switch "Ativo/Inativo".  

> o

Ação: Ao desligar um jogador (simular lesão), o sistema 

recalcula instantaneamente a probabilidade de vitória e a 

distribuição de pontos (Usage Rate) para o resto do time. 3.  Projeções Individuais (Props):  

> o

Tabela comparativa: Projeção Modelo vs Linha Vegas vs 

Melhor Odd.  

> o

Indicadores visuais: Verde (Valor), Cinza (Justo), Vermelho 

(Odds ruins). 

Módulo D: Perfil & Bankroll (Gestão Financeira) 

Ferramenta de disciplina. O Agente deve incentivar o uso deste módulo.  

> 

Tracker: Planilha de input manual de apostas realizadas.  

> 

KPIs: ROI (Retorno sobre Investimento), Taxa de Acerto (Win Rate), 

Drawdown (Maior queda acumulada). 

4. INTEGRAÇÃO DO AGENTE (CLAUDE) 

O Agente não é um oráculo mágico; ele é um Analista Sênior que lê os 

relatórios gerados pelas camadas anteriores. 

O que o Agente VÊ (Contexto Injetado): 

{

"game": "LAL vs BOS", 

"alerts": ["LeBron James (GTD) - Decisão de última hora", "BOS vem de 

B2B (Cansaço) "], 

"model_prediction": { 

"winner": "BOS", 

"probability": 62.5, 

"key_player_props": [ 

{ "name": "Jayson Tatum", "prop": "Points", "model": 28.1, 

"vegas_line": 26.5, "vegas_odd": 1.90, "value_rating": "HIGH" } 

]

}, 

"market_odds": {

"moneyline": { "LAL": 2.40, "BOS": 1.60 } 

}

}O que o Agente FAZ: 

1.  Explica o "Porquê": Traduz a matemática ("28.1 vs 26.5") em texto 

("Tatum tem vantagem no matchup contra a defesa de transição do 

Lakers..."). 

2.  Gestão de Risco: Alerta sobre variáve is externas ("Cuidado, LeBron 

é GTD, a linha pode mudar se ele jogar"). 

3.  Recomendação Final: Baseada puramente em Valor Esperado 

(+EV). 

5. REGRAS DE INTEGRIDADE (LIMITES TÉCNICOS) 

1.  Latência de Odds: As odds são atualizadas a cada requisição, mas 

podem ter de lay de 1 -5 minutos em relação ao site da casa de 

aposta. O usuário deve sempre conferir na casa. 

2.  Mock Data (Fallback): Se a API da Sportradar falhar (limite de cota), 

o sistema entrará em "Modo Histórico", exibindo dados do último 

cache disponível, com um aviso visual claro:  ⚠️ DADOS EM CACHE .

3.  Jogo Responsável: O sistema fornece probabilidades, não 

garantias. O Agente é instruído a encerrar conversas que 

demonstrem comportamento de vício ou desespero financeiro.