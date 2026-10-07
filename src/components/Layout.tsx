import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  LogOut,
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
  UserCheck,
  Settings,
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
  { id: 'cadastrar', rotulo: 'Cadastro', icone: PlusCircle },
  { id: 'estoque', rotulo: 'Estoque', icone: Boxes },
  { id: 'compras', rotulo: 'Compras', icone: Truck },
  { id: 'validade', rotulo: 'Validade', icone: CalendarClock },
  { id: 'dinheiro-parado', rotulo: 'Dinheiro parado', icone: CircleDollarSign },
  { id: 'financeiro', rotulo: 'Financeiro', icone: Wallet },
  { id: 'relatorios', rotulo: 'Relatórios', icone: BarChart3 },
  { id: 'configuracoes', rotulo: 'Configurações', icone: Settings },
];

const ABAS_OPERADOR: ItemAba[] = [
  { id: 'caixa', rotulo: 'Caixa', icone: ShoppingCart },
];

export const Layout: React.FC<LayoutProps> = ({ rotaAtiva, aoMudarRota, children }) => {
  const { usuario, perfil, papel, logout, alternarPapelTeste, modoTeste } = useAuth();
  const abasDisponiveis = papel === 'operador' ? ABAS_OPERADOR : TODAS_ABAS_DONO;

  return (
    <div className="min-h-screen text-[#17231E] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[#DDE5DF]/90 bg-white/90 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[68px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#0E7A4F] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(14,122,79,0.18)] flex-shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[15px] sm:text-base tracking-[-0.02em] truncate">
                  Mercado & Estoque
                </div>
                <div className="text-[11px] sm:text-xs text-[#6D7973] truncate">
                  Gestão simples para o dia a dia
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {modoTeste && (
                <button
                  id="toggle-papel-teste-btn"
                  onClick={() => alternarPapelTeste()}
                  title="Alternar perfil no modo demonstração"
                  className="hidden md:flex min-h-[40px] items-center gap-2 px-3 rounded-xl border border-[#DCE6DF] bg-[#F7FAF8] text-[#355046] text-xs font-semibold hover:bg-[#EEF6F1]"
                >
                  {papel === 'dono' ? (
                    <>
                      <UserCheck className="w-4 h-4 text-[#0E7A4F]" />
                      Simular operador
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#0E7A4F]" />
                      Voltar para dono
                    </>
                  )}
                </button>
              )}

              <div className="hidden sm:flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#E1E7E3] bg-[#FAFBFA]">
                <div className="w-8 h-8 rounded-full bg-[#EAF6EF] text-[#0E7A4F] flex items-center justify-center">
                  {papel === 'dono' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                </div>
                <div className="leading-tight">
                  <div className="text-xs sm:text-sm font-semibold truncate max-w-[150px]">
                    {perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[#849089] mt-0.5">
                    {papel === 'dono' ? 'Dono' : 'Operador'}
                  </div>
                </div>
              </div>

              <button
                id="header-logout-btn"
                onClick={() => logout()}
                title="Sair do sistema"
                className="h-10 px-3 sm:px-4 rounded-xl border border-[#E1E7E3] bg-white text-[#43524B] hover:bg-[#FFF4F1] hover:text-[#B83A22] hover:border-[#F2D2CB] flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>

          <nav
            className="flex items-center gap-1 overflow-x-auto pb-3 no-scrollbar"
            aria-label="Navegação do sistema"
          >
            {abasDisponiveis.map((aba) => {
              const estaAtiva = rotaAtiva === aba.id;
              const Icone = aba.icone;

              return (
                <button
                  key={aba.id}
                  id={`nav-tab-${aba.id}`}
                  onClick={() => aoMudarRota(aba.id)}
                  className={`h-10 px-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap flex-shrink-0 border ${estaAtiva
                    ? 'bg-[#102A20] text-white border-[#102A20] shadow-[0_6px_18px_rgba(16,42,32,0.12)]'
                    : 'bg-transparent text-[#617069] border-transparent hover:bg-[#F2F6F3] hover:text-[#21352C]'
                  }`}
                >
                  <Icone className={`w-4 h-4 flex-shrink-0 ${estaAtiva ? 'text-[#8BE0B8]' : 'text-[#819087]'}`} />
                  <span>{aba.rotulo}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="app-surface flex-1 w-full">
        {children}
      </main>
    </div>
  );
};
