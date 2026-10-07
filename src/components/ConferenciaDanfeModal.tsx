import React, { useState, useMemo, useEffect } from 'react';
import { X, Edit2, Trash2, Search, CheckCircle2, AlertTriangle, PackagePlus, ArrowRight, DollarSign, Box } from 'lucide-react';

export interface ItemNotaProcessado {
  id_temporario: string;
  codigo_fornecedor: string | null;
  descricao_completa: string;
  ncm: string | null;
  quantidade_fiscal: number;      // Qtd conforme nota (ex: 1 CX)
  unidade_fiscal: string;         // UN original da nota
  quantidade_estoque: number;     // Qtd convertida (ex: 10 UN)
  unidade_venda: string;          // UN final do estoque
  valor_unitario_fiscal: number;  // Preço da CX inteira
  custo_unitario_real: number;    // Preço por UN vendável
  preco_venda_sugerido: number;   // Campo NOVO
  ean_gtin: string | null;
  observacao_manual: string | null;
  nivel_confianca_item: 'ALTO' | 'MEDIO' | 'BAIXO';
  foi_convertido: boolean;        // Flag visual
  fator_conversao: number;        // Quantas unidades vendáveis existem em cada unidade fiscal
  necessita_confirmar_conversao: boolean;
}

// Tipo de compatibilidade retroativa
export type ItemNota = ItemNotaProcessado;

export interface ProdutoExistente {
  id_sistema: string;
  nome: string;
  ean: string | null;
  cod_fornecedor: string | null;
  estoque_atual: number;
  preco_custo: number;
  margem_padrao?: number; // Margem sugerida por categoria
}

export interface ConferenciaDanfeModalProps {
  itensExtraidos: any[]; // Vêm brutos do backend/Gemini
  onClose: () => void;
  onConfirmarImportacao: (itensProcessados: ItemNotaProcessado[]) => void;
  baseProdutosExistentes: ProdutoExistente[];
  buscarEanAutomatico?: (descricao: string, ncm: string) => Promise<string | null>;
}

export const ConferenciaDanfeModal: React.FC<ConferenciaDanfeModalProps> = ({
  itensExtraidos,
  onClose,
  onConfirmarImportacao,
  baseProdutosExistentes,
  buscarEanAutomatico
}) => {
  const [itens, setItens] = useState<ItemNotaProcessado[]>([]);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [carregandoEans, setCarregandoEans] = useState(true);

  // Processamento inicial + Busca automática de EANs faltantes
  useEffect(() => {
    const processar = async () => {
      let processados: ItemNotaProcessado[] = itensExtraidos.map((item, idx) => {
        // CONVERSÃO DE EMBALAGEM
        // Nunca presumimos quantas unidades existem em CX/FARDO/PCT/KIT.
        // O fator só é aplicado automaticamente quando veio explicitamente dos dados já conhecidos.
        const unidadeUpper = String(item.unidade_medida || item.unidade_fiscal || item.unidade || 'UN').toUpperCase().trim();
        const unidadesQueExigemConfirmacao = ['CX', 'KIT', 'FARDO', 'FD', 'PCT'];
        const fatorInformado = Number(item.fator_conversao);
        const temFatorValido = Number.isFinite(fatorInformado) && fatorInformado > 0;
        const fator = temFatorValido ? fatorInformado : 1;
        const necessitaConfirmarConversao = unidadesQueExigemConfirmacao.includes(unidadeUpper) && !temFatorValido;
        const foiConvertido = fator > 1;

        // Sugestão de preço de venda baseada em margem padrão ou existente
        const existente = baseProdutosExistentes.find(p => 
          (item.ean_gtin && p.ean === item.ean_gtin) || 
          (item.codigo_fornecedor && p.cod_fornecedor === item.codigo_fornecedor)
        );
        
        const valorFiscal = Number(item.valor_unitario_real) || Number(item.valor_unitario_fiscal) || Number(item.valor_unitario_original) || 0;
        const custoUnitario = Number((valorFiscal / fator).toFixed(4));
        // margem_padrao é margem sobre o preço de venda, não markup sobre o custo.
        // Ex.: custo 10 com margem de 40% => preço 16,67.
        const margem = existente?.margem_padrao ?? 0.40;
        const margemSegura = Math.min(Math.max(Number(margem) || 0.40, 0), 0.95);
        const precoVendaSugerido = parseFloat((custoUnitario / (1 - margemSegura)).toFixed(2));
        const qtdFiscal = Number(item.quantidade_fiscal) || Number(item.quantidade) || 1;

        return {
          ...item,
          id_temporario: item.id_temporario || `temp_${idx}_${Date.now()}`,
          codigo_fornecedor: item.codigo_fornecedor || null,
          descricao_completa: item.descricao_completa || item.nome || 'Produto sem descrição',
          ncm: item.ncm || null,
          quantidade_fiscal: qtdFiscal,
          unidade_fiscal: item.unidade_fiscal || item.unidade_medida || 'UN',
          quantidade_estoque: item.quantidade_estoque || (qtdFiscal * fator),
          unidade_venda: item.unidade_venda || (foiConvertido ? 'UN' : (item.unidade_medida || 'UN')),
          valor_unitario_fiscal: valorFiscal,
          custo_unitario_real: Number(custoUnitario.toFixed(2)),
          preco_venda_sugerido: item.preco_venda_sugerido !== undefined ? Number(item.preco_venda_sugerido) : precoVendaSugerido,
          ean_gtin: item.ean_gtin || null,
          observacao_manual: item.observacao_manual || null,
          nivel_confianca_item: item.nivel_confianca_item || 'ALTO',
          foi_convertido: foiConvertido,
          fator_conversao: fator,
          necessita_confirmar_conversao: necessitaConfirmarConversao
        };
      });

      // Busca automática de EANs faltantes em background
      if (buscarEanAutomatico) {
        setCarregandoEans(true);
        const promises = processados.map(async (item, idx) => {
          if (!item.ean_gtin && item.descricao_completa) {
            try {
              const eanEncontrado = await buscarEanAutomatico(item.descricao_completa, item.ncm || '');
              if (eanEncontrado) {
                processados[idx].ean_gtin = eanEncontrado;
              }
            } catch (e) { /* ignora falhas individuais */ }
          }
        });
        await Promise.allSettled(promises);
        setCarregandoEans(false);
      } else {
        setCarregandoEans(false);
      }

      setItens(processados);
    };

    processar();
  }, [itensExtraidos, baseProdutosExistentes, buscarEanAutomatico]);

  // Cálculos do Rodapé
  const resumo = useMemo(() => {
    let novos = 0, atualizacoes = 0;
    let totalCompra = 0, unidadesFiscais = 0, unidadesVendaveis = 0;

    itens.forEach(item => {
      const existente = baseProdutosExistentes.find(p => 
        (item.ean_gtin && p.ean === item.ean_gtin) || 
        (item.codigo_fornecedor && p.cod_fornecedor === item.codigo_fornecedor)
      );
      
      if (existente) atualizacoes++; else novos++;
      
      totalCompra += item.quantidade_fiscal * item.valor_unitario_fiscal;
      unidadesFiscais += item.quantidade_fiscal;
      unidadesVendaveis += item.quantidade_estoque;
    });

    return { novos, atualizacoes, totalCompra, unidadesFiscais, unidadesVendaveis };
  }, [itens, baseProdutosExistentes]);

  const atualizarItem = (id: string, campo: keyof ItemNotaProcessado, valor: any) => {
    setItens(prev => prev.map(i => {
      if (i.id_temporario !== id) return i;
      const atualizado = { ...i, [campo]: valor };
      // Recalcula preço sugerido usando margem real de 40% quando o custo for alterado.
      if (campo === 'custo_unitario_real') {
        const novoCusto = Number(valor) || 0;
        atualizado.preco_venda_sugerido = novoCusto > 0
          ? parseFloat((novoCusto / (1 - 0.40)).toFixed(2))
          : 0;
      }

      // Ao informar a quantidade vendável, calculamos o fator real da embalagem
      // e o custo unitário coerente com o total fiscal.
      if (campo === 'quantidade_estoque') {
        const qtdEstoque = Number(valor) || 0;
        const qtdFiscal = Number(i.quantidade_fiscal) || 0;
        if (qtdEstoque > 0 && qtdFiscal > 0) {
          const fatorReal = qtdEstoque / qtdFiscal;
          const custoReal = Number(i.valor_unitario_fiscal || 0) / fatorReal;
          atualizado.fator_conversao = fatorReal;
          atualizado.custo_unitario_real = Number(custoReal.toFixed(2));
          atualizado.preco_venda_sugerido = custoReal > 0
            ? parseFloat((custoReal / (1 - 0.40)).toFixed(2))
            : 0;
          atualizado.foi_convertido = Math.abs(fatorReal - 1) > 0.0001;
          atualizado.unidade_venda = atualizado.foi_convertido ? 'UN' : i.unidade_fiscal;
          atualizado.necessita_confirmar_conversao = false;
        }
      }
      return atualizado;
    }));
  };

  const removerItem = (id: string) => setItens(prev => prev.filter(i => i.id_temporario !== id));

  const getStatusBadge = (item: ItemNotaProcessado) => {
    if (item.necessita_confirmar_conversao) return { icon: AlertTriangle, text: 'Confirmar embalagem', color: 'text-red-700 bg-red-100' };
    if (item.observacao_manual) return { icon: AlertTriangle, text: 'Manuscrito', color: 'text-red-600 bg-red-100' };
    if (item.foi_convertido) return { icon: Box, text: `${item.unidade_fiscal} → ${item.unidade_venda}`, color: 'text-orange-600 bg-orange-100' };
    if (item.nivel_confianca_item === 'BAIXO') return { icon: AlertTriangle, text: 'Baixa Confiança', color: 'text-orange-600 bg-orange-100' };
    return { icon: CheckCircle2, text: 'OK', color: 'text-green-600 bg-green-100' };
  };

  const haConversoesPendentes = itens.some(item => item.necessita_confirmar_conversao);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-7xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <PackagePlus className="text-blue-600" /> Conferência de Importação
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {carregandoEans ? '🔍 Buscando códigos de barras automaticamente...' : 'Revise preços de venda e confirme a entrada no estoque.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"><X size={24} /></button>
        </div>

        {/* Tabela Scrollável */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-12">Status</th>
                  <th className="px-4 py-3 min-w-[280px]">Produto</th>
                  <th className="px-4 py-3 w-28 text-center">Qtd Fiscal</th>
                  <th className="px-4 py-3 w-28 text-center">Qtd Estoque</th>
                  <th className="px-4 py-3 w-28 text-right">Custo Unit.</th>
                  <th className="px-4 py-3 w-32 text-right">Preço Venda</th>
                  <th className="px-4 py-3 w-28 text-right">Total Compra</th>
                  <th className="px-4 py-3 w-24 text-center">EAN</th>
                  <th className="px-4 py-3 w-20 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itens.map((item) => {
                  const badge = getStatusBadge(item);
                  const isEditing = editandoId === item.id_temporario;
                  const existente = baseProdutosExistentes.find(p => 
                    (item.ean_gtin && p.ean === item.ean_gtin) || 
                    (item.codigo_fornecedor && p.cod_fornecedor === item.codigo_fornecedor)
                  );

                  return (
                    <tr key={item.id_temporario} className="hover:bg-gray-50 transition-colors bg-opacity-20">
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${badge.color}`}>
                          <badge.icon size={12} /> {badge.text}
                        </span>
                        {item.observacao_manual && <p className="text-[10px] text-red-500 mt-1 leading-tight">{item.observacao_manual}</p>}
                      </td>
                      
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <input type="text" value={item.descricao_completa} onChange={(e) => atualizarItem(item.id_temporario, 'descricao_completa', e.target.value)} className="w-full p-1.5 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
                        ) : (
                          <div>
                            <p className="font-medium text-gray-900 line-clamp-2">{item.descricao_completa}</p>
                            {existente ? (
                              <p className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1">
                                <ArrowRight size={10} /> Vinculado: {existente.nome} (Estoque: {existente.estoque_atual})
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400 mt-1 italic">Novo produto</p>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center align-middle">
                        <span className="font-mono font-bold text-gray-700">{item.quantidade_fiscal} {item.unidade_fiscal}</span>
                      </td>

                      <td className="px-4 py-3 text-center align-middle">
                        {isEditing || item.necessita_confirmar_conversao ? (
                          <div className="flex flex-col gap-1 items-center">
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={item.quantidade_estoque}
                              onChange={(e) => atualizarItem(item.id_temporario, 'quantidade_estoque', Number(e.target.value))}
                              className={`w-24 p-1.5 border rounded text-center text-sm font-mono ${
                                item.necessita_confirmar_conversao ? 'border-red-300 bg-red-50' : 'border-blue-300'
                              }`}
                            />
                            {item.necessita_confirmar_conversao && (
                              <span className="text-[10px] leading-tight text-red-600 font-semibold">
                                Informe quantas UN serão vendidas
                              </span>
                            )}
                          </div>
                        ) : item.foi_convertido ? (
                          <span className="font-mono font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">{item.quantidade_estoque} {item.unidade_venda}</span>
                        ) : (
                          <span className="font-mono font-bold text-gray-700">{item.quantidade_estoque} {item.unidade_venda}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right align-middle">
                        {isEditing ? (
                          <input type="number" step="0.01" value={item.custo_unitario_real} onChange={(e) => atualizarItem(item.id_temporario, 'custo_unitario_real', Number(e.target.value))} className="w-24 p-1.5 border border-blue-300 rounded text-right text-sm" />
                        ) : (
                          <div className="text-right">
                            {item.foi_convertido && <span className="text-[10px] text-gray-400 block line-through">R$ {item.valor_unitario_fiscal.toFixed(2)} /{item.unidade_fiscal}</span>}
                            <span className="font-mono text-gray-700">R$ {item.custo_unitario_real.toFixed(2)}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right align-middle">
                        {isEditing ? (
                          <input type="number" step="0.01" value={item.preco_venda_sugerido} onChange={(e) => atualizarItem(item.id_temporario, 'preco_venda_sugerido', Number(e.target.value))} className="w-28 p-1.5 border border-green-300 rounded text-right text-sm font-bold text-green-700" />
                        ) : (
                          <span className="font-mono font-bold text-green-700">R$ {item.preco_venda_sugerido.toFixed(2)}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right align-middle font-mono font-bold text-gray-900">
                        R$ {(item.quantidade_fiscal * item.valor_unitario_fiscal).toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-center align-middle">
                        {item.ean_gtin ? (
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{item.ean_gtin}</span>
                        ) : (
                          <button className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mx-auto"><Search size={12} /> Buscar</button>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditandoId(isEditing ? null : item.id_temporario)} className={`p-1.5 rounded-md transition-colors ${isEditing ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}><Edit2 size={16} /></button>
                          <button onClick={() => removerItem(item.id_temporario)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé com Totais Aprimorados */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col lg:flex-row justify-between items-center gap-4 shrink-0">
          <div className="flex items-center gap-6 text-sm flex-wrap justify-center lg:justify-start">
            <div className="flex flex-col"><span className="text-gray-500 text-[10px] uppercase font-bold">Novos</span><span className="text-lg font-bold text-gray-900">{resumo.novos}</span></div>
            <div className="w-px h-8 bg-gray-300"></div>
            <div className="flex flex-col"><span className="text-gray-500 text-[10px] uppercase font-bold">Atualizações</span><span className="text-lg font-bold text-blue-600">{resumo.atualizacoes}</span></div>
            <div className="w-px h-8 bg-gray-300"></div>
            <div className="flex flex-col"><span className="text-gray-500 text-[10px] uppercase font-bold">Unid. Fiscais</span><span className="text-lg font-bold text-gray-900">{resumo.unidadesFiscais}</span></div>
            <div className="w-px h-8 bg-gray-300"></div>
            <div className="flex flex-col"><span className="text-gray-500 text-[10px] uppercase font-bold">Unid. Vendáveis</span><span className="text-lg font-bold text-orange-600">{resumo.unidadesVendaveis}</span></div>
            <div className="w-px h-8 bg-gray-300"></div>
            <div className="flex flex-col"><span className="text-gray-500 text-[10px] uppercase font-bold">Total Compra</span><span className="text-lg font-bold text-gray-900">R$ {resumo.totalCompra.toFixed(2)}</span></div>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto">
            {haConversoesPendentes && (
              <div className="max-w-xs text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Confirme a quantidade vendável das embalagens antes de importar. O sistema não presume unidades por caixa/fardo/pacote.
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap">
              <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Li e conferi todos os itens
            </label>
            <button disabled={!aceitouTermos || itens.length === 0 || haConversoesPendentes} onClick={() => onConfirmarImportacao(itens)} className={`px-8 py-3 rounded-lg font-bold text-white shadow-sm transition-all flex items-center gap-2 whitespace-nowrap ${!aceitouTermos || itens.length === 0 || haConversoesPendentes ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}>
              <CheckCircle2 size={20} /> Confirmar e Cadastrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
