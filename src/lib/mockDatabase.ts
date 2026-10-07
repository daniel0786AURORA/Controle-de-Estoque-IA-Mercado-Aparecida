import type { Perfil, Produto, Categoria, Lote, Movimento, PapelUsuario } from '../types';

export const EMPRESA_ID_PADRAO = 'empresa_mercado_aparecida';

export const USUARIO_TESTE_ADMIN = {
  id: 'usr_teste_admin_01',
  app_metadata: { provider: 'email' },
  user_metadata: { nome: 'Daniel (Administrador)' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'daniel@mercadoaparecida.com.br',
  role: 'authenticated',
  updated_at: new Date().toISOString(),
};

export const PERFIL_TESTE_ADMIN: Perfil = {
  id: 'usr_teste_admin_01',
  empresa_id: EMPRESA_ID_PADRAO,
  nome: 'Daniel (Administrador)',
  papel: 'dono',
};

export const PERFIL_TESTE_OPERADOR: Perfil = {
  id: 'usr_teste_operador_01',
  empresa_id: EMPRESA_ID_PADRAO,
  nome: 'Operador de Caixa 01',
  papel: 'operador',
};

// Dados padrão iniciais
const CATEGORIAS_INICIAIS: Categoria[] = [
  { id: 'cat_mercearia', empresa_id: EMPRESA_ID_PADRAO, nome: 'Mercearia' },
  { id: 'cat_bebidas', empresa_id: EMPRESA_ID_PADRAO, nome: 'Bebidas' },
  { id: 'cat_laticinios', empresa_id: EMPRESA_ID_PADRAO, nome: 'Laticínios e Frios' },
  { id: 'cat_limpeza', empresa_id: EMPRESA_ID_PADRAO, nome: 'Limpeza' },
  { id: 'cat_hortifruti', empresa_id: EMPRESA_ID_PADRAO, nome: 'Hortifrúti' },
  { id: 'cat_higiene', empresa_id: EMPRESA_ID_PADRAO, nome: 'Higiene & Perfumaria' },
  { id: 'cat_padaria', empresa_id: EMPRESA_ID_PADRAO, nome: 'Padaria & Biscoitos' },
];

const PRODUTOS_INICIAIS: Produto[] = [
  {
    id: 'prod_arroz_5kg',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7896006711124',
    nome: 'Arroz Tipo 1 Camil 5kg',
    categoria_id: 'cat_mercearia',
    unidade: 'un',
    custo: 21.50,
    preco: 29.90,
    perecivel: false,
    estoque_minimo: 20,
    ativo: true,
    criado_em: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 'prod_feijao_1kg',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7896006721017',
    nome: 'Feijão Carioca Camil 1kg',
    categoria_id: 'cat_mercearia',
    unidade: 'un',
    custo: 5.90,
    preco: 8.79,
    perecivel: false,
    estoque_minimo: 25,
    ativo: true,
    criado_em: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 'prod_oleo_soya',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7891107101235',
    nome: 'Óleo de Soja Soya 900ml',
    categoria_id: 'cat_mercearia',
    unidade: 'un',
    custo: 5.10,
    preco: 6.99,
    perecivel: false,
    estoque_minimo: 30,
    ativo: true,
    criado_em: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 'prod_leite_pira',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7898215151234',
    nome: 'Leite Integral Piracanjuba 1L',
    categoria_id: 'cat_laticinios',
    unidade: 'un',
    custo: 3.80,
    preco: 4.99,
    perecivel: true,
    estoque_minimo: 40,
    ativo: true,
    criado_em: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'prod_cafe_melitta',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7891025101119',
    nome: 'Café Torrado Melitta 500g',
    categoria_id: 'cat_mercearia',
    unidade: 'un',
    custo: 13.50,
    preco: 18.90,
    perecivel: false,
    estoque_minimo: 15,
    ativo: true,
    criado_em: new Date(Date.now() - 80 * 86400000).toISOString(),
  },
  {
    id: 'prod_coca_2l',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7894900011517',
    nome: 'Refrigerante Coca-Cola 2L',
    categoria_id: 'cat_bebidas',
    unidade: 'un',
    custo: 7.20,
    preco: 10.49,
    perecivel: false,
    estoque_minimo: 20,
    ativo: true,
    criado_em: new Date(Date.now() - 70 * 86400000).toISOString(),
  },
  {
    id: 'prod_sabao_omo',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7891150028823',
    nome: 'Sabão em Pó OMO Lavagem Perfeita 1,6kg',
    categoria_id: 'cat_limpeza',
    unidade: 'un',
    custo: 16.80,
    preco: 22.90,
    perecivel: false,
    estoque_minimo: 12,
    ativo: true,
    criado_em: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'prod_detergente_ype',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7891022100016',
    nome: 'Detergente Líquido Ypê Neutro 500ml',
    categoria_id: 'cat_limpeza',
    unidade: 'un',
    custo: 1.65,
    preco: 2.49,
    perecivel: false,
    estoque_minimo: 30,
    ativo: true,
    criado_em: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'prod_acucar_uniao',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7891910000108',
    nome: 'Açúcar Refinado União 1kg',
    categoria_id: 'cat_mercearia',
    unidade: 'un',
    custo: 3.40,
    preco: 4.69,
    perecivel: false,
    estoque_minimo: 20,
    ativo: true,
    criado_em: new Date(Date.now() - 70 * 86400000).toISOString(),
  },
  {
    id: 'prod_mussarela_200g',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7896102500012',
    nome: 'Queijo Mussarela Fatiado 200g',
    categoria_id: 'cat_laticinios',
    unidade: 'un',
    custo: 7.50,
    preco: 11.90,
    perecivel: true,
    estoque_minimo: 15,
    ativo: true,
    criado_em: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'prod_iogurte_danone',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7891025801200',
    nome: 'Iogurte Morango Danone 170g',
    categoria_id: 'cat_laticinios',
    unidade: 'un',
    custo: 2.10,
    preco: 3.49,
    perecivel: true,
    estoque_minimo: 12,
    ativo: true,
    criado_em: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'prod_macarrao_barilla',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7891025400011',
    nome: 'Macarrão Espaguete nº 5 Barilla 500g',
    categoria_id: 'cat_mercearia',
    unidade: 'un',
    custo: 4.20,
    preco: 6.49,
    perecivel: false,
    estoque_minimo: 15,
    ativo: true,
    criado_em: new Date(Date.now() - 50 * 86400000).toISOString(),
  },
  {
    id: 'prod_biscoito_passatempo',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7891000244107',
    nome: 'Biscoito Recheado Passatempo 130g',
    categoria_id: 'cat_padaria',
    unidade: 'un',
    custo: 2.30,
    preco: 3.79,
    perecivel: false,
    estoque_minimo: 20,
    ativo: true,
    criado_em: new Date(Date.now() - 50 * 86400000).toISOString(),
  },
  {
    id: 'prod_tomate_italiano',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '2000000000018',
    nome: 'Tomate Italiano Selecionado',
    categoria_id: 'cat_hortifruti',
    unidade: 'kg',
    custo: 4.50,
    preco: 7.99,
    perecivel: true,
    estoque_minimo: 10,
    ativo: true,
    criado_em: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'prod_banana_prata',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '2000000000025',
    nome: 'Banana Prata Fresca',
    categoria_id: 'cat_hortifruti',
    unidade: 'kg',
    custo: 3.20,
    preco: 5.49,
    perecivel: true,
    estoque_minimo: 10,
    ativo: true,
    criado_em: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'prod_parado_palmito',
    empresa_id: EMPRESA_ID_PADRAO,
    ean: '7896541230019',
    nome: 'Palmito Pupunha em Conserva Vidro 300g',
    categoria_id: 'cat_mercearia',
    unidade: 'un',
    custo: 18.00,
    preco: 26.90,
    perecivel: false,
    estoque_minimo: 5,
    ativo: true,
    criado_em: new Date(Date.now() - 120 * 86400000).toISOString(),
  },
];

// Saldos de estoque iniciais por produto
const SALDOS_INICIAIS: Record<string, number> = {
  prod_arroz_5kg: 48,
  prod_feijao_1kg: 55,
  prod_oleo_soya: 72,
  prod_leite_pira: 110,
  prod_cafe_melitta: 80,
  prod_coca_2l: 45,
  prod_sabao_omo: 60,
  prod_detergente_ype: 85,
  prod_acucar_uniao: 42,
  prod_mussarela_200g: 25,
  prod_iogurte_danone: 30,
  prod_macarrao_barilla: 38,
  prod_biscoito_passatempo: 29,
  prod_tomate_italiano: 12.5,
  prod_banana_prata: 15.0,
  prod_parado_palmito: 100, // Principal concentração de capital parado
};

// Vendas dos últimos 30 dias para cálculo de giro e ranking
const GIRO_30D_INICIAL: Record<string, { vendido_30d: number; media_dia: number }> = {
  prod_arroz_5kg: { vendido_30d: 94, media_dia: 3.13 },
  prod_feijao_1kg: { vendido_30d: 82, media_dia: 2.73 },
  prod_leite_pira: { vendido_30d: 165, media_dia: 5.50 },
  prod_coca_2l: { vendido_30d: 110, media_dia: 3.67 },
  prod_cafe_melitta: { vendido_30d: 0, media_dia: 0 }, // estoque lento
  prod_oleo_soya: { vendido_30d: 75, media_dia: 2.50 },
  prod_detergente_ype: { vendido_30d: 90, media_dia: 3.00 },
  prod_sabao_omo: { vendido_30d: 0, media_dia: 0 }, // compra excessiva
  prod_acucar_uniao: { vendido_30d: 62, media_dia: 2.07 },
  prod_mussarela_200g: { vendido_30d: 0, media_dia: 0 }, // perecível lento
  prod_iogurte_danone: { vendido_30d: 0, media_dia: 0 }, // perecível lento
  prod_macarrao_barilla: { vendido_30d: 48, media_dia: 1.60 },
  prod_biscoito_passatempo: { vendido_30d: 52, media_dia: 1.73 },
  prod_tomate_italiano: { vendido_30d: 45, media_dia: 1.50 },
  prod_banana_prata: { vendido_30d: 60, media_dia: 2.00 },
  prod_parado_palmito: { vendido_30d: 0, media_dia: 0 }, // Parado há mais de 60 dias
};

const criarDataRelativa = (dias: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
};

const LOTES_INICIAIS: Lote[] = [
  {
    id: 'lote_iogurte_01',
    empresa_id: EMPRESA_ID_PADRAO,
    produto_id: 'prod_iogurte_danone',
    validade: criarDataRelativa(3), // Vence em 3 dias! Alerta urgente
    custo: 2.10,
    criado_em: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'lote_mussarela_01',
    empresa_id: EMPRESA_ID_PADRAO,
    produto_id: 'prod_mussarela_200g',
    validade: criarDataRelativa(7), // Vence em 7 dias!
    custo: 7.50,
    criado_em: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'lote_leite_01',
    empresa_id: EMPRESA_ID_PADRAO,
    produto_id: 'prod_leite_pira',
    validade: criarDataRelativa(35),
    custo: 3.80,
    criado_em: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'lote_arroz_01',
    empresa_id: EMPRESA_ID_PADRAO,
    produto_id: 'prod_arroz_5kg',
    validade: criarDataRelativa(180),
    custo: 21.50,
    criado_em: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

// Movimentos e Vendas de Hoje
const hojeISO = new Date().toISOString();
const inicioDia = new Date();
inicioDia.setHours(8, 0, 0, 0);

const VENDAS_HOJE_INICIAIS = [
  {
    id: 'venda_hoje_01',
    empresa_id: EMPRESA_ID_PADRAO,
    operador_id: USUARIO_TESTE_ADMIN.id,
    total: 87.50,
    desconto: 0,
    forma_pagamento: 'pix',
    criado_em: new Date(inicioDia.getTime() + 1800000).toISOString(),
  },
  {
    id: 'venda_hoje_02',
    empresa_id: EMPRESA_ID_PADRAO,
    operador_id: USUARIO_TESTE_ADMIN.id,
    total: 142.30,
    desconto: 5.0,
    desconto_motivo: 'Cliente Fidelidade',
    forma_pagamento: 'credito',
    criado_em: new Date(inicioDia.getTime() + 5400000).toISOString(),
  },
  {
    id: 'venda_hoje_03',
    empresa_id: EMPRESA_ID_PADRAO,
    operador_id: USUARIO_TESTE_ADMIN.id,
    total: 34.90,
    desconto: 0,
    forma_pagamento: 'dinheiro',
    criado_em: new Date(inicioDia.getTime() + 9000000).toISOString(),
  },
  {
    id: 'venda_hoje_04',
    empresa_id: EMPRESA_ID_PADRAO,
    operador_id: USUARIO_TESTE_ADMIN.id,
    total: 62.40,
    desconto: 0,
    forma_pagamento: 'debito',
    criado_em: new Date(inicioDia.getTime() + 12000000).toISOString(),
  },
];

class MockDatabaseService {
  private produtos: Produto[] = [...PRODUTOS_INICIAIS];
  private categorias: Categoria[] = [...CATEGORIAS_INICIAIS];
  private lotes: Lote[] = [...LOTES_INICIAIS];
  private saldos: Record<string, number> = { ...SALDOS_INICIAIS };
  private giro30d: Record<string, { vendido_30d: number; media_dia: number }> = { ...GIRO_30D_INICIAL };
  private vendas: any[] = [...VENDAS_HOJE_INICIAIS];
  private itensVenda: any[] = [];
  private configTaxa = {
    empresa_id: EMPRESA_ID_PADRAO,
    dinheiro: 0.0,
    pix: 0.0,
    debito: 0.014,
    credito: 0.032,
    desconto_max_operador: 5.0,
  };

  constructor() {
    this.carregarDoLocalStorage();
  }

  private salvarNoLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('mercado_mock_produtos', JSON.stringify(this.produtos));
        localStorage.setItem('mercado_mock_categorias', JSON.stringify(this.categorias));
        localStorage.setItem('mercado_mock_lotes', JSON.stringify(this.lotes));
        localStorage.setItem('mercado_mock_saldos', JSON.stringify(this.saldos));
        localStorage.setItem('mercado_mock_vendas', JSON.stringify(this.vendas));
      }
    } catch (e) {
      // Ignora erro de cota de armazenamento
    }
  }

  private carregarDoLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const prod = localStorage.getItem('mercado_mock_produtos');
        if (prod) this.produtos = JSON.parse(prod);

        const cat = localStorage.getItem('mercado_mock_categorias');
        if (cat) this.categorias = JSON.parse(cat);

        const lot = localStorage.getItem('mercado_mock_lotes');
        if (lot) this.lotes = JSON.parse(lot);

        const sal = localStorage.getItem('mercado_mock_saldos');
        if (sal) this.saldos = JSON.parse(sal);

        const ven = localStorage.getItem('mercado_mock_vendas');
        if (ven) this.vendas = JSON.parse(ven);
      }
    } catch (e) {
      // Usa dados padrão
    }
  }

  // --- MÉTODOS DE CONSULTA ---
  public getCategorias(empresaId?: string): Categoria[] {
    return [...this.categorias];
  }

  public getProdutos(empresaId?: string): Produto[] {
    return [...this.produtos];
  }

  public getLotes(empresaId?: string): Lote[] {
    return [...this.lotes];
  }

  public getEstoqueView(empresaId?: string) {
    return this.produtos.map((p) => {
      const saldo = this.saldos[p.id] ?? 10;
      return {
        produto_id: p.id,
        empresa_id: p.empresa_id,
        saldo,
        valor_custo: Number((saldo * p.custo).toFixed(2)),
      };
    });
  }

  public getPrecoAtualView(empresaId?: string) {
    return this.produtos.map((p) => ({
      produto_id: p.id,
      empresa_id: p.empresa_id,
      preco_cheio: p.preco,
      desconto_pct: 0,
      preco_venda: p.preco,
    }));
  }

  public getGiro30dView(empresaId?: string) {
    return this.produtos.map((p) => {
      const info = this.giro30d[p.id] || { vendido_30d: 15, media_dia: 0.5 };
      return {
        produto_id: p.id,
        empresa_id: p.empresa_id,
        vendido_30d: info.vendido_30d,
        media_dia: info.media_dia,
      };
    });
  }

  public getVendas(empresaId?: string, inicioISO?: string) {
    if (inicioISO) {
      const minDate = new Date(inicioISO).getTime();
      return this.vendas.filter((v) => new Date(v.criado_em).getTime() >= minDate);
    }
    return [...this.vendas];
  }

  public getItensVendaHoje(empresaId?: string, inicioISO?: string) {
    return this.produtos.slice(0, 5).map((p, idx) => ({
      id: `iv_${idx}`,
      produto_id: p.id,
      quantidade: 2,
      preco_unit: p.preco,
      custo_unit: p.custo,
      desconto_unit: 0,
      venda: { criado_em: hojeISO, empresa_id: EMPRESA_ID_PADRAO },
    }));
  }

  public getMovimentosVenda(empresaId?: string) {
    return this.produtos.map((p, idx) => {
      // Para o produto parado, sem data recente
      if (p.id === 'prod_parado_palmito') {
        return {
          id: `mov_p_${idx}`,
          produto_id: p.id,
          tipo: 'venda',
          criado_em: new Date(Date.now() - 75 * 86400000).toISOString(),
        };
      }
      return {
        id: `mov_${idx}`,
        produto_id: p.id,
        tipo: 'venda',
        criado_em: new Date(Date.now() - (idx % 5) * 86400000).toISOString(),
      };
    });
  }

  public getConfigTaxa(empresaId?: string) {
    return { ...this.configTaxa };
  }

  public getPerfil(userId: string): Perfil {
    if (userId === PERFIL_TESTE_OPERADOR.id) {
      return PERFIL_TESTE_OPERADOR;
    }
    return PERFIL_TESTE_ADMIN;
  }

  // --- MÉTODOS DE MUTACÃO ---
  public adicionarProduto(novo: Partial<Produto>): Produto {
    const prodCompleto: Produto = {
      id: novo.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      empresa_id: novo.empresa_id || EMPRESA_ID_PADRAO,
      ean: novo.ean || null,
      nome: novo.nome || 'Produto Sem Nome',
      categoria_id: novo.categoria_id || null,
      unidade: (novo.unidade as 'un' | 'kg') || 'un',
      custo: Number(novo.custo || 0),
      preco: Number(novo.preco || 0),
      perecivel: Boolean(novo.perecivel),
      estoque_minimo: novo.estoque_minimo ? Number(novo.estoque_minimo) : 10,
      ativo: novo.ativo !== false,
      criado_em: new Date().toISOString(),
    };

    this.produtos.push(prodCompleto);
    this.saldos[prodCompleto.id] = 10; // Saldo padrão inicial
    this.giro30d[prodCompleto.id] = { vendido_30d: 0, media_dia: 0 };
    this.salvarNoLocalStorage();
    return prodCompleto;
  }

  public atualizarProduto(id: string, updates: Partial<Produto>): Produto | null {
    const idx = this.produtos.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.produtos[idx] = { ...this.produtos[idx], ...updates };
    this.salvarNoLocalStorage();
    return this.produtos[idx];
  }

  public adicionarCategoria(nome: string, empresaId?: string): Categoria {
    const nova: Categoria = {
      id: `cat_${Date.now()}`,
      empresa_id: empresaId || EMPRESA_ID_PADRAO,
      nome,
    };
    this.categorias.push(nova);
    this.salvarNoLocalStorage();
    return nova;
  }

  public adicionarLote(lote: Partial<Lote>): Lote {
    const novoLote: Lote = {
      id: lote.id || `lote_${Date.now()}`,
      empresa_id: lote.empresa_id || EMPRESA_ID_PADRAO,
      produto_id: lote.produto_id || '',
      validade: lote.validade || null,
      custo: Number(lote.custo || 0),
      criado_em: new Date().toISOString(),
    };
    this.lotes.push(novoLote);
    this.salvarNoLocalStorage();
    return novoLote;
  }

  public atualizarEstoque(produtoId: string, deltaOuNovo: number, isDelta: boolean = true) {
    const atual = this.saldos[produtoId] ?? 0;
    const novoSaldo = isDelta ? Math.max(0, atual + deltaOuNovo) : Math.max(0, deltaOuNovo);
    this.saldos[produtoId] = novoSaldo;
    this.salvarNoLocalStorage();
    return novoSaldo;
  }

  public fecharVendaRPC(params: {
    p_itens: Array<{
      produto_id: string;
      quantidade: number;
      preco_unit: number;
      custo_unit: number;
      desconto_unit?: number;
    }>;
    p_forma: string;
    operador_id?: string;
  }): string {
    const vendaId = `venda_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let totalVenda = 0;
    let descontoTotal = 0;

    params.p_itens.forEach((item) => {
      const precoFinal = item.preco_unit;
      const subtotal = precoFinal * item.quantidade;
      totalVenda += subtotal;
      descontoTotal += (item.desconto_unit || 0) * item.quantidade;

      // Abate do estoque
      this.atualizarEstoque(item.produto_id, -item.quantidade, true);

      // Incrementa giro
      if (this.giro30d[item.produto_id]) {
        this.giro30d[item.produto_id].vendido_30d += item.quantidade;
      }

      this.itensVenda.push({
        id: `iv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        venda_id: vendaId,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unit: item.preco_unit,
        custo_unit: item.custo_unit,
        desconto_unit: item.desconto_unit || 0,
      });
    });

    const novaVenda = {
      id: vendaId,
      empresa_id: EMPRESA_ID_PADRAO,
      operador_id: params.operador_id || USUARIO_TESTE_ADMIN.id,
      total: Number(totalVenda.toFixed(2)),
      desconto: Number(descontoTotal.toFixed(2)),
      forma_pagamento: params.p_forma,
      criado_em: new Date().toISOString(),
    };

    this.vendas.unshift(novaVenda);
    this.salvarNoLocalStorage();
    return vendaId;
  }

  public atualizarVenda(id: string, updates: any) {
    const idx = this.vendas.findIndex((v) => v.id === id);
    if (idx !== -1) {
      this.vendas[idx] = { ...this.vendas[idx], ...updates };
      this.salvarNoLocalStorage();
    }
  }

  public atualizarConfigTaxa(updates: any) {
    this.configTaxa = { ...this.configTaxa, ...updates };
    return this.configTaxa;
  }
}

export const mockDatabase = new MockDatabaseService();
