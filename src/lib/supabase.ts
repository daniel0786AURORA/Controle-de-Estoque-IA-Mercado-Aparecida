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
    getSession: async () => {
      if (!fallbackToMock) {
        return realSupabase.auth.getSession();
      }
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
      if (!fallbackToMock) {
        return realSupabase.auth.getUser();
      }
      return { data: { user: USUARIO_TESTE_ADMIN }, error: null };
    },

    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      if (!fallbackToMock) {
        return realSupabase.auth.onAuthStateChange(callback);
      }

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
      if (!fallbackToMock) {
        return realSupabase.auth.signInWithPassword({ email, password });
      }

      if (email.toLowerCase().includes('operador')) {
        return {
          data: {
            user: { ...USUARIO_TESTE_ADMIN, id: PERFIL_TESTE_OPERADOR.id, email },
            session: null,
          },
          error: null,
        };
      }

      return {
        data: { user: USUARIO_TESTE_ADMIN, session: null },
        error: null,
      };
    },

    signOut: async () => {
      if (!fallbackToMock) {
        return realSupabase.auth.signOut();
      }
      return { error: null };
    },
  },};
