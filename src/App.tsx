import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { PainelPage } from './pages/PainelPage';
import { CaixaPage } from './pages/CaixaPage';
import { CadastrarPage } from './pages/CadastrarPage';
import { EstoquePage } from './pages/EstoquePage';
import { ComprasPage } from './pages/ComprasPage';
import { ValidadePage } from './pages/ValidadePage';
import { DinheiroParadoPage } from './pages/DinheiroParadoPage';
import { FinanceiroPage } from './pages/FinanceiroPage';
import { RelatoriosPage } from './pages/RelatoriosPage';
import type { TabRota } from './types';

// Mapeamento de rotas e caminhos
const ROTAS_VALIDAS: Record<string, TabRota> = {
  '/painel': 'painel',
  '/': 'painel',
  '/caixa': 'caixa',
  '/cadastrar': 'cadastrar',
  '/estoque': 'estoque',
  '/compras': 'compras',
  '/validade': 'validade',
  '/dinheiro-parado': 'dinheiro-parado',
  '/financeiro': 'financeiro',
  '/relatorios': 'relatorios',
};

const obterCaminhoPorRota = (rota: TabRota): string => {
  return `/${rota}`;
};

const obterRotaInicial = (): { tela: 'login' | 'app'; rota: TabRota } => {
  const caminho = window.location.pathname;
  if (caminho === '/login') {
    return { tela: 'login', rota: 'painel' };
  }
  const rotaEncontrada = ROTAS_VALIDAS[caminho] || 'painel';
  return { tela: 'app', rota: rotaEncontrada };
};

const ConteudoPrincipal: React.FC = () => {
  const { usuario, papel, carregando } = useAuth();
  const [telaAtual, setTelaAtual] = useState<'login' | 'app'>(() => obterRotaInicial().tela);
  const [rotaAtiva, setRotaAtiva] = useState<TabRota>(() => obterRotaInicial().rota);

  // Navega para um caminho alterando o histórico do navegador
  const navegarParaCaminho = useCallback((caminho: string) => {
    if (window.location.pathname !== caminho) {
      window.history.pushState({}, '', caminho);
    }
  }, []);

  const irParaLogin = useCallback(() => {
    setTelaAtual('login');
    navegarParaCaminho('/login');
  }, [navegarParaCaminho]);

  const irParaRota = useCallback((novaRota: TabRota) => {
    // Regra de negócio: operador só tem permissão de ir para caixa
    if (papel === 'operador' && novaRota !== 'caixa') {
      setRotaAtiva('caixa');
      setTelaAtual('app');
      navegarParaCaminho('/caixa');
      return;
    }

    setRotaAtiva(novaRota);
    setTelaAtual('app');
    navegarParaCaminho(obterCaminhoPorRota(novaRota));
  }, [papel, navegarParaCaminho]);

  const irParaCaixa = useCallback(() => {
    irParaRota('caixa');
  }, [irParaRota]);

  // Sincroniza rota inicial quando o perfil do usuário carregar
  useEffect(() => {
    if (!carregando) {
      if (!usuario) {
        setTelaAtual('login');
        if (window.location.pathname !== '/login') {
          navegarParaCaminho('/login');
        }
      } else {
        // Usuário logado
        if (papel === 'operador') {
          setTelaAtual('app');
          setRotaAtiva('caixa');
          if (window.location.pathname !== '/caixa') {
            navegarParaCaminho('/caixa');
          }
        } else {
          // Papel dono
          if (telaAtual === 'login' || window.location.pathname === '/login') {
            setTelaAtual('app');
            setRotaAtiva('painel');
            navegarParaCaminho('/painel');
          }
        }
      }
    }
  }, [usuario, papel, carregando, telaAtual, navegarParaCaminho]);

  // Listener para botões avançar/voltar do navegador
  useEffect(() => {
    const tratarPopState = () => {
      const caminho = window.location.pathname;
      if (caminho === '/login') {
        setTelaAtual('login');
      } else if (ROTAS_VALIDAS[caminho]) {
        const rota = ROTAS_VALIDAS[caminho];
        if (papel === 'operador' && rota !== 'caixa') {
          setTelaAtual('app');
          setRotaAtiva('caixa');
          navegarParaCaminho('/caixa');
        } else {
          setTelaAtual('app');
          setRotaAtiva(rota);
        }
      }
    };

    window.addEventListener('popstate', tratarPopState);
    return () => window.removeEventListener('popstate', tratarPopState);
  }, [papel, navegarParaCaminho]);

  // Se o usuário está na tela de login e não está autenticado
  if (telaAtual === 'login' && !usuario) {
    return (
      <LoginPage
        onSuccessLogin={() => {
          setTelaAtual('app');
          if (papel === 'operador') {
            setRotaAtiva('caixa');
            navegarParaCaminho('/caixa');
          } else {
            setRotaAtiva('painel');
            navegarParaCaminho('/painel');
          }
        }}
      />
    );
  }

  // Renderização das páginas conforme a aba selecionada
  const renderizarPagina = () => {
    switch (rotaAtiva) {
      case 'painel':
        return <PainelPage />;
      case 'caixa':
        return <CaixaPage />;
      case 'cadastrar':
        return <CadastrarPage />;
      case 'estoque':
        return <EstoquePage />;
      case 'compras':
        return <ComprasPage />;
      case 'validade':
        return <ValidadePage />;
      case 'dinheiro-parado':
        return <DinheiroParadoPage />;
      case 'financeiro':
        return <FinanceiroPage />;
      case 'relatorios':
        return <RelatoriosPage />;
      default:
        return <PainelPage />;
    }
  };

  return (
    <ProtectedRoute
      rotaAtual={rotaAtiva}
      aoRedirecionarParaLogin={irParaLogin}
      aoRedirecionarParaCaixa={irParaCaixa}
    >
      <Layout rotaAtiva={rotaAtiva} aoMudarRota={irParaRota}>
        {renderizarPagina()}
      </Layout>
    </ProtectedRoute>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ConteudoPrincipal />
    </AuthProvider>
  );
}
