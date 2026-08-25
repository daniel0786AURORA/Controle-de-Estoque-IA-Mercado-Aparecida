import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import type { TabRota } from '../types';

interface ProtectedRouteProps {
  rotaAtual: TabRota;
  aoRedirecionarParaLogin: () => void;
  aoRedirecionarParaCaixa: () => void;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  rotaAtual,
  aoRedirecionarParaLogin,
  aoRedirecionarParaCaixa,
  children,
}) => {
  const { usuario, papel, carregando, erro } = useAuth();

  useEffect(() => {
    if (!carregando) {
      if (!usuario) {
        aoRedirecionarParaLogin();
      } else if (papel === 'operador' && rotaAtual !== 'caixa') {
        // Regra de negócio: papel 'operador' só acessa /caixa. Outras rotas redirecionam para /caixa.
        aoRedirecionarParaCaixa();
      }
    }
  }, [usuario, papel, carregando, rotaAtual, aoRedirecionarParaLogin, aoRedirecionarParaCaixa]);

  // Exibe tela de carregamento amigável enquanto verifica autenticação e perfil
  if (carregando) {
    return (
      <div className="min-h-screen bg-[#EEF1EC] text-[#14211C] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 text-[#0E7A4F] animate-spin" />
          <span className="text-base font-medium text-[#14211C]/80">
            Carregando sistema...
          </span>
        </div>
      </div>
    );
  }

  // Se não autenticado, não renderiza o conteúdo protegido
  if (!usuario) {
    return null;
  }

  // Se o papel for operador e tentar acessar outra rota, aguarda o redirecionamento
  if (papel === 'operador' && rotaAtual !== 'caixa') {
    return null;
  }

  return <>{children}</>;
};
