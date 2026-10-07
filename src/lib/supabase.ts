import { createClient } from '@supabase/supabase-js';
import {
  mockDatabase,
  USUARIO_TESTE_ADMIN,
  PERFIL_TESTE_ADMIN,
  PERFIL_TESTE_OPERADOR,
  EMPRESA_ID_PADRAO
} from './mockDatabase';

// Helper para ler variáveis de ambiente de forma segura no Vite/TypeScript
const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env) {
    return (import.meta as unknown as { env: Record<string, string> }).env[key] || '';
  }
  return '';
};

const supabaseUrl =
  getEnv('VITE_SUPABASE_URL') ||
  getEnv('SUPABASE_URL') ||
  '';

const supabaseAnonKey =
  getEnv('VITE_SUPABASE_ANON_KEY') ||
  getEnv('SUPABASE_ANON_KEY') ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

// Cria o cliente real Supabase
const realSupabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// Usa mock automaticamente apenas quando não há configuração real de Supabase.
const temSupabaseReal = Boolean(
  (import.meta as any).env.VITE_SUPABASE_URL &&
  (import.meta as any).env.VITE_SUPABASE_ANON_KEY
);
let fallbackToMock = !temSupabaseReal;

export function setModoMock(ativo: boolean) {
  fallbackToMock = ativo;
}

export function isModoMock(): boolean {
  return fallbackToMock;
}

// Simulador de Query Builder para o banco em memória/localStorage
class MockQueryBuilder {
  private tabela: string;
  private filtros: Array<(item: any) => boolean> = [];
  private ordenacoes: Array<{ campo: string; ascending: boolean }> = [];
  private limiteQtd?: number;
  private querContagem = false;
  private isSingle = false;
  private isMaybeSingle = false;
  private acao: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payloadParaGravar: any = null;

  constructor(tabela: string) {
    this.tabela = tabela;
  }

  select(colunas: string = '*', options?: { count?: string }) {
    if (this.acao === 'select') {
      this.acao = 'select';
    }
    if (options?.count === 'exact') {
      this.querContagem = true;
    }
    return this;
  }

  insert(payload: any) {
    this.acao = 'insert';
    this.payloadParaGravar = payload;
    return this;
  }

  update(payload: any) {
    this.acao = 'update';
    this.payloadParaGravar = payload;
    return this;
  }

  upsert(payload: any, _options?: any) {
    this.acao = 'upsert';
    this.payloadParaGravar = payload;
    return this;
  }

  delete() {
    this.acao = 'delete';
    return this;
  }

  eq(campo: string, valor: any) {
    this.filtros.push((item) => {
      // Suporte para joins tipo venda.empresa_id
      if (campo.includes('.')) {
        const partes = campo.split('.');
        const valObj = item[partes[0]]?.[partes[1]];
        return valObj === valor;
      }
      return item[campo] === valor;
    });
    return this;
  }

  neq(campo: string, valor: any) {
    this.filtros.push((item) => item[campo] !== valor);
    return this;
  }

  gt(campo: string, valor: any) {
    this.filtros.push((item) => Number(item[campo]) > Number(valor));
    return this;
  }

  gte(campo: string, valor: any) {
    this.filtros.push((item) => {
      if (typeof valor === 'string' && valor.includes('T')) {
        return new Date(item[campo]).getTime() >= new Date(valor).getTime();
      }
      return Number(item[campo]) >= Number(valor);
    });
    return this;
  }

  lt(campo: string, valor: any) {
    this.filtros.push((item) => Number(item[campo]) < Number(valor));
    return this;
  }

  lte(campo: string, valor: any) {
    this.filtros.push((item) => {
      if (typeof valor === 'string' && valor.includes('T')) {
        return new Date(item[campo]).getTime() <= new Date(valor).getTime();
      }
      return Number(item[campo]) <= Number(valor);
    });
    return this;
  }

  in(campo: string, valores: any[]) {
    this.filtros.push((item) => {
      return valores.includes(item[campo]);
    });
    return this;
  }

  ilike(campo: string, valor: string) {
    const valBuscado = valor.replace(/%/g, '').toLowerCase();
    this.filtros.push((item) => {
      const v = String(item[campo] || '').toLowerCase();
      return v.includes(valBuscado);
    });
    return this;
  }

  not(campo: string, operador: string, valor: any) {
    if (operador === 'is' && valor === null) {
      this.filtros.push((item) => item[campo] !== null && item[campo] !== undefined);
    } else {
      this.filtros.push((item) => item[campo] !== valor);
    }
    return this;
  }

  is(campo: string, valor: any) {
    this.filtros.push((item) => item[campo] === valor);
    return this;
  }

  range(from: number, to: number) {
    this.limiteQtd = Math.max(1, to - from + 1);
    return this;
  }

  or(condicaoOr: string) {
    // Ex: "nome.ilike.%termo%,ean.ilike.%termo%"
    const partes = condicaoOr.split(',');
    this.filtros.push((item) => {
      return partes.some((cond) => {
        const sub = cond.split('.ilike.');
        if (sub.length === 2) {
          const campo = sub[0];
          const valBuscado = sub[1].replace(/%/g, '').toLowerCase();
          const valorCampo = String(item[campo] || '').toLowerCase();
          return valorCampo.includes(valBuscado);
        }
        return false;
      });
    });
    return this;
  }

  order(campo: string, options?: { ascending?: boolean }) {
    this.ordenacoes.push({
      campo,
      ascending: options?.ascending !== false,
    });
    return this;
  }

  limit(qtd: number) {
    this.limiteQtd = qtd;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private executarMock(): { data: any; count?: number; error: any } {
    let dataset: any[] = [];

    switch (this.tabela) {
      case 'categoria':
        dataset = mockDatabase.getCategorias();
        break;
      case 'produto':
        dataset = mockDatabase.getProdutos();
        break;
      case 'lote':
        dataset = mockDatabase.getLotes();
        break;
      case 'v_estoque':
        dataset = mockDatabase.getEstoqueView();
        break;
      case 'v_preco_atual':
        dataset = mockDatabase.getPrecoAtualView();
        break;
      case 'v_giro':
      case 'v_giro_30d':
        dataset = mockDatabase.getGiro30dView();
        break;
      case 'venda':
        dataset = mockDatabase.getVendas();
        break;
      case 'venda_item':
      case 'item_venda':
        dataset = mockDatabase.getItensVendaHoje();
        break;
      case 'movimento':
        dataset = mockDatabase.getMovimentosVenda();
        break;
      case 'config_taxa':
        dataset = [mockDatabase.getConfigTaxa()];
        break;
      case 'promocao':
        dataset = mockDatabase.getPromocoes();
        break;
      case 'relatorio':
        dataset = mockDatabase.getRelatorios();
        break;
      case 'perfil':
        dataset = [PERFIL_TESTE_ADMIN, PERFIL_TESTE_OPERADOR];
        break;
      case 'empresa':
        dataset = [{ id: EMPRESA_ID_PADRAO, nome: 'Mercado Aparecida' }];
        break;
      default:
        dataset = [];
    }

    // Processamento de Ações de Escrita
    if (this.acao === 'insert') {
      const payload = this.payloadParaGravar;
      let resultadoGravado: any = null;

      if (this.tabela === 'produto') {
        resultadoGravado = mockDatabase.adicionarProduto(payload);
      } else if (this.tabela === 'categoria') {
        resultadoGravado = mockDatabase.adicionarCategoria(payload.nome, payload.empresa_id);
      } else if (this.tabela === 'lote') {
        resultadoGravado = mockDatabase.adicionarLote(payload);
      } else if (this.tabela === 'movimento') {
        resultadoGravado = { id: `mov_${Date.now()}`, ...payload };
        if (payload.produto_id && payload.quantidade) {
          const delta = payload.tipo === 'entrada' ? Number(payload.quantidade) : -Number(payload.quantidade);
          mockDatabase.atualizarEstoque(payload.produto_id, delta, true);
        }
      } else if (this.tabela === 'venda') {
        resultadoGravado = { id: `venda_${Date.now()}`, criado_em: new Date().toISOString(), ...payload };
      } else if (this.tabela === 'promocao') {
        resultadoGravado = mockDatabase.adicionarPromocao(payload);
      } else if (this.tabela === 'relatorio') {
        resultadoGravado = mockDatabase.adicionarRelatorio(payload);
      } else {
        resultadoGravado = { id: `item_${Date.now()}`, ...payload };
      }

      return {
        data: this.isSingle ? resultadoGravado : [resultadoGravado],
        count: 1,
        error: null,
      };
    }

    if (this.acao === 'update') {
      const payload = this.payloadParaGravar;
      // Aplica update nos registros que baterem com o filtro
      if (this.tabela === 'produto') {
        // Encontra o id se houver filtro
        dataset.filter((item) => this.filtros.every((f) => f(item))).forEach((prod) => {
          mockDatabase.atualizarProduto(prod.id, payload);
        });
      } else if (this.tabela === 'venda') {
        dataset.filter((item) => this.filtros.every((f) => f(item))).forEach((v) => {
          mockDatabase.atualizarVenda(v.id, payload);
        });
      } else if (this.tabela === 'config_taxa') {
        mockDatabase.atualizarConfigTaxa(payload);
      } else if (this.tabela === 'promocao') {
        dataset.filter((item) => this.filtros.every((f) => f(item))).forEach((p) => {
          mockDatabase.atualizarPromocao(p.id, payload);
        });
      }
      return { data: payload, error: null };
    }

    if (this.acao === 'upsert') {
      const payload = this.payloadParaGravar;
      if (this.tabela === 'config_taxa') {
        mockDatabase.atualizarConfigTaxa(payload);
      }
      return { data: payload, error: null };
    }

    // Filtragem para SELECT
    let filtrados = dataset.filter((item) => this.filtros.every((f) => f(item)));
    const totalCount = filtrados.length;

    // Ordenação
    if (this.ordenacoes.length > 0) {
      filtrados.sort((a, b) => {
        for (const ord of this.ordenacoes) {
          const vA = a[ord.campo];
          const vB = b[ord.campo];
          if (vA < vB) return ord.ascending ? -1 : 1;
          if (vA > vB) return ord.ascending ? 1 : -1;
        }
        return 0;
      });
    }

    // Limite
    if (typeof this.limiteQtd === 'number') {
      filtrados = filtrados.slice(0, this.limiteQtd);
    }

    if (this.isSingle) {
      const item = filtrados[0] || null;
      return {
        data: item,
        count: item ? 1 : 0,
        error: item ? null : { message: 'Nenhum registro retornado.', code: 'PGRST116' },
      };
    }

    if (this.isMaybeSingle) {
      return {
        data: filtrados[0] || null,
        count: filtrados[0] ? 1 : 0,
        error: null,
      };
    }

    return {
      data: filtrados,
      count: this.querContagem ? totalCount : undefined,
      error: null,
    };
  }

  // Promise thenable interface para permitir await
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; count?: number; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const res = this.executarMock();
    return Promise.resolve(res).then(onfulfilled, onrejected);
  }
}

// Cliente exportado compatível com Supabase
export const supabase: any = {
  from: (tabela: string) => {
    if (fallbackToMock) {
      return new MockQueryBuilder(tabela);
    }
    // Tenta cliente real, se falhar cai no mock
    const query = realSupabase.from(tabela);
    return new Proxy(query, {
      get(target, prop, receiver) {
        const orig = Reflect.get(target, prop, receiver);
        if (typeof orig === 'function') {
          return (...args: any[]) => {
            const result = orig.apply(target, args);
            if (result && typeof result.then === 'function') {
              return result.catch((err: any) => {
                console.warn(`[Supabase Fallback] Alternando consulta de ${tabela} para Mock:`, err?.message);
                fallbackToMock = true;
                return new MockQueryBuilder(tabela);
              });
            }
            return result;
          };
        }
        return orig;
      },
    });
  },

  rpc: async (fn: string, params: any) => {
    if (fallbackToMock && fn === 'fechar_venda') {
      try {
        const vendaId = mockDatabase.fecharVendaRPC({
          p_itens: params.p_itens || [],
          p_forma: params.p_forma || 'dinheiro',
          p_desconto_motivo: params.p_desconto_motivo || null,
        });
        return { data: vendaId, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err?.message || 'Falha no fechamento da venda demo.' } };
      }
    }

    if (fallbackToMock && fn === 'registrar_entrada_produto') {
      try {
        const produtoId = mockDatabase.registrarEntradaProdutoRPC(params || {});
        return { data: produtoId, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err?.message || 'Falha ao registrar entrada demo.' } };
      }
    }
    if (!fallbackToMock) {
      try {
        return await realSupabase.rpc(fn, params);
      } catch (e) {
        console.warn(`[RPC Fallback]: Falha na RPC ${fn}, usando simulação mock.`, e);
      }
    }
    return { data: `mock_rpc_${Date.now()}`, error: null };
  },

  auth: {
    getSession: async () => {
      // Retorna sessão do usuário de teste
      return {
        data: {
          session: {
            user: USUARIO_TESTE_ADMIN,
            access_token: 'mock_access_token_daniel',
            expires_in: 3600,
            token_type: 'bearer',
          },
        },
        error: null,
      };
    },
    getUser: async () => {
      return { data: { user: USUARIO_TESTE_ADMIN }, error: null };
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      // Dispara imediatamente sessão ativa para inicialização instantânea
      setTimeout(() => {
        callback('SIGNED_IN', {
          user: USUARIO_TESTE_ADMIN,
          access_token: 'mock_access_token_daniel',
        });
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      if (email.toLowerCase().includes('operador')) {
        return {
          data: { user: { ...USUARIO_TESTE_ADMIN, id: PERFIL_TESTE_OPERADOR.id, email } },
          error: null,
        };
      }
      return {
        data: { user: USUARIO_TESTE_ADMIN },
        error: null,
      };
    },
    signOut: async () => {
      return { error: null };
    },
  },
};
