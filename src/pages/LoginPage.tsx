import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Store, AlertCircle, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onSuccessLogin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccessLogin }) => {
  const { login, erro: erroAuth, carregando, isConfigurado, usuario } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [submetendo, setSubmetendo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroLocal(null);

    if (!email.trim()) {
      setErroLocal('Informe o seu e-mail cadastrado.');
      return;
    }

    if (!senha) {
      setErroLocal('Digite a sua senha de acesso.');
      return;
    }

    setSubmetendo(true);
    const resultado = await login(email, senha);
    setSubmetendo(false);

    if (resultado.success) {
      onSuccessLogin?.();
    } else if (resultado.error) {
      setErroLocal(resultado.error);
    }
  };

  const erroExibido = erroLocal || erroAuth;

  return (
    <div className="min-h-screen bg-[#EEF1EC] text-[#14211C] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-[#14211C]/15 rounded-xl shadow-sm p-6 sm:p-8">
        
        {/* Cabeçalho da Identidade Visual */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-[#14211C] text-white flex items-center justify-center mb-3">
            <Store className="w-7 h-7 text-[#0E7A4F]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14211C]">
            Acesso ao Sistema
          </h1>
          <p className="text-sm text-[#14211C]/70 mt-1">
            Controle de Estoque e Caixa para Mini Mercados
          </p>
        </div>

        {/* Alerta caso credenciais Supabase não estejam preenchidas */}
        {!isConfigurado && (
          <div className="mb-5 p-3.5 bg-amber-50 border border-[#B87503]/30 rounded-lg text-sm text-[#B87503] flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block">Configuração do Supabase pendente</strong>
              <span>
                Defina as variáveis de ambiente <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> (ou com prefixo <code>VITE_</code>) para conectar o banco de dados.
              </span>
            </div>
          </div>
        )}

        {/* Mensagem de Erro com instrução clara */}
        {erroExibido && (
          <div 
            id="login-error-message"
            className="mb-5 p-3.5 bg-red-50 border border-[#C4361A]/30 rounded-lg text-sm text-[#C4361A] flex items-start gap-2.5"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block">Atenção</strong>
              <span>{erroExibido}</span>
            </div>
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              htmlFor="email-input" 
              className="block text-sm font-semibold text-[#14211C] mb-1.5"
            >
              E-mail
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#14211C]/50">
                <Mail className="w-5 h-5" />
              </div>
              <input
                id="email-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@mercado.com.br"
                className="w-full min-h-[44px] h-12 pl-10 pr-3.5 rounded-lg border border-[#14211C]/25 bg-white text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] text-base"
                disabled={submetendo || carregando}
              />
            </div>
          </div>

          <div>
            <label 
              htmlFor="password-input" 
              className="block text-sm font-semibold text-[#14211C] mb-1.5"
            >
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#14211C]/50">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="password-input"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] h-12 pl-10 pr-3.5 rounded-lg border border-[#14211C]/25 bg-white text-[#14211C] placeholder-[#14211C]/40 focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] text-base"
                disabled={submetendo || carregando}
              />
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={submetendo || carregando}
            className="w-full min-h-[44px] h-12 bg-[#0E7A4F] hover:bg-[#0E7A4F]/90 active:bg-[#0E7A4F]/95 text-white font-medium rounded-lg text-base flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-sm"
          >
            {submetendo || (carregando && !usuario) ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Entrando no sistema...</span>
              </>
            ) : (
              <span>Entrar</span>
            )}
          </button>
        </form>

        {/* Nota sobre cadastro restrito */}
        <div className="mt-6 pt-4 border-t border-[#14211C]/10 text-center text-xs text-[#14211C]/60">
          Acesso restrito a usuários autorizados. Não há cadastro público.
        </div>
      </div>
    </div>
  );
};
