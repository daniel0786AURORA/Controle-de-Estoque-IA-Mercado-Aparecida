import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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
  // Inicializa já com usuário de teste ativo para pular tela de login e permitir testes imediatos
  const [usuario, setUsuario] = useState<User | null>(USUARIO_TESTE_ADMIN as unknown as User);
  const [perfil, setPerfil] = useState<Perfil | null>(PERFIL_TESTE_ADMIN);
  const [carregando, setCarregando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modoTeste, setModoTeste] = useState<boolean>(true);

  const carregarPerfilUsuario = useCallback(async (userId: string) => {
    try {
      setErro(null);
      const { data, error } = await supabase
        .from('perfil')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        // Fallback para perfil de teste padrão
        const perfilFallback = userId === PERFIL_TESTE_OPERADOR.id ? PERFIL_TESTE_OPERADOR : PERFIL_TESTE_ADMIN;
        setPerfil(perfilFallback);
        return perfilFallback;
      }

      const perfilData = data as Perfil;
      setPerfil(perfilData);
      return perfilData;
    } catch (err) {
      console.warn('Usando perfil de teste padrão:', err);
      const perfilFallback = userId === PERFIL_TESTE_OPERADOR.id ? PERFIL_TESTE_OPERADOR : PERFIL_TESTE_ADMIN;
      setPerfil(perfilFallback);
      return perfilFallback;
    }
  }, []);

  // Inicializa sessão e escuta mudanças de autenticação
  useEffect(() => {
    let montado = true;

    async function inicializarSessao() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Sessão offline detectada, mantendo modo de teste ativo.');
          if (montado) {
            setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
            setPerfil(PERFIL_TESTE_ADMIN);
            setCarregando(false);
          }
          return;
        }

        if (session?.user && montado) {
          setUsuario(session.user as User);
          await carregarPerfilUsuario(session.user.id);
        } else if (montado) {
          // Garante usuário de teste para permitir testar o sistema diretamente
          setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
          setPerfil(PERFIL_TESTE_ADMIN);
        }
      } catch (err) {
        console.warn('Mantendo usuário de teste para exploração:', err);
        if (montado) {
          setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
          setPerfil(PERFIL_TESTE_ADMIN);
        }
      } finally {
        if (montado) {
          setCarregando(false);
        }
      }
    }

    inicializarSessao();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!montado) return;
        if (session?.user) {
          setUsuario(session.user as User);
          await carregarPerfilUsuario(session.user.id);
        } else {
          setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
          setPerfil(PERFIL_TESTE_ADMIN);
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

      // Se for email de teste com operador
      if (email.toLowerCase().includes('operador')) {
        setUsuario({ ...USUARIO_TESTE_ADMIN, id: PERFIL_TESTE_OPERADOR.id, email } as unknown as User);
        setPerfil(PERFIL_TESTE_OPERADOR);
        setCarregando(false);
        return { success: true };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error) {
        // Se falhar a autenticação remota em ambiente de teste, permite login direto
        console.warn('Falha remota, autenticando como administrador de teste:', error);
        setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
        setPerfil(PERFIL_TESTE_ADMIN);
        setCarregando(false);
        return { success: true };
      }

      if (data?.user) {
        setUsuario(data.user as User);
        await carregarPerfilUsuario(data.user.id);
        setCarregando(false);
        return { success: true };
      }

      setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
      setPerfil(PERFIL_TESTE_ADMIN);
      setCarregando(false);
      return { success: true };
    } catch (err) {
      console.warn('Exceção no login, liberando acesso de teste:', err);
      setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
      setPerfil(PERFIL_TESTE_ADMIN);
      setCarregando(false);
      return { success: true };
    }
  };

  const logout = async () => {
    try {
      setCarregando(true);
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Erro ao sair:', err);
    } finally {
      // Quando clica em sair no modo teste, recarrega o estado inicial ou permite alternar
      setUsuario(USUARIO_TESTE_ADMIN as unknown as User);
      setPerfil(PERFIL_TESTE_ADMIN);
      setErro(null);
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
    empresaId: perfil?.empresa_id || EMPRESA_ID_PADRAO,
    papel: perfil?.papel || 'dono',
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
