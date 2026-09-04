const { db, Timestamp } = require('../data/firebase');
const { HttpError } = require('../utils/httpError');

const ACTIVE_STATUS = ['AGENDADO', 'CONFIRMADO', 'AGUARDANDO_CONFIRMACAO', 'EM_ATENDIMENTO'];
const CLINIC_TIMEZONE = 'America/Sao_Paulo';

function toDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Data invalida.');
  return date;
}

function minutesOfDay(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return Number(value.hour) * 60 + Number(value.minute);
}

function weekdayKey(date) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: CLINIC_TIMEZONE, weekday: 'short' }).format(date).toLowerCase();
  return { sun: 'sun', mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat' }[weekday];
}

function dateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
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

async function read(source, reference) {
  return source ? source.get(reference) : reference.get();
}

async function getClinicSettings(transaction) {
  const doc = await read(transaction, db.collection('clinic_settings').doc('main'));
  if (!doc.exists) throw new HttpError(500, 'Configuracoes da clinica nao encontradas.');
  return doc.data();
}

async function assertSlotAvailable({ professionalId, procedureId, startsAt, appointmentIdToIgnore, transaction }) {
  if (!professionalId || !procedureId || !startsAt) {
    throw new HttpError(400, 'Profissional, procedimento e horario sao obrigatorios.');
  }

  const professionalSnap = await read(transaction, db.collection('professionals').doc(professionalId));
  if (!professionalSnap.exists || professionalSnap.data().active === false) {
    throw new HttpError(404, 'Profissional indisponivel.');
  }

  const procedureSnap = await read(transaction, db.collection('procedures').doc(procedureId));
  if (!procedureSnap.exists || procedureSnap.data().active === false) {
    throw new HttpError(404, 'Procedimento indisponivel.');
  }

  const procedure = procedureSnap.data();
  const professional = professionalSnap.data();
  if (Array.isArray(procedure.professionalIds) && procedure.professionalIds.length && !procedure.professionalIds.includes(professionalId)) {
    throw new HttpError(409, 'Profissional nao habilitado para este procedimento.');
  }
  const settings = await getClinicSettings(transaction);
  const start = toDate(startsAt);
  if (start.getTime() < Date.now() - 60 * 1000) {
    throw new HttpError(409, 'Nao e possivel agendar um horario no passado.');
  }
  const end = addMinutes(start, procedure.durationMinutes);
  const day = weekdayKey(start);
  const startMin = minutesOfDay(start);
  const endMin = minutesOfDay(end);
  const clinicDay = settings.businessHours?.[day];
  const professionalDay = professional.workingHours?.[day];

  if ((settings.unavailableDates || []).includes(dateKey(start))) {
    throw new HttpError(409, 'Data indisponivel para atendimento.');
  }

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

  const localDate = dateKey(start);
  const dayStart = new Date(`${localDate}T00:00:00-03:00`);
  const dayEnd = new Date(`${localDate}T23:59:59.999-03:00`);

  const blockedQuery = db.collection('blocked_slots')
    .where('professionalId', 'in', [professionalId, 'ALL'])
  const blocked = await read(transaction, blockedQuery);

  blocked.forEach((doc) => {
    const item = doc.data();
    const itemStart = item.startsAt.toDate();
    const itemEnd = item.endsAt.toDate();
    if (itemEnd >= dayStart && itemStart <= dayEnd && intervalsOverlap(start, end, itemStart, itemEnd)) {
      throw new HttpError(409, 'Horario bloqueado.');
    }
  });

  const appointmentsQuery = db.collection('appointments')
    .where('professionalId', '==', professionalId)
    .where('startsAt', '>=', Timestamp.fromDate(dayStart))
    .where('startsAt', '<=', Timestamp.fromDate(dayEnd))
  const appointments = await read(transaction, appointmentsQuery);

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    throw new HttpError(400, 'Data invalida. Use o formato AAAA-MM-DD.');
  }
  const dayStart = toDate(`${date}T00:00:00-03:00`);
  const slots = [];

  const procedureSnap = await db.collection('procedures').doc(procedureId).get();
  if (!procedureSnap.exists || procedureSnap.data().active === false) throw new HttpError(404, 'Procedimento nao encontrado.');
  const procedure = procedureSnap.data();
  const settings = await getClinicSettings();
  const professionalSnap = await db.collection('professionals').doc(professionalId).get();
  if (!professionalSnap.exists || professionalSnap.data().active === false) throw new HttpError(404, 'Profissional nao encontrado.');
  const professionalDay = professionalSnap.data().workingHours?.[weekdayKey(dayStart)];
  const clinicDay = settings.businessHours?.[weekdayKey(dayStart)];
  if (!clinicDay?.open || !professionalDay?.open) return slots;

  const step = 30;
  const opening = Math.max(parseTime(clinicDay.start), parseTime(professionalDay.start));
  const closing = Math.min(parseTime(clinicDay.end), parseTime(professionalDay.end));

  for (let minuteOfDay = opening; minuteOfDay + procedure.durationMinutes <= closing; minuteOfDay += step) {
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const startsAt = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`);
    try {
      await assertSlotAvailable({ professionalId, procedureId, startsAt: startsAt.toISOString() });
      slots.push({ startsAt: startsAt.toISOString(), durationMinutes: procedure.durationMinutes });
    } catch (_error) {
      // Unavailable slots are intentionally omitted.
    }
  }

  return slots;
}

module.exports = { assertSlotAvailable, listAvailableSlots, ACTIVE_STATUS };
