const { db, Timestamp } = require('../data/firebase');
const { HttpError } = require('../utils/httpError');

const ACTIVE_STATUS = ['AGENDADO', 'CONFIRMADO', 'AGUARDANDO_CONFIRMACAO', 'EM_ATENDIMENTO'];

function toDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Data invalida.');
  return date;
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function weekdayKey(date) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function parseTime(time) {
  const [hour, minute] = String(time).split(':').map(Number);
  return hour * 60 + minute;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

async function getClinicSettings() {
  const doc = await db.collection('clinic_settings').doc('main').get();
  if (!doc.exists) throw new HttpError(500, 'Configuracoes da clinica nao encontradas.');
  return doc.data();
}

async function assertSlotAvailable({ professionalId, procedureId, startsAt, appointmentIdToIgnore }) {
  const professionalSnap = await db.collection('professionals').doc(professionalId).get();
  if (!professionalSnap.exists || professionalSnap.data().active === false) {
    throw new HttpError(404, 'Profissional indisponivel.');
  }

  const procedureSnap = await db.collection('procedures').doc(procedureId).get();
  if (!procedureSnap.exists || procedureSnap.data().active === false) {
    throw new HttpError(404, 'Procedimento indisponivel.');
  }

  const procedure = procedureSnap.data();
  const professional = professionalSnap.data();
  if (Array.isArray(procedure.professionalIds) && procedure.professionalIds.length && !procedure.professionalIds.includes(professionalId)) {
    throw new HttpError(409, 'Profissional nao habilitado para este procedimento.');
  }
  const settings = await getClinicSettings();
  const start = toDate(startsAt);
  const end = addMinutes(start, procedure.durationMinutes);
  const day = weekdayKey(start);
  const startMin = minutesOfDay(start);
  const endMin = minutesOfDay(end);
  const clinicDay = settings.businessHours?.[day];
  const professionalDay = professional.workingHours?.[day];

  if (!clinicDay?.open || !professionalDay?.open) throw new HttpError(409, 'Data indisponivel para atendimento.');
  if (startMin < parseTime(clinicDay.start) || endMin > parseTime(clinicDay.end)) {
    throw new HttpError(409, 'Horario fora do funcionamento da clinica.');
  }
  if (startMin < parseTime(professionalDay.start) || endMin > parseTime(professionalDay.end)) {
    throw new HttpError(409, 'Horario fora da agenda do profissional.');
  }

  const breaks = [...(clinicDay.breaks || []), ...(professionalDay.breaks || [])];
  if (breaks.some((item) => intervalsOverlap(startMin, endMin, parseTime(item.start), parseTime(item.end)))) {
    throw new HttpError(409, 'Horario bloqueado por intervalo.');
  }

  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setHours(23, 59, 59, 999);

  const blocked = await db.collection('blocked_slots')
    .where('professionalId', 'in', [professionalId, 'ALL'])
    .get();

  blocked.forEach((doc) => {
    const item = doc.data();
    const itemStart = item.startsAt.toDate();
    const itemEnd = item.endsAt.toDate();
    if (itemEnd >= dayStart && itemStart <= dayEnd && intervalsOverlap(start, end, itemStart, itemEnd)) {
      throw new HttpError(409, 'Horario bloqueado.');
    }
  });

  const appointments = await db.collection('appointments')
    .where('professionalId', '==', professionalId)
    .where('startsAt', '>=', Timestamp.fromDate(dayStart))
    .where('startsAt', '<=', Timestamp.fromDate(dayEnd))
    .get();

  appointments.forEach((doc) => {
    if (doc.id === appointmentIdToIgnore) return;
    const item = doc.data();
    if (!ACTIVE_STATUS.includes(item.status)) return;
    const itemStart = item.startsAt.toDate();
    const itemEnd = item.endsAt.toDate();
    if (intervalsOverlap(start, end, itemStart, itemEnd)) {
      throw new HttpError(409, 'Ja existe agendamento para este horario.');
    }
  });

  return {
    professional: { id: professionalSnap.id, ...professional },
    procedure: { id: procedureSnap.id, ...procedure },
    startsAt: start,
    endsAt: end,
  };
}

async function listAvailableSlots({ professionalId, procedureId, date }) {
  const dayStart = toDate(`${date}T00:00:00-03:00`);
  const slots = [];

  const procedure = (await db.collection('procedures').doc(procedureId).get()).data();
  if (!procedure) throw new HttpError(404, 'Procedimento nao encontrado.');

  for (let hour = 8; hour <= 17; hour += 1) {
    for (const minute of [0, 30]) {
      const startsAt = new Date(dayStart);
      startsAt.setHours(hour, minute, 0, 0);
      try {
        await assertSlotAvailable({ professionalId, procedureId, startsAt: startsAt.toISOString() });
        slots.push({ startsAt: startsAt.toISOString(), durationMinutes: procedure.durationMinutes });
      } catch (_error) {
        // Unavailable slots are intentionally omitted.
      }
    }
  }

  return slots;
}

module.exports = { assertSlotAvailable, listAvailableSlots, ACTIVE_STATUS };
