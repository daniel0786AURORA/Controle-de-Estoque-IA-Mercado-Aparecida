import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Store, 
  LogOut, 
  User, 
  LayoutDashboard, 
  ShoppingCart, 
  PlusCircle, 
  Boxes, 
  Truck, 
  CalendarClock, 
  CircleDollarSign, 
  Wallet, 
  BarChart3,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import type { TabRota } from '../types';

interface LayoutProps {
  rotaAtiva: TabRota;
  aoMudarRota: (rota: TabRota) => void;
  children: React.ReactNode;
}

interface ItemAba {
  id: TabRota;
  rotulo: string;
  icone: React.ComponentType<{ className?: string }>;
}

const TODAS_ABAS_DONO: ItemAba[] = [
  { id: 'painel', rotulo: 'Painel', icone: LayoutDashboard },
  { id: 'caixa', rotulo: 'Caixa', icone: ShoppingCart },
  { id: 'cadastrar', rotulo: 'Cadastrar', icone: PlusCircle },
  { id: 'estoque', rotulo: 'Estoque', icone: Boxes },
  { id: 'compras', rotulo: 'Compras', icone: Truck },
  { id: 'validade', rotulo: 'Validade', icone: CalendarClock },
  { id: 'dinheiro-parado', rotulo: 'Dinheiro parado', icone: CircleDollarSign },
  { id: 'financeiro', rotulo: 'Financeiro', icone: Wallet },
  { id: 'relatorios', rotulo: 'Relatórios', icone: BarChart3 },
];

const ABAS_OPERADOR: ItemAba[] = [
  { id: 'caixa', rotulo: 'Caixa', icone: ShoppingCart },
];

export const Layout: React.FC<LayoutProps> = ({ rotaAtiva, aoMudarRota, children }) => {
  const { usuario, perfil, papel, logout } = useAuth();

  const abasDisponiveis = papel === 'operador' ? ABAS_OPERADOR : TODAS_ABAS_DONO;

  return (
    <div className="min-h-screen bg-[#EEF1EC] text-[#14211C] flex flex-col font-sans selection:bg-[#0E7A4F]/20">
      
      {/* Barra Superior Escura (#14211C) */}
      <header className="bg-[#14211C] text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          
          {/* Linha Principal: Identidade e Usuário */}
          <div className="flex items-center justify-between h-16 border-b border-white/10 gap-2">
            
            {/* Logo / Nome do Mercado */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0E7A4F] text-white flex items-center justify-center flex-shrink-0">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-base sm:text-lg tracking-tight block text-white leading-tight">
                  Mercado & Estoque
                </span>
                <span className="text-xs text-white/60 hidden sm:inline-block">
                  Controle de Vendas e Caixa
                </span>
              </div>
            </div>

            {/* Usuário, Papel e Botão Sair */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Badge de Papel e Nome */}
              <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                {papel === 'dono' ? (
                  <ShieldCheck className="w-4 h-4 text-[#0E7A4F] flex-shrink-0" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                )}
                
                <div className="flex flex-col text-left">
                  <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[120px] sm:max-w-[180px]">
                    {perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'}
                  </span>
                  <span className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wider font-medium">
                    {papel === 'dono' ? 'Dono' : 'Operador de Caixa'}
                  </span>
                </div>
              </div>

              {/* Botão de Sair com no mínimo 44px de altura para toque */}
              <button
                id="header-logout-btn"
                onClick={() => logout()}
                title="Sair do sistema"
                className="min-h-[44px] h-11 px-3 sm:px-4 rounded-lg bg-white/10 hover:bg-[#C4361A] text-white flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer text-xs sm:text-sm border border-white/15"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>

          {/* Navegação em Abas */}
          <nav 
            className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-2 scrollbar-none no-scrollbar"
            aria-label="Navegação do Sistema"
          >
            {abasDisponiveis.map((aba) => {
              const estaAtiva = rotaAtiva === aba.id;
              const Icone = aba.icone;

              return (
                <button
                  key={aba.id}
                  id={`nav-tab-${aba.id}`}
                  onClick={() => aoMudarRota(aba.id)}
                  className={`min-h-[44px] h-11 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                    estaAtiva
                      ? 'bg-[#0E7A4F] text-white shadow-sm font-semibold'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icone className={`w-4 h-4 flex-shrink-0 ${estaAtiva ? 'text-white' : 'text-white/70'}`} />
                  <span>{aba.rotulo}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 w-full bg-[#EEF1EC]">
        {children}
      </main>
    </div>
  );
};
