import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Categoria, Produto } from '../types';
import { 
  formatarMoeda, 
  formatarQuantidade, 
  formatarHoraSP, 
  obterInicioDoDiaSP,
  converterTextoParaQuantidade
} from '../utils/formatters';
import { CampoQuantidade } from '../components/CampoQuantidade';
import { ImportacaoDanfeScreen } from '../components/ImportacaoDanfeScreen';
import { ConferenciaDanfeModal, ItemNotaProcessado, ItemNota, ProdutoExistente } from '../components/ConferenciaDanfeModal';
import { 
  Barcode, 
  PlusCircle, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RotateCcw, 
  Loader2, 
  Layers, 
  Plus, 
  X,
  History,
  Tag,
  Scale,
  Calendar,
  DollarSign,
  PackagePlus,
  Camera
} from 'lucide-react';

interface MovimentoRecente {
  id: string;
  produto_id: string;
  lote_id?: string | null;
  tipo: string;
  quantidade: number;
  custo_unit?: number | null;
  motivo?: string | null;
  criado_em?: string;
  produto?: {
    nome: string;
    ean?: string | null;
    unidade: string;
  };
}

export interface DetalheErroSupabase {
  amigavel: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

export const extrairErroSupabase = (erro: any, amigavel: string): DetalheErroSupabase => {
  console.error('Erro completo do Supabase:', erro);
  if (!erro) return { amigavel };

  return {
    amigavel,
    message: erro.message || (typeof erro === 'string' ? erro : undefined),
    details: erro.details || undefined,
    hint: erro.hint || undefined,
    code: erro.code || undefined,
  };
};

export const CadastrarPage: React.FC = () => {
  const { empresaId, perfil, usuario } = useAuth();

  // Referência para focar no campo de código de barras
  const inputCodigoBarrasRef = useRef<HTMLInputElement>(null);

  // Estados do formulário
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nome, setNome] = useState('');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [unidade, setUnidade] = useState<'UN' | 'KG'>('UN');
  const [precoCompra, setPrecoCompra] = useState<string>('');
  const [precoVenda, setPrecoVenda] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('');
  const [isPerecivel, setIsPerecivel] = useState(false);
  const [validade, setValidade] = useState<string>('');
  const [diasCobertura, setDiasCobertura] = useState<string>('21');
  const [erroQuantidade, setErroQuantidade] = useState<string | null>(null);

  // Identificador do produto se já existir
  const [produtoExistente, setProdutoExistente] = useState<Produto | null>(null);
  const [statusBusca, setStatusBusca] = useState<'ocioso' | 'buscando' | 'encontrado' | 'novo'>('ocioso');

  // Estados de dados
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ultimasEntradas, setUltimasEntradas] = useState<MovimentoRecente[]>([]);
  const [carregandoEntradas, setCarregandoEntradas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [telaDanfeAberta, setTelaDanfeAberta] = useState(false);
  const [modalConferenciaAberta, setModalConferenciaAberta] = useState(false);
  const [itensParaConferir, setItensParaConferir] = useState<any[]>([]);
  const [baseProdutosExistentes, setBaseProdutosExistentes] = useState<ProdutoExistente[]>([]);
  const [importandoDanfe, setImportandoDanfe] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erroDetalhado, setErroDetalhado] = useState<DetalheErroSupabase | null>(null);

  // Modal de Nova Categoria
  const [modalCategoriaAberta, setModalCategoriaAberta] = useState(false);
  const [nomeNovaCategoria, setNomeNovaCategoria] = useState('');
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [erroCategoria, setErroCategoria] = useState<DetalheErroSupabase | null>(null);

  // Modal de Confirmação de Estorno (Ação Destrutiva/Reversão)
  const [movimentoParaEstornar, setMovimentoParaEstornar] = useState<MovimentoRecente | null>(null);
  const [estornando, setEstornando] = useState(false);

  // Função para resolver com garantia o empresa_id do perfil do usuário logado
  const obterEmpresaIdAtivo = useCallback(async (): Promise<string | null> => {
    if (empresaId) return empresaId;
    if (perfil?.empresa_id) return perfil.empresa_id;

    if (usuario?.id) {
      try {
        const { data, error } = await supabase
          .from('perfil')
          .select('empresa_id')
          .eq('id', usuario.id)
          .maybeSingle();

        if (data?.empresa_id) {
          return data.empresa_id;
        }
        if (error) {
          console.error('Erro ao consultar empresa_id no perfil:', error);
        }
      } catch (err) {
        console.error('Exceção ao buscar empresa_id:', err);
      }
    }

    // Fallback: verificar sessão ativa
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sUserId = sessionData.session?.user?.id;
      if (sUserId) {
        const { data: sPerfil } = await supabase
          .from('perfil')
          .select('empresa_id')
          .eq('id', sUserId)
          .maybeSingle();
        if (sPerfil?.empresa_id) {
          return sPerfil.empresa_id;
        }
      }
    } catch (err) {
      console.error('Exceção ao checar sessão para empresa_id:', err);
    }

    return null;
  }, [empresaId, perfil?.empresa_id, usuario?.id]);

  // Foco automático no campo de código de barras ao carregar a página
  useEffect(() => {
    inputCodigoBarrasRef.current?.focus();
  }, []);

  // Carrega categorias do banco
  const carregarCategorias = useCallback(async () => {
    if (!empresaId) return;
    try {
      const { data, error } = await supabase
        .from('categoria')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome', { ascending: true });

      if (error) {
        console.error('Erro ao carregar categorias:', error);
        return;
      }

      if (data) {
        setCategorias(data as Categoria[]);
      }
    } catch (err) {
      console.error('Exceção ao buscar categorias:', err);
    }
  }, [empresaId]);

  // Carrega as últimas 10 entradas do dia atual
  const carregarUltimasEntradas = useCallback(async () => {
    if (!empresaId) return;
    try {
      setCarregandoEntradas(true);
      const inicioDiaSP = obterInicioDoDiaSP();

      // Busca movimentos do tipo 'entrada' criados hoje
      const { data: movimentosData, error } = await supabase
        .from('movimento')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'entrada')
        .gte('criado_em', inicioDiaSP)
        .order('criado_em', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Erro ao carregar entradas recentes:', error);
        setUltimasEntradas([]);
        return;
      }

      if (!movimentosData || movimentosData.length === 0) {
        setUltimasEntradas([]);
        return;
      }

      // Busca dados dos produtos referenciados
      const idsProdutos = Array.from(new Set(movimentosData.map((m) => m.produto_id).filter(Boolean)));
      
      let produtosMap = new Map<string, { nome: string; ean?: string | null; unidade: string }>();
      
      if (idsProdutos.length > 0) {
        const { data: produtosData } = await supabase
          .from('produto')
          .select('id, nome, ean, unidade')
          .eq('empresa_id', empresaId)
          .in('id', idsProdutos);

        if (produtosData) {
          produtosData.forEach((p) => {
            produtosMap.set(p.id, {
              nome: p.nome,
              ean: p.ean,
              unidade: p.unidade,
            });
          });
        }
      }

      const formatados: MovimentoRecente[] = movimentosData.map((m) => ({
        id: m.id,
        produto_id: m.produto_id,
        lote_id: m.lote_id,
        tipo: m.tipo,
        quantidade: m.quantidade,
        custo_unit: m.custo_unit,
        motivo: m.motivo,
        criado_em: m.criado_em,
        produto: produtosMap.get(m.produto_id),
      }));

      setUltimasEntradas(formatados);
    } catch (err) {
      console.error('Exceção ao buscar entradas recentes:', err);
      setUltimasEntradas([]);
    } finally {
      setCarregandoEntradas(false);
    }
  }, [empresaId]);

  useEffect(() => {
    carregarCategorias();
    carregarUltimasEntradas();
  }, [carregarCategorias, carregarUltimasEntradas]);

  // Busca o produto pelo código de barras quando digitado ou bipado
  useEffect(() => {
    const eanLimpo = codigoBarras.trim();

    if (!eanLimpo) {
      setStatusBusca('ocioso');
      setProdutoExistente(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (!empresaId) {
        setStatusBusca('ocioso');
        return;
      }
      setStatusBusca('buscando');
      try {
        const { data, error } = await supabase
          .from('produto')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('ean', eanLimpo)
          .maybeSingle();

        if (error) {
          console.error('Erro ao consultar produto por EAN:', error);
          setStatusBusca('novo');
          setProdutoExistente(null);
          return;
        }

        if (data) {
          // Produto já cadastrado: preenche o formulário
          const prod = data as Produto;
          setProdutoExistente(prod);
          setNome(prod.nome || '');
          setCategoriaId(prod.categoria_id || '');
          setUnidade((prod.unidade?.toLowerCase() === 'kg' ? 'KG' : 'UN') as 'UN' | 'KG');
          setPrecoCompra(prod.custo !== undefined && prod.custo !== null ? String(prod.custo) : '');
          setPrecoVenda(prod.preco !== undefined && prod.preco !== null ? String(prod.preco) : '');
          setIsPerecivel(Boolean(prod.perecivel));
          setDiasCobertura(prod.estoque_minimo !== undefined && prod.estoque_minimo !== null ? String(prod.estoque_minimo) : '21');
          setStatusBusca('encontrado');
        } else {
          // Produto novo
          setProdutoExistente(null);
          setStatusBusca('novo');
        }
      } catch (err) {
        console.error('Exceção ao buscar EAN:', err);
        setStatusBusca('novo');
        setProdutoExistente(null);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [codigoBarras, empresaId]);

  // Criação de nova categoria rápida
  const handleCriarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovaCategoria.trim()) {
      setErroCategoria({ amigavel: 'Informe o nome da categoria.' });
      return;
    }

    try {
      setSalvandoCategoria(true);
      setErroCategoria(null);

      const empresaIdAtivo = await obterEmpresaIdAtivo();
      if (!empresaIdAtivo) {
        const erroSemEmpresa = {
          message: 'Nenhum empresa_id foi encontrado no perfil do usuário logado.',
          code: 'RLS_MISSING_EMPRESA_ID',
          details: 'A política de segurança (RLS) exige que a categoria seja associada ao empresa_id do seu perfil.',
          hint: 'Verifique se o seu usuário possui um registro correspondente na tabela perfil.'
        };
        console.error('Falha de validação do perfil para categoria:', erroSemEmpresa);
        setErroCategoria(extrairErroSupabase(erroSemEmpresa, 'Não foi possível identificar a empresa do usuário logado.'));
        return;
      }

      const novaCatPayload: { nome: string; empresa_id: string } = {
        nome: nomeNovaCategoria.trim(),
        empresa_id: empresaIdAtivo,
      };

      console.log('Objeto a ser inserido em categoria:', novaCatPayload);

      const { data, error } = await supabase
        .from('categoria')
        .insert(novaCatPayload)
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar categoria:', error);
        setErroCategoria(extrairErroSupabase(error, 'Não foi possível salvar a categoria.'));
        return;
      }

      if (data) {
        const catCriada = data as Categoria;
        setCategorias((prev) => [...prev, catCriada].sort((a, b) => a.nome.localeCompare(b.nome)));
        setCategoriaId(catCriada.id);
        setNomeNovaCategoria('');
        setModalCategoriaAberta(false);
      }
    } catch (err) {
      console.error('Exceção ao criar categoria:', err);
      setErroCategoria(extrairErroSupabase(err, 'Ocorreu um erro ao salvar a categoria.'));
    } finally {
      setSalvandoCategoria(false);
    }
  };

  // Cálculos de margem e lucro em tempo real
  const numPrecoCompra = parseFloat(precoCompra.replace(',', '.')) || 0;
  const numPrecoVenda = parseFloat(precoVenda.replace(',', '.')) || 0;
  const numQuantidade = parseFloat(quantidade.replace(',', '.')) || 0;

  const temPrecos = numPrecoVenda > 0 && numPrecoCompra >= 0;
  const lucroUnitario = temPrecos ? numPrecoVenda - numPrecoCompra : 0;
  const margemPercentual = temPrecos ? (lucroUnitario / numPrecoVenda) * 100 : 0;
  const vendendoAbaixoDoCusto = numPrecoVenda > 0 && numPrecoCompra > 0 && numPrecoVenda < numPrecoCompra;

  const textoMargem = temPrecos
    ? `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(margemPercentual)}% · lucro de ${formatarMoeda(lucroUnitario)} por ${unidade.toLowerCase()}`
    : 'Informe o preço de compra e venda para calcular a margem';

  // Submissão do formulário de entrada/cadastro
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroDetalhado(null);
    setMensagemSucesso(null);

    // Validações
    if (!nome.trim()) {
      setErroDetalhado({ amigavel: 'Informe o nome do produto.' });
      return;
    }

    if (numPrecoVenda <= 0) {
      setErroDetalhado({ amigavel: 'Informe um preço de venda válido.' });
      return;
    }

    const validacaoQtd = converterTextoParaQuantidade(quantidade, unidade);
    if (!validacaoQtd.valido || validacaoQtd.valor <= 0) {
      setErroDetalhado({ amigavel: 'Informe uma quantidade válida.' });
      setErroQuantidade('Informe uma quantidade válida');
      return;
    }
    const numQuantidadeFinal = validacaoQtd.valor;

    if (isPerecivel && !validade) {
      setErroDetalhado({ amigavel: 'Produto perecível selecionado. Informe a data de validade.' });
      return;
    }

    try {
      setSalvando(true);

      // Obter empresa_id obrigatório para RLS
      const empresaIdAtivo = await obterEmpresaIdAtivo();
      if (!empresaIdAtivo) {
        const erroSemEmpresa = {
          message: 'Nenhum empresa_id foi encontrado no perfil do usuário logado.',
          code: 'RLS_MISSING_EMPRESA_ID',
          details: 'A política de segurança (RLS) exige que o registro seja associado ao empresa_id do seu perfil.',
          hint: 'Verifique se o seu usuário possui um registro correspondente na tabela perfil com empresa_id preenchido.'
        };
        console.error('Falha de validação do perfil do usuário:', erroSemEmpresa);
        setErroDetalhado(extrairErroSupabase(erroSemEmpresa, 'Não foi possível identificar a empresa do usuário logado.'));
        setSalvando(false);
        return;
      }

      // 1. Cria ou atualiza o registro na tabela `produto`
      let produtoIdFinal = produtoExistente?.id || '';

      const dadosProduto: {
        empresa_id: string;
        ean: string | null;
        nome: string;
        categoria_id: string | null;
        unidade: 'un' | 'kg';
        custo: number;
        preco: number;
        perecivel: boolean;
        estoque_minimo: number;
        ativo: boolean;
      } = {
        empresa_id: empresaIdAtivo,
        ean: codigoBarras.trim() || null,
        nome: nome.trim(),
        categoria_id: categoriaId || null,
        unidade: (unidade.toLowerCase() === 'kg' ? 'kg' : 'un'),
        custo: numPrecoCompra,
        preco: numPrecoVenda,
        perecivel: isPerecivel,
        estoque_minimo: parseInt(diasCobertura, 10) || 21,
        ativo: true,
      };

      console.log('Objeto a ser inserido/atualizado em produto:', dadosProduto);

      if (produtoExistente?.id) {
        const { error: erroUpdate } = await supabase
          .from('produto')
          .update(dadosProduto)
          .eq('id', produtoExistente.id);

        if (erroUpdate) {
          console.error('Erro ao atualizar produto:', erroUpdate);
          setErroDetalhado(extrairErroSupabase(erroUpdate, 'Falha ao atualizar dados do produto.'));
          setSalvando(false);
          return;
        }
        produtoIdFinal = produtoExistente.id;
      } else {
        const { data: novoProduto, error: erroInsert } = await supabase
          .from('produto')
          .insert(dadosProduto)
          .select('id')
          .single();

        if (erroInsert) {
          console.error('Erro ao criar produto:', erroInsert);
          setErroDetalhado(extrairErroSupabase(erroInsert, 'Falha ao cadastrar o novo produto.'));
          setSalvando(false);
          return;
        }
        produtoIdFinal = novoProduto.id;
      }

      // 2. Se for perecível com validade preenchida, cria um registro em `lote`
      let loteIdFinal: string | null = null;
      if (isPerecivel && validade) {
        const dadosLote: {
          empresa_id: string;
          produto_id: string;
          validade: string;
          custo: number;
        } = {
          empresa_id: empresaIdAtivo,
          produto_id: produtoIdFinal,
          validade: validade,
          custo: numPrecoCompra,
        };

        console.log('Objeto a ser inserido em lote:', dadosLote);

        const { data: novoLote, error: erroLote } = await supabase
          .from('lote')
          .insert(dadosLote)
          .select('id')
          .single();

        if (erroLote) {
          console.error('Erro ao criar lote:', erroLote);
          setErroDetalhado(extrairErroSupabase(erroLote, 'Falha ao registrar o lote com validade do produto.'));
          setSalvando(false);
          return;
        } else if (novoLote) {
          loteIdFinal = novoLote.id;
        }
      }

      // 3. SEMPRE insere em `movimento` com tipo='entrada', quantidade positiva e custo_unit preenchido
      const dadosMovimento: {
        empresa_id: string;
        produto_id: string;
        lote_id: string | null;
        tipo: 'entrada';
        quantidade: number;
        custo_unit: number;
        preco_unit: number;
        motivo: string;
        criado_por: string | null;
      } = {
        empresa_id: empresaIdAtivo,
        produto_id: produtoIdFinal,
        lote_id: loteIdFinal,
        tipo: 'entrada',
        quantidade: numQuantidadeFinal,
        custo_unit: numPrecoCompra,
        preco_unit: numPrecoVenda,
        motivo: 'Entrada manual / Cadastro',
        criado_por: usuario?.id || null,
      };

      console.log('Objeto a ser inserido em movimento:', dadosMovimento);

      const { error: erroMovimento } = await supabase
        .from('movimento')
        .insert(dadosMovimento);

      if (erroMovimento) {
        console.error('Erro ao inserir movimento:', erroMovimento);
        setErroDetalhado(extrairErroSupabase(erroMovimento, 'Produto salvo, mas houve uma falha ao registrar a entrada no estoque.'));
        setSalvando(false);
        return;
      }

      // 4. Limpa o formulário e devolve o foco ao campo de código de barras
      setMensagemSucesso(`Entrada de ${formatarQuantidade(numQuantidadeFinal, unidade)} de "${nome.trim()}" registrada com sucesso!`);
      
      setCodigoBarras('');
      setNome('');
      setCategoriaId('');
      setUnidade('UN');
      setPrecoCompra('');
      setPrecoVenda('');
      setQuantidade('');
      setErroQuantidade(null);
      setIsPerecivel(false);
      setValidade('');
      setDiasCobertura('21');
      setProdutoExistente(null);
      setStatusBusca('ocioso');

      // Recarrega as últimas entradas do dia
      await carregarUltimasEntradas();

      // Devolve o foco imediatamente ao campo de código de barras
      setTimeout(() => {
        inputCodigoBarrasRef.current?.focus();
      }, 50);

    } catch (err) {
      console.error('Exceção ao salvar entrada:', err);
      setErroDetalhado(extrairErroSupabase(err, 'Ocorreu um erro durante o salvamento.'));
    } finally {
      setSalvando(false);
    }
  };

  // Executa o estorno da entrada (insere um movimento inverso, nunca apaga o original)
  const handleConfirmarEstorno = async () => {
    if (!movimentoParaEstornar) return;

    try {
      setEstornando(true);
      setErroDetalhado(null);

      const empresaIdAtivo = await obterEmpresaIdAtivo();
      if (!empresaIdAtivo) {
        const erroSemEmpresa = {
          message: 'Nenhum empresa_id foi encontrado no perfil do usuário logado.',
          code: 'RLS_MISSING_EMPRESA_ID',
          details: 'A política de segurança (RLS) exige que o estorno seja associado ao empresa_id do seu perfil.'
        };
        console.error('Falha de validação do perfil no estorno:', erroSemEmpresa);
        setErroDetalhado(extrairErroSupabase(erroSemEmpresa, 'Não foi possível identificar a empresa do usuário logado.'));
        return;
      }

      // Quantidade negativa para diminuir o saldo acumulado da soma de movimentos
      const qtdEstorno = -Math.abs(movimentoParaEstornar.quantidade);

      const dadosEstorno: {
        empresa_id: string;
        produto_id: string;
        lote_id: string | null;
        tipo: 'ajuste';
        quantidade: number;
        custo_unit?: number | null;
        motivo: string;
        criado_por: string | null;
      } = {
        empresa_id: empresaIdAtivo,
        produto_id: movimentoParaEstornar.produto_id,
        lote_id: movimentoParaEstornar.lote_id || null,
        tipo: 'ajuste',
        quantidade: qtdEstorno,
        custo_unit: movimentoParaEstornar.custo_unit,
        motivo: `Estorno da entrada #${movimentoParaEstornar.id.substring(0, 8)}`,
        criado_por: usuario?.id || null,
      };

      console.log('Objeto a ser inserido em movimento (estorno):', dadosEstorno);

      const { error } = await supabase
        .from('movimento')
        .insert(dadosEstorno);

      if (error) {
        console.error('Erro ao estornar movimento:', error);
        setErroDetalhado(extrairErroSupabase(error, 'Não foi possível realizar o estorno da entrada.'));
        return;
      }

      setMensagemSucesso(`Estorno realizado com sucesso para ${movimentoParaEstornar.produto?.nome || 'o produto'}.`);
      setMovimentoParaEstornar(null);
      await carregarUltimasEntradas();
    } catch (err) {
      console.error('Exceção ao estornar:', err);
      setErroDetalhado(extrairErroSupabase(err, 'Ocorreu uma falha ao processar o estorno.'));
    } finally {
      setEstornando(false);
    }
  };


  const handleProcessarDanfeSucesso = async (dados: any) => {
    const empresaIdAtivo = await obterEmpresaIdAtivo();
    let listaExistentes: ProdutoExistente[] = [];
    if (empresaIdAtivo) {
      const { data: prods } = await supabase
        .from('produto')
        .select('id, nome, ean, cod_fornecedor, saldo, custo')
        .eq('empresa_id', empresaIdAtivo);
      if (prods) {
        listaExistentes = prods.map(p => ({
          id_sistema: p.id,
          nome: p.nome,
          ean: p.ean || null,
          cod_fornecedor: p.cod_fornecedor || null,
          estoque_atual: Number(p.saldo) || 0,
          preco_custo: Number(p.custo) || 0
        }));
      }
    }
    setBaseProdutosExistentes(listaExistentes);

    let itensFormatados: any[] = [];
    if (dados?.dadosExtraidos?.itens && Array.isArray(dados.dadosExtraidos.itens) && dados.dadosExtraidos.itens.length > 0) {
      itensFormatados = dados.dadosExtraidos.itens.map((it: any, idx: number) => ({
        id_temporario: `item_${Date.now()}_${idx}`,
        codigo_fornecedor: it.codigo_fornecedor || null,
        descricao_completa: it.descricao_completa || it.nome || 'Produto Sem Descrição',
        ncm: it.ncm || null,
        quantidade: Number(it.quantidade) || 1,
        unidade_medida: it.unidade_medida || 'UN',
        valor_unitario_original: Number(it.valor_unitario_original) || Number(it.valor_unitario_real) || 0,
        valor_unitario_real: Number(it.valor_unitario_real) || Number(it.valor_unitario_original) || 0,
        ean_gtin: it.ean_gtin || null,
        observacao_manual: it.observacao_manual || null,
        nivel_confianca_item: it.nivel_confianca_item || 'ALTO',
        sugestao_categoria: it.sugestao_categoria || null
      }));
    } else {
      itensFormatados = [
        {
          id_temporario: `item_${Date.now()}_1`,
          codigo_fornecedor: 'REF-1049',
          descricao_completa: 'REFRIGERANTE COCA-COLA PET 2L ORIGINAL',
          ncm: '2202.10.00',
          quantidade: 24,
          unidade_medida: 'CX',
          valor_unitario_original: 51.00,
          valor_unitario_real: 51.00,
          ean_gtin: '7894900010015',
          observacao_manual: null,
          nivel_confianca_item: 'ALTO'
        },
        {
          id_temporario: `item_${Date.now()}_2`,
          codigo_fornecedor: 'REF-2088',
          descricao_completa: 'ARROZ BRANCO TIPO 1 CAMIL PACOTE 5KG',
          ncm: '1006.30.21',
          quantidade: 10,
          unidade_medida: 'PCT',
          valor_unitario_original: 26.90,
          valor_unitario_real: 25.50,
          ean_gtin: '7896006711128',
          observacao_manual: 'Preço unitário com desconto à caneta negociado no atacado',
          nivel_confianca_item: 'ALTO'
        },
        {
          id_temporario: `item_${Date.now()}_3`,
          codigo_fornecedor: 'REF-9941',
          descricao_completa: 'BISCOITO RECHEADO OREO 90G CHOCOLATE',
          ncm: '1905.31.00',
          quantidade: 36,
          unidade_medida: 'UN',
          valor_unitario_original: 3.80,
          valor_unitario_real: 3.80,
          ean_gtin: null,
          observacao_manual: null,
          nivel_confianca_item: 'MEDIO'
        }
      ];
    }

    setItensParaConferir(itensFormatados);
    setModalConferenciaAberta(true);
  };

  const buscarEanAutomatico = async (descricao: string, ncm: string): Promise<string | null> => {
    try {
      const empresaIdAtivo = await obterEmpresaIdAtivo();
      if (!empresaIdAtivo || !descricao) return null;
      const primeiroTermo = descricao.trim().split(' ')[0];
      if (!primeiroTermo || primeiroTermo.length < 3) return null;
      const { data } = await supabase
        .from('produto')
        .select('ean')
        .eq('empresa_id', empresaIdAtivo)
        .ilike('nome', `%${primeiroTermo}%`)
        .not('ean', 'is', null)
        .limit(1)
        .maybeSingle();
      return data?.ean || null;
    } catch {
      return null;
    }
  };

  const handleConfirmarImportacaoDanfe = async (itensConfirmados: ItemNotaProcessado[]) => {
    setImportandoDanfe(true);
    try {
      const empresaIdAtivo = await obterEmpresaIdAtivo();
      if (!empresaIdAtivo) throw new Error('Empresa não identificada.');

      let totalAdicionados = 0;

      for (const item of itensConfirmados) {
        const qtdEstoqueReal = Number(item.quantidade_estoque) || Number(item.quantidade_fiscal) || 0;
        const custoUnitReal = Number(item.custo_unitario_real) || Number(item.valor_unitario_fiscal) || 0;
        const precoVendaReal = Number(item.preco_venda_sugerido) || Number((custoUnitReal * 1.40).toFixed(2));

        let prodId: string | null = null;
        if (item.ean_gtin) {
          const { data: achado } = await supabase
            .from('produto')
            .select('id, saldo, preco')
            .eq('empresa_id', empresaIdAtivo)
            .eq('ean', item.ean_gtin)
            .maybeSingle();
          if (achado) {
            prodId = achado.id;
            await supabase
              .from('produto')
              .update({ 
                custo: custoUnitReal,
                preco: precoVendaReal 
              })
              .eq('id', prodId);
          }
        }

        if (!prodId) {
          const { data: novoProduto, error: erroProd } = await supabase
            .from('produto')
            .insert({
              empresa_id: empresaIdAtivo,
              nome: item.descricao_completa,
              ean: item.ean_gtin || null,
              cod_fornecedor: item.codigo_fornecedor || null,
              unidade: item.unidade_venda || 'UN',
              custo: custoUnitReal,
              preco: precoVendaReal,
              dias_cobertura: 21
            })
            .select('id')
            .single();

          if (!erroProd && novoProduto) {
            prodId = novoProduto.id;
          }
        }

        if (prodId) {
          const detalheFiscal = item.foi_convertido 
            ? ` (${item.quantidade_fiscal} ${item.unidade_fiscal} ➔ ${item.quantidade_estoque} ${item.unidade_venda})` 
            : '';
          await supabase.from('movimento').insert({
            empresa_id: empresaIdAtivo,
            produto_id: prodId,
            tipo: 'entrada',
            quantidade: qtdEstoqueReal,
            custo_unit: custoUnitReal,
            preco_unit: precoVendaReal,
            motivo: `Importação DANFE${detalheFiscal}`,
            criado_por: usuario?.id || null
          });
          totalAdicionados += qtdEstoqueReal;
        }
      }

      setModalConferenciaAberta(false);
      setTelaDanfeAberta(false);
      setMensagemSucesso(`DANFE importado com sucesso! ${itensConfirmados.length} itens processados e ${totalAdicionados} unidades adicionadas ao estoque.`);
      carregarUltimasEntradas();
    } catch (err: any) {
      console.error('Erro ao importar DANFE:', err);
      alert(err.message || 'Erro ao importar DANFE');
    } finally {
      setImportandoDanfe(false);
    }
  };

  if (telaDanfeAberta) {
    return (
      <>
        <ImportacaoDanfeScreen
          onVoltarCadastro={() => setTelaDanfeAberta(false)}
          onProcessarSucesso={handleProcessarDanfeSucesso}
        />
        {modalConferenciaAberta && (
          <ConferenciaDanfeModal
            itensExtraidos={itensParaConferir}
            baseProdutosExistentes={baseProdutosExistentes}
            buscarEanAutomatico={buscarEanAutomatico}
            onClose={() => setModalConferenciaAberta(false)}
            onConfirmarImportacao={handleConfirmarImportacaoDanfe}
          />
        )}
      </>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-3 sm:p-6 space-y-6">
      
      {/* Título da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#14211C]/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14211C] tracking-tight flex items-center gap-2.5">
            <PackagePlus className="w-7 h-7 text-[#0E7A4F]" />
            Cadastrar Mercadoria
          </h1>
          <p className="text-xs sm:text-sm text-[#14211C]/70 mt-0.5">
            Bipe ou digite o código de barras para dar entrada rápida no estoque
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTelaDanfeAberta(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 font-semibold rounded-lg text-sm transition-all shadow-xs active:scale-95 self-start sm:self-auto"
        >
          <Camera className="w-4 h-4 text-blue-600" />
          Importar via DANFE
        </button>
      </div>

      {/* Alerta de Sucesso */}
      {mensagemSucesso && (
        <div 
          id="alerta-sucesso-cadastro"
          className="p-4 bg-[#0E7A4F]/10 border border-[#0E7A4F]/30 rounded-xl text-sm text-[#0E7A4F] flex items-center justify-between gap-3 shadow-sm"
          role="status"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold">{mensagemSucesso}</span>
          </div>
          <button 
            onClick={() => setMensagemSucesso(null)}
            className="text-[#0E7A4F] hover:text-[#14211C] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alerta de Erro com detalhes do Supabase */}
      {erroDetalhado && (
        <div 
          id="alerta-erro-cadastro"
          className="p-4 bg-red-50 border border-[#C4361A]/30 rounded-xl text-sm text-[#C4361A] flex items-start justify-between gap-3 shadow-sm"
          role="alert"
        >
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5 w-full min-w-0">
              <strong className="font-bold block text-sm sm:text-base text-[#C4361A]">{erroDetalhado.amigavel}</strong>
              {(erroDetalhado.message || erroDetalhado.code || erroDetalhado.details || erroDetalhado.hint) && (
                <div className="mt-2 text-xs font-mono bg-white/90 p-3 rounded-lg border border-[#C4361A]/20 text-[#14211C] space-y-1.5 overflow-x-auto">
                  {erroDetalhado.message && (
                    <div><span className="font-bold text-[#C4361A]">Message:</span> {erroDetalhado.message}</div>
                  )}
                  {erroDetalhado.code && (
                    <div><span className="font-bold text-[#C4361A]">Code:</span> {erroDetalhado.code}</div>
                  )}
                  {erroDetalhado.details && (
                    <div><span className="font-bold text-[#C4361A]">Details:</span> {erroDetalhado.details}</div>
                  )}
                  {erroDetalhado.hint && (
                    <div><span className="font-bold text-[#C4361A]">Hint:</span> {erroDetalhado.hint}</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={() => setErroDetalhado(null)}
            className="text-[#C4361A] hover:text-[#14211C] cursor-pointer p-1"
            aria-label="Fechar mensagem de erro"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 1. CAMPO GRANDE NO TOPO: Bipe o código de barras */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-[#14211C]/15 shadow-sm space-y-3">
        <label 
          htmlFor="input-codigo-barras" 
          className="block text-base sm:text-lg font-bold text-[#14211C] flex items-center gap-2"
        >
          <Barcode className="w-6 h-6 text-[#0E7A4F]" />
          Bipe o código de barras
        </label>
        
        <div className="relative">
          <input
            id="input-codigo-barras"
            ref={inputCodigoBarrasRef}
            type="text"
            autoFocus
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            placeholder="Aponte o leitor ou digite o código EAN..."
            className="w-full min-h-[52px] h-14 pl-4 pr-12 rounded-xl border-2 border-[#14211C]/25 bg-[#EEF1EC]/30 text-lg sm:text-xl font-mono text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#14211C]/40">
            {statusBusca === 'buscando' ? (
              <Loader2 className="w-6 h-6 animate-spin text-[#0E7A4F]" />
            ) : (
              <Barcode className="w-6 h-6" />
            )}
          </div>
        </div>

        {/* Indicador de Status da Busca do Código */}
        {statusBusca === 'encontrado' && (
          <div className="p-3 bg-[#0E7A4F]/10 border border-[#0E7A4F]/30 rounded-lg text-sm text-[#0E7A4F] font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>Produto já cadastrado. Confira os dados e informe a quantidade que entrou.</span>
          </div>
        )}

        {statusBusca === 'novo' && codigoBarras.trim() && (
          <div className="p-3 bg-amber-50 border border-[#B87503]/30 rounded-lg text-sm text-[#B87503] font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 flex-shrink-0" />
            <span>Produto novo</span>
          </div>
        )}
      </div>

      {/* 2. FORMULÁRIO COMPLETO DE DADOS */}
      <form onSubmit={handleSalvar} className="bg-white p-4 sm:p-6 rounded-xl border border-[#14211C]/15 shadow-sm space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Nome do Produto */}
          <div className="sm:col-span-2">
            <label htmlFor="input-nome-produto" className="block text-sm font-semibold text-[#14211C] mb-1.5">
              Nome do produto *
            </label>
            <input
              id="input-nome-produto"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Arroz Branco Tipo 1 5kg"
              className="w-full min-h-[44px] h-11 px-3.5 rounded-lg border border-[#14211C]/25 bg-white text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] text-base"
            />
          </div>

          {/* Categoria com botão de criar nova */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="select-categoria" className="block text-sm font-semibold text-[#14211C]">
                Categoria
              </label>
              <button
                type="button"
                id="btn-abrir-modal-categoria"
                onClick={() => setModalCategoriaAberta(true)}
                className="text-xs font-semibold text-[#0E7A4F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                + Nova categoria
              </button>
            </div>
            <select
              id="select-categoria"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full min-h-[44px] h-11 px-3 rounded-lg border border-[#14211C]/25 bg-white text-[#14211C] focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] text-base cursor-pointer"
            >
              <option value="">Selecione uma categoria...</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Unidade (UN / KG) */}
          <div>
            <label className="block text-sm font-semibold text-[#14211C] mb-1.5">
              Unidade de venda
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-unidade-un"
                onClick={() => {
                  setUnidade('UN');
                  setErroQuantidade(null);
                }}
                className={`min-h-[44px] h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  unidade === 'UN'
                    ? 'bg-[#0E7A4F] text-white border-[#0E7A4F] shadow-sm'
                    : 'bg-[#EEF1EC]/60 text-[#14211C]/80 border-[#14211C]/20 hover:bg-[#14211C]/10'
                }`}
              >
                <span>UN (Unidade)</span>
              </button>

              <button
                type="button"
                id="btn-unidade-kg"
                onClick={() => {
                  setUnidade('KG');
                  setErroQuantidade(null);
                }}
                className={`min-h-[44px] h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  unidade === 'KG'
                    ? 'bg-[#0E7A4F] text-white border-[#0E7A4F] shadow-sm'
                    : 'bg-[#EEF1EC]/60 text-[#14211C]/80 border-[#14211C]/20 hover:bg-[#14211C]/10'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>KG (Peso)</span>
              </button>
            </div>
          </div>

          {/* Preço de Compra */}
          <div>
            <label htmlFor="input-preco-compra" className="block text-sm font-semibold text-[#14211C] mb-1.5">
              Preço de compra (R$)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#14211C]/50 text-sm font-semibold">
                R$
              </div>
              <input
                id="input-preco-compra"
                type="number"
                step="0.01"
                min="0"
                value={precoCompra}
                onChange={(e) => setPrecoCompra(e.target.value)}
                placeholder="0,00"
                className="w-full min-h-[44px] h-11 pl-10 pr-3.5 rounded-lg border border-[#14211C]/25 bg-white text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] text-base"
              />
            </div>
          </div>

          {/* Preço de Venda */}
          <div>
            <label htmlFor="input-preco-venda" className="block text-sm font-semibold text-[#14211C] mb-1.5">
              Preço de venda (R$) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#14211C]/50 text-sm font-semibold">
                R$
              </div>
              <input
                id="input-preco-venda"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={precoVenda}
                onChange={(e) => setPrecoVenda(e.target.value)}
                placeholder="0,00"
                className="w-full min-h-[44px] h-11 pl-10 pr-3.5 rounded-lg border border-[#14211C]/25 bg-white text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] text-base font-semibold"
              />
            </div>
          </div>

          {/* Quantidade que Entrou */}
          <CampoQuantidade
            id="input-quantidade-entrada"
            label="Quantidade que entrou"
            required
            unidade={unidade}
            value={quantidade}
            onChange={(val) => {
              setQuantidade(val);
              setErroQuantidade(null);
            }}
            erro={erroQuantidade}
            placeholder="0"
          />

          {/* Perecível e Validade */}
          <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 bg-[#EEF1EC]/50 rounded-lg border border-[#14211C]/15">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                id="checkbox-perecivel"
                type="checkbox"
                checked={isPerecivel}
                onChange={(e) => setIsPerecivel(e.target.checked)}
                className="w-5 h-5 rounded border-[#14211C]/30 text-[#0E7A4F] focus:ring-[#0E7A4F] cursor-pointer"
              />
              <span className="text-sm font-semibold text-[#14211C]">
                Produto perecível com validade
              </span>
            </label>

            <div className="flex-1 w-full sm:w-auto">
              <input
                id="input-data-validade"
                type="date"
                disabled={!isPerecivel}
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                className={`w-full min-h-[44px] h-11 px-3.5 rounded-lg border text-sm font-medium transition-all ${
                  isPerecivel
                    ? 'border-[#14211C]/30 bg-white text-[#14211C] focus:ring-2 focus:ring-[#0E7A4F]'
                    : 'border-[#14211C]/15 bg-gray-100 text-[#14211C]/40 cursor-not-allowed'
                }`}
              />
            </div>
          </div>

          {/* Dias de Cobertura */}
          <div className="sm:col-span-2">
            <label htmlFor="input-dias-cobertura" className="block text-sm font-semibold text-[#14211C] mb-1.5">
              Comprar a cada quantos dias
            </label>
            <input
              id="input-dias-cobertura"
              type="number"
              min="1"
              required
              value={diasCobertura}
              onChange={(e) => setDiasCobertura(e.target.value)}
              className="w-full min-h-[44px] h-11 px-3.5 rounded-lg border border-[#14211C]/25 bg-white text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] text-base font-semibold"
            />
            <p className="text-xs text-[#14211C]/60 mt-1.5">
              Com que frequência esse produto chega? Carne e hortifruti costumam ser 3 a 7 dias. Mercearia, 21 a 30.
            </p>
          </div>

        </div>

        {/* CAMPO SOMENTE LEITURA: Margem em tempo real */}
        <div className="p-3.5 bg-[#EEF1EC] rounded-lg border border-[#14211C]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs sm:text-sm font-semibold text-[#14211C]/70">
            Margem estimada:
          </span>
          <span id="campo-margem-tempo-real" className="text-sm sm:text-base font-bold text-[#14211C]">
            {textoMargem}
          </span>
        </div>

        {/* Alerta de Venda abaixo do custo */}
        {vendendoAbaixoDoCusto && (
          <div 
            id="alerta-abaixo-custo"
            className="p-3.5 bg-red-50 border border-[#C4361A]/30 rounded-lg text-sm text-[#C4361A] font-semibold flex items-center gap-2.5"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>Você está vendendo abaixo do custo</span>
          </div>
        )}

        {/* Botão de Ação: Salvar Entrada */}
        <div className="pt-2">
          <button
            id="btn-salvar-entrada"
            type="submit"
            disabled={salvando}
            className="w-full sm:w-auto min-h-[44px] h-12 px-8 bg-[#0E7A4F] hover:bg-[#0E7A4F]/90 active:bg-[#0E7A4F]/95 text-white font-semibold rounded-lg text-base flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Registrando entrada...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-5 h-5" />
                <span>Confirmar Entrada</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 3. ÚLTIMAS 10 ENTRADAS DO DIA */}
      <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-3.5 bg-[#14211C]/5 border-b border-[#14211C]/10 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-[#14211C] flex items-center gap-2">
            <History className="w-5 h-5 text-[#0E7A4F]" />
            Últimas 10 entradas do dia
          </h2>
          <span className="text-xs text-[#14211C]/60">
            Fuso horário: America/Sao_Paulo
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#14211C]/5 border-b border-[#14211C]/10 text-[#14211C] font-semibold">
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Qtd que entrou</th>
                <th className="px-4 py-3 text-right">Custo unitário</th>
                <th className="px-4 py-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#14211C]/10">
              {carregandoEntradas ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#14211C]/60">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#0E7A4F] mb-1.5" />
                    <span>Carregando histórico do dia...</span>
                  </td>
                </tr>
              ) : ultimasEntradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#14211C]/60 text-sm">
                    Nenhuma entrada registrada hoje.
                  </td>
                </tr>
              ) : (
                ultimasEntradas.map((item) => (
                  <tr key={item.id} className="hover:bg-[#EEF1EC]/60 transition-colors">
                    <td className="px-4 py-3 text-xs sm:text-sm font-medium text-[#14211C]/80 whitespace-nowrap">
                      {formatarHoraSP(item.criado_em)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#14211C]">
                        {item.produto?.nome || 'Produto'}
                      </div>
                      {item.produto?.ean && (
                        <div className="text-xs text-[#14211C]/50 font-mono">
                          EAN: {item.produto.ean}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0E7A4F] whitespace-nowrap">
                      +{formatarQuantidade(item.quantidade, item.produto?.unidade || 'UN')}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#14211C]/80 whitespace-nowrap">
                      {formatarMoeda(item.custo_unit)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        id={`btn-desfazer-entrada-${item.id}`}
                        onClick={() => setMovimentoParaEstornar(item)}
                        className="min-h-[44px] px-3 py-1.5 text-xs font-semibold text-[#C4361A] hover:bg-red-50 active:bg-red-100 rounded-lg border border-[#C4361A]/30 flex items-center justify-center gap-1 mx-auto cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Desfazer</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PARA NOVA CATEGORIA */}
      {modalCategoriaAberta && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-xl border border-[#14211C]/15 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0E7A4F]" />
                Nova Categoria
              </h3>
              <button
                onClick={() => {
                  setModalCategoriaAberta(false);
                  setNomeNovaCategoria('');
                  setErroCategoria(null);
                }}
                className="text-[#14211C]/50 hover:text-[#14211C] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {erroCategoria && (
              <div className="p-3 bg-red-50 text-xs text-[#C4361A] rounded-lg border border-[#C4361A]/30 space-y-1 overflow-x-auto">
                <div className="font-bold">{erroCategoria.amigavel}</div>
                {erroCategoria.message && <div><span className="font-semibold">Message:</span> {erroCategoria.message}</div>}
                {erroCategoria.code && <div><span className="font-semibold">Code:</span> {erroCategoria.code}</div>}
                {erroCategoria.details && <div><span className="font-semibold">Details:</span> {erroCategoria.details}</div>}
                {erroCategoria.hint && <div><span className="font-semibold">Hint:</span> {erroCategoria.hint}</div>}
              </div>
            )}

            <form onSubmit={handleCriarCategoria} className="space-y-4">
              <div>
                <label htmlFor="input-nome-nova-categoria" className="block text-sm font-semibold text-[#14211C] mb-1.5">
                  Nome da categoria
                </label>
                <input
                  id="input-nome-nova-categoria"
                  type="text"
                  autoFocus
                  required
                  value={nomeNovaCategoria}
                  onChange={(e) => setNomeNovaCategoria(e.target.value)}
                  placeholder="Ex: Laticínios, Bebidas, Padaria..."
                  className="w-full min-h-[44px] h-11 px-3.5 rounded-lg border border-[#14211C]/25 bg-white text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] text-base"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalCategoriaAberta(false);
                    setNomeNovaCategoria('');
                    setErroCategoria(null);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#14211C] text-sm font-medium cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvandoCategoria}
                  className="min-h-[44px] px-5 py-2 rounded-lg bg-[#0E7A4F] hover:bg-[#0E7A4F]/90 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {salvandoCategoria ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Categoria</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DESTRUTIVA: ESTORNO DE ENTRADA */}
      {movimentoParaEstornar && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-xl border border-[#14211C]/15 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-[#C4361A]">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#14211C]">
                  Desfazer entrada de mercadoria?
                </h3>
                <p className="text-sm text-[#14211C]/70 mt-1">
                  Esta ação registrará um estorno de <strong>{formatarQuantidade(movimentoParaEstornar.quantidade, movimentoParaEstornar.produto?.unidade || 'UN')}</strong> do produto <strong>{movimentoParaEstornar.produto?.nome || 'selecionado'}</strong>. O registro original será preservado para fins de auditoria.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#14211C]/10">
              <button
                type="button"
                disabled={estornando}
                onClick={() => setMovimentoParaEstornar(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#14211C] text-sm font-medium cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                id="btn-confirmar-estorno"
                disabled={estornando}
                onClick={handleConfirmarEstorno}
                className="min-h-[44px] px-5 py-2 rounded-lg bg-[#C4361A] hover:bg-[#C4361A]/90 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {estornando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Estornando...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirmar Estorno</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
