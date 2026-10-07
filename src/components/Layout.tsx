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
    <div className="min-h-screen text-[#1E2D26] flex flex-col">
      <header className="sticky top-0 z-40 px-3 sm:px-5 pt-3">
        <div className="max-w-[1440px] mx-auto rounded-[22px] border border-white/70 bg-white/72 backdrop-blur-2xl shadow-[0_10px_40px_rgba(45,76,61,0.08)] overflow-hidden">
          <div className="px-4 sm:px-5 lg:px-6">
            <div className="h-[64px] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-[#39B980] to-[#16845A] text-white flex items-center justify-center shadow-[0_10px_26px_rgba(22,132,90,0.22)] flex-shrink-0">
                  <Store className="w-5 h-5" />
                  <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 rounded-full bg-white/90 shadow-sm" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[15px] sm:text-base tracking-[-0.025em] truncate text-[#23352C]">
                    Mercado & Estoque
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#8A9790] truncate">
                    Gestão leve. Decisões rápidas.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {modoTeste && (
                  <button
                    id="toggle-papel-teste-btn"
                    onClick={() => alternarPapelTeste()}
                    title="Alternar perfil no modo demonstração"
                    className="hidden md:flex h-9 items-center gap-2 px-3 rounded-full border border-[#DCECE4] bg-[#F4FBF7]/90 text-[#4C685A] text-xs font-semibold hover:bg-white hover:shadow-sm"
                  >
                    {papel === 'dono' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-[#16845A]" />
                        Simular operador
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-[#16845A]" />
                        Voltar para dono
                      </>
                    )}
                  </button>
                )}

                <div className="hidden sm:flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full border border-[#E7ECE9] bg-white/78 shadow-[0_3px_14px_rgba(45,76,61,0.045)]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#EEF9F3] to-[#E4F5EB] text-[#16845A] flex items-center justify-center">
                    {papel === 'dono' ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs sm:text-sm font-semibold truncate max-w-[140px] text-[#31443A]">
                      {perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.13em] text-[#98A29D] mt-0.5">
                      {papel === 'dono' ? 'Dono' : 'Operador'}
                    </div>
                  </div>
                </div>

                <button
                  id="header-logout-btn"
                  onClick={() => logout()}
                  title="Sair do sistema"
                  className="h-9 w-9 sm:w-auto sm:px-3.5 rounded-full border border-[#E7ECE9] bg-white/74 text-[#718078] hover:bg-[#FFF7F5] hover:text-[#BE4B34] hover:border-[#F0DDD7] flex items-center justify-center gap-2 text-xs font-semibold shadow-[0_3px_14px_rgba(45,76,61,0.035)]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>

            <nav className="flex items-center gap-1 overflow-x-auto pb-3 no-scrollbar" aria-label="Navegação do sistema">
              {abasDisponiveis.map((aba) => {
                const ativa = rotaAtiva === aba.id;
                const Icone = aba.icone;
                return (
                  <button
                    key={aba.id}
                    id={`nav-tab-${aba.id}`}
                    onClick={() => aoMudarRota(aba.id)}
                    className={`h-9 px-3.5 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap flex-shrink-0 border ${ativa
                      ? 'bg-[#EDF9F3] text-[#126A49] border-[#D7EEE2] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_4px_14px_rgba(22,132,90,.07)]'
                      : 'bg-transparent text-[#7B8982] border-transparent hover:bg-white/78 hover:text-[#334A3E] hover:shadow-[0_4px_14px_rgba(45,76,61,.05)]'
                    }`}
                  >
                    <Icone className={`w-3.5 h-3.5 flex-shrink-0 ${ativa ? 'text-[#1D9A69]' : 'text-[#9AA59F]'}`} />
                    <span>{aba.rotulo}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="app-surface flex-1 w-full">
        {children}
      </main>
    </div>
  );
};
