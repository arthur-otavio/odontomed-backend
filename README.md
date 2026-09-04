# OdontoMed Backend

API Node/Express para a plataforma OdontoMed, preparada para Firebase Functions, Firebase Auth e Firestore.

## Estrutura

- `api/controllers`: regras de entrada HTTP
- `api/routes`: rotas REST
- `api/services`: agenda, notificacoes e auditoria
- `api/middleware`: autenticacao, permissoes, erros e validacoes
- `api/data`: conexao Firebase Admin
- `docs/openapi.json`: documentacao Swagger
- `scripts/seed.js`: carga inicial

## Configuracao

1. Copie `.env.example` para `.env`.
2. Crie um projeto Firebase com Auth e Firestore.
3. Copie `.firebaserc.example` para `.firebaserc` e altere o ID do projeto.
4. Instale dependencias:

```bash
npm install
```

## Rodar local

```bash
npm run start
```

API local: `http://localhost:3333`

Swagger: `http://localhost:3333/docs`

## Emuladores Firebase

```bash
npm run serve
```

Em outro terminal:

```bash
npm run seed
```

Usuarios demo:

- Admin: `admin@odontomed.local` / `Admin@123456`
- Paciente: `paciente@odontomed.local` / `Paciente@123456`

## Deploy

```bash
firebase login
firebase use seu-projeto-firebase
npm run deploy
```

## Dados oficiais usados

- Clinica: OdontoMed
- Endereco: Av. Parana, 1740 - Sao Jose, Divinopolis - MG, 35501-170
- Telefone/WhatsApp: (37) 3214-5540

Profissionais do seed sao ficticios e estao marcados como demonstracao.
