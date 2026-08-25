import { createClient } from '@supabase/supabase-js';

// Helper para ler variáveis de ambiente de forma segura no Vite/TypeScript
const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env) {
    return (import.meta as unknown as { env: Record<string, string> }).env[key] || '';
  }
  return '';
};

// Lê as variáveis de ambiente com suporte a prefixo VITE_ e padrão
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

// Cria o cliente Supabase utilizando as credenciais de ambiente
export const supabase = createClient(
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
