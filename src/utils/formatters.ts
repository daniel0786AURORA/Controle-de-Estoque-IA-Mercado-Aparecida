// Utilitários de formatação para moedas, números e cálculos seguros

// Converte string de quantidade para número respeitando as regras de UN (inteiro) e KG (até 3 decimais com vírgula)
export const converterTextoParaQuantidade = (
  texto: string,
  unidade: string = 'UN'
): { valido: boolean; valor: number; erro?: string } => {
  const limpo = texto.trim();
  if (!limpo) {
    return { valido: false, valor: 0, erro: 'Informe uma quantidade válida' };
  }

  const isKg = unidade.toUpperCase() === 'KG';

  if (!isKg) {
    // Unidade 'UN': apenas inteiros positivos, sem casas decimais nem vírgula/ponto
    if (!/^\d+$/.test(limpo)) {
      return { valido: false, valor: 0, erro: 'Informe uma quantidade válida' };
    }
    const val = parseInt(limpo, 10);
    if (isNaN(val) || val <= 0) {
      return { valido: false, valor: 0, erro: 'Informe uma quantidade válida' };
    }
    return { valido: true, valor: val };
  } else {
    // Unidade 'KG': aceita até 3 casas decimais com vírgula (ou ponto)
    // Ex: 1,5 | 0,750 | 2 | 0,5 | 10,25
    if (!/^\d+([.,]\d{1,3})?$/.test(limpo)) {
      return { valido: false, valor: 0, erro: 'Informe uma quantidade válida' };
    }
    const comPonto = limpo.replace(',', '.');
    const val = parseFloat(comPonto);
    if (isNaN(val) || val <= 0) {
      return { valido: false, valor: 0, erro: 'Informe uma quantidade válida' };
    }
    return { valido: true, valor: val };
  }
};

// Formata moeda brasileira BRL
export const formatarMoeda = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
};

// Formata quantidade fracionada ou inteira
export const formatarQuantidade = (qtd: number | null | undefined, unidade?: string): string => {
  if (qtd === null || qtd === undefined || isNaN(qtd)) {
    return unidade ? `0 ${unidade}` : '0';
  }

  const formatado = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(qtd) ? 0 : 2,
    maximumFractionDigits: 3,
  }).format(qtd);

  return unidade ? `${formatado} ${unidade}` : formatado;
};

// Formata percentual com 1 casa decimal
export const formatarPercentual = (valor: number | null | undefined): string => {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return '-';
  }
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor) + '%';
};

// Calcula a margem de lucro percentual com segurança: ((Venda - Custo) / Venda) * 100
export const calcularMargem = (
  precoVenda: number | null | undefined,
  custoMedio: number | null | undefined
): number | null => {
  if (!precoVenda || precoVenda <= 0 || custoMedio === null || custoMedio === undefined || custoMedio < 0) {
    return null;
  }
  // Cálculo em centavos para evitar imprecisão de ponto flutuante
  const vendaCentavos = Math.round(precoVenda * 100);
  const custoCentavos = Math.round(custoMedio * 100);
  if (vendaCentavos <= 0) return null;

  const lucroCentavos = vendaCentavos - custoCentavos;
  return (lucroCentavos / vendaCentavos) * 100;
};

// Calcula o valor total em estoque com precisão segura de centavos: Custo * Saldo
export const calcularValorEstoque = (
  custoMedio: number | null | undefined,
  saldo: number | null | undefined
): number => {
  if (!custoMedio || custoMedio <= 0 || !saldo || saldo <= 0) {
    return 0;
  }
  // Trabalha com centavos e arredonda
  const custoCentavos = Math.round(custoMedio * 100);
  const totalCentavos = Math.round(custoCentavos * saldo);
  return totalCentavos / 100;
};

// Formata data e hora no fuso horário America/Sao_Paulo
export const formatarDataHoraSP = (dataIso?: string | null): string => {
  if (!dataIso) return '-';
  try {
    const data = new Date(dataIso);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(data);
  } catch {
    return '-';
  }
};

// Formata apenas hora no fuso horário America/Sao_Paulo
export const formatarHoraSP = (dataIso?: string | null): string => {
  if (!dataIso) return '-';
  try {
    const data = new Date(dataIso);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(data);
  } catch {
    return '-';
  }
};

// Formata apenas data (DD/MM/AAAA) no fuso horário America/Sao_Paulo
export const formatarDataSP = (dataIso?: string | null): string => {
  if (!dataIso) return '-';
  try {
    const data = new Date(dataIso);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(data);
  } catch {
    return '-';
  }
};

// Obtém o início do dia atual em formato ISO considerando o fuso de São Paulo
export const obterInicioDoDiaSP = (): string => {
  const agora = new Date();
  const spFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const partes = spFormatter.formatToParts(agora);
  const ano = partes.find((p) => p.type === 'year')?.value || agora.getFullYear();
  const mes = partes.find((p) => p.type === 'month')?.value || '01';
  const dia = partes.find((p) => p.type === 'day')?.value || '01';
  
  // Retorna ISO para 00:00:00 no fuso de SP (-03:00)
  return `${ano}-${mes}-${dia}T00:00:00-03:00`;
};
