# Sistema de Controle de Estoque e Caixa

Sistema web de controle de estoque, frente de caixa (PDV), gestão de compras, controle de validade e conferência inteligente de DANFE/Notas Fiscais para mini mercados e comércio varejista.

## 🚀 Tecnologias

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion
- **Backend:** Express, Node.js (com TypeScript e TSX)
- **Banco de Dados & Auth:** Supabase (PostgreSQL, Row Level Security, RPCs)
- **Inteligência Artificial:** Google Gemini API (Leitura, extração e normalização de DANFE e recibos)
- **Build Tool:** Vite, esbuild

## 📦 Funcionalidades

- **Frente de Caixa (PDV):** Abertura/fechamento de vendas, desconto com permissão de operador/supervisor, leitor de código de barras.
- **Controle de Estoque:** Listagem com filtros, alertas de estoque baixo e movimentações (entradas/saídas/perdas).
- **Conferência de DANFE:** Extração via Gemini com conversão inteligente de unidades (CX, FARDO, KIT para UN), precificação sugerida e conciliação por EAN/Código de Fornecedor.
- **Controle de Validade & Promoções:** Identificação de produtos próximos ao vencimento e aplicação rápida de descontos.
- **Financeiro & DRE:** Visão de faturamento, margem de contribuição, custos e perdas registradas.

## 🛠️ Configuração e Execução

### 1. Clonar e Instalar Dependências

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd <PASTA_DO_PROJETO>
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preencha as variáveis em `.env`:
- `VITE_SUPABASE_URL` e `SUPABASE_URL`: URL do seu projeto Supabase.
- `VITE_SUPABASE_ANON_KEY` e `SUPABASE_ANON_KEY`: Chave anônima pública do Supabase.
- `GEMINI_API_KEY`: Chave da API do Google Gemini.

### 3. Rodar em Desenvolvimento

```bash
npm run dev
```

Acesse em `http://localhost:3000`.

### 4. Build para Produção

```bash
npm run build
npm start
```
