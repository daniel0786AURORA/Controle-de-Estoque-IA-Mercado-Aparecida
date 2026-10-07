import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Wallet, AlertTriangle, TrendingDown, 
  CircleDollarSign, ShieldAlert, Download, Calendar, Boxes, Tag
} from 'lucide-react';
import { formatarMoeda, formatarDataSP, formatarQuantidade } from '../utils/formatters';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

type Periodo = 'hoje' | '7' | '30' | '90' | 'custom';

interface VendaItem {
  produto_id: string;
  quantidade: number;
  preco_unit: number;
  custo_unit: number;
  desconto_unit: number;
  desconto_origem: 'promocao' | 'caixa' | 'ambos' | null;
  produto: { nome: string };
}

interface Venda {
  id: string;
  total: number;
  custo_total: number;
  taxa: number;
  forma_pagamento: string;
  criado_em: string;
  desconto: number;
  desconto_motivo: string;
  venda_item: VendaItem[];
}

interface Promocao {
  id: string;
  produto_id: string;
  motivo: string;
  inicio: string;
  fim: string;
}

interface Perda {
  id: string;
  quantidade: number;
  custo_unit: number;
  motivo: string;
  criado_em: string;
  produto: {
    nome: string;
  };
}



interface ErrorBoundaryProps { children: React.ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class FinanceiroErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  props: ErrorBoundaryProps;
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Erro no bloco de descontos:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#C4361A]/10 border border-[#C4361A]/30 p-4 rounded-xl text-[#C4361A] text-sm mt-6">
          <strong>Erro ao carregar descontos:</strong> {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}

const formatarFormaPagamento = (forma: string) => {
  const normalizada = String(forma || '').trim().toLowerCase();
  const labels: Record<string, string> = {
    pix: 'Pix',
    fotos: 'Pix',
    dinheiro: 'Dinheiro',
    credito: 'Crédito',
    crédito: 'Crédito',
    debito: 'Débito',
    débito: 'Débito',
  };
  return labels[normalizada] || (forma || 'Outro');
};

const formatarMotivoDesconto = (motivo: string) => {
  const normalizado = String(motivo || '').trim().toLowerCase();
  if (['arredondamento', 'arredondão', 'arredondao'].includes(normalizado)) {
    return 'Ajuste de centavos';
  }
  return motivo || 'Não informado';
};

export const FinanceiroPage: React.FC = () => {
  const { papel, empresaId } = useAuth();
  const ehDono = papel === 'dono';

  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [dataInicio, setDataInicio] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [perdas, setPerdas] = useState<Perda[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [vendaItensDesc, setVendaItensDesc] = useState<any[]>([]);
  const [estoqueGeral, setEstoqueGeral] = useState({
    custoTotal: 0,
    vendaTotal: 0,
    lucroEmbutido: 0,
    qtdCadastrados: 0,
    qtdZerados: 0
  });

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Manipular alteração de período rápido
  useEffect(() => {
    if (periodo === 'custom') return;
    const hoje = new Date();
    let inicio = hoje;
    if (periodo === 'hoje') inicio = hoje;
    else if (periodo === '7') inicio = subDays(hoje, 7);
    else if (periodo === '30') inicio = subDays(hoje, 30);
    else if (periodo === '90') inicio = subDays(hoje, 90);

    setDataInicio(format(inicio, 'yyyy-MM-dd'));
    setDataFim(format(hoje, 'yyyy-MM-dd'));
  }, [periodo]);

  // Carregar Dados
  const carregarDados = useCallback(async () => {
    if (!empresaId) return;
    try {
      setCarregando(true);
      setErro(null);

      const inicioISO = startOfDay(new Date(dataInicio + 'T00:00:00')).toISOString();
      const fimISO = endOfDay(new Date(dataFim + 'T23:59:59')).toISOString();

      // 1. Vendas
      const { data: dadosVendas, error: erroVendas } = await supabase
        .from('venda')
        .select('id, total, custo_total, taxa, forma_pagamento, criado_em')
        .eq('empresa_id', empresaId)
        .gte('criado_em', inicioISO)
        .lte('criado_em', fimISO);

      if (erroVendas) throw erroVendas;

      const { data: dadosPromocoes, error: erroPromocoes } = await supabase
        .from('promocao')
        .select('id, produto_id, motivo, inicio, fim')
        .eq('empresa_id', empresaId);
      if (erroPromocoes) throw erroPromocoes;

      // 1b. Venda Itens para Descontos
      const { data: dadosVendaItens, error: erroVendaItens } = await supabase
        .from('venda_item')
        .select('*, venda!inner(criado_em, empresa_id, desconto, desconto_motivo), produto(nome)')
        .eq('venda.empresa_id', empresaId)
        .gte('venda.criado_em', inicioISO)
        .lte('venda.criado_em', fimISO);

      if (erroVendaItens) throw erroVendaItens;
      console.log('Itens de venda brutos (Descontos):', dadosVendaItens, 'Quantidade:', dadosVendaItens?.length);


      
      // 2. Perdas
      const { data: dadosPerdas, error: erroPerdas } = await supabase
        .from('movimento')
        .select('id, quantidade, custo_unit, motivo, criado_em, produto(nome)')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'perda')
        .gte('criado_em', inicioISO)
        .lte('criado_em', fimISO);

      if (erroPerdas) throw erroPerdas;

      // 3. Estoque Patrimônio (Não depende do período de datas)
      const { data: prods, error: errProds } = await supabase
        .from('produto')
        .select('id, preco')
        .eq('empresa_id', empresaId)
        .eq('ativo', true);

      const { data: ests, error: errEsts } = await supabase
        .from('v_estoque')
        .select('produto_id, saldo, valor_custo')
        .eq('empresa_id', empresaId);

      if (errProds || errEsts) throw errProds || errEsts;

      // Processar Estoque Patrimônio
      let custoTotal = 0;
      let vendaTotal = 0;
      let qtdZerados = 0;
      const precoMap = new Map<string, number>();
      
      if (prods) {
        prods.forEach((p: any) => precoMap.set(p.id, Number(p.preco || 0)));
      }

      if (ests) {
        ests.forEach((e: any) => {
          const saldo = Number(e.saldo || 0);
          const valCusto = Number(e.valor_custo || 0);
          const preco = precoMap.get(e.produto_id) || 0;
          
          if (saldo > 0) {
            custoTotal += valCusto;
            vendaTotal += (saldo * preco);
          } else {
            qtdZerados++;
          }
        });
      }

      setEstoqueGeral({
        custoTotal,
        vendaTotal,
        lucroEmbutido: vendaTotal - custoTotal,
        qtdCadastrados: prods ? prods.length : 0,
        qtdZerados
      });

      setVendas(dadosVendas as Venda[] || []);
      setPerdas(dadosPerdas as unknown as Perda[] || []);
      setPromocoes(dadosPromocoes as unknown as Promocao[] || []);
      setVendaItensDesc(dadosVendaItens || []);

    } catch (err: any) {
      console.error('Erro ao carregar financeiro:', err);
      setErro('Não foi possível carregar os dados financeiros.');
    } finally {
      setCarregando(false);
    }
  }, [empresaId, dataInicio, dataFim]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Cálculos Principais
  const { 
    totalVendas, 
    totalCusto, 
    totalTaxas, 
    totalPerdas, 
    lucroBruto, 
    margemLucro,
    descontos 
  } = useMemo(() => {
    let v = 0;
    let c = 0;
    let t = 0;
    let p = 0;
    
    let totalDesc = 0;
    let promoDesc = 0;
    let caixaDesc = 0;
    
    const mCaixa = new Map<string, { qtd: Set<string>, valor: number }>();
    const mPromo = new Map<string, { qtd: Set<string>, valor: number }>();
    
    const prodsStats = new Map<string, { 
      nome: string, 
      qtdCom: number, qtdSem: number, 
      vendaCom: number, vendaSem: number, 
      custoCom: number, custoSem: number,
      valorDesconto: number 
    }>();

    vendas.forEach(vd => {
      v += Number(vd.total || 0);
      c += Number(vd.custo_total || 0);
      t += Number(vd.taxa || 0);
    });
    
    // Processar descontos usando vendaItensDesc
    vendaItensDesc.forEach(vi => {
      const pId = vi.produto_id;
      if (!prodsStats.has(pId)) {
         prodsStats.set(pId, { 
            nome: vi.produto?.nome || 'Desconhecido',
            qtdCom: 0, qtdSem: 0, 
            vendaCom: 0, vendaSem: 0, 
            custoCom: 0, custoSem: 0,
            valorDesconto: 0 
         });
      }
      
      const stat = prodsStats.get(pId)!;
      let origem = vi.desconto_origem;
      const valDescItem = Number(vi.desconto_unit || 0) * Number(vi.quantidade || 0);
      
      if (valDescItem > 0 && !origem) {
          origem = 'Não informado';
      }

      // 'ambos' needs to be counted only once in totalDesc, but counts towards both promoDesc and caixaDesc?
      // "No caso de 'ambos', conte o valor no total geral uma única vez."
      if (origem === 'promocao' || origem === 'ambos') {
         if (origem === 'promocao') totalDesc += valDescItem;
         promoDesc += valDescItem;
         
         const d = new Date(vi.venda?.criado_em || Date.now());
         const activePromo = promocoes.find(pr => pr.produto_id === pId && new Date(pr.inicio) <= d && new Date(pr.fim) >= d);
         const pMot = activePromo?.motivo || 'Não informado';
         
         if (!mPromo.has(pMot)) mPromo.set(pMot, { qtd: new Set(), valor: 0 });
         mPromo.get(pMot)!.qtd.add(vi.venda_id);
         mPromo.get(pMot)!.valor += valDescItem;
      }
      
      if (origem === 'caixa' || origem === 'ambos' || origem === 'Não informado') {
         if (origem === 'caixa' || origem === 'ambos' || origem === 'Não informado') totalDesc += valDescItem; // ambos is counted once here
         caixaDesc += valDescItem;
         
         const mot = vi.venda?.desconto_motivo || 'Não informado';
         if (!mCaixa.has(mot)) mCaixa.set(mot, { qtd: new Set(), valor: 0 });
         mCaixa.get(mot)!.qtd.add(vi.venda_id);
         mCaixa.get(mot)!.valor += valDescItem;
      }
      
      if (origem) {
         stat.qtdCom += vi.quantidade;
         stat.vendaCom += (vi.preco_unit * vi.quantidade);
         stat.custoCom += (vi.custo_unit * vi.quantidade);
         stat.valorDesconto += valDescItem;
      } else {
         stat.qtdSem += vi.quantidade;
         stat.vendaSem += (vi.preco_unit * vi.quantidade);
         stat.custoSem += (vi.custo_unit * vi.quantidade);
      }
    });
    perdas.forEach(pd => {
      p += Math.abs(Number(pd.quantidade || 0) * Number(pd.custo_unit || 0));
    });

    const bruto = v - c - t - p;
    const margem = v > 0 ? (bruto / v) * 100 : 0;
    
    const arrCaixa = Array.from(mCaixa.entries()).map(([motivo, data]) => ({
       motivo, qtdVendas: data.qtd.size, valor: data.valor, perc: caixaDesc > 0 ? (data.valor / caixaDesc) * 100 : 0
    })).sort((a,b) => b.valor - a.valor);
    
    const arrPromo = Array.from(mPromo.entries()).map(([motivo, data]) => ({
       motivo, qtdVendas: data.qtd.size, valor: data.valor, perc: promoDesc > 0 ? (data.valor / promoDesc) * 100 : 0
    })).sort((a,b) => b.valor - a.valor);
    
    const prodsAnalise = Array.from(prodsStats.values())
      .filter(p => p.valorDesconto > 0)
      .map(p => {
        const margemCom = p.vendaCom > 0 ? ((p.vendaCom - p.custoCom) / p.vendaCom) * 100 : 0;
        const margemSem = p.vendaSem > 0 ? ((p.vendaSem - p.custoSem) / p.vendaSem) * 100 : 0;
        
        let analiseTexto = '';
        let analiseCor = '';
        
        if (p.qtdCom < 5 || p.qtdSem < 5) {
           analiseCor = 'cinza';
           analiseTexto = 'Ainda sem dados suficientes para comparar.';
        } else {
           const dInicio = dataInicio ? new Date(dataInicio).getTime() : Date.now();
           const dFim = dataFim ? new Date(dataFim).getTime() : Date.now();
           const maxDiff = Math.max(dFim - dInicio, 0);
           const diasPeriodo = Math.max(1, Math.round(maxDiff / (1000 * 60 * 60 * 24)) + 1);
           const mediaCom = (p.qtdCom / diasPeriodo).toFixed(1);
           const mediaSem = (p.qtdSem / diasPeriodo).toFixed(1);
           
           if (p.qtdCom > 3 * p.qtdSem && p.qtdCom / (p.qtdCom + p.qtdSem) > 0.6) {
              analiseCor = 'ambar';
              analiseTexto = `${p.nome} praticamente só sai com desconto: ${mediaCom} por dia em promoção contra ${mediaSem} por dia no preço normal. Ou o preço cheio está acima do que o bairro paga, ou o custo de compra está alto. Vale negociar com o fornecedor ou rever o preço.`;
           } else if (Math.max(p.qtdCom, p.qtdSem) > 0 && Math.abs(p.qtdCom - p.qtdSem) / Math.max(p.qtdCom, p.qtdSem) < 0.2) {
              analiseCor = 'vermelho';
              analiseTexto = `${p.nome} vende quase o mesmo com ou sem desconto. Você deixou de ganhar ${p.valorDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})} sem vender mais por isso. Considere parar com o desconto nesse item.`;
           } else if (p.qtdCom > p.qtdSem && margemCom > 0) {
              analiseCor = 'verde';
              analiseTexto = `${p.nome} respondeu bem: vendeu ${p.qtdCom - p.qtdSem} a mais e ainda deixou ${(p.vendaCom - p.custoCom).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})} de lucro.`;
           } else {
              analiseCor = 'cinza';
              analiseTexto = `O desconto trouxe resultados mistos para ${p.nome}.`;
           }
        }
        
        return {
           ...p,
           margemCom,
           margemSem,
           analiseTexto,
           analiseCor
        };
      })
      .sort((a,b) => b.valorDesconto - a.valorDesconto);

    return {
      totalVendas: v,
      totalCusto: c,
      totalTaxas: t,
      totalPerdas: p,
      lucroBruto: bruto,
      margemLucro: margem,
      descontos: {
        total: totalDesc,
        promo: promoDesc,
        caixa: caixaDesc,
        percFaturamento: (v + totalDesc) > 0 ? (totalDesc / (v + totalDesc)) * 100 : 0,
        motivosCaixa: arrCaixa,
        motivosPromo: arrPromo,
        produtos: prodsAnalise
      }
    };
  }, [vendas, perdas, promocoes, dataInicio, dataFim, vendaItensDesc]);

  // Como o dinheiro entrou
  const breakdownPagamentos = useMemo(() => {
    const map = new Map<string, { total: number; taxa: number }>();
    vendas.forEach(v => {
      const p = v.forma_pagamento || 'Outro';
      const cur = map.get(p) || { total: 0, taxa: 0 };
      map.set(p, {
        total: cur.total + Number(v.total || 0),
        taxa: cur.taxa + Number(v.taxa || 0)
      });
    });

    return Array.from(map.entries())
      .map(([forma, valores]) => ({
        forma,
        total: valores.total,
        taxa: valores.taxa,
        perc: totalVendas > 0 ? (valores.total / totalVendas) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [vendas, totalVendas]);

  // Resumo de perdas por motivo
  const resumoPerdas = useMemo(() => {
    const map = new Map<string, number>();
    perdas.forEach(p => {
      const motivo = p.motivo || 'Não informado';
      const valor = Math.abs(Number(p.quantidade || 0) * Number(p.custo_unit || 0));
      map.set(motivo, (map.get(motivo) || 0) + valor);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [perdas]);

  const handleExportarCSV = () => {
    if (vendas.length === 0) return;
    let csv = 'Data;ID Venda;Forma Pagamento;Total;Custo Total;Taxa\n';
    vendas.forEach(v => {
      const data = format(new Date(v.criado_em), 'dd/MM/yyyy HH:mm');
      csv += `${data};${v.id};${v.forma_pagamento};${v.total};${v.custo_total};${v.taxa}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vendas_${dataInicio}_a_${dataFim}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!ehDono) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white p-8 rounded-2xl border border-[#14211C]/15 shadow-sm text-center max-w-md">
          <div className="w-14 h-14 bg-[#C4361A]/10 text-[#C4361A] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#14211C] mb-2">Acesso Restrito ao Dono</h2>
          <p className="text-sm text-[#14211C]/70 leading-relaxed">
            A seção financeira é restrita aos administradores da loja.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14211C] tracking-tight flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-[#0E7A4F]" />
            Financeiro
          </h1>
          <p className="text-xs sm:text-sm text-[#14211C]/70 mt-0.5">
            Visão consolidada de vendas, custos, taxas e margem de lucro
          </p>
        </div>

        {/* Seleção de Período */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: '7', label: '7 dias' },
              { id: '30', label: '30 dias' },
              { id: '90', label: '90 dias' },
              { id: 'custom', label: 'Personalizado' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id as Periodo)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  periodo === p.id
                    ? 'bg-[#0E7A4F] text-white border-[#0E7A4F]'
                    : 'bg-white text-[#14211C]/70 border-[#14211C]/15 hover:bg-[#EEF1EC]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          
          {periodo === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-9 px-3 text-sm rounded-lg border border-[#14211C]/20 focus:ring-[#0E7A4F]"
              />
              <span className="text-[#14211C]/50 text-sm">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-9 px-3 text-sm rounded-lg border border-[#14211C]/20 focus:ring-[#0E7A4F]"
              />
            </div>
          )}
        </div>
      </div>

      {erro && (
        <div className="p-4 bg-[#C4361A]/10 border border-[#C4361A]/30 rounded-xl text-[#C4361A] text-sm">
          {erro}
        </div>
      )}

      {/* Cartões Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Vendas */}
        <div className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm">
          <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block mb-1">
            Vendas no período
          </span>
          <div className="text-xl sm:text-2xl font-bold text-[#14211C]">
            {carregando ? <div className="h-8 bg-[#14211C]/10 rounded w-28 animate-pulse" /> : formatarMoeda(totalVendas)}
          </div>
        </div>

        {/* CMV */}
        <div className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm">
          <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block mb-1">
            Custo da mercadoria
          </span>
          <div className="text-xl sm:text-2xl font-bold text-[#14211C]">
            {carregando ? <div className="h-8 bg-[#14211C]/10 rounded w-28 animate-pulse" /> : formatarMoeda(totalCusto)}
          </div>
        </div>

        {/* Taxas */}
        <div className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm">
          <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block mb-1">
            Taxa da maquininha
          </span>
          <div className="text-xl sm:text-2xl font-bold text-[#C4361A]">
            {carregando ? <div className="h-8 bg-[#14211C]/10 rounded w-28 animate-pulse" /> : formatarMoeda(totalTaxas)}
          </div>
        </div>

        {/* Perdas */}
        <div className="bg-white p-5 rounded-xl border border-[#14211C]/15 shadow-sm">
          <span className="text-xs font-semibold text-[#14211C]/60 uppercase tracking-wider block mb-1">
            Perdas
          </span>
          <div className="text-xl sm:text-2xl font-bold text-[#C4361A]">
            {carregando ? <div className="h-8 bg-[#14211C]/10 rounded w-28 animate-pulse" /> : formatarMoeda(totalPerdas)}
          </div>
        </div>

        {/* Lucro Bruto */}
        <div className={lucroBruto < 0 ? "bg-[#C4361A] p-5 rounded-xl border border-[#C4361A] shadow-sm text-white" : "bg-[#0E7A4F] p-5 rounded-xl border border-[#0E7A4F] shadow-sm text-white"}>
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider block mb-1">
            Lucro Bruto
          </span>
          <div className="text-xl sm:text-2xl font-bold">
            {carregando ? (
              <div className="h-8 bg-white/20 rounded w-28 animate-pulse" />
            ) : (
              <div className="flex items-center gap-2">
                {formatarMoeda(lucroBruto)}
                <span className="text-sm bg-white/20 px-2 py-0.5 rounded text-white font-medium">
                  {margemLucro.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AVISO OBRIGATÓRIO */}
      <div className="bg-[#FDF3DC] p-4 rounded-xl border border-[#F5D796] text-[#935A12] text-sm font-medium shadow-sm">
        Leia com atenção: este número é lucro bruto — já desconta o custo da mercadoria, a taxa da maquininha e as perdas, mas NÃO desconta aluguel, energia, salários, pró-labore e impostos. Não substitui o seu contador.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COMO O DINHEIRO ENTROU */}
        <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#14211C]/10 bg-[#EEF1EC]/40">
            <h2 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5 text-[#0E7A4F]" />
              Como o dinheiro entrou
            </h2>
          </div>
          <div className="p-5 space-y-5 flex-1">
            {carregando ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-[#14211C]/5 rounded animate-pulse" />)}
              </div>
            ) : breakdownPagamentos.length === 0 ? (
              <p className="text-sm text-[#14211C]/50 text-center py-4">Nenhuma venda no período</p>
            ) : (
              breakdownPagamentos.map(item => (
                <div key={item.forma}>
                  <div className="flex justify-between text-sm font-semibold text-[#14211C] mb-1">
                    <span>{formatarFormaPagamento(item.forma)}</span>
                    <span>{formatarMoeda(item.total)} ({item.perc.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-[#EEF1EC] rounded-full h-2.5 mb-1 overflow-hidden">
                    <div 
                      className="bg-[#0E7A4F] h-2.5 rounded-full" 
                      style={{ width: `${item.perc}%` }}
                    />
                  </div>
                  <div className="text-xs text-[#14211C]/50 text-right">
                    Taxa: {formatarMoeda(item.taxa)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DA VENDA AO QUE SOBROU */}
        <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#14211C]/10 bg-[#EEF1EC]/40 flex justify-between items-center">
            <h2 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-[#0E7A4F]" />
              Da venda ao que sobrou
            </h2>
            <button
              onClick={handleExportarCSV}
              className="text-xs flex items-center gap-1.5 font-semibold text-[#0E7A4F] hover:text-[#0b633f] transition-colors bg-[#0E7A4F]/10 px-3 py-1.5 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
          <div className="p-0">
            <table className="w-full text-sm text-left">
              <tbody className="divide-y divide-[#14211C]/10">
                <tr className="hover:bg-[#EEF1EC]/40">
                  <td className="px-5 py-3 font-semibold text-[#14211C]">Vendas no período</td>
                  <td className="px-5 py-3 text-right font-bold text-[#14211C]">{formatarMoeda(totalVendas)}</td>
                  <td className="px-5 py-3 text-right text-[#14211C]/60">100%</td>
                </tr>
                <tr className="hover:bg-[#EEF1EC]/40 text-[#C4361A]">
                  <td className="px-5 py-3">(−) Custo da mercadoria vendida</td>
                  <td className="px-5 py-3 text-right font-medium">{formatarMoeda(totalCusto)}</td>
                  <td className="px-5 py-3 text-right">{totalVendas ? ((totalCusto/totalVendas)*100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="bg-[#14211C]/5 font-semibold">
                  <td className="px-5 py-3">= Lucro sobre a mercadoria</td>
                  <td className="px-5 py-3 text-right">{formatarMoeda(totalVendas - totalCusto)}</td>
                  <td className="px-5 py-3 text-right">{totalVendas ? (((totalVendas - totalCusto)/totalVendas)*100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="hover:bg-[#EEF1EC]/40 text-[#C4361A]">
                  <td className="px-5 py-3">(−) Taxa da maquininha</td>
                  <td className="px-5 py-3 text-right font-medium">{formatarMoeda(totalTaxas)}</td>
                  <td className="px-5 py-3 text-right">{totalVendas ? ((totalTaxas/totalVendas)*100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="hover:bg-[#EEF1EC]/40 text-[#C4361A]">
                  <td className="px-5 py-3">(−) Perdas e quebras</td>
                  <td className="px-5 py-3 text-right font-medium">{formatarMoeda(totalPerdas)}</td>
                  <td className="px-5 py-3 text-right">{totalVendas ? ((totalPerdas/totalVendas)*100).toFixed(1) : 0}%</td>
                </tr>
                <tr className={lucroBruto < 0 ? "bg-[#C4361A]/10 font-bold text-[#C4361A]" : "bg-[#0E7A4F]/10 font-bold text-[#0E7A4F]"}>
                  <td className="px-5 py-3">= Lucro bruto</td>
                  <td className="px-5 py-3 text-right">{formatarMoeda(lucroBruto)}</td>
                  <td className="px-5 py-3 text-right">{margemLucro.toFixed(1)}%</td>
                </tr>
                <tr className="text-[#14211C]/40 italic">
                  <td className="px-5 py-3">
                    (−) Aluguel, luz, salários, impostos
                    <span className="block text-xs font-normal mt-0.5">não controlado aqui</span>
                  </td>
                  <td className="px-5 py-3 text-right">-</td>
                  <td className="px-5 py-3 text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PERDAS DO PERÍODO */}
        <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#14211C]/10 bg-[#EEF1EC]/40">
            <h2 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#C4361A]" />
              Perdas do Período
            </h2>
          </div>
          
          <div className="p-5 space-y-4">
            {/* Resumo por motivo */}
            {resumoPerdas.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4">
                {resumoPerdas.map(([motivo, valor]) => (
                  <div key={motivo} className="px-3 py-2 bg-[#C4361A]/10 border border-[#C4361A]/20 rounded-lg text-sm flex flex-col">
                    <span className="text-[#14211C]/60 text-xs font-semibold uppercase">{motivo}</span>
                    <span className="text-[#C4361A] font-bold">{formatarMoeda(valor)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {perdas.length === 0 ? (
                <p className="text-sm text-[#14211C]/50 text-center py-4">Nenhuma perda no período</p>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-white shadow-[0_1px_0_rgba(20,33,28,0.1)]">
                    <tr className="text-[#14211C]/60 font-semibold uppercase">
                      <th className="pb-2 font-semibold">Data</th>
                      <th className="pb-2 font-semibold">Produto</th>
                      <th className="pb-2 font-semibold">Qtd</th>
                      <th className="pb-2 font-semibold">Motivo</th>
                      <th className="pb-2 font-semibold text-right">Custo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#14211C]/5">
                    {perdas.map(p => (
                      <tr key={p.id} className="hover:bg-[#EEF1EC]/40">
                        <td className="py-2 text-[#14211C]/60 whitespace-nowrap">{format(new Date(p.criado_em), 'dd/MM/yy')}</td>
                        <td className="py-2 font-medium text-[#14211C] line-clamp-1">{p.produto?.nome || 'Desconhecido'}</td>
                        <td className="py-2 text-[#14211C]/80">{formatarQuantidade(Math.abs(p.quantidade))}</td>
                        <td className="py-2 text-[#14211C]/60 capitalize">{p.motivo}</td>
                        <td className="py-2 text-right font-medium text-[#C4361A]">{formatarMoeda(Math.abs(p.quantidade * p.custo_unit))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* PATRIMÔNIO EM MERCADORIA */}
        <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden h-fit">
          <div className="p-5 border-b border-[#14211C]/10 bg-[#EEF1EC]/40">
            <h2 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#0E7A4F]" />
              Patrimônio em Mercadoria
            </h2>
            <p className="text-xs text-[#14211C]/60 mt-1">
              Valor de todo o seu estoque atual
            </p>
          </div>
          <div className="p-0">
            <table className="w-full text-sm text-left">
              <tbody className="divide-y divide-[#14211C]/10">
                <tr className="hover:bg-[#EEF1EC]/40">
                  <td className="px-5 py-3.5 font-semibold text-[#14211C]">Estoque a preço de custo</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#14211C]">{formatarMoeda(estoqueGeral.custoTotal)}</td>
                </tr>
                <tr className="hover:bg-[#EEF1EC]/40">
                  <td className="px-5 py-3.5 font-semibold text-[#14211C]">Estoque a preço de venda</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#0E7A4F]">{formatarMoeda(estoqueGeral.vendaTotal)}</td>
                </tr>
                <tr className="bg-[#0E7A4F]/5">
                  <td className="px-5 py-3.5 font-semibold text-[#0E7A4F]">Lucro embutido no estoque</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#0E7A4F]">{formatarMoeda(estoqueGeral.lucroEmbutido)}</td>
                </tr>
                <tr className="hover:bg-[#EEF1EC]/40">
                  <td className="px-5 py-3 text-[#14211C]/70">Produtos cadastrados</td>
                  <td className="px-5 py-3 text-right font-medium text-[#14211C]">{estoqueGeral.qtdCadastrados}</td>
                </tr>
                <tr className="hover:bg-[#EEF1EC]/40">
                  <td className="px-5 py-3 text-[#14211C]/70">Itens com saldo zerado</td>
                  <td className="px-5 py-3 text-right font-medium text-[#C4361A]">{estoqueGeral.qtdZerados}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* DESCONTOS CONCEDIDOS */}
      <FinanceiroErrorBoundary>
      <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#14211C]/10 bg-[#EEF1EC]/40">
          <h2 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#935A12]" />
            Descontos Concedidos
          </h2>
          <p className="text-xs text-[#14211C]/60 mt-1">
            Análise do impacto dos descontos (promoções e manuais de caixa) no faturamento e lucro.
          </p>
        </div>
        
        <div className="p-5">
          {descontos.total === 0 ? (
            <p className="text-sm text-gray-500 italic text-center py-4">Nenhum desconto concedido neste período.</p>
          ) : (
            <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase">Total no período</span>
              <div className="text-xl font-black text-gray-800">{formatarMoeda(descontos.total)}</div>
              <div className="text-xs font-semibold text-gray-500 mt-1">Representa {descontos.percFaturamento.toFixed(1)}% do faturamento bruto</div>
            </div>
            <div className="bg-[#0E7A4F]/10 p-4 rounded-lg border border-[#0E7A4F]/20">
              <span className="text-xs font-bold text-[#0E7A4F] uppercase">Promoções ativas</span>
              <div className="text-xl font-black text-[#0E7A4F]">{formatarMoeda(descontos.promo)}</div>
            </div>
            <div className="bg-[#935A12]/10 p-4 rounded-lg border border-[#935A12]/20">
              <span className="text-xs font-bold text-[#935A12] uppercase">Desconto no Caixa</span>
              <div className="text-xl font-black text-[#935A12]">{formatarMoeda(descontos.caixa)}</div>
            </div>
            <div className="bg-[#C4361A]/10 p-4 rounded-lg border border-[#C4361A]/20">
              <span className="text-xs font-bold text-[#C4361A] uppercase">Lucro deixado na mesa</span>
              <div className="text-xl font-black text-[#C4361A]">{formatarMoeda(descontos.total)}</div>
              <div className="text-xs font-medium text-[#C4361A] mt-1">Valor reduzido direto do seu bolso</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div>
               <h3 className="text-sm font-bold text-[#14211C] uppercase tracking-wide mb-3">Motivos de Promoção</h3>
               {descontos.motivosPromo.length === 0 ? (
                 <p className="text-sm text-gray-500 italic">Nenhum desconto de promoção.</p>
               ) : (
                 <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50">
                       <tr className="text-gray-500">
                          <th className="p-2 font-semibold">Motivo</th>
                          <th className="p-2 font-semibold text-right">Vendas</th>
                          <th className="p-2 font-semibold text-right">Valor</th>
                          <th className="p-2 font-semibold text-right">%</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {descontos.motivosPromo.map((m, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                             <td className="p-2 font-medium">{formatarMotivoDesconto(m.motivo)}</td>
                             <td className="p-2 text-right">{m.qtdVendas}</td>
                             <td className="p-2 text-right text-[#0E7A4F] font-bold">{formatarMoeda(m.valor)}</td>
                             <td className="p-2 text-right font-medium">{m.perc.toFixed(1)}%</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
               )}
            </div>
            <div>
               <h3 className="text-sm font-bold text-[#14211C] uppercase tracking-wide mb-3">Motivos de Caixa (Manual)</h3>
               {descontos.motivosCaixa.length === 0 ? (
                 <p className="text-sm text-gray-500 italic">Nenhum desconto manual de caixa.</p>
               ) : (
                 <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50">
                       <tr className="text-gray-500">
                          <th className="p-2 font-semibold">Motivo</th>
                          <th className="p-2 font-semibold text-right">Vendas</th>
                          <th className="p-2 font-semibold text-right">Valor</th>
                          <th className="p-2 font-semibold text-right">%</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {descontos.motivosCaixa.map((m, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                             <td className="p-2 font-medium">{m.motivo}</td>
                             <td className="p-2 text-right">{m.qtdVendas}</td>
                             <td className="p-2 text-right text-[#935A12] font-bold">{formatarMoeda(m.valor)}</td>
                             <td className="p-2 text-right font-medium">{m.perc.toFixed(1)}%</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
               )}
            </div>
          </div>
          
          <h3 className="text-sm font-bold text-[#14211C] uppercase tracking-wide mb-3">Produtos que mais receberam desconto</h3>
          {descontos.produtos.length === 0 ? (
             <p className="text-sm text-gray-500 italic">Nenhum produto teve desconto no período.</p>
          ) : (
             <div className="overflow-x-auto mb-8 custom-scrollbar">
                <table className="w-full text-xs text-left min-w-[700px]">
                   <thead className="bg-gray-50 border-y border-gray-200">
                      <tr className="text-gray-500">
                         <th className="p-3 font-semibold">Produto</th>
                         <th className="p-3 font-semibold text-right">Vendidos c/ Desconto</th>
                         <th className="p-3 font-semibold text-right">Vendidos s/ Desconto</th>
                         <th className="p-3 font-semibold text-right">Desconto Total</th>
                         <th className="p-3 font-semibold text-right">Margem Média (com)</th>
                         <th className="p-3 font-semibold text-right">Margem Média (sem)</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                      {descontos.produtos.map((p, i) => (
                         <tr key={i} className="hover:bg-gray-50">
                            <td className="p-3 font-bold text-gray-800">{p.nome}</td>
                            <td className="p-3 text-right font-medium">{p.qtdCom}</td>
                            <td className="p-3 text-right font-medium">{p.qtdSem}</td>
                            <td className="p-3 text-right text-[#C4361A] font-bold">{formatarMoeda(p.valorDesconto)}</td>
                            <td className="p-3 text-right font-medium">{p.margemCom.toFixed(1)}%</td>
                            <td className="p-3 text-right font-medium">{p.margemSem.toFixed(1)}%</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          )}
          
          <div className="bg-[#14211C]/5 rounded-xl p-5 border border-[#14211C]/10">
             <h3 className="text-base font-black text-[#14211C] mb-4">O que isso diz</h3>
             {descontos.produtos.length === 0 ? (
                <p className="text-sm text-gray-600">Nada a analisar no momento.</p>
             ) : (
                <div className="space-y-3">
                   {descontos.produtos.map((p, i) => {
                      let colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
                      if (p.analiseCor === 'ambar') colorClass = 'bg-[#FDF3DC] text-[#935A12] border-[#F5D796]';
                      if (p.analiseCor === 'vermelho') colorClass = 'bg-[#C4361A]/10 text-[#C4361A] border-[#C4361A]/20';
                      if (p.analiseCor === 'verde') colorClass = 'bg-[#0E7A4F]/10 text-[#0E7A4F] border-[#0E7A4F]/20';
                      
                      return (
                         <div key={i} className={`p-4 rounded-lg border text-sm font-medium ${colorClass}`}>
                            {p.analiseTexto}
                         </div>
                      );
                   })}
                </div>
             )}
          </div>
          
        </>
          )}
        </div>
      </div>
      </FinanceiroErrorBoundary>

    </div>
  );
};
