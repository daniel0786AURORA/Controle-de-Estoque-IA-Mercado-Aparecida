import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  ShieldAlert, FileText, Copy, CheckCircle2, AlertTriangle, 
  RefreshCcw, Sparkles, Calendar, ChevronRight, BarChart3, TrendingUp, TrendingDown, Tag,
  Clock, CreditCard, ChevronDown, ChevronUp, Download, Check
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, parseISO, startOfDay, endOfDay, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type TipoRelatorio = 'diario' | 'semanal' | 'mensal';

interface RelatorioHistorico {
  id: string;
  tipo: TipoRelatorio;
  data_inicio: string;
  data_fim: string;
  texto: string;
  dados: any;
  criado_em: string;
}

export const RelatoriosPage: React.FC = () => {
  const { papel, empresaId } = useAuth();
  const ehDono = papel === 'dono';
  
  const [abaAtiva, setAbaAtiva] = useState<TipoRelatorio>('diario');
  const [carregando, setCarregando] = useState<boolean>(false);
  const [relatorioTexto, setRelatorioTexto] = useState<string | null>(null);
  const [relatorioDados, setRelatorioDados] = useState<any | null>(null);
  const [relatorioCriadoEm, setRelatorioCriadoEm] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);
  
  // Date selection states
  const hoje = new Date();
  const [dataDiario, setDataDiario] = useState<string>(format(hoje, 'yyyy-MM-dd'));
  const [dataSemanal, setDataSemanal] = useState<string>(format(subDays(hoje, 6), 'yyyy-MM-dd'));
  const [mesMensal, setMesMensal] = useState<string>(format(hoje, 'yyyy-MM'));
  
  const [historico, setHistorico] = useState<RelatorioHistorico[]>([]);
  
  // Detalhes das vendas
  const [vendas, setVendas] = useState<any[]>([]);
  const [detalhesCarregando, setDetalhesCarregando] = useState(false);
  const [blocoDetalhesAberto, setBlocoDetalhesAberto] = useState(false);
  const [abaDetalhe, setAbaDetalhe] = useState<'resumo' | 'lista'>('resumo');
  const [vendaExpandida, setVendaExpandida] = useState<string | null>(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [showConfirmReplace, setShowConfirmReplace] = useState(false);

  useEffect(() => {
    if (ehDono && empresaId) {
      carregarHistorico();
    }
  }, [ehDono, empresaId]);

  const carregarHistorico = async () => {
    try {
      const { data, error } = await supabase
        .from('relatorio')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('criado_em', { ascending: false });
        
      if (error) throw error;
      setHistorico(data || []);
    } catch (err) {
      console.error('Erro ao carregar historico:', err);
    }
  };

  const getDatasFiltro = () => {
    let inicio: Date, fim: Date;
    try {
      if (abaAtiva === 'diario') {
        const base = parseISO(dataDiario);
        if (isNaN(base.getTime())) throw new Error('Invalid Date');
        inicio = startOfDay(base);
        fim = endOfDay(base);
      } else if (abaAtiva === 'semanal') {
        const base = parseISO(dataSemanal);
        if (isNaN(base.getTime())) throw new Error('Invalid Date');
        inicio = startOfDay(base);
        fim = endOfDay(addDays(base, 6));
      } else {
        const base = parseISO(`${mesMensal}-01`);
        if (isNaN(base.getTime())) throw new Error('Invalid Date');
        inicio = startOfMonth(base);
        fim = endOfMonth(base);
      }
    } catch (e) {
      // Fallback in case of parsing errors
      const today = new Date();
      if (abaAtiva === 'semanal') {
        inicio = startOfDay(subDays(today, 6));
        fim = endOfDay(today);
      } else if (abaAtiva === 'mensal') {
        inicio = startOfMonth(today);
        fim = endOfMonth(today);
      } else {
        inicio = startOfDay(today);
        fim = endOfDay(today);
      }
    }
    return { dataInicio: inicio.toISOString(), dataFim: fim.toISOString(), fimDate: fim };
  };

  // Efeito para verificar relatório existente ao mudar de período
  useEffect(() => {
    if (!empresaId || historico.length === 0) return;
    
    const { dataInicio, dataFim } = getDatasFiltro();
    const existente = historico.find(h => 
      h.tipo === abaAtiva && 
      h.data_inicio === dataInicio && 
      h.data_fim === dataFim
    );

    if (existente) {
      setRelatorioTexto(existente.texto);
      setRelatorioDados(existente.dados);
      setRelatorioCriadoEm(existente.criado_em);
      setErro(null);
    } else {
      setRelatorioTexto(null);
      setRelatorioDados(null);
      setRelatorioCriadoEm(null);
    }
    
    carregarVendasPeriodo(dataInicio, dataFim);
    setPaginaAtual(1);
    setBlocoDetalhesAberto(false);
  }, [abaAtiva, dataDiario, dataSemanal, mesMensal, historico]);

  const carregarVendasPeriodo = async (inicioISO: string, fimISO: string) => {
    try {
      setDetalhesCarregando(true);
      const { data, error } = await supabase
        .from('venda')
        .select(`
          id, total, desconto, forma_pagamento, criado_em,
          venda_item(quantidade, preco_unit, desconto_unit, produto(nome))
        `)
        .eq('empresa_id', empresaId)
        .gte('criado_em', inicioISO)
        .lte('criado_em', fimISO)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setVendas(data || []);
    } catch (err) {
      console.error('Erro ao carregar detalhes das vendas:', err);
    } finally {
      setDetalhesCarregando(false);
    }
  };

  const confirmarGerarRelatorio = () => {
    const { fimDate } = getDatasFiltro();
    const isEncerrado = fimDate.getTime() < startOfDay(new Date()).getTime();
    if (isEncerrado && relatorioTexto) {
      setShowConfirmReplace(true);
    } else {
      gerarRelatorio(true);
    }
  };

  const gerarRelatorio = async (forcarNovo: boolean = false) => {
    if (!empresaId) return;
    
    setShowConfirmReplace(false);
    setCarregando(true);
    setErro(null);
    if (forcarNovo) {
      setRelatorioTexto(null);
      setRelatorioDados(null);
      setRelatorioCriadoEm(null);
    }
    setCopiado(false);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) throw new Error('Sessão expirada. Por favor, faça login novamente.');
      
      const { dataInicio, dataFim } = getDatasFiltro();
      
      const response = await fetch('/api/relatorio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tipo: abaAtiva,
          empresaId,
          dataInicio,
          dataFim,
          forcarNovo
        })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao comunicar com o servidor de IA.');
      }
      
      setRelatorioTexto(data.texto);
      setRelatorioDados(data.dados);
      setRelatorioCriadoEm(data.criado_em || new Date().toISOString());
      
      if (!data.cache) {
         carregarHistorico();
      }
    } catch (err: any) {
      console.error('Erro ao gerar relatorio:', err);
      setErro(err.message || 'Erro inesperado ao gerar relatório. Tente novamente mais tarde.');
    } finally {
      setCarregando(false);
    }
  };

  const visualizarHistorico = (item: RelatorioHistorico) => {
    setAbaAtiva(item.tipo);
    try {
      const parsed = parseISO(item.data_inicio);
      if (!isNaN(parsed.getTime())) {
        if (item.tipo === 'diario') {
           setDataDiario(format(parsed, 'yyyy-MM-dd'));
        } else if (item.tipo === 'semanal') {
           setDataSemanal(format(parsed, 'yyyy-MM-dd'));
        } else if (item.tipo === 'mensal') {
           setMesMensal(format(parsed, 'yyyy-MM'));
        }
      }
    } catch (e) {
      console.error('Invalid date in history item', e);
    }
  };

  const copiarTexto = async () => {
    if (!relatorioTexto) return;
    try {
      await navigator.clipboard.writeText(relatorioTexto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  };

  const formatarMoeda = (valor: number) => {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  
  const obterDataExtenso = (tipo: TipoRelatorio, dados?: any) => {
    try {
      const { dataInicio, dataFim } = getDatasFiltro();
      const inicio = parseISO(dados?.dataInicio || dataInicio);
      const fim = parseISO(dados?.dataFim || dataFim);
      
      if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
        return "Período Analisado";
      }
      
      if (isSameDay(inicio, fim)) {
        return format(inicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      }
      return `${format(inicio, "dd/MM/yyyy")} a ${format(fim, "dd/MM/yyyy")}`;
    } catch (e) {
      return "Período Analisado";
    }
  };

  // --- Lógica do Bloco de Vendas ---
  
  // Resumo por Dia
  const resumoDias = useMemo(() => {
    const map = new Map<string, { faturamento: number, qtd: number }>();
    vendas.forEach(v => {
      let dataStr = v.criado_em;
      try {
        const parsed = parseISO(v.criado_em);
        if (!isNaN(parsed.getTime())) {
          dataStr = format(parsed, 'yyyy-MM-dd');
        }
      } catch (e) {}
      const cur = map.get(dataStr) || { faturamento: 0, qtd: 0 };
      map.set(dataStr, { faturamento: cur.faturamento + Number(v.total), qtd: cur.qtd + 1 });
    });
    const sorted = Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]));
    let maxDia = '';
    let maxVal = -1;
    sorted.forEach(([d, vals]) => {
       if (vals.faturamento > maxVal) { maxVal = vals.faturamento; maxDia = d; }
    });
    return { list: sorted, maxDia };
  }, [vendas]);

  // Resumo por Pagamento
  const resumoPagamento = useMemo(() => {
    const map = new Map<string, number>();
    vendas.forEach(v => {
      const p = v.forma_pagamento || 'Outro';
      map.set(p, (map.get(p) || 0) + Number(v.total));
    });
    return Array.from(map.entries()).sort((a,b) => b[1] - a[1]);
  }, [vendas]);

  // Resumo por Hora
  const resumoHora = useMemo(() => {
    const arr = Array(24).fill(0);
    let max = 0;
    vendas.forEach(v => {
      const h = parseISO(v.criado_em).getHours();
      arr[h] += Number(v.total);
      if (arr[h] > max) max = arr[h];
    });
    return { horas: arr, max };
  }, [vendas]);

  // Paginação
  const itensPorPagina = 50;
  const paginasTotais = Math.ceil(vendas.length / itensPorPagina);
  const vendasPaginadas = vendas.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

  const exportarCSV = () => {
    let csv = 'Data/Hora,Forma de Pagamento,Qtd Itens,Desconto,Total\n';
    vendas.forEach(v => {
      let dh = v.criado_em;
      try {
        const parsed = parseISO(v.criado_em);
        if (!isNaN(parsed.getTime())) {
          dh = format(parsed, 'dd/MM/yyyy HH:mm');
        }
      } catch (e) {}
      const fp = v.forma_pagamento || '';
      const q = v.venda_item?.reduce((acc: number, i: any) => acc + i.quantidade, 0) || 0;
      const d = Number(v.desconto || 0);
      const t = Number(v.total || 0);
      csv += `"${dh}","${fp}",${q},${d.toFixed(2)},${t.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vendas_${abaAtiva}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!ehDono) {
    return (
      <div className="w-full max-w-[1180px] mx-auto p-3 sm:p-4 md:p-5 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white p-6 rounded-2xl border border-[#14211C]/15 shadow-sm text-center max-w-md">
          <div className="w-14 h-14 bg-[#C4361A]/10 text-[#C4361A] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#14211C] mb-2">Acesso Restrito ao Dono</h2>
          <p className="text-sm text-[#14211C]/70 leading-relaxed">
            Os relatórios detalhados com inteligência artificial são exclusivos para a administração da empresa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1180px] mx-auto p-3 sm:p-4 md:p-5 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#14211C] flex items-center gap-2">
            Relatórios Inteligentes
            <Sparkles className="w-5 h-5 text-[#935A12]" />
          </h1>
          <p className="text-[#14211C]/60 text-sm mt-1">
            Resumos rápidos e diretos sobre as vendas, perdas e o que fazer em seguida.
          </p>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Principal */}
        <div className="flex-1 space-y-6">
          <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm p-4 sm:p-6">
            
            {/* Controles: Abas e Datas */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-[#EEF1EC]/40 p-2 rounded-xl border border-[#14211C]/10">
              {/* Abas */}
              <div className="flex bg-white p-1 rounded-lg shadow-sm border border-[#14211C]/5 w-full sm:w-auto">
                {(['diario', 'semanal', 'mensal'] as TipoRelatorio[]).map(tipo => (
                  <button
                    key={tipo}
                    onClick={() => setAbaAtiva(tipo)}
                    className={`flex-1 sm:flex-none text-sm font-semibold capitalize py-2 px-4 rounded-md transition-all ${
                      abaAtiva === tipo 
                      ? 'bg-[#14211C] text-white shadow-sm' 
                      : 'text-[#14211C]/60 hover:text-[#14211C] hover:bg-[#14211C]/5'
                    }`}
                  >
                    {tipo === 'diario' ? 'Diário' : tipo === 'semanal' ? 'Semanal' : 'Mensal'}
                  </button>
                ))}
              </div>
              
              {/* Seletor de Data */}
              <div className="flex items-center gap-2 w-full sm:w-auto bg-white p-1 rounded-lg border border-[#14211C]/10 shadow-sm">
                <Calendar className="w-5 h-5 text-[#14211C]/50 ml-2" />
                {abaAtiva === 'diario' && (
                  <input 
                    type="date" 
                    value={dataDiario}
                    onChange={e => setDataDiario(e.target.value)}
                    className="flex-1 min-h-[40px] px-2 outline-none text-sm font-medium text-[#14211C] bg-transparent"
                  />
                )}
                {abaAtiva === 'semanal' && (
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-xs text-[#14211C]/50 font-medium">Início:</span>
                    <input 
                      type="date" 
                      value={dataSemanal}
                      onChange={e => setDataSemanal(e.target.value)}
                      className="flex-1 min-h-[40px] bg-transparent outline-none text-sm font-medium text-[#14211C]"
                    />
                  </div>
                )}
                {abaAtiva === 'mensal' && (
                  <input 
                    type="month" 
                    value={mesMensal}
                    onChange={e => setMesMensal(e.target.value)}
                    className="flex-1 min-h-[40px] px-2 outline-none text-sm font-medium text-[#14211C] bg-transparent"
                  />
                )}
              </div>
            </div>

            {/* View do Relatório AI */}
            {!relatorioTexto && !carregando && !erro && (
              <div className="text-center py-16 px-4 bg-[#EEF1EC]/20 rounded-xl border border-[#14211C]/10 border-dashed">
                <FileText className="w-12 h-12 text-[#14211C]/20 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#14211C] mb-2">Relatório {abaAtiva}</h3>
                <p className="text-sm text-[#14211C]/60 mb-6">
                  Não há relatório salvo para este período. Gere um agora.
                </p>
                <button
                  onClick={() => gerarRelatorio(true)}
                  className="bg-[#14211C] hover:bg-[#0E7A4F] text-white px-6 py-3 rounded-lg font-bold transition-colors inline-flex items-center gap-2 justify-center"
                >
                  <Sparkles className="w-4 h-4" />
                  Gerar relatório
                </button>
              </div>
            )}

            {carregando && (
              <div className="text-center space-y-4 py-16">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 border-4 border-[#EEF1EC] rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-[#0E7A4F] border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-[#935A12]">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                </div>
                <p className="text-[#14211C] font-semibold animate-pulse">
                  Analisando suas vendas...
                </p>
              </div>
            )}
            
            {erro && !carregando && (
              <div className="text-center max-w-sm mx-auto p-6 bg-[#C4361A]/5 rounded-xl border border-[#C4361A]/20">
                <AlertTriangle className="w-10 h-10 text-[#C4361A] mx-auto mb-3" />
                <h3 className="text-base font-bold text-[#C4361A] mb-2">Ops, algo deu errado</h3>
                <p className="text-sm text-[#C4361A]/80 mb-6">{erro}</p>
                <button
                  onClick={() => gerarRelatorio(true)}
                  className="bg-white border border-[#C4361A]/30 text-[#C4361A] hover:bg-[#C4361A]/10 px-5 py-2.5 rounded-lg font-semibold transition-colors inline-flex items-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Tentar de novo
                </button>
              </div>
            )}
            
            {relatorioTexto && relatorioDados && !carregando && (
              <div className="w-full flex flex-col space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#EEF1EC]/30 p-3 rounded-lg border border-[#14211C]/5">
                   <div className="text-xs text-[#14211C]/60 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Gerado em {(() => {
                        if (!relatorioCriadoEm) return 'agora';
                        try {
                          const p = parseISO(relatorioCriadoEm);
                          if (!isNaN(p.getTime())) return format(p, "dd/MM 'às' HH'h'mm");
                        } catch(e) {}
                        return 'recente';
                      })()}
                   </div>
                   <button
                     onClick={confirmarGerarRelatorio}
                     className="text-xs font-semibold bg-white border border-[#14211C]/15 px-3 py-1.5 rounded text-[#14211C] hover:bg-[#EEF1EC] hover:border-[#14211C]/30 flex items-center gap-1 transition-colors"
                   >
                     <RefreshCcw className="w-3.5 h-3.5" />
                     Atualizar relatório
                   </button>
                </div>
                
                {/* Modal de Confirmação para Atualizar */}
                {showConfirmReplace && (
                  <div className="bg-[#FFF4E5] border border-[#935A12]/30 p-4 rounded-xl flex items-start gap-3">
                     <AlertTriangle className="w-5 h-5 text-[#935A12] flex-shrink-0 mt-0.5" />
                     <div className="flex-1">
                        <h4 className="font-bold text-[#935A12] text-sm">Atualizar relatório passado?</h4>
                        <p className="text-xs text-[#935A12]/80 mt-1 mb-3">
                           Este período já foi encerrado e o relatório salvo é o registro daquele momento. Deseja substituir as conclusões antigas pelas atuais?
                        </p>
                        <div className="flex gap-2">
                           <button 
                             onClick={() => setShowConfirmReplace(false)}
                             className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white text-[#935A12] border border-[#935A12]/20 hover:bg-[#935A12]/5"
                           >
                             Cancelar
                           </button>
                           <button 
                             onClick={() => gerarRelatorio(true)}
                             className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#935A12] text-white hover:bg-[#935A12]/90"
                           >
                             Sim, substituir
                           </button>
                        </div>
                     </div>
                  </div>
                )}
                
                {/* O cupom com o texto */}
                <div className="w-full max-w-[430px] mx-auto flex flex-col space-y-4">
                  <div className="bg-white border border-[#14211C]/20 shadow-md rounded-sm overflow-hidden" style={{ fontFamily: 'monospace' }}>
                    <div className="text-center pt-8 pb-6 px-6 border-b border-dashed border-[#14211C]/30 bg-[#FAFAFA]">
                      <h2 className="text-xl font-bold text-[#14211C] uppercase tracking-widest mb-1">
                        Sua Loja
                      </h2>
                      <p className="text-xs text-[#14211C]/60 font-semibold tracking-wider">
                        RESUMO {abaAtiva.toUpperCase()}
                      </p>
                      <p className="text-[10px] text-[#14211C]/50 mt-1">
                        {obterDataExtenso(abaAtiva, relatorioDados)}
                      </p>
                    </div>
                    <div className="p-6 md:p-8 bg-[#FAFAFA] text-[#14211C]/80 text-[13px] md:text-[14px] leading-relaxed">
                      {(() => {
                        try {
                          const json = JSON.parse(relatorioTexto || '{}');
                          if (json.resumo_executivo || json.insights) {
                            return (
                              <div className="space-y-6">
                                {json.resumo_executivo && (
                                  <div className="border-l-2 border-[#0E7A4F] pl-3 py-1">
                                    <p className="font-semibold text-[#14211C]">{json.resumo_executivo}</p>
                                  </div>
                                )}
                                
                                {json.insights && json.insights.length > 0 && (
                                  <div className="space-y-5">
                                    <h3 className="font-bold text-[#14211C] border-b border-[#14211C]/10 pb-2">💡 O Que Os Números Estão Te Dizendo</h3>
                                    {json.insights.map((insight: any, i: number) => (
                                      <div key={i} className="bg-white p-4 rounded border border-[#14211C]/5 shadow-xs">
                                        <h4 className="font-bold text-[#14211C] mb-2">{insight.titulo}</h4>
                                        <p className="text-[#14211C]/70 mb-3">{insight.analise}</p>
                                        <div className="bg-[#EEF1EC]/50 px-3 py-2 rounded text-xs font-semibold text-[#0E7A4F]">
                                          👉 Ação: {insight.acao_pratica}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {json.recomendacao_geral && (
                                  <div className="mt-6 text-center italic text-[#14211C]/60 text-xs">
                                    "{json.recomendacao_geral}"
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return <div className="whitespace-pre-wrap">{relatorioTexto}</div>;
                        } catch(e) {
                          return <div className="whitespace-pre-wrap">{relatorioTexto}</div>;
                        }
                      })()}
                    </div>
                    <div className="text-center pt-2 pb-6 px-6 bg-[#FAFAFA]">
                      <div className="w-full border-t border-dashed border-[#14211C]/30 mb-4"></div>
                      <p className="text-[10px] text-[#14211C]/40">Gerado por IA</p>
                    </div>
                  </div>
                  <button
                    onClick={copiarTexto}
                    className={`w-full py-3.5 rounded-lg font-bold transition-colors inline-flex items-center justify-center gap-2 ${
                      copiado ? 'bg-[#0E7A4F] text-white' : 'bg-[#EEF1EC] text-[#14211C] hover:bg-[#14211C]/10'
                    }`}
                  >
                    {copiado ? <><CheckCircle2 className="w-5 h-5" /> Copiado!</> : <><Copy className="w-5 h-5" /> Copiar texto</>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* NOVO: Bloco de Detalhes Vendas do Período */}
          {vendas.length > 0 && (
          <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden">
             <button 
                onClick={() => setBlocoDetalhesAberto(!blocoDetalhesAberto)}
                className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
             >
                <div className="flex items-center gap-2">
                   <BarChart3 className="w-5 h-5 text-gray-500" />
                   <h2 className="text-base font-bold text-gray-800">Vendas do período ({vendas.length})</h2>
                </div>
                {blocoDetalhesAberto ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
             </button>
             
             {blocoDetalhesAberto && (
                <div className="p-0">
                   <div className="flex border-b border-gray-200">
                      <button 
                         onClick={() => setAbaDetalhe('resumo')}
                         className={`px-4 py-3 text-sm font-semibold flex-1 sm:flex-none border-b-2 ${abaDetalhe === 'resumo' ? 'border-gray-800 text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                      >
                         Resumos
                      </button>
                      <button 
                         onClick={() => setAbaDetalhe('lista')}
                         className={`px-4 py-3 text-sm font-semibold flex-1 sm:flex-none border-b-2 ${abaDetalhe === 'lista' ? 'border-gray-800 text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                      >
                         Todas as Vendas
                      </button>
                   </div>
                   
                   <div className="p-4 sm:p-6 bg-white">
                      {abaDetalhe === 'resumo' ? (
                         <div className="space-y-8">
                            {/* Resumo por Dia */}
                            <div>
                               <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                                  <Calendar className="w-4 h-4" /> Por Dia
                               </h3>
                               <div className="overflow-x-auto">
                                  <table className="w-full text-sm text-left">
                                     <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                        <tr>
                                           <th className="px-4 py-2 font-semibold">Data</th>
                                           <th className="px-4 py-2 font-semibold">Vendas</th>
                                           <th className="px-4 py-2 font-semibold">Faturamento</th>
                                           <th className="px-4 py-2 font-semibold">Ticket Médio</th>
                                        </tr>
                                     </thead>
                                     <tbody className="divide-y divide-gray-100">
                                        {resumoDias.list.map(([dataStr, vals]) => {
                                           const isMax = dataStr === resumoDias.maxDia;
                                           return (
                                           <tr key={dataStr} className={isMax ? 'bg-green-50/50' : ''}>
                                              <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                                                 {(() => {
                                                   try {
                                                     const p = parseISO(dataStr);
                                                     if (!isNaN(p.getTime())) return format(p, 'dd/MM/yyyy');
                                                   } catch(e) {}
                                                   return dataStr;
                                                 })()}
                                                 {isMax && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase">Pico</span>}
                                              </td>
                                              <td className="px-4 py-3 text-gray-600">{vals.qtd}</td>
                                              <td className="px-4 py-3 font-bold text-gray-900">{formatarMoeda(vals.faturamento)}</td>
                                              <td className="px-4 py-3 text-gray-600">{formatarMoeda(vals.faturamento / vals.qtd)}</td>
                                           </tr>
                                        )})}
                                     </tbody>
                                  </table>
                               </div>
                            </div>
                            
                            {/* Resumo por Forma de Pagamento */}
                            <div>
                               <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                                  <CreditCard className="w-4 h-4" /> Forma de Pagamento
                               </h3>
                               <div className="flex flex-wrap gap-3">
                                  {resumoPagamento.map(([forma, valor]) => (
                                     <div key={forma} className="bg-gray-50 border border-gray-200 p-3 rounded-lg flex-1 min-w-[120px]">
                                        <div className="text-xs text-gray-500 font-semibold capitalize mb-1">{forma}</div>
                                        <div className="text-sm font-black text-gray-800">{formatarMoeda(valor)}</div>
                                     </div>
                                  ))}
                               </div>
                            </div>
                            
                            {/* Resumo por Hora */}
                            <div>
                               <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                                  <Clock className="w-4 h-4" /> Horários de Pico
                               </h3>
                               <div className="space-y-1.5">
                                  {resumoHora.horas.map((val, h) => {
                                     if (val === 0) return null;
                                     const perc = (val / resumoHora.max) * 100;
                                     return (
                                        <div key={h} className="flex items-center gap-3">
                                           <div className="w-12 text-xs font-medium text-gray-500 text-right">{h.toString().padStart(2, '0')}:00</div>
                                           <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden flex items-center relative">
                                              <div className="h-full bg-gray-800" style={{ width: `${perc}%` }}></div>
                                              <span className="absolute left-2 text-[10px] text-white mix-blend-difference font-bold">
                                                 {formatarMoeda(val)}
                                              </span>
                                           </div>
                                        </div>
                                     )
                                  })}
                               </div>
                            </div>
                         </div>
                      ) : (
                         <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                               <p className="text-xs text-gray-500">Mostrando {vendasPaginadas.length} de {vendas.length} vendas</p>
                               <button 
                                  onClick={exportarCSV}
                                  className="text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                               >
                                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                               </button>
                            </div>
                            
                            <div className="space-y-2">
                               {vendasPaginadas.map(v => (
                                  <div key={v.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                     <button 
                                        onClick={() => setVendaExpandida(vendaExpandida === v.id ? null : v.id)}
                                        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-sm transition-colors text-left"
                                     >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                           <span className="font-semibold text-gray-800">
                                             {(() => {
                                               try {
                                                 const p = parseISO(v.criado_em);
                                                 if (!isNaN(p.getTime())) return format(p, 'dd/MM HH:mm');
                                               } catch(e) {}
                                               return v.criado_em;
                                             })()}
                                           </span>
                                           <span className="text-xs text-gray-500 capitalize">{v.forma_pagamento}</span>
                                           {Number(v.desconto) > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">- {formatarMoeda(Number(v.desconto))}</span>}
                                        </div>
                                        <div className="flex items-center gap-3">
                                           <span className="font-black text-gray-900">{formatarMoeda(v.total)}</span>
                                           {vendaExpandida === v.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                        </div>
                                     </button>
                                     
                                     {vendaExpandida === v.id && v.venda_item && (
                                        <div className="p-4 bg-white border-t border-gray-100">
                                           <table className="w-full text-xs text-left">
                                              <thead className="text-gray-400 uppercase border-b border-gray-100">
                                                 <tr>
                                                    <th className="pb-2 font-medium">Produto</th>
                                                    <th className="pb-2 font-medium text-center">Qtd</th>
                                                    <th className="pb-2 font-medium text-right">Unitário</th>
                                                 </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-50">
                                                 {v.venda_item.map((vi: any, idx: number) => (
                                                    <tr key={idx}>
                                                       <td className="py-2 text-gray-700 font-medium">{vi.produto?.nome || 'Desconhecido'}</td>
                                                       <td className="py-2 text-gray-500 text-center">{vi.quantidade}</td>
                                                       <td className="py-2 text-gray-700 text-right font-semibold">{formatarMoeda(vi.preco_unit)}</td>
                                                    </tr>
                                                 ))}
                                              </tbody>
                                           </table>
                                        </div>
                                     )}
                                  </div>
                               ))}
                            </div>
                            
                            {paginasTotais > 1 && (
                               <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                  <button 
                                     disabled={paginaAtual === 1}
                                     onClick={() => setPaginaAtual(p => p - 1)}
                                     className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                                  >
                                     Anterior
                                  </button>
                                  <span className="text-xs text-gray-500 font-medium">Página {paginaAtual} de {paginasTotais}</span>
                                  <button 
                                     disabled={paginaAtual === paginasTotais}
                                     onClick={() => setPaginaAtual(p => p + 1)}
                                     className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                                  >
                                     Próxima
                                  </button>
                               </div>
                            )}
                         </div>
                      )}
                   </div>
                </div>
             )}
          </div>
          )}
        </div>
        
        {/* Barra Lateral: Histórico */}
        <div className="w-full lg:w-80 bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-[#14211C]/10 bg-[#EEF1EC]/30">
            <h3 className="font-bold text-[#14211C] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0E7A4F]" />
              Histórico
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[600px] p-2 space-y-1">
            {historico.length === 0 ? (
              <div className="p-4 text-center text-[#14211C]/50 text-sm">
                Nenhum relatório salvo.
              </div>
            ) : (
              historico.map(item => (
                <button
                  key={item.id}
                  onClick={() => visualizarHistorico(item)}
                  className="w-full text-left p-3 rounded-lg hover:bg-[#EEF1EC]/50 transition-colors flex flex-col gap-1 border border-transparent hover:border-[#14211C]/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#14211C] capitalize">
                      {item.tipo}
                    </span>
                    <span className="text-[10px] text-[#14211C]/50">
                      {(() => {
                        try {
                          const p = parseISO(item.criado_em);
                          if (!isNaN(p.getTime())) return format(p, "dd/MM HH:mm");
                        } catch(e) {}
                        return "Data inválida";
                      })()}
                    </span>
                  </div>
                  <span className="text-xs text-[#14211C]/70 font-medium">
                    {(() => {
                      try {
                        const pi = parseISO(item.data_inicio);
                        const pf = parseISO(item.data_fim);
                        if (!isNaN(pi.getTime()) && !isNaN(pf.getTime())) {
                          return `${format(pi, "dd/MM/yyyy")} a ${format(pf, "dd/MM/yyyy")}`;
                        }
                      } catch(e) {}
                      return "Período inválido";
                    })()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
