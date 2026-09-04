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

No Console Firebase, habilite **Authentication > Sign-in method > E-mail/senha** e crie o banco **Cloud Firestore**. Para producao, defina `FIREBASE_PROJECT_ID` com o mesmo ID presente em `.firebaserc`.

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

Para executar o seed contra os emuladores ja abertos, em outro PowerShell:

```bash
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_PROJECT_ID='seu-projeto-firebase'
npm run seed
```

Tambem e possivel iniciar emuladores temporarios, carregar os dados e encerra-los com `npx firebase emulators:exec --only auth,firestore "node scripts/seed.js"`.

Usuarios demo:

- Admin: `admin@odontomed.local` / `Admin@123456`
- Paciente: `paciente@odontomed.local` / `Paciente@123456`

## Deploy

```bash
firebase login
firebase use seu-projeto-firebase
npm run deploy
```

Antes do primeiro deploy, aplique o arquivo `.firebaserc` com o ID real do projeto. O deploy publica a API como Cloud Function em `southamerica-east1`; configure no frontend a URL `https://southamerica-east1-SEU_PROJETO.cloudfunctions.net/api/api`.

## Dados oficiais usados

- Clinica: OdontoMed
- Endereco: Av. Parana, 1740 - Sao Jose, Divinopolis - MG, 35501-170
- Telefone/WhatsApp: (37) 3214-5540

Profissionais do seed sao ficticios e estao marcados como demonstracao.
