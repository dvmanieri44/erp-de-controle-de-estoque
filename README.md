# PremieRpet Operations

ERP em Next.js pensado para a operação industrial e logística da PremieRpet, com foco em:
- controle de estoque por localizações
- movimentações de entrada, saída e ajuste
- transferências entre fábrica, expedição e centros de distribuição
- lotes, rastreabilidade e acompanhamento operacional

## Módulos atuais

- Painel industrial
- Produtos
- Movimentações
- Estoque baixo
- Lotes
- Fornecedores
- Categorias
- Localizações
- Transferências
- Relatórios
- Histórico
- Configurações

## Rodando localmente

```bash
npm.cmd install
npm.cmd run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## Qualidade de código

```bash
npm.cmd run quality:check
```

Esse comando roda:
- lint do Next.js
- `quality-agent` para detectar arquivos duplicados em `app`, `components` e `lib`
