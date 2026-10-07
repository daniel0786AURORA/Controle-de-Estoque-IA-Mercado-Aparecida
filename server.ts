import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { startOfDay, endOfDay, subDays, subMonths } from 'date-fns';

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const PORT = 3000;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;


app.post(['/api/danfe', '/api/importacao-nota/processar'], async (req, res) => {
  try {
    const { imagem, mimeType, ean_gtin } = req.body;
    if (!ai) {
      return res.status(500).json({ error: 'Gemini API Key não configurada no servidor' });
    }
    if (!imagem) {
      return res.json({ erro: "IMAGEM_INVALIDA", mensagem: "Imagem não é um DANFE válido ou está ilegível." });
    }

    const danfePrompt = `
# ROLE & STRICT CONSTRAINTS
Você é um parser fiscal brasileiro especializado exclusivamente em DANFEs (Documentos Auxiliares de Nota Fiscal Eletrônica). Sua única função é extrair dados de produtos de imagens de notas fiscais pré-processadas e retornar um JSON estritamente formatado para integração ERP. 
REGRAS ABSOLUTAS:
1. NÃO converse, NÃO explique, NÃO adicione markdown, NÃO use \`\`\`json. Retorne APENAS o objeto JSON puro.
2. Se a imagem não for um DANFE válido ou estiver ilegível após pré-processamento, retorne EXATAMENTE: {"erro": "IMAGEM_INVALIDA", "mensagem": "Imagem não é um DANFE válido ou está ilegível."}
3. NUNCA alucine códigos de barras (EAN/GTIN). Se o campo 'ean_gtin' vier preenchido nos metadados da imagem, USE EXATAMENTE ESSE VALOR. Se não vier, leia apenas se houver barcode impresso claramente abaixo da descrição do produto. Caso contrário, retorne null. É melhor null do que código errado.
4. Temperatura de geração deve ser 0.1. Precisão absoluta sobre criatividade.

# EXTRACTION LOGIC
1. ITENS: Extraia APENAS linhas da tabela "DADOS DO PRODUTO/SERVIÇOS". Ignore completamente taxas, fretes, seguros, descontos, ISSQN e informações fora da tabela de produtos.
2. DESCRIÇÕES: Concatene descrições multiline em uma única string. Mantenha texto completo no JSON (o frontend truncará visualmente).
3. ALTERAÇÕES MANUSCRITAS:
   - valor_unitario_original = valor IMPRESSO na nota
   - valor_unitario_real = valor MANUSCRITO à caneta (se houver alteração visível)
   - observacao_manual = descrição exata da alteração (ex: "Preço unitário riscado e alterado manualmente para 11,50")
   - Se NÃO houver alteração manual: valor_unitario_real DEVE SER IGUAL ao valor_unitario_original E observacao_manual DEVE SER null
4. UNIDADES: Padronize automaticamente para siglas: UN, KG, LT, CX, PCT, ML. Converta extensos ("UNIDADE" → "UN", "KILOGRAMA" → "KG").
5. VALORES MONETÁRIOS: Sempre float com ponto decimal (ex: 24.90). NUNCA use R $ , vírgula decimal brasileira ou strings monetárias.
6. CONFIANÇA: Calcule nivel_confianca_item baseado em: rasuras, borrões, descrições truncadas ou divergência >5% entre (quantidade * valor_unitario_real) e valor_total_linha.

# STRICT OUTPUT SCHEMA
{
  "fornecedor": "string | null",
  "numero_nota": "string | null",
  "data_emissao": "DD/MM/YYYY | null",
  "confianca_geral_ocr": number (0-100),
  "total_itens_extraidos": number,
  "itens": [
    {
      "codigo_fornecedor": "string | null",
      "descricao_completa": "string",
      "ncm": "string | null",
      "cfop_cst": "string | null",
      "quantidade": number,
      "unidade_medida": "string",
      "valor_unitario_original": number,
      "valor_unitario_real": number,
      "valor_total_linha": number,
      "ean_gtin": "string | null",
      "observacao_manual": "string | null",
      "nivel_confianca_item": "ALTO | MEDIO | BAIXO",
      "sugestao_categoria": "string | null"
    }
  ]
}

# VALIDATION RULES
- Campo ilegível: use null, NUNCA invente valores.
- Validação interna obrigatória: abs((quantidade * valor_unitario_real) - valor_total_linha) / valor_total_linha <= 0.05. Se falhar, defina nivel_confianca_item como "MEDIO".
- Itens sem descrição ou quantidade zero devem ser excluídos do array 'itens'.
- O campo 'sugestao_categoria' deve inferir categoria baseada na descrição e NCM (ex: "BEBIDAS_ENERGETICAS", "VINHOS", "DOCES"). Se não conseguir inferir, retorne null.
${ean_gtin ? `Metadados recebidos: ean_gtin = "${ean_gtin}"` : ''}
`;

    const base64Data = imagem.replace(/^data:image\/\w+;base64,/, '');
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType || 'image/jpeg'
      }
    };

    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [imagePart, danfePrompt],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    let rawText = response.text || '{}';
    try {
      const parsed = JSON.parse(rawText);
      return res.json(parsed);
    } catch (e) {
      return res.json({ erro: "IMAGEM_INVALIDA", mensagem: "Imagem não é um DANFE válido ou está ilegível." });
    }
  } catch (error: any) {
    console.error('Erro no parser DANFE:', error);
    return res.status(500).json({ erro: "ERRO_INTERNO", mensagem: error.message || 'Erro ao processar DANFE' });
  }
});

app.post('/api/relatorio', async (req, res) => {
  try {
    const { tipo, empresaId, dataInicio, dataFim } = req.body;
    const authHeader = req.headers.authorization;

    if (!tipo || !empresaId) {
      return res.status(400).json({ error: 'Faltam parâmetros' });
    }

    if (!ai) {
      return res.status(500).json({ error: 'Gemini API Key não configurada no servidor' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const hoje = new Date();
    let inicioAtual: Date, fimAtual: Date, inicioAnterior: Date, fimAnterior: Date;

    if (dataInicio && dataFim) {
      inicioAtual = new Date(dataInicio);
      fimAtual = new Date(dataFim);
      
      const diffTime = Math.abs(fimAtual.getTime() - inicioAtual.getTime());
      // Ajuste para pegar período idêntico anterior (incluindo o +1ms perdido na diferença de fim para inicio se for start/endOfDay)
      inicioAnterior = new Date(inicioAtual.getTime() - diffTime - 1);
      fimAnterior = new Date(fimAtual.getTime() - diffTime - 1);
    } else {
      if (tipo === 'diario') {
        inicioAtual = startOfDay(hoje);
        fimAtual = endOfDay(hoje);
        inicioAnterior = startOfDay(subDays(hoje, 1));
        fimAnterior = endOfDay(subDays(hoje, 1));
      } else if (tipo === 'semanal') {
        inicioAtual = startOfDay(subDays(hoje, 6)); // Últimos 7 dias (hoje + 6 dias anteriores)
        fimAtual = endOfDay(hoje);
        inicioAnterior = startOfDay(subDays(hoje, 13));
        fimAnterior = endOfDay(subDays(hoje, 7));
      } else { // mensal
        inicioAtual = startOfDay(subDays(hoje, 29)); // Últimos 30 dias
        fimAtual = endOfDay(hoje);
        inicioAnterior = startOfDay(subDays(hoje, 59));
        fimAnterior = endOfDay(subDays(hoje, 30));
      }
    }
    
    // Check if report already exists
    const { data: relatoriosExistentes, error: errRel } = await supabase
      .from('relatorio')
      .select('id, texto, dados, criado_em')
      .eq('empresa_id', empresaId)
      .eq('tipo', tipo)
      .eq('data_inicio', inicioAtual.toISOString())
      .eq('data_fim', fimAtual.toISOString())
      .order('criado_em', { ascending: false })
      .limit(1);
      
    if (relatoriosExistentes && relatoriosExistentes.length > 0 && !req.body.forcarNovo) {
       return res.json({ texto: relatoriosExistentes[0].texto, dados: relatoriosExistentes[0].dados, criado_em: relatoriosExistentes[0].criado_em, cache: true });
    }


    // 1. Vendas Atual
    const { data: vendasAtual, error: errVAtual } = await supabase
      .from('venda')
      .select('id, total, custo_total, taxa, criado_em, forma_pagamento')
      .eq('empresa_id', empresaId)
      .gte('criado_em', inicioAtual.toISOString())
      .lte('criado_em', fimAtual.toISOString());

    // 2. Vendas Anterior (apenas para faturamento)
    const { data: vendasAnterior, error: errVAnterior } = await supabase
      .from('venda')
      .select('total')
      .eq('empresa_id', empresaId)
      .gte('criado_em', inicioAnterior.toISOString())
      .lte('criado_em', fimAnterior.toISOString());

    // 3. Perdas Atual
    const { data: perdasAtual, error: errPAtual } = await supabase
      .from('movimento')
      .select('quantidade, custo_unit, motivo')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'perda')
      .gte('criado_em', inicioAtual.toISOString())
      .lte('criado_em', fimAtual.toISOString());

    // 4. Itens vendidos Atual (para ranking)
    // Para simplificar, buscamos os itens cujas vendas ocorreram no período
    const { data: itensVenda, error: errItens } = await supabase
      .from('venda_item')
      .select(`
        venda_id, produto_id, quantidade, preco_unit, custo_unit, desconto_unit,
        venda!inner(criado_em, empresa_id),
        produto(nome)
      `)
      .eq('venda.empresa_id', empresaId)
      .gte('venda.criado_em', inicioAtual.toISOString())
      .lte('venda.criado_em', fimAtual.toISOString());

    // 5. Estoque e Giro
    const { data: estoque, error: errEst } = await supabase
      .from('v_estoque')
      .select('produto_id, saldo, valor_custo')
      .eq('empresa_id', empresaId);
      
    const { data: giro, error: errGir } = await supabase
      .from('v_giro')
      .select('produto_id, vendido_30d, media_dia')
      .eq('empresa_id', empresaId);
      
    const { data: produtos } = await supabase
      .from('produto')
      .select('id, nome, ativo')
      .eq('empresa_id', empresaId);

    // Calcular Métricas
    let fatAtual = 0, custoAtual = 0, taxaAtual = 0;
    (vendasAtual || []).forEach(v => {
      fatAtual += Number(v.total || 0);
      custoAtual += Number(v.custo_total || 0);
      taxaAtual += Number(v.taxa || 0);
    });

    let fatAnterior = 0;
    (vendasAnterior || []).forEach(v => {
      fatAnterior += Number(v.total || 0);
    });

    let totalPerdas = 0;
    const perdasPorMotivo: Record<string, number> = {};
    (perdasAtual || []).forEach(p => {
      const valor = Number(p.quantidade || 0) * Number(p.custo_unit || 0);
      totalPerdas += valor;
      const motivo = p.motivo || 'outros';
      perdasPorMotivo[motivo] = (perdasPorMotivo[motivo] || 0) + valor;
    });

    const lucroBruto = fatAtual - custoAtual - taxaAtual - totalPerdas;

    // Horários e Pagamentos
    const pagamentos: Record<string, number> = {};
    const horarios: Record<string, number> = {};
    
    (vendasAtual || []).forEach(v => {
      const fp = v.forma_pagamento || 'Outro';
      pagamentos[fp] = (pagamentos[fp] || 0) + Number(v.total || 0);
      
      if (v.criado_em) {
        const d = new Date(v.criado_em);
        const hora = d.getHours();
        horarios[hora] = (horarios[hora] || 0) + Number(v.total || 0);
      }
    });

    // Ranking de produtos (Top 3), descontos e afins
    const lucroPorProduto: Record<string, { nome: string; lucro: number, quantidade: number, receita: number }> = {};
    const descontoPorProduto: Record<string, { nome: string; desconto: number }> = {};
    let totalDescontos = 0;
    
    (itensVenda || []).forEach((item: any) => {
      const pid = item.produto_id;
      const qtde = Number(item.quantidade || 0);
      const precoUnit = Number(item.preco_unit || 0);
      const custoUnit = Number(item.custo_unit || 0);
      const descontoUnit = Number(item.desconto_unit || 0);
      
      const lucroItem = qtde * (precoUnit - custoUnit);
      const descItem = qtde * descontoUnit;
      
      const pNome = Array.isArray(item.produto) ? item.produto[0]?.nome : item.produto?.nome;
      const nomeProduto = pNome || 'Desconhecido';
      
      if (!lucroPorProduto[pid]) {
        lucroPorProduto[pid] = { nome: nomeProduto, lucro: 0, quantidade: 0, receita: 0 };
      }
      lucroPorProduto[pid].lucro += lucroItem;
      lucroPorProduto[pid].quantidade += qtde;
      lucroPorProduto[pid].receita += (qtde * precoUnit);
      
      if (descItem > 0) {
        totalDescontos += descItem;
        if (!descontoPorProduto[pid]) {
           descontoPorProduto[pid] = { nome: nomeProduto, desconto: 0 };
        }
        descontoPorProduto[pid].desconto += descItem;
      }
    });
    
    const quantidadeVendas = (vendasAtual || []).length;
    const ticketMedio = quantidadeVendas > 0 ? (fatAtual / quantidadeVendas) : 0;
    
    const topProdutosDesconto = Object.values(descontoPorProduto)
      .sort((a, b) => b.desconto - a.desconto)
      .slice(0, 3);


    const top3Produtos = Object.values(lucroPorProduto)
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 3);

    // Ruptura e Dinheiro Parado
    const giroMap = new Map();
    (giro || []).forEach(g => giroMap.set(g.produto_id, g));
    
    const prodMap = new Map();
    (produtos || []).forEach(p => prodMap.set(p.id, p));

    const produtosRuptura: string[] = [];
    let dinheiroParado = 0;

    (estoque || []).forEach(e => {
      const g = giroMap.get(e.produto_id);
      const p = prodMap.get(e.produto_id);
      if (!p || p.ativo === false) return; // Ignora inativos se houver

      const saldo = Number(e.saldo || 0);
      const valorCusto = Number(e.valor_custo || 0);
      const vendido30d = Number(g?.vendido_30d || 0);
      const mediaDia = Number(g?.media_dia || 0);

      // Ruptura
      if (saldo <= 0 && vendido30d > 0) {
        produtosRuptura.push(p.nome);
      }

      // Parado
      if (saldo > 0) {
        const cobertura = mediaDia > 0 ? (saldo / mediaDia) : Infinity;
        if (cobertura > 60) {
          dinheiroParado += valorCusto;
        }
      }
    });

    const dados = {
      tipoRelatorio: tipo,
      dataInicio: inicioAtual.toISOString(),
      dataFim: fimAtual.toISOString(),
      faturamentoAtual: fatAtual,
      faturamentoAnterior: fatAnterior,
      custoMercadorias: custoAtual,
      taxasMaquininha: taxaAtual,
      lucroBruto,
      totalPerdas,
      perdasPorMotivo,
      top3ProdutosLucro: top3Produtos,
      produtosEsgotadosQueTinhamGiro: produtosRuptura.slice(0, 10), // Limitando para não sobrecarregar
      dinheiroParado,
      totalDescontos,
      topProdutosDesconto,
      quantidadeVendas,
      ticketMedio,
      pagamentos,
      horarios,
      produtosDetalhe: Object.values(lucroPorProduto)
    };

    const prompt = `
# ROLE (PAPEL EXCLUSIVO)
Você é o "Analista Financeiro Sênior" da aba Relatórios de um sistema de gestão varejista. Sua ÚNICA função é analisar dados de vendas de um período específico e gerar insights acionáveis. Você NÃO tem acesso a outras abas, NÃO modifica estoque, NÃO altera compras. Seu escopo é 100% limitado aos dados de vendas recebidos.

# OBJETIVO
Receber dados brutos de vendas (que podem estar incompletos ou mal formatados) e retornar APENAS um JSON estruturado com:
1. Resumo executivo (máx. 20 palavras).
2. Exatamente 3 insights estratégicos cruzando variáveis.
3. Recomendação geral (máx. 20 palavras).

# REGRAS DE RESILIÊNCIA (CRÍTICO PARA EVITAR ERROS)
1. SE data_inicio/data_fim estiverem mal formatadas ou ausentes: IGNORE as datas. Use "No período analisado" no resumo. NUNCA trave ou invente datas.
2. SE faturamento_bruto == 0 ou < 50: Gere insight de "Alerta Operacional". Ex: "Vendas abaixo do esperado. Verifique se o caixa estava aberto."
3. SE campos opcionais (produtos/descontos) estiverem ausentes: PULE silenciosamente os insights que dependem deles. Gere apenas insights possíveis com dados disponíveis.
4. SE ticket_medio for anormal (< 10 ou > 200): Destaque como ponto de atenção especial.
5. NUNCA sugira ações fora do escopo de relatórios (ex: "compre mais estoque", "cadastre produtos"). Foque APENAS em análise de vendas passadas.

# LÓGICA DE INSIGHTS ESTRATÉGICOS (OBRIGATÓRIO GERAR 3)

## 💡 INSIGHT 1: EFICIÊNCIA DO TICKET MÉDIO
- Analise ticket_medio vs faturamento_bruto vs total_vendas.
- Se ticket < 30: "Ticket baixo. Sugestão: Crie combos ou exponha itens de impulso próximo ao caixa."
- Se ticket entre 30-60: "Ticket saudável. Mantenha mix atual. Teste upselling leve ('leva mais um por R$ X')."
- Se ticket > 60: "Ticket excelente! Foque em fidelização, não em desconto."

## ⚠️ INSIGHT 2: CONCENTRAÇÃO DE RISCO
- Calcule % do faturamento por horário e forma de pagamento.
- SE algum horário > 40% do total: "Risco de concentração horária. [X]% das vendas vêm das [HORA]. Crie promoções em horários mortos para diluir risco."
- SE alguma forma de pagamento > 50%: "Dependência de [FORMA]. Tenha plano B (ex: Pix QR code impresso) caso falhe."
- SE distribuição equilibrada: "Distribuição saudável. Baixo risco operacional."

## 🏆 INSIGHT 3: HERÓIS VS VILÕES (OU BÔNUS)
- SE tiver top_produtos: Compare produto mais vendido em QTD vs. maior receita.
  - Se diferentes: "[PRODUTO A] vende mais unidades, mas [PRODUTO B] traz mais dinheiro. Exponha B no nível dos olhos."
  - Se iguais: "Campeão de volume também é campeão de receita. Proteja esse estoque."
- SE tiver descontos_totais E descontos > 10% do faturamento: "Descontos comem [X]% do faturamento. Limite a itens com margem > 40%."
- SE não tiver produtos nem descontos: PULE e gere bônus: "Pix representa [X]% das vendas. Incentive com benefício simbólico para reduzir custo de maquininha."

# FORMATO DE SAÍDA (JSON ESTRICTO - SEM MARKDOWN)
Retorne APENAS este JSON. Nada antes, nada depois:

{
  "resumo_executivo": "Frase única, direta, máximo 20 palavras.",
  "insights": [
    {
      "titulo": "🎯 Ticket Médio: R$ XX,XX",
      "analise": "Texto explicativo curto (máx. 25 palavras)",
      "acao_pratica": "O que fazer AGORA (máx. 15 palavras)"
    },
    {
      "titulo": "⚠️ Concentração de Risco",
      "analise": "...",
      "acao_pratica": "..."
    },
    {
      "titulo": "🏆 Herói vs Vilão",
      "analise": "...",
      "acao_pratica": "..."
    }
  ],
  "recomendacao_geral": "Frase final motivacional ou de alerta (máx. 20 palavras)"
}

# TOM DE VOZ
- Profissional, empático, direto. Como consultor sentado ao lado do dono.
- Emojis apenas nos títulos dos insights.
- Foco total em AÇÃO PRÁTICA. Cada insight termina com "faça isso".
- Linguagem simples. Zero jargões contábeis sem explicação.
- NUNCA mencione outras abas do sistema. Escopo 100% relatórios.

Dados do período a analisar: ${JSON.stringify(dados, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

        const textoRelatorio = response.text;
    const dataCriacao = new Date().toISOString();

    if (relatoriosExistentes && relatoriosExistentes.length > 0) {
      await supabase.from('relatorio').update({
        texto: textoRelatorio,
        dados: dados,
        criado_em: dataCriacao
      }).eq('id', relatoriosExistentes[0].id);
    } else {
      await supabase.from('relatorio').insert({
        empresa_id: empresaId,
        tipo: tipo,
        data_inicio: inicioAtual.toISOString(),
        data_fim: fimAtual.toISOString(),
        texto: textoRelatorio,
        dados: dados,
        criado_em: dataCriacao
      });
    }

    return res.json({ texto: textoRelatorio, dados: dados, criado_em: dataCriacao });
  } catch (error: any) {
    console.error('Erro na geração do relatório:', error);
    
    const isModelUnavailable = 
      error.status === 404 || 
      (error.message && error.message.toLowerCase().includes('is no longer available')) ||
      (error.message && error.message.toLowerCase().includes('not found'));
      
    if (isModelUnavailable) {
      return res.status(404).json({ error: 'O modelo de IA configurado não está mais disponível. Atualize a variável GEMINI_MODEL.' });
    }
    
    res.status(500).json({ error: error.message || 'Erro interno ao gerar relatório' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
