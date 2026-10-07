import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, isModoMock } from '../lib/supabase';
import {
  USUARIO_TESTE_ADMIN,
  PERFIL_TESTE_ADMIN,
  PERFIL_TESTE_OPERADOR,
  EMPRESA_ID_PADRAO
} from '../lib/mockDatabase';
import type { Perfil, PapelUsuario } from '../types';

interface AuthContextType {
  usuario: User | null;
  perfil: Perfil | null;
  empresaId: string | null;
  papel: PapelUsuario | null;
  carregando: boolean;
  erro: string | null;
  isConfigurado: boolean;
  modoTeste: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
  alternarPapelTeste: (novoPapel?: PapelUsuario) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const iniciarEmDemo = isModoMock();
  const [usuario, setUsuario] = useState<User | null>(
    iniciarEmDemo ? (USUARIO_TESTE_ADMIN as unknown as User) : null
  );
  const [perfil, setPerfil] = useState<Perfil | null>(iniciarEmDemo ? PERFIL_TESTE_ADMIN : null);
  const [carregando, setCarregando] = useState<boolean>(!iniciarEmDemo);
  const [erro, setErro] = useState<string | null>(null);
  const [modoTeste] = useState<boolean>(iniciarEmDemo);

  const carregarPerfilUsuario = useCallback(async (userId: string) => {
    try {
      setErro(null);
      const { data, error } = await supabase
        .from('perfil')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        if (isModoMock()) {
          const perfilFallback = userId === PERFIL_TESTE_OPERADOR.id ? PERFIL_TESTE_OPERADOR : PERFIL_TESTE_ADMIN;
          setPerfil(perfilFallback);
          return perfilFallback;
        }
        throw error || new Error('Perfil do usuário não encontrado.');
      }

      const perfilData = data as Perfil;
      setPerfil(perfilData);
      return perfilData;
    } catch (err) {
      if (isModoMock()) {
        const perfilFallback = userId === PERFIL_TESTE_OPERADOR.id ? PERFIL_TESTE_OPERADOR : PERFIL_TESTE_ADMIN;
        setPerfil(perfilFallback);
        return perfilFallback;
      }
      setPerfil(null);
      setErro('Não foi possível carregar o perfil do usuário.');
      throw err;
    }
  }, []);

  // Inicializa sessão real quando há Supabase configurado; no modo demo usa perfil local.
  useEffect(() => {
    let montado = true;

    async function inicializarSessao() {
      if (isModoMock()) {
        if (montado) {
          setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
          setPerfil(PERFIL_TESTE_ADMIN);
          setCarregando(false);
        }
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!montado) return;

        if (session?.user) {
          setUsuario(session.user as User);
          await carregarPerfilUsuario(session.user.id);
        } else {
          setUsuario(null);
          setPerfil(null);
        }
      } catch (err) {
        console.error('Falha ao inicializar autenticação real:', err);
        if (montado) {
          setUsuario(null);
          setPerfil(null);
          setErro('Não foi possível validar a sessão.');
        }
      } finally {
        if (montado) setCarregando(false);
      }
    }

    inicializarSessao();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!montado || isModoMock()) return;

        if (session?.user) {
          setUsuario(session.user as User);
          try {
            await carregarPerfilUsuario(session.user.id);
          } catch {
            setPerfil(null);
          }
        } else {
          setUsuario(null);
          setPerfil(null);
        }
        setCarregando(false);
      }
    );

    return () => {
      montado = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [carregarPerfilUsuario]);

  const login = async (email: string, senha: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setCarregando(true);
      setErro(null);

      if (isModoMock()) {
        if (email.toLowerCase().includes('operador')) {
          setUsuario({ ...USUARIO_TESTE_ADMIN, id: PERFIL_TESTE_OPERADOR.id, email } as unknown as User);
          setPerfil(PERFIL_TESTE_OPERADOR);
        } else {
          setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
          setPerfil(PERFIL_TESTE_ADMIN);
        }
        return { success: true };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error || !data?.user) {
        const mensagem = error?.message || 'Não foi possível autenticar.';
        setErro(mensagem);
        return { success: false, error: mensagem };
      }

      setUsuario(data.user as User);
      await carregarPerfilUsuario(data.user.id);
      return { success: true };
    } catch (err: any) {
      const mensagem = err?.message || 'Erro inesperado ao entrar.';
      setErro(mensagem);
      return { success: false, error: mensagem };
    } finally {
      setCarregando(false);
    }
  };

  const logout = async () => {
    try {
      setCarregando(true);
      if (!isModoMock()) {
        await supabase.auth.signOut();
        setUsuario(null);
        setPerfil(null);
      } else {
        setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
        setPerfil(PERFIL_TESTE_ADMIN);
      }
      setErro(null);
    } catch (err) {
      console.warn('Erro ao sair:', err);
    } finally {
      setCarregando(false);
    }
  };

  const recarregarPerfil = async () => {
    if (usuario) {
      await carregarPerfilUsuario(usuario.id);
    }
  };

  // Permite alternar rapidamente entre visão de Dono (administrador completo) e Operador (somente Caixa/PDV)
  const alternarPapelTeste = (novoPapel?: PapelUsuario) => {
    if (!modoTeste) return;
    if (novoPapel) {
      if (novoPapel === 'operador') {
        setPerfil(PERFIL_TESTE_OPERADOR);
        setUsuario({ ...USUARIO_TESTE_ADMIN, id: PERFIL_TESTE_OPERADOR.id, email: 'operador@mercadoaparecida.com.br' } as unknown as User);
      } else {
        setPerfil(PERFIL_TESTE_ADMIN);
        setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
      }
      return;
    }

    if (perfil?.papel === 'dono') {
      setPerfil(PERFIL_TESTE_OPERADOR);
      setUsuario({ ...USUARIO_TESTE_ADMIN, id: PERFIL_TESTE_OPERADOR.id, email: 'operador@mercadoaparecida.com.br' } as unknown as User);
    } else {
      setPerfil(PERFIL_TESTE_ADMIN);
      setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
    }
  };

  const valorContexto: AuthContextType = {
    usuario,
    perfil,
    empresaId: perfil?.empresa_id || (modoTeste ? EMPRESA_ID_PADRAO : null),
    papel: perfil?.papel || (modoTeste ? 'dono' : null),
    carregando,
    erro,
    isConfigurado: isSupabaseConfigured,
    modoTeste,
    login,
    logout,
    recarregarPerfil,
    alternarPapelTeste,
  };

  return <AuthContext.Provider value={valorContexto}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
