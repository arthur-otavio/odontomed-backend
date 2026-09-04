# Arquitetura OdontoMed

## Backend

Node.js com Express no mesmo padrao estrutural do `portalv2-backend`, publicado em Firebase Functions.

Colecoes Firestore:

- `users`
- `patients`
- `professionals`
- `specialties`
- `procedures`
- `appointments`
- `schedules`
- `blocked_slots`
- `notifications`
- `clinic_settings`
- `audit_logs`

## Frontend

React com Vite no mesmo padrao estrutural do `portalv2-frontend`, publicado em Firebase Hosting.

## Agendamento

A criacao de consulta passa pelo backend, que valida:

- profissional ativo
- procedimento ativo
- profissional habilitado
- horario de funcionamento da clinica
- horario de trabalho do profissional
- intervalos
- bloqueios administrativos
- conflito com consultas ativas

Status ativos para conflito: `AGENDADO`, `CONFIRMADO`, `AGUARDANDO_CONFIRMACAO`, `EM_ATENDIMENTO`.

## Notificacoes

A arquitetura grava notificacoes em `notifications` com status `SIMULATED` quando os provedores estao configurados como mock.
