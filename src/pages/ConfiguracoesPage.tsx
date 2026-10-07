import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings, Save, Percent, ShieldAlert } from 'lucide-react';

export const ConfiguracoesPage: React.FC = () => {
  const { papel, empresaId } = useAuth();
  const ehDono = papel === 'dono';

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Valores em % (ex: 3.19)
  const [taxaDinheiro, setTaxaDinheiro] = useState('0,00');
  const [taxaPix, setTaxaPix] = useState('0,00');
  const [taxaDebito, setTaxaDebito] = useState('0,00');
  const [taxaCredito, setTaxaCredito] = useState('0,00');

  useEffect(() => {
    if (!empresaId) return;

    const carregarConfiguracoes = async () => {
      try {
        setCarregando(true);
        const { data, error } = await supabase
          .from('config_taxa')
          .select('dinheiro, pix, debito, credito')
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setTaxaDinheiro((data.dinheiro * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setTaxaPix((data.pix * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setTaxaDebito((data.debito * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setTaxaCredito((data.credito * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      } catch (err: any) {
        console.error('Erro ao carregar taxas:', err);
        setErro('Não foi possível carregar as configurações de taxa.');
      } finally {
        setCarregando(false);
      }
    };

    carregarConfiguracoes();
  }, [empresaId]);

  const handleSalvar = async () => {
    if (!empresaId) return;

    try {
      setSalvando(true);
      setErro(null);
      setMensagemSucesso(false);

      const parseTaxa = (val: string) => {
        const num = parseFloat(val.replace(/\./g, '').replace(',', '.'));
        return isNaN(num) ? 0 : num / 100;
      };

      const payload = {
        empresa_id: empresaId,
        dinheiro: parseTaxa(taxaDinheiro),
        pix: parseTaxa(taxaPix),
        debito: parseTaxa(taxaDebito),
        credito: parseTaxa(taxaCredito),
      };

      const { error } = await supabase
        .from('config_taxa')
        .upsert(payload, { onConflict: 'empresa_id' });

      if (error) throw error;

      setMensagemSucesso(true);
      setTimeout(() => setMensagemSucesso(false), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar taxas:', err);
      setErro('Ocorreu um erro ao salvar as configurações.');
    } finally {
      setSalvando(false);
    }
  };

  const handleMascaraPorcentagem = (valor: string, setValor: (v: string) => void) => {
    let numStr = valor.replace(/\D/g, '');
    if (numStr === '') {
      setValor('0,00');
      return;
    }
    const num = parseInt(numStr, 10);
    const floatNum = num / 100;
    setValor(floatNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  if (!ehDono) {
    return (
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white p-8 rounded-2xl border border-[#14211C]/15 shadow-sm text-center max-w-md">
          <div className="w-14 h-14 bg-[#C4361A]/10 text-[#C4361A] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#14211C] mb-2">Acesso Restrito ao Dono</h2>
          <p className="text-sm text-[#14211C]/70 leading-relaxed">
            A seção de configurações é restrita aos administradores da loja.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14211C] tracking-tight flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-[#0E7A4F]" />
            Configurações
          </h1>
          <p className="text-xs sm:text-sm text-[#14211C]/70 mt-0.5">
            Configure as taxas da sua maquininha e formas de pagamento
          </p>
        </div>
      </div>

      {erro && (
        <div className="p-4 bg-[#C4361A]/10 border border-[#C4361A]/30 rounded-xl text-[#C4361A] text-sm">
          {erro}
        </div>
      )}

      {mensagemSucesso && (
        <div className="p-4 bg-[#0E7A4F]/10 border border-[#0E7A4F]/30 rounded-xl text-[#0E7A4F] text-sm font-medium">
          Configurações salvas com sucesso!
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#14211C]/15 shadow-sm max-w-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#14211C]/10 bg-[#EEF1EC]/40">
          <h2 className="text-lg font-bold text-[#14211C] flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#0E7A4F]" />
            Taxas de Venda
          </h2>
          <p className="text-sm text-[#14211C]/70 mt-1">
            Confira esses percentuais na fatura da sua maquininha. Eles mudam de operadora para operadora.
          </p>
        </div>

        {carregando ? (
          <div className="p-6 space-y-4">
            <div className="h-10 bg-[#14211C]/5 rounded animate-pulse" />
            <div className="h-10 bg-[#14211C]/5 rounded animate-pulse" />
            <div className="h-10 bg-[#14211C]/5 rounded animate-pulse" />
            <div className="h-10 bg-[#14211C]/5 rounded animate-pulse" />
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-5">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-[#14211C] mb-1.5">
                  Débito (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={taxaDebito}
                    onChange={(e) => handleMascaraPorcentagem(e.target.value, setTaxaDebito)}
                    className="w-full h-11 pl-4 pr-10 rounded-lg border border-[#14211C]/20 bg-white text-[#14211C] focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#14211C]/40">
                    %
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#14211C] mb-1.5">
                  Crédito (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={taxaCredito}
                    onChange={(e) => handleMascaraPorcentagem(e.target.value, setTaxaCredito)}
                    className="w-full h-11 pl-4 pr-10 rounded-lg border border-[#14211C]/20 bg-white text-[#14211C] focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#14211C]/40">
                    %
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#14211C] mb-1.5">
                  Pix (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={taxaPix}
                    onChange={(e) => handleMascaraPorcentagem(e.target.value, setTaxaPix)}
                    className="w-full h-11 pl-4 pr-10 rounded-lg border border-[#14211C]/20 bg-white text-[#14211C] focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#14211C]/40">
                    %
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#14211C] mb-1.5">
                  Dinheiro (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={taxaDinheiro}
                    onChange={(e) => handleMascaraPorcentagem(e.target.value, setTaxaDinheiro)}
                    className="w-full h-11 pl-4 pr-10 rounded-lg border border-[#14211C]/20 bg-[#EEF1EC]/50 text-[#14211C] focus:outline-none focus:ring-2 focus:ring-[#0E7A4F] focus:border-[#0E7A4F] transition-all"
                    title="Geralmente o dinheiro não possui taxa"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[#14211C]/40">
                    %
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="h-11 px-6 bg-[#0E7A4F] hover:bg-[#0b633f] active:bg-[#094d31] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all disabled:opacity-50"
              >
                {salvando ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Configurações</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
