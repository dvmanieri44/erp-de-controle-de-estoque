# PremieRpet Operations ERP

ERP full stack em Next.js para operacoes de estoque, movimentacoes, rastreabilidade e modulos operacionais. O foco atual do projeto e estabilidade, previsibilidade de dados e preparo para trabalho em equipe sem reescrever a arquitetura central.

## Stack

- Next.js 15
- React 19
- TypeScript 5
- Tailwind CSS 4
- Firebase Admin como persistencia compartilhada
- Fallback local em arquivos `.data/` para desenvolvimento
- Testes de backend com `node:test`

## Arquitetura resumida

- `app/`: App Router, telas principais e rotas API.
- `components/`: UI do dashboard, login e modulos operacionais.
- `lib/server/`: regras de negocio do backend, controle de acesso, auditoria, versionamento e stores dedicados.
- `lib/`: cache em memoria, sincronizacao local/remota, helpers de frontend e colecoes operacionais.
- `tests/server/`: testes dos fluxos criticos do backend.
- `scripts/`: utilitarios de qualidade, backup e seed local.

Pontos importantes da arquitetura atual:

- Recursos criticos usam rotas dedicadas e stores itemizados com `version`, tombstone e checagem de conflito.
- Recursos legados/genericos ainda usam sincronizacao por colecao com cache local e persistencia assincorna.
- O frontend usa `localStorage`, `ERP_DATA_EVENT` e `erpQueryClient` para sincronizacao entre telas.
- Em producao, o backend exige Firebase Admin configurado.

## Estrutura de pastas

```text
.
|-- app/
|   |-- api/
|   |-- dashboard/
|   `-- login/
|-- components/
|   |-- dashboard/
|   `-- login/
|-- lib/
|   |-- server/
|   `-- ...
|-- public/
|-- scripts/
|-- tests/
|   `-- server/
|-- .env.example
|-- package.json
`-- README.md
```

## Requisitos

- Node.js 20 LTS recomendado
- npm 10+

Versao local usada na auditoria:

- Node `v24.14.0`
- npm `11.9.0`

## Setup local

1. Instale dependencias:

```bash
npm install
```

2. Crie o arquivo de ambiente:

```bash
Copy-Item .env.example .env.local
```

3. Defina pelo menos:

- `AUTH_SECRET`
- credenciais Firebase se quiser persistencia compartilhada

4. Provisione as contas temporarias de desenvolvimento:

```bash
npm run seed:dev-users
```

Por padrao, o seed cria ou atualiza as contas temporarias da equipe:

- `davi / Davi123!`
- `lael / Lael123!`
- `marcos / Marcos123!`
- `luiz / Luiz123!`
- `marco / Marco123!`

Todas entram como `administrador`, com acesso maximo ao ERP, apenas para desenvolvimento, validacao e testes internos.
Essas credenciais sao temporarias, nao sao provisionadas automaticamente e nunca devem ser usadas em producao.

5. Rode o projeto:

```bash
npm run dev
```

Aplicacao local:

- `http://localhost:3000`

## Comandos principais

```bash
npm run dev
npm run dev:fast
npm run build
npm run start
npm run lint
npm run test:server
npm run quality:check
npm run backup:local-state
npm run seed:dev-users
npm run seed:dev-user
```

## Variaveis de ambiente

O arquivo `.env.example` esta versionado e documenta:

- autenticacao e sessao
- fallback local em `.data/`
- paths dos stores dedicados
- reset de senha
- seed local de desenvolvimento da equipe
- Firebase Admin

Nunca versione:

- `.env.local`
- `.data/`
- `.next/`
- `node_modules/`

## Build e testes

Validacoes minimas antes de abrir PR:

```bash
npm run lint
npm run test:server
npm run build
```

Observacao:

- hoje a cobertura automatizada esta concentrada no backend
- ainda nao existem testes frontend equivalentes para os fluxos principais do dashboard

## Fluxo de branches

Sugestao para equipe:

- `main`: somente codigo pronto para entrega
- `feature/<escopo>`: novas alteracoes pequenas e isoladas
- `fix/<escopo>`: correcoes de bug
- `chore/<escopo>`: limpeza, setup e manutencao

Boas praticas:

- branch curta e com escopo unico
- PR pequena
- nao misturar refactor, feature e limpeza no mesmo PR
- nao subir `.data`, `.env.local`, `.next` ou caches locais

## Convencao de commits

Padrao recomendado:

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
- `test: ...`
- `chore: ...`

Exemplos:

- `fix: harden inventory movement validation`
- `docs: document local development setup`
- `chore: add dev seed and env example`

## Observacoes importantes

- `.data/` guarda estado local de desenvolvimento. Se voce limpar essa pasta, rode `npm run seed:dev-users` novamente antes de testar login.
- O seed de equipe usa o mesmo recurso `user.accounts` e o mesmo armazenamento de credenciais do backend atual: se o Firebase Admin estiver configurado, grava no Firebase; caso contrario, grava no fallback local em `.data/`.
- Para reprovisionar as contas temporarias da equipe depois de limpar o estado local, rode `npm run seed:dev-users`. O comando antigo `npm run seed:dev-user` continua funcionando como alias.
- Antes de apagar estado local, gere backup com `npm run backup:local-state`.
- O projeto tem recursos com leitura hibrida entre snapshot legado e stores itemizados. Isso reduz ruptura, mas aumenta o cuidado necessario com normalizacao e conflitos.
- A rota generica `/api/erp/state/[resource]` deve continuar bloqueada para escrita nos recursos que ja possuem rotas dedicadas.
- Em producao, `AUTH_SECRET` precisa ser forte e o Firebase Admin precisa estar configurado.
