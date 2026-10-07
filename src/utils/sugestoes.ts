import { differenceInDays, startOfDay, parseISO } from 'date-fns';
import { formatarMoeda } from './formatters';

export interface DadosSugestao {
  validade: string; // ISO date string
  created_at?: string; // ISO date string, if available
  preco: number;
  custo: number;
  nomeProduto: string;
  mediaDia?: number; // giro médio diário
  saldo?: number; // saldo atual
}

export interface ResultadoSugestao {
  percentualSugerido: number;
  justificativa: string;
  margemAtual: number;
}

export function calcularSugestaoPromocao(dados: DadosSugestao): ResultadoSugestao {
  const { validade, created_at, preco, custo, nomeProduto, mediaDia = 0, saldo = 0 } = dados;
  
  if (preco <= 0 || custo <= 0) {
    return { percentualSugerido: 0, justificativa: "Dados incompletos para sugestão automática (falta preço ou custo).", margemAtual: 0 };
  }

  const hoje = startOfDay(new Date());
  const dataValidade = parseISO(validade);
  const diasRestantes = differenceInDays(dataValidade, hoje);
  
  // Margem de Lucro Atual: (Preço - Custo) / Preço
  const margemAtual = (preco - custo) / preco;
  const margemPercentual = margemAtual * 100;
  
  if (diasRestantes < 0) {
    return { percentualSugerido: 0, justificativa: "Produto vencido. Venda bloqueada.", margemAtual: margemPercentual };
  }

  if (margemAtual <= 0) {
    return { percentualSugerido: 0, justificativa: `Margem negativa ou zero (Custo: ${formatarMoeda(custo)} | Preço: ${formatarMoeda(preco)}). Sugestão automática desativada.`, margemAtual: margemPercentual };
  }

  // 1. Razão Dias Restantes / Vida Total Útil
  let vidaTotal = 30; // padrão assumido se não houver created_at
  if (created_at) {
     const dataCriacao = startOfDay(parseISO(created_at));
     const calcVida = differenceInDays(dataValidade, dataCriacao);
     if (calcVida > 0) vidaTotal = calcVida;
  }
  
  const razaoTempo = Math.max(0, Math.min(1, diasRestantes / vidaTotal));
  
  // 2. Categoria / Tipo de Produto (Inferência por nome)
  const pereciveis = ['pão', 'pao', 'leite', 'iogurte', 'queijo', 'frango', 'carne', 'bolo', 'doce', 'torta', 'fruta', 'verdura', 'peixe', 'hortaliça'];
  const nomeLower = nomeProduto.toLowerCase();
  const isPerecivel = pereciveis.some(p => nomeLower.includes(p));

  // 3. Histórico de Vendas
  // Consideramos vendas baixas se o giro semanal for menor que 10% do estoque atual (e se tiver estoque)
  const vendasBaixas = saldo > 0 && (mediaDia * 7) < (saldo * 0.1); 
  
  // Cálculo Base do Desconto
  let descontoSugerido = 0;
  
  if (razaoTempo < 0.2) {
    // Crítico (falta menos de 20% da vida útil)
    descontoSugerido = 30;
  } else if (razaoTempo < 0.5) {
    // Atenção
    descontoSugerido = 15;
  } else {
    // Normal, longe do vencimento (não precisa de muito desconto)
    descontoSugerido = 0;
  }
  
  // Modificadores
  if (descontoSugerido > 0) {
    if (isPerecivel) {
      descontoSugerido += 10;
    }
    if (vendasBaixas) {
      descontoSugerido += 5;
    }
  } else if (diasRestantes <= 15) {
    // Mesmo se a razão não for crítica, mas faltam poucos dias (ex: validade original longa)
    descontoSugerido = 10;
  }
  
  // Limites de Segurança
  // Não podemos ultrapassar a margem atual. A margem máxima de desconto é a margem atual - 5% 
  // (para manter pelo menos 5% de margem)
  const maxDescontoSeguro = Math.floor(margemPercentual - 5);
  
  if (descontoSugerido > maxDescontoSeguro) {
     descontoSugerido = maxDescontoSeguro;
  }
  
  // Arredondamento seguro para o múltiplo de 5 mais próximo para baixo
  descontoSugerido = Math.floor(descontoSugerido / 5) * 5;
  
  if (descontoSugerido < 0) descontoSugerido = 0;
  
  // Justificativa
  let just = "";
  if (descontoSugerido > 0) {
    just = `Sugerido ${descontoSugerido}% OFF: Faltam ${diasRestantes} dias. `;
    if (isPerecivel) just += "Produto de rápido perecimento. ";
    if (vendasBaixas && mediaDia > 0) just += "Giro recente muito baixo. ";
    just += `Margem atual comporta o desconto (${margemPercentual.toFixed(1)}%).`;
  } else {
    if (margemPercentual < 5) {
      just = `Margem baixa (${margemPercentual.toFixed(1)}%). Criação manual recomendada.`;
    } else {
      just = `Faltam ${diasRestantes} dias. Produto com prazo seguro ou sem necessidade iminente.`;
    }
  }

  return {
    percentualSugerido: Math.max(0, descontoSugerido),
    justificativa: just,
    margemAtual: margemPercentual
  };
}
