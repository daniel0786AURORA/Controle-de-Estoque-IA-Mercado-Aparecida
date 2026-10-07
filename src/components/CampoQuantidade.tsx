import React from 'react';
import { converterTextoParaQuantidade } from '../utils/formatters';
import { AlertCircle } from 'lucide-react';

interface CampoQuantidadeProps {
  id?: string;
  label?: string;
  required?: boolean;
  unidade: 'UN' | 'KG' | string;
  value: string;
  onChange: (value: string) => void;
  erro?: string | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onBlur?: () => void;
}

export const CampoQuantidade: React.FC<CampoQuantidadeProps> = ({
  id = 'input-quantidade',
  label,
  required = false,
  unidade = 'UN',
  value,
  onChange,
  erro,
  placeholder = '0',
  disabled = false,
  className = '',
  onBlur,
}) => {
  const isKg = unidade.toUpperCase() === 'KG';
  const unidadeLabel = unidade.toLowerCase();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (!isKg) {
      // Regra para 'UN': aceita apenas dígitos (inteiros positivos, sem vírgula, sem ponto)
      // Permite campo vazio para que o usuário possa apagar e digitar livremente
      if (raw === '' || /^\d+$/.test(raw)) {
        onChange(raw);
      } else {
        // Se usuário digitou algo não numérico ou com vírgula/ponto, atualiza o valor bruto para exibir o erro de validação
        onChange(raw);
      }
    } else {
      // Regra para 'KG': aceita dígitos e uma vírgula ou ponto, com até 3 casas decimais
      // Substitui ponto por vírgula automaticamente na digitação para manter o padrão brasileiro
      const normalizado = raw.replace('.', ',');
      onChange(normalizado);
    }
  };

  // Verificação de erro imediato na digitação caso haja valor
  const validacao = value ? converterTextoParaQuantidade(value, unidade) : null;
  const mostrarErro = erro || (value && validacao && !validacao.valido ? 'Informe uma quantidade válida' : null);

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-[#14211C] mb-1.5">
          {label} {required && <span className="text-[#C4361A]">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode={isKg ? 'decimal' : 'numeric'}
          value={value}
          onChange={handleInputChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full min-h-[44px] h-11 pl-3.5 pr-20 rounded-lg border bg-white text-[#14211C] placeholder-[#14211C]/35 focus:outline-none focus:ring-2 text-base font-semibold transition-all ${
            mostrarErro
              ? 'border-[#C4361A] focus:ring-[#C4361A] focus:border-[#C4361A]'
              : 'border-[#14211C]/25 focus:ring-[#0E7A4F] focus:border-[#0E7A4F]'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
        />

        {/* Indicador visual da unidade ao lado do campo */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1 bg-[#EEF1EC] px-2.5 py-1 rounded-md border border-[#14211C]/15 text-xs sm:text-sm font-bold text-[#14211C]/80">
          <span>{value ? `${value} ${unidadeLabel}` : unidadeLabel}</span>
        </div>
      </div>

      {/* Mensagem de erro amigável */}
      {mostrarErro && (
        <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[#C4361A]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{mostrarErro}</span>
        </div>
      )}
    </div>
  );
};
