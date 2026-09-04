const { db, FieldValue } = require('../data/firebase');

async function queueNotification({ userId, patientId, appointmentId, channel, type, message }) {
  const doc = {
    userId,
    patientId,
    appointmentId,
    channel,
    type,
    message,
    status: process.env[`${channel}_PROVIDER`] === 'mock' ? 'SIMULATED' : 'PENDING',
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection('notifications').add(doc);
  return { id: ref.id, ...doc };
}

function appointmentMessage(type, patientName, appointment, professionalName) {
  const when = new Date(appointment.startsAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });

  const messages = {
    APPOINTMENT_CREATED: `Ola, ${patientName}! Seu atendimento na OdontoMed foi agendado para ${when} com ${professionalName}.`,
    APPOINTMENT_CANCELLED: 'Seu agendamento foi cancelado com sucesso.',
    APPOINTMENT_RESCHEDULED: `Seu horario foi alterado para ${when}.`,
    APPOINTMENT_REMINDER: `Ola, ${patientName}! Passando para lembrar que sua consulta na OdontoMed sera em ${when}.`,
  };

  return messages[type] || 'Voce tem uma nova notificacao da OdontoMed.';
}

module.exports = { queueNotification, appointmentMessage };
