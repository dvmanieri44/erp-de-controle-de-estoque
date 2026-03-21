# GoodStock

Dashboard ERP em Next.js com menu lateral para:
- Dashboard
- Produtos
- Entradas
- Saidas
- Lotes
- Movimentacoes
- Relatorios

## Rodando localmente

```bash
npm.cmd install
npm.cmd run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## Qualidade de codigo

```bash
npm.cmd run quality:check
```

Esse comando roda:
- lint do Next.js
- `quality-agent` para detectar arquivos duplicados em `app`, `components` e `lib`
