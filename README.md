# Casa de Leilões Online — Teste Técnico Elite Dev (Verzel)

Plataforma full-stack de leilões ao vivo construída para o desafio técnico do programa **Elite Dev da Verzel**.
Um **leiloeiro** cria lotes a partir de itens buscados em uma API pública de museu e **licitantes** disputam
cada lote com lances em tempo real, com saldo simulado, comprovante de arremate compartilhável e uma
página de auditoria pública que verifica a integridade do histórico de lances.

## Stack tecnológica

| Camada | Tecnologia |
| --- | --- |
| Front-End | **React** (Next.js 16 — App Router, TypeScript, Tailwind CSS 4) |
| Back-End | **Node.js** (Express 5 + TypeScript) |
| Banco de dados | **PostgreSQL** (Docker local / Railway em produção) |
| Tempo real | **SSE** (Server-Sent Events) + REST |
| API pública externa | [Cleveland Museum of Art Open Access API](https://openaccess-api.clevelandart.org/) (sem chave de acesso, imagens CC0) |
| ORM | Prisma |
| Deploy | **Railway** (back-end + PostgreSQL) · **Vercel** (front-end) |

## Estrutura do projeto

```
elite-dev-leiloes/
├── docker-compose.yml      # PostgreSQL 15 para desenvolvimento local
├── backend/                # API Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma   # Modelo de dados
│   │   ├── migrations/     # Migrações do banco
│   │   └── seed.ts         # Dados de teste
│   ├── src/
│   │   ├── routes/         # Endpoints da API
│   │   ├── services/       # Regras de negócio (lances, liquidação, auditoria)
│   │   ├── middleware/     # Autenticação JWT + papéis
│   │   └── lib/            # Prisma client, utilitários
│   └── tests/              # Testes automatizados das regras de lance
└── frontend/               # App Next.js (React)
    └── app/                # Páginas da aplicação
```

## Pré-requisitos

- [Node.js](https://nodejs.org/) 20+ (testado na 24)
- [Docker](https://www.docker.com/) com Docker Compose
- npm 10+

## Como executar (passo a passo)

### 1. Banco de dados

Na raiz do projeto:

```bash
docker compose up -d
```

Isso sobe o PostgreSQL 15 na porta **55432** (usuário `admin`, senha `adminpassword`,
banco `elitedev_leiloes`).

### 2. Back-end

```bash
cd backend
cp .env.example .env        # já aponta para o Docker acima
npm install
npx prisma migrate dev      # cria as tabelas
npm run seed                # popula os dados de teste
npm run dev                 # API em http://localhost:4000
```

### 3. Front-end

Em outro terminal, na raiz do projeto:

```bash
cd frontend
npm install
npm run dev                 # app em http://localhost:3000
```

### 4. Testes automatizados

```bash
cd backend && npm test
```

## Contas de teste (seed)

O seed cria **1 leiloeiro**, **2 licitantes** e lotes publicados com lances abertos,
para que seja possível percorrer todo o fluxo sem montar nada do zero:

| Papel | E-mail | Senha |
| --- | --- | --- |
| Leiloeiro | `leiloeiro@demo.com` | `senha123` |
| Licitante 1 | `licitante1@demo.com` | `senha123` |
| Licitante 2 | `licitante2@demo.com` | `senha123` |

> Os lotes do seed têm horários relativos ao momento da execução (ex.: início em alguns
> minutos e fim logo depois), para que já exista um lote **ao vivo** com lances.

## Funcionalidades

### Usuários e papéis

- **Leiloeiro (vendedor):** busca itens na API pública, cria e gerencia os próprios lotes
  (cancela os que ainda não receberam lances e acompanha o resultado dos encerrados).
  Não pode dar lances.
- **Licitante (cliente):** deposita um saldo simulado na carteira, acompanha os lotes ao vivo,
  dá lances e, se vencer, recebe um comprovante de arremate com link de compartilhamento.

### Telas

| Tela | Descrição |
| --- | --- |
| Vitrine | Lotes separados em **ao vivo / agendados / encerrados** (cancelados não aparecem), atualização sem recarregar |
| Painel do leiloeiro | Busca de itens na API, criação de lote (imagem, título, atributos, início/fim, valor mínimo e incremento), cancelamento e resultado dos lotes encerrados + total recebido |
| Sala do lote ao vivo | Lance atual, histórico, posição do usuário, contagem regressiva e indicador "você está ganhando" / "você foi superado" — tudo via SSE |
| Carteira | Saldo total, comprometido e disponível + depósito simulado |
| Meus arremates | Itens em que o usuário deu lance e lotes vencidos, com comprovante e link de compartilhamento |
| Auditoria (pública, sem login) | Histórico completo de lances de um lote e verificação de integridade |
| Comprovante (público, link compartilhável) | Detalhes do arremate |

### Regras de lance (back-end)

1. Lances são aceitos apenas em lotes **ao vivo** (entre início e fim).
2. O primeiro lance deve ser **≥ ao lance inicial**; os seguintes **≥ ao lance atual + incremento mínimo**.
3. O licitante líder **não pode cobrir o próprio lance**.
4. **Saldo comprometido:** enquanto um licitante lidera um lote, o valor fica comprometido;
   ao ser superado, volta a ficar disponível imediatamente. Um lance só é aceito se couber
   no saldo disponível (`total − comprometido`).
5. **Prorrogação (anti-sniping):** um lance aceito nos últimos 2 minutos estende o fim do
   lote em +2 minutos.
6. **Liquidação:** ao encerrar, debita-se o valor do vencedor e credita-se o leiloeiro,
   gerando o comprovante. Lotes sem lances fecham sem vencedor.
7. Todo lance recusado retorna uma **mensagem clara com o motivo**: abaixo do mínimo,
   saldo insuficiente, você já está ganhando, lote ainda não iniciado ou lote encerrado.

### Auditoria à prova de adulteração

Cada lance recebe um número de sequência dentro do lote e um hash encadeado:

```
hash(n) = SHA-256( hash(n-1) ‖ seq ‖ valor ‖ licitante ‖ criadoEm ‖ id do lote )
```

A página de auditoria recalcula toda a cadeia a cada consulta. Qualquer **alteração,
remoção ou inserção posterior** de um registro no banco de dados — mesmo feita
diretamente no SQL — quebra a cadeia e a página acusa o histórico como **adulterado**.
A cadeia completa é verificada no servidor a cada leitura (não confiamos em hash
guardado sem recalcular).

### Privacidade

Auditoria e comprovante identificam os licitantes por **alias** público — e-mail e
outros dados pessoais nunca são expostos em páginas públicas.

### Resiliência da API externa

Os dados do item (título, artista, data, técnica, dimensões, imagem) são **copiados para o
banco no momento da criação do lote**. Vitrine, sala ao vivo, auditoria e comprovante
funcionam integralmente mesmo se a API pública cair; apenas a busca de itens no painel do
leiloeiro depende da API e exibe uma mensagem amigável em caso de falha.

## Itens opcionais implementados

- [ ] Busca e filtro de lotes
- [ ] Cancelamento de lote com estorno automático
- [ ] Docker Compose
- [ ] Testes automatizados
- [ ] Dark Mode (tema claro e escuro)

## Deploy

- Front-end: _(em atualização)_
- Back-end: _(em atualização)_

## Uso de IA

_(Relato de onde e como IA foi usada no desenvolvimento — preenchido na entrega.)_

## Referências de mercado

Fluxos usados como ponto de partida (não copiados):
[catawiki.com/pt](https://www.catawiki.com/pt) ·
[liveauctioneers.com](https://www.liveauctioneers.com/) ·
[superbid.net](https://www.superbid.net/)
