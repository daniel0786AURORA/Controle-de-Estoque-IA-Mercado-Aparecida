import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { TabRota } from '../types';
import { 
  formatarMoeda, 
  formatarQuantidade, 
  formatarPercentual, 
  calcularMargem,
  obterInicioDoDiaSP 
} from '../utils/formatters';
import { 
  differenceInDays, 
  startOfDay, 
  parseISO 
} from 'date-fns';
import { 
  Boxes, 
  CircleDollarSign, 
  CalendarClock, 
  Truck, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight, 
  ShieldAlert, 
  PackageX,
  ArrowUpRight,
  SunMedium
} from 'lucide-react';

interface PainelPageProps {
  aoNavegar?: (rota: TabRota) => void;
}

// Item urgente para a tabela "Precisa da sua atenção hoje"
interface ItemAtencao {
  id: string;
  tipo: 'falta' | 'validade';
  produtoId: string;
  nome: string;
  categoriaNome: string;
  unidade: string;
  diasGravidade: number; // Menor valor = mais crítico
  descricaoUrgencia: string;
  detalheFinanceiro: string;
  rotaDestino: TabRota;
  caminhoDestino: string;
  textoBotao: string;
}

// Item para a tabela dos top 6 lucros
interface ItemTopLucro {
  id: string;
  nome: string;
  categoriaNome: string;
  unidade: string;
  vendido30d: number;
  margemPercentual: number | null;
  lucroTotal: number;
}

export const PainelPage: React.FC<PainelPageProps> = ({ aoNavegar }) => {
  const { papel, empresaId } = useAuth();
  const ehDono = papel === 'dono';

  // Estados de dados
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Linha de hoje
  const [vendasHoje, setVendasHoje] = useState({
    total: 0,
    quantidade: 0,
    lucroBruto: 0,
  });

  // Cartões Principais
  const [valorEstoqueCusto, setValorEstoqueCusto] = useState<number>(0);
  const [dinheiroParado, setDinheiroParado] = useState<number>(0);
  const [valorVencendo15d, setValorVencendo15d] = useState<number>(0);
  const [qtdItensVaoFaltar, setQtdItensVaoFaltar] = useState<number>(0);

  // Tabelas
  const [itensAtencaoHoje, setItensAtencaoHoje] = useState<ItemAtencao[]>([]);
  const [topLucro30d, setTopLucro30d] = useState<ItemTopLucro[]>([]);

  // Função central de navegação
  const navegarPara = useCallback((rota: TabRota, caminhoFallback: string) => {
    if (aoNavegar) {
      aoNavegar(rota);
    } else {
      window.history.pushState({}, '', caminhoFallback);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [aoNavegar]);

  // Carregamento de todos os dados consolidados
  const carregarDadosPainel = useCallback(async () => {
    if (!empresaId) return;

    try {
      setCarregando(true);
      setErro(null);

      const hoje = startOfDay(new Date());
      const inicioDiaISO = obterInicioDoDiaSP();

      // Consultas paralelas no Supabase
      const [
        { data: vendasHojeData, error: errVendasHoje },
        { data: produtosData, error: errProd },
        { data: categoriasData, error: errCat },
        { data: estoqueData, error: errEstoque },
        { data: giroData, error: errGiro },
        { data: lotesData, error: errLotes },
        { data: movimentosVendaData, error: errMovimentos }
      ] = await Promise.all([
        // 1. Vendas de hoje
        supabase
          .from('venda')
          .select('id, total, custo_total, criado_em')
          .eq('empresa_id', empresaId)
          .gte('criado_em', inicioDiaISO),

        // 2. Produtos
        supabase
          .from('produto')
          .select('id, empresa_id, ean, nome, categoria_id, unidade, custo, preco, ativo')
          .eq('empresa_id', empresaId),

        // 3. Categorias
        supabase
          .from('categoria')
          .select('id, nome')
          .eq('empresa_id', empresaId),

        // 4. Saldo e valor de estoque por produto
        supabase
          .from('v_estoque')
          .select('produto_id, saldo, valor_custo')
          .eq('empresa_id', empresaId),

        // 5. Giro por produto
        supabase
          .from('v_giro')
          .select('produto_id, vendido_30d, media_dia')
          .eq('empresa_id', empresaId),

        // 6. Lotes com validade
        supabase
          .from('lote')
          .select('id, produto_id, validade, custo')
          .eq('empresa_id', empresaId)
          .not('validade', 'is', null),

        // 7. Últimas movimentações de venda (para cálculo preciso de dinheiro parado)
        supabase
          .from('movimento')
          .select('produto_id, criado_em')
          .eq('empresa_id', empresaId)
          .eq('tipo', 'venda')
          .order('criado_em', { ascending: false })
      ]);

      if (errVendasHoje) throw errVendasHoje;
      if (errProd) throw errProd;
      if (errCat) throw errCat;
      if (errEstoque) throw errEstoque;
      if (errGiro) throw errGiro;
      if (errLotes) throw errLotes;
      if (errMovimentos) throw errMovimentos;

      // -------------------------------------------------------------
      // 1. LINHA DE HOJE (Vendas, Qtd e Lucro Bruto)
      // -------------------------------------------------------------
      let totalVendidoHoje = 0;
      let lucroBrutoHoje = 0;
      const qtdVendasHoje = vendasHojeData?.length || 0;

      vendasHojeData?.forEach(v => {
        const total = Number(v.total || 0);
        const custoTotal = Number(v.custo_total || 0);
        totalVendidoHoje += total;
        lucroBrutoHoje += (total - custoTotal);
      });

      setVendasHoje({
        total: totalVendidoHoje,
        quantidade: qtdVendasHoje,
        lucroBruto: lucroBrutoHoje
      });

      // -------------------------------------------------------------
      // MAPEAMENTOS AUXILIARES
      // -------------------------------------------------------------
      const catMap = new Map<string, string>();
      categoriasData?.forEach(c => catMap.set(c.id, c.nome));

      const estoqueMap = new Map<string, { saldo: number; valor_custo: number }>();
      let totalValorEstoqueGeral = 0;
      estoqueData?.forEach(e => {
        const s = Number(e.saldo || 0);
        const vc = Number(e.valor_custo || 0);
        estoqueMap.set(e.produto_id, { saldo: s, valor_custo: vc });
        if (s > 0) {
          totalValorEstoqueGeral += vc;
        }
      });
      setValorEstoqueCusto(totalValorEstoqueGeral);

      const giroMap = new Map<string, { vendido_30d: number; media_dia: number }>();
      giroData?.forEach(g => {
        giroMap.set(g.produto_id, {
          vendido_30d: Number(g.vendido_30d || 0),
          media_dia: Number(g.media_dia || 0)
        });
      });

      const ultimaVendaMap = new Map<string, string>();
      movimentosVendaData?.forEach(m => {
        if (!ultimaVendaMap.has(m.produto_id) && m.criado_em) {
          ultimaVendaMap.set(m.produto_id, m.criado_em);
        }
      });

      const produtosMap = new Map<string, any>();
      (produtosData || []).forEach(p => produtosMap.set(p.id, p));

      // -------------------------------------------------------------
      // 2. DINHEIRO PARADO (> 60 dias)
      // -------------------------------------------------------------
      let somaDinheiroParado = 0;

      (produtosData || []).forEach(prod => {
        const est = estoqueMap.get(prod.id);
        const saldo = est?.saldo || 0;
        if (saldo <= 0) return;

        const custo = Number(prod.custo || 0);
        const valorCusto = est?.valor_custo ?? (saldo * custo);
        const giro = giroMap.get(prod.id);
        const mediaDia = giro?.media_dia || 0;

        const ultimaVenda = ultimaVendaMap.get(prod.id) || null;
        let diasSemVenda = Infinity;
        if (ultimaVenda) {
          diasSemVenda = differenceInDays(hoje, startOfDay(parseISO(ultimaVenda)));
        }

        const cobertura = mediaDia > 0 ? (saldo / mediaDia) : Infinity;
        const isParado = cobertura > 45 || diasSemVenda > 45 || !ultimaVenda;

        if (isParado) {
          somaDinheiroParado += valorCusto;
        }
      });
      setDinheiroParado(somaDinheiroParado);

      // -------------------------------------------------------------
      // 3. VALOR VENCENDO NOS PRÓXIMOS 15 DIAS & LOTES CRÍTICOS
      // -------------------------------------------------------------
      let somaVencendo15d = 0;
      const lotesAtencao: ItemAtencao[] = [];

      (lotesData || []).forEach(lote => {
        if (!lote.validade) return;
        const est = estoqueMap.get(lote.produto_id);
        const saldoProd = est?.saldo || 0;
        if (saldoProd <= 0) return;

        const valDate = startOfDay(parseISO(lote.validade));
        const diasRestantes = differenceInDays(valDate, hoje);

        // Vencendo em até 15 dias (inclui vencidos <= 0 ou até +15)
        if (diasRestantes <= 15) {
          const custoLote = Number(lote.custo || 0);
          const valorRisco = saldoProd * custoLote;
          somaVencendo15d += valorRisco;

          const prod = produtosMap.get(lote.produto_id);
          const nomeProd = prod?.nome || 'Produto sem nome';
          const catNome = prod?.categoria_id ? (catMap.get(prod.categoria_id) || 'Sem categoria') : 'Sem categoria';
          const unidade = prod?.unidade || 'UN';

          let textoUrgencia = '';
          if (diasRestantes < 0) {
            const diasVencido = Math.abs(diasRestantes);
            textoUrgencia = `Vencido há ${diasVencido} ${diasVencido === 1 ? 'dia' : 'dias'}`;
          } else if (diasRestantes === 0) {
            textoUrgencia = 'Vence hoje';
          } else {
            textoUrgencia = `Vence em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`;
          }

          lotesAtencao.push({
            id: `lote-${lote.id}`,
            tipo: 'validade',
            produtoId: lote.produto_id,
            nome: nomeProd,
            categoriaNome: catNome,
            unidade,
            diasGravidade: diasRestantes,
            descricaoUrgencia: textoUrgencia,
            detalheFinanceiro: `${formatarMoeda(valorRisco)} em risco`,
            rotaDestino: 'validade',
            caminhoDestino: '/validade',
            textoBotao: 'Ver validade'
          });
        }
      });
      setValorVencendo15d(somaVencendo15d);

      // -------------------------------------------------------------
      // 4. ITENS QUE VÃO FALTAR (cobertura < 7 dias e media_dia > 0.3)
      // -------------------------------------------------------------
      let contagemItensFalta = 0;
      const produtosFaltaAtencao: ItemAtencao[] = [];

      (produtosData || []).forEach(prod => {
        // Apenas produtos ativos
        if (prod.ativo === false) return;

        const giro = giroMap.get(prod.id);
        const mediaDia = giro?.media_dia || 0;

        // Regra do painel: media_dia acima de 0,3
        if (mediaDia > 0.3) {
          const est = estoqueMap.get(prod.id);
          const saldo = est?.saldo || 0;
          const cobertura = mediaDia > 0 ? (saldo / mediaDia) : 0;

          // Regra do painel: cobertura abaixo de 7 dias
          if (cobertura < 7) {
            contagemItensFalta += 1;

            const custo = Number(prod.custo || 0);
            const preco = Number(prod.preco || 0);
            const margemUnitaria = Math.max(0, preco - custo);
            const lucroEmJogoDia = mediaDia * margemUnitaria;

            const catNome = prod.categoria_id ? (catMap.get(prod.categoria_id) || 'Sem categoria') : 'Sem categoria';
            const unidade = prod.unidade || 'UN';

            let textoUrgencia = '';
            if (saldo <= 0) {
              textoUrgencia = 'Estoque esgotado (0 dias)';
            } else {
              const diasInt = Math.floor(cobertura);
              textoUrgencia = `${diasInt} ${diasInt === 1 ? 'dia' : 'dias'} de cobertura`;
            }

            produtosFaltaAtencao.push({
              id: `falta-${prod.id}`,
              tipo: 'falta',
              produtoId: prod.id,
              nome: prod.nome,
              categoriaNome: catNome,
              unidade,
              diasGravidade: Math.max(0, cobertura),
              descricaoUrgencia: textoUrgencia,
              detalheFinanceiro: `${formatarMoeda(lucroEmJogoDia)}/dia em jogo`,
              rotaDestino: 'compras',
              caminhoDestino: '/compras',
              textoBotao: 'Fazer pedido'
            });
          }
        }
      });
      setQtdItensVaoFaltar(contagemItensFalta);

      // -------------------------------------------------------------
      // 5. CONSOLIDAÇÃO DA TABELA "PRECISA DA SUA ATENÇÃO HOJE"
      // Ordenação por gravidade: menor diasGravidade no topo
      // (vencidos e estoques zerados primeiro)
      // -------------------------------------------------------------
      const listaAtencaoConsolidada = [...lotesAtencao, ...produtosFaltaAtencao];
      listaAtencaoConsolidada.sort((a, b) => a.diasGravidade - b.diasGravidade);
      setItensAtencaoHoje(listaAtencaoConsolidada);

      // -------------------------------------------------------------
      // 6. OS 6 QUE MAIS DERAM LUCRO EM 30 DIAS
      // -------------------------------------------------------------
      const rankingLucro: ItemTopLucro[] = [];

      (produtosData || []).forEach(prod => {
        const giro = giroMap.get(prod.id);
        const vendido30d = giro?.vendido_30d || 0;
        if (vendido30d <= 0) return;

        const custo = Number(prod.custo || 0);
        const preco = Number(prod.preco || 0);
        const lucroUnitario = preco - custo;
        const lucroTotal = vendido30d * lucroUnitario;
        const margemPct = calcularMargem(preco, custo);

        const catNome = prod.categoria_id ? (catMap.get(prod.categoria_id) || 'Sem categoria') : 'Sem categoria';

        if (lucroTotal > 0) {
          rankingLucro.push({
            id: prod.id,
            nome: prod.nome,
            categoriaNome: catNome,
            unidade: prod.unidade || 'UN',
            vendido30d,
            margemPercentual: margemPct,
            lucroTotal
          });
        }
      });

      rankingLucro.sort((a, b) => b.lucroTotal - a.lucroTotal);
      setTopLucro30d(rankingLucro.slice(0, 6));

    } catch (err: any) {
      console.error('Erro ao carregar dados do painel:', err);
      setErro('Não foi possível carregar o resumo executivo do painel.');
    } finally {
      setCarregando(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregarDadosPainel();
  }, [carregarDadosPainel]);

  // Se o usuário não for dono, bloqueia a visualização
  if (!ehDono) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white p-8 rounded-2xl border border-[#14211C]/15 shadow-sm text-center max-w-md">
          <div className="w-14 h-14 bg-[#C4361A]/10 text-[#C4361A] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#14211C] mb-2">Acesso Restrito ao Dono</h2>
          <p className="text-sm text-[#14211C]/70 leading-relaxed">
            O painel de abertura e controle executivo é exclusivo para a administração da empresa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">

      {/* ------------------------------------------------------------- */}
      {/* LINHA DE HOJE (no topo, discreta e executiva) */}
      {/* ------------------------------------------------------------- */}
      <div 
        id="painel-linha-hoje"
        className="bg-white px-4 py-3 rounded-xl border border-[#14211C]/15 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
      >
        <div className="flex items-center gap-2 text-[#14211C]/80 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0E7A4F] animate-pulse"></span>
          <span className="font-semibold text-[#14211C] flex items-center gap-1.5">
            <SunMedium className="w-4 h-4 text-[#935A12]" />
            Hoje na Loja:
          </span>
          <span className="text-[#14211C]/60 text-xs hidden md:inline">
            Acompanhamento em tempo real
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[#14211C]/60 font-medium">Vendas de hoje:</span>
            <strong className="text-[#14211C] font-bold text-sm sm:text-base">
              {carregando ? '...' : formatarMoeda(vendasHoje.total)}
            </strong>
          </div>

          <div className="h-3.5 w-px bg-[#14211C]/15 hidden xs:block"></div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#14211C]/60 font-medium">Quantidade:</span>
            <strong className="text-[#14211C] font-bold text-sm sm:text-base">
              {carregando ? '...' : `${vendasHoje.quantidade} ${vendasHoje.quantidade === 1 ? 'venda' : 'vendas'}`}
            </strong>
          </div>

          <div className="h-3.5 w-px bg-[#14211C]/15 hidden xs:block"></div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#14211C]/60 font-medium">Lucro bruto de hoje:</span>
            <strong className={`font-bold text-sm sm:text-base ${vendasHoje.lucroBruto < 0 ? 'text-[#C4361A]' : 'text-[#0E7A4F]'}`}>
              {carregando ? '...' : formatarMoeda(vendasHoje.lucroBruto)}
            </strong>
          </div>
        </div>
      </div>

      {/* Alerta de erro caso ocorra falha */}
      {erro && (
        <div className="p-4 bg-[#C4361A]/10 border border-[#C4361A]/30 rounded-xl text-[#C4361A] text-sm flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CARTÕES PRINCIPAIS — todos clicáveis, levando à tela detalhada */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Cartão 1: Valor do estoque (a preço de custo) → /estoque */}
        <div
          id="cartao-painel-estoque"
          role="button"
          tabIndex={0}
          onClick={() => navegarPara('estoque', '/estoque')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navegarPara('estoque', '/estoque'); }}
          className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm hover:border-[#0E7A4F] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider">
              Valor do estoque
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#EEF1EC] text-[#14211C] flex items-center justify-center group-hover:bg-[#0E7A4F] group-hover:text-white transition-colors">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          
          <div className="text-2xl sm:text-3xl font-bold text-[#14211C] my-1">
            {carregando ? (
              <div className="h-9 bg-[#14211C]/10 rounded w-32 animate-pulse" />
            ) : (
              formatarMoeda(valorEstoqueCusto)
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#14211C]/60 pt-2 border-t border-[#14211C]/10 mt-2">
            <span>A preço de custo</span>
            <span className="font-semibold text-[#0E7A4F] group-hover:underline flex items-center gap-0.5">
              Ver estoque <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Cartão 2: Dinheiro parado há mais de 60 dias → /parados */}
        <div
          id="cartao-painel-parados"
          role="button"
          tabIndex={0}
          onClick={() => navegarPara('dinheiro-parado', '/parados')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navegarPara('dinheiro-parado', '/parados'); }}
          className="bg-white p-5 rounded-xl border border-[#C4361A]/20 shadow-sm hover:border-[#C4361A] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#C4361A] uppercase tracking-wider">
              Dinheiro parado
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#C4361A]/10 text-[#C4361A] flex items-center justify-center group-hover:bg-[#C4361A] group-hover:text-white transition-colors">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          
          <div className="text-2xl sm:text-3xl font-bold text-[#C4361A] my-1">
            {carregando ? (
              <div className="h-9 bg-[#C4361A]/10 rounded w-32 animate-pulse" />
            ) : (
              formatarMoeda(dinheiroParado)
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#14211C]/60 pt-2 border-t border-[#14211C]/10 mt-2">
            <span>Sem giro &gt; 60 dias</span>
            <span className="font-semibold text-[#C4361A] group-hover:underline flex items-center gap-0.5">
              Liquidar <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Cartão 3: Valor vencendo nos próximos 15 dias → /validade */}
        <div
          id="cartao-painel-validade"
          role="button"
          tabIndex={0}
          onClick={() => navegarPara('validade', '/validade')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navegarPara('validade', '/validade'); }}
          className="bg-white p-5 rounded-xl border border-[#935A12]/20 shadow-sm hover:border-[#935A12] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#935A12] uppercase tracking-wider">
              Vencendo em 15 dias
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#935A12]/10 text-[#935A12] flex items-center justify-center group-hover:bg-[#935A12] group-hover:text-white transition-colors">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          
          <div className="text-2xl sm:text-3xl font-bold text-[#935A12] my-1">
            {carregando ? (
              <div className="h-9 bg-[#935A12]/10 rounded w-32 animate-pulse" />
            ) : (
              formatarMoeda(valorVencendo15d)
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#14211C]/60 pt-2 border-t border-[#14211C]/10 mt-2">
            <span>Próximos 15 dias</span>
            <span className="font-semibold text-[#935A12] group-hover:underline flex items-center gap-0.5">
              Ver lotes <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Cartão 4: Itens que vão faltar → /compras */}
        <div
          id="cartao-painel-compras"
          role="button"
          tabIndex={0}
          onClick={() => navegarPara('compras', '/compras')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navegarPara('compras', '/compras'); }}
          className="bg-white p-5 rounded-xl border border-[#0E7A4F]/30 shadow-sm hover:border-[#0E7A4F] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between bg-gradient-to-br from-white to-[#0E7A4F]/5"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#0E7A4F] uppercase tracking-wider">
              Itens que vão faltar
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#0E7A4F]/10 text-[#0E7A4F] flex items-center justify-center group-hover:bg-[#0E7A4F] group-hover:text-white transition-colors">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          
          <div className="text-2xl sm:text-3xl font-bold text-[#14211C] my-1">
            {carregando ? (
              <div className="h-9 bg-[#0E7A4F]/10 rounded w-20 animate-pulse" />
            ) : (
              `${qtdItensVaoFaltar} ${qtdItensVaoFaltar === 1 ? 'item' : 'itens'}`
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#14211C]/60 pt-2 border-t border-[#14211C]/10 mt-2">
            <span>Cobertura &lt; 7 dias</span>
            <span className="font-semibold text-[#0E7A4F] group-hover:underline flex items-center gap-0.5">
              Fazer pedido <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* PRECISA DA SUA ATENÇÃO HOJE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-[#14211C]/10 bg-[#EEF1EC]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#C4361A]" />
              Precisa da Sua Atenção Hoje
            </h2>
            <p className="text-xs text-[#14211C]/60 mt-0.5">
              Riscos imediatos de falta de estoque e lotes vencendo ordenados por gravidade.
            </p>
          </div>
          {itensAtencaoHoje.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#C4361A]/10 text-[#C4361A] border border-[#C4361A]/20">
              {itensAtencaoHoje.length} {itensAtencaoHoje.length === 1 ? 'ação necessária' : 'ações necessárias'}
            </span>
          )}
        </div>

        <div className="p-0 overflow-x-auto">
          {carregando ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-[#14211C]/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : itensAtencaoHoje.length === 0 ? (
            <div className="p-10 text-center text-[#14211C]/70 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[#0E7A4F] mx-auto" />
              <div className="text-base font-bold text-[#14211C]">
                Nada urgente hoje. Bom dia de vendas.
              </div>
              <p className="text-xs text-[#14211C]/60 max-w-md mx-auto">
                Não há lotes com validade crítica nos próximos 15 dias nem produtos com risco iminente de ruptura.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-[#EEF1EC]/30 text-[#14211C]/70 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-5 py-3.5">Urgência</th>
                  <th className="px-5 py-3.5">Produto</th>
                  <th className="px-5 py-3.5">Categoria</th>
                  <th className="px-5 py-3.5">Diagnóstico</th>
                  <th className="px-5 py-3.5 text-right">Impacto Financeiro</th>
                  <th className="px-5 py-3.5 text-center">Ação Imediata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14211C]/10">
                {itensAtencaoHoje.map(item => {
                  const ehFalta = item.tipo === 'falta';

                  return (
                    <tr key={item.id} className="hover:bg-[#EEF1EC]/40 transition-colors">
                      
                      {/* Tipo / Urgência */}
                      <td className="px-5 py-4">
                        {ehFalta ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C4361A] bg-[#C4361A]/10 border border-[#C4361A]/20 px-2.5 py-1 rounded-md">
                            <PackageX className="w-3.5 h-3.5" />
                            Risco de Falta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#935A12] bg-[#935A12]/10 border border-[#935A12]/20 px-2.5 py-1 rounded-md">
                            <CalendarClock className="w-3.5 h-3.5" />
                            Validade
                          </span>
                        )}
                      </td>

                      {/* Nome do Produto */}
                      <td className="px-5 py-4 font-bold text-[#14211C]">
                        {item.nome}
                      </td>

                      {/* Categoria */}
                      <td className="px-5 py-4 text-[#14211C]/70 text-xs">
                        {item.categoriaNome}
                      </td>

                      {/* Diagnóstico */}
                      <td className="px-5 py-4 text-xs font-medium">
                        <span className={ehFalta ? 'text-[#C4361A] font-semibold' : 'text-[#935A12] font-semibold'}>
                          {item.descricaoUrgencia}
                        </span>
                      </td>

                      {/* Impacto Financeiro */}
                      <td className="px-5 py-4 text-right font-bold text-xs sm:text-sm text-[#14211C]">
                        {item.detalheFinanceiro}
                      </td>

                      {/* Botão de Ação */}
                      <td className="px-5 py-4 text-center">
                        <button
                          id={`btn-acao-${item.id}`}
                          type="button"
                          onClick={() => navegarPara(item.rotaDestino, item.caminhoDestino)}
                          className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all inline-flex items-center gap-1.5 shadow-sm ${
                            ehFalta
                              ? 'bg-[#0E7A4F] text-white hover:bg-[#0b633f] active:bg-[#08492e]'
                              : 'bg-white text-[#935A12] border border-[#935A12]/40 hover:bg-[#935A12]/10 active:bg-[#935A12]/20'
                          }`}
                        >
                          <span>{item.textoBotao}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* OS 6 QUE MAIS DERAM LUCRO EM 30 DIAS */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-[#14211C]/10 bg-[#EEF1EC]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#0E7A4F]" />
              Os 6 Que Mais Deram Lucro em 30 Dias
            </h2>
            <p className="text-xs text-[#14211C]/60 mt-0.5">
              Produtos com maior contribuição de lucro líquido no período recente.
            </p>
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          {carregando ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 bg-[#14211C]/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : topLucro30d.length === 0 ? (
            <div className="p-8 text-center text-[#14211C]/60 text-sm">
              Nenhuma venda com lucro positivo registrada nos últimos 30 dias.
            </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-[#EEF1EC]/30 text-[#14211C]/70 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">Produto</th>
                  <th className="px-5 py-3.5">Categoria</th>
                  <th className="px-5 py-3.5 text-right">Qtd Vendida (30d)</th>
                  <th className="px-5 py-3.5 text-right">Margem %</th>
                  <th className="px-5 py-3.5 text-right">Lucro Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14211C]/10">
                {topLucro30d.map((prod, index) => {
                  const margem = prod.margemPercentual;
                  let badgeMargem = 'bg-[#14211C]/5 text-[#14211C]';
                  if (margem !== null) {
                    if (margem >= 30) {
                      badgeMargem = 'bg-[#0E7A4F]/10 text-[#0E7A4F] border border-[#0E7A4F]/20';
                    } else if (margem >= 20) {
                      badgeMargem = 'bg-[#935A12]/10 text-[#935A12] border border-[#935A12]/20';
                    } else {
                      badgeMargem = 'bg-[#C4361A]/10 text-[#C4361A] border border-[#C4361A]/20';
                    }
                  }

                  return (
                    <tr key={prod.id} className="hover:bg-[#EEF1EC]/40 transition-colors">
                      <td className="px-5 py-3.5 text-xs font-bold text-[#14211C]/40">
                        {index + 1}º
                      </td>
                      <td className="px-5 py-3.5 font-bold text-[#14211C]">
                        {prod.nome}
                      </td>
                      <td className="px-5 py-3.5 text-[#14211C]/70 text-xs">
                        {prod.categoriaNome}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-[#14211C]">
                        {formatarQuantidade(prod.vendido30d, prod.unidade)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${badgeMargem}`}>
                          {formatarPercentual(margem)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-[#0E7A4F] text-base">
                        {formatarMoeda(prod.lucroTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
};
