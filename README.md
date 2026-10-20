# SIMONU — Teatro de Operações

Aplicação web em React + TypeScript + Vite conectada ao Supabase para organizar a avaliação ao vivo da simulação acadêmica **Invasão Americana no Irã (2027)**.

## O que já está incluído

- Login por e-mail e senha usando Supabase Auth.
- Painel de resumo com total de representações, avaliações e média.
- Cinco sessões de duas horas, com quatro momentos de avaliação por sessão (a cada 30 minutos).
- Formulário de avaliação com critérios configuráveis no banco, notas de 0 a 10 em incrementos de 0,5 e observações privadas da mesa.
- Uma avaliação por delegado, sessão e momento; salvar novamente atualiza o registro.
- Cadastro, edição e ativação/desativação de delegados sem apagar seu histórico.
- Ranking geral, por sessão e por momento; comparação entre EUA e Irã.
- Histórico com edição, exclusão e exportação CSV.
- Persistência no Supabase, então os dados ficam disponíveis entre computadores para usuários autorizados.

## 1. Pré-requisitos

Instale uma versão LTS do Node.js (que inclui npm) e o Visual Studio Code:

- Node.js: https://nodejs.org/
- Visual Studio Code: https://code.visualstudio.com/

## 2. Baixe e extraia o ZIP

Extraia a pasta `simonu-projeto` em um local fácil de achar. No VS Code, clique em **Arquivo → Abrir Pasta** e selecione essa pasta.

## 3. Configure a chave pública do Supabase

O projeto já aponta para este banco:

- URL: `https://ipouhzjxceycgdqhgwof.supabase.co`
- Painel: https://supabase.com/dashboard/project/ipouhzjxceycgdqhgwof
- Chaves: https://supabase.com/dashboard/project/ipouhzjxceycgdqhgwof/settings/api-keys

Na página de chaves, copie a **Publishable key** (normalmente começa com `sb_publishable_`). Na pasta do projeto, duplique `.env.example` e renomeie a cópia para `.env.local`. Abra `.env.local` e substitua o valor de `VITE_SUPABASE_PUBLISHABLE_KEY` pela chave pública.

Exemplo:

```env
VITE_SUPABASE_URL=https://ipouhzjxceycgdqhgwof.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_COLE_A_CHAVE_REAL_AQUI
```

**Nunca coloque `service_role`, secret key ou senha do banco no frontend.** Não compartilhe o arquivo `.env.local` nem o publique no Git.

## 4. Instale e execute

No VS Code, abra **Terminal → Novo Terminal**. Confirme que o terminal está dentro da pasta que contém `package.json` e execute:

```bash
npm install
npm run dev
```

Abra no navegador o endereço que o Vite mostrar (normalmente `http://127.0.0.1:5173`). Para encerrar o servidor, pressione `Ctrl + C` no terminal.

Sempre que quiser voltar a usar o SIMONU, abra essa mesma pasta no VS Code e execute `npm run dev`. Não precisa baixar o pacote novamente. Os dados salvos no Supabase continuam lá.

## 5. Acesso de usuário

O login exige uma conta criada em **Supabase → Authentication → Users** e permissão em `public.committee_members`. O usuário administrador inicial foi cadastrado anteriormente no projeto. Se precisar adicionar outra pessoa da mesa, crie primeiro o usuário no Supabase Auth e depois associe seu `user_id` na tabela `committee_members` com papel `board` ou `admin`.

Se o login funcionar mas o banco negar acesso, confira as políticas RLS e a associação em `committee_members`. O frontend não usa nem precisa de chave secreta.

## 6. Banco de dados existente

O pacote foi preparado para o esquema Supabase que já foi configurado no projeto. **Não execute `supabase/schema.sql` inteiro sobre o banco em uso sem conferir o conteúdo**: ele é um arquivo de referência/compatibilidade e inclui verificações que podem ser úteis caso você recrie o projeto. O banco atual já foi criado e continha tabelas `committee_members`, `delegates`, `sessions`, `evaluation_criteria`, `evaluations` e `evaluation_scores`.

O código salva várias notas de critérios com `upsert` e espera uma restrição única em `evaluation_scores (evaluation_id, criterion_id)`. Se a tela mostrar erro de conflito/constraint ao salvar avaliação, abra o SQL Editor do Supabase e execute:

```sql
create unique index if not exists evaluation_scores_evaluation_criterion_uidx
on public.evaluation_scores (evaluation_id, criterion_id);
```

Se o banco já tiver duplicatas, o índice não será criado até que elas sejam resolvidas; nesse caso, não apague dados automaticamente, revise as linhas duplicadas primeiro.

## 7. Repetir a simulação / preparar nova edição

- Para começar outra edição sem perder a anterior, prefira manter o mesmo banco e cadastrar uma nova edição com um esquema de dados separado. Esta primeira versão usa as mesmas tabelas para todas as avaliações; portanto, antes de reutilizar com novos participantes, exporte o CSV e combine como separar/arquivar as edições.
- **Não existe botão para apagar tudo** nesta versão, intencionalmente: isso protege contra apagar acidentalmente dados reais.
- Para corrigir uma nota, abra Histórico, clique no lápis, ajuste as notas e salve. Para remover um único registro, use o ícone de lixeira.
- Use **Exportar CSV** para guardar uma cópia externa das avaliações.

## Limitações desta primeira versão

- O ranking público com link compartilhável e permissões específicas ainda não está implementado. O ranking interno exige login.
- O cenário e os dados são compartilhados no mesmo conjunto de tabelas; a separação de múltiplas edições (por exemplo, SIMONU26 e SIMONU27), salas e ordens de gabinete deve ser adicionada em uma próxima etapa.
- A tela administra delegados e registra avaliações. Gestão de contas da mesa e edição visual dos critérios ainda precisam de uma interface administrativa própria.
- O código foi montado para o esquema descrito, mas não foi possível testar contra o banco real a partir deste pacote. Se surgir erro, copie a mensagem completa e ela poderá ser corrigida sem refazer o projeto.

## Estrutura

```text
simonu-projeto/
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── types.ts
│   └── lib/supabase.ts
└── supabase/schema.sql
```
