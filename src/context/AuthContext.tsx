import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Perfil, PapelUsuario } from '../types';

interface AuthContextType {
  usuario: User | null;
  perfil: Perfil | null;
  empresaId: string | null;
  papel: PapelUsuario | null;
  carregando: boolean;
  erro: string | null;
  isConfigurado: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarPerfilUsuario = useCallback(async (userId: string) => {
    try {
      setErro(null);
      const { data, error } = await supabase
        .from('perfil')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil do usuário:', error);
        setErro('Não foi possível carregar seu perfil de acesso. Verifique com o administrador.');
        setPerfil(null);
        return null;
      }

      const perfilData = data as Perfil;
      setPerfil(perfilData);
      return perfilData;
    } catch (err) {
      console.error('Exceção ao carregar perfil:', err);
      setErro('Erro de conexão ao buscar seu perfil. Tente recarregar a página.');
      setPerfil(null);
      return null;
    }
  }, []);

  // Inicializa sessão e escuta mudanças de autenticação
  useEffect(() => {
    let montado = true;

    async function inicializarSessao() {
      if (!isSupabaseConfigured) {
        if (montado) {
          setCarregando(false);
        }
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao recuperar sessão:', error);
          if (montado) {
            setUsuario(null);
            setPerfil(null);
            setCarregando(false);
          }
          return;
        }

        if (session?.user && montado) {
          setUsuario(session.user);
          await carregarPerfilUsuario(session.user.id);
        } else if (montado) {
          setUsuario(null);
          setPerfil(null);
        }
      } catch (err) {
        console.error('Exceção ao inicializar sessão:', err);
      } finally {
        if (montado) {
          setCarregando(false);
        }
      }
    }

    inicializarSessao();

    // Listener para eventos de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!montado) return;

        if (session?.user) {
          setUsuario(session.user);
          await carregarPerfilUsuario(session.user.id);
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
    if (!isSupabaseConfigured) {
      const msg = 'As variáveis de ambiente do Supabase (SUPABASE_URL e SUPABASE_ANON_KEY) não estão configuradas.';
      setErro(msg);
      return { success: false, error: msg };
    }

    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (error) {
        let mensagemAmigavel = 'E-mail ou senha incorretos. Verifique os dados e tente novamente.';
        const authErr = error as AuthError;
        
        if (authErr.message?.toLowerCase().includes('network') || authErr.message?.toLowerCase().includes('fetch')) {
          mensagemAmigavel = 'Falha na conexão com o servidor. Verifique sua internet e tente novamente.';
        } else if (authErr.message?.toLowerCase().includes('invalid login credentials')) {
          mensagemAmigavel = 'E-mail ou senha incorretos. Por favor, verifique a digitação.';
        } else if (authErr.message?.toLowerCase().includes('email not confirmed')) {
          mensagemAmigavel = 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
        }

        setErro(mensagemAmigavel);
        setCarregando(false);
        return { success: false, error: mensagemAmigavel };
      }

      if (data.user) {
        setUsuario(data.user);
        const perfilCarregado = await carregarPerfilUsuario(data.user.id);
        
        if (!perfilCarregado) {
          const msg = 'Seu usuário não possui um perfil vinculado. Contate o administrador.';
          setErro(msg);
          setCarregando(false);
          return { success: false, error: msg };
        }

        setCarregando(false);
        return { success: true };
      }

      setCarregando(false);
      return { success: false, error: 'Não foi possível completar o login. Tente novamente.' };
    } catch (err) {
      console.error('Exceção no login:', err);
      const msg = 'Ocorreu um erro ao processar seu login. Verifique sua conexão e tente novamente.';
      setErro(msg);
      setCarregando(false);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      setCarregando(true);
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao sair:', err);
    } finally {
      setUsuario(null);
      setPerfil(null);
      setErro(null);
      setCarregando(false);
    }
  };

  const recarregarPerfil = async () => {
    if (usuario) {
      await carregarPerfilUsuario(usuario.id);
    }
  };

  const valorContexto: AuthContextType = {
    usuario,
    perfil,
    empresaId: perfil?.empresa_id || null,
    papel: perfil?.papel || null,
    carregando,
    erro,
    isConfigurado: isSupabaseConfigured,
    login,
    logout,
    recarregarPerfil,
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
