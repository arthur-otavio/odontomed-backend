const { db, FieldValue, Timestamp } = require('../data/firebase');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');
const { assertSlotAvailable, listAvailableSlots } = require('../services/scheduleService');
const { queueNotification, appointmentMessage } = require('../services/notificationService');
const { auditLog } = require('../services/auditService');

function serializeAppointment(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    startsAt: data.startsAt?.toDate ? data.startsAt.toDate().toISOString() : data.startsAt,
    endsAt: data.endsAt?.toDate ? data.endsAt.toDate().toISOString() : data.endsAt,
  };
}

const availableSlots = asyncHandler(async (req, res) => {
  const slots = await listAvailableSlots(req.query);
  res.json(slots);
});

const listAppointments = asyncHandler(async (req, res) => {
  let query = db.collection('appointments');
  if (req.user.role === 'PACIENTE') query = query.where('patientId', '==', req.user.profileId);
  if (req.query.professionalId) query = query.where('professionalId', '==', req.query.professionalId);
  const snap = await query.orderBy('startsAt', 'desc').limit(200).get();
  res.json(snap.docs.map(serializeAppointment));
});

const createAppointment = asyncHandler(async (req, res) => {
  const patientId = req.user.role === 'PACIENTE' ? req.user.profileId : req.body.patientId;
  if (!patientId) throw new HttpError(400, 'Paciente obrigatorio.');

  const slot = await assertSlotAvailable({
    professionalId: req.body.professionalId,
    procedureId: req.body.procedureId,
    startsAt: req.body.startsAt,
  });

  const patientDoc = await db.collection('patients').doc(patientId).get();
  if (!patientDoc.exists) throw new HttpError(404, 'Paciente nao encontrado.');

  const appointment = {
    patientId,
    professionalId: req.body.professionalId,
    procedureId: req.body.procedureId,
    professionalName: slot.professional.name,
    procedureName: slot.procedure.name,
    patientName: patientDoc.data().name,
    startsAt: Timestamp.fromDate(slot.startsAt),
    endsAt: Timestamp.fromDate(slot.endsAt),
    status: req.body.status || 'AGUARDANDO_CONFIRMACAO',
    notes: req.body.notes || null,
    createdBy: req.user.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection('appointments').add(appointment);
  const message = appointmentMessage('APPOINTMENT_CREATED', patientDoc.data().name, { startsAt: slot.startsAt }, slot.professional.name);
  await queueNotification({ userId: patientId, patientId, appointmentId: ref.id, channel: 'WHATSAPP', type: 'APPOINTMENT_CREATED', message });
  await auditLog({ actorId: req.user.uid, action: 'CREATE', entity: 'appointments', entityId: ref.id });

  res.status(201).json({ id: ref.id, ...appointment, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() });
});

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const allowed = ['AGENDADO', 'CONFIRMADO', 'AGUARDANDO_CONFIRMACAO', 'EM_ATENDIMENTO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU'];
  if (!allowed.includes(req.body.status)) throw new HttpError(400, 'Status invalido.');

  await db.collection('appointments').doc(req.params.id).set({
    status: req.body.status,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await auditLog({ actorId: req.user.uid, action: 'STATUS', entity: 'appointments', entityId: req.params.id, metadata: { status: req.body.status } });
  res.json({ id: req.params.id, status: req.body.status });
});

const rescheduleAppointment = asyncHandler(async (req, res) => {
  const ref = db.collection('appointments').doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) throw new HttpError(404, 'Agendamento nao encontrado.');
  const current = doc.data();
  if (req.user.role === 'PACIENTE' && current.patientId !== req.user.profileId) throw new HttpError(403, 'Acesso nao permitido.');

  const slot = await assertSlotAvailable({
    professionalId: current.professionalId,
    procedureId: current.procedureId,
    startsAt: req.body.startsAt,
    appointmentIdToIgnore: req.params.id,
  });

  await ref.set({
    startsAt: Timestamp.fromDate(slot.startsAt),
    endsAt: Timestamp.fromDate(slot.endsAt),
    status: req.user.role === 'PACIENTE' ? 'AGUARDANDO_CONFIRMACAO' : current.status,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const message = appointmentMessage('APPOINTMENT_RESCHEDULED', current.patientName, { startsAt: slot.startsAt }, current.professionalName);
  await queueNotification({ userId: current.patientId, patientId: current.patientId, appointmentId: req.params.id, channel: 'WHATSAPP', type: 'APPOINTMENT_RESCHEDULED', message });
  res.json({ id: req.params.id, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() });
});

const cancelAppointment = asyncHandler(async (req, res) => {
  const ref = db.collection('appointments').doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) throw new HttpError(404, 'Agendamento nao encontrado.');
  const appointment = doc.data();
  if (req.user.role === 'PACIENTE' && appointment.patientId !== req.user.profileId) throw new HttpError(403, 'Acesso nao permitido.');

  await ref.set({
    status: 'CANCELADO',
    cancelReason: req.body.reason || null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await queueNotification({
    userId: appointment.patientId,
    patientId: appointment.patientId,
    appointmentId: req.params.id,
    channel: 'WHATSAPP',
    type: 'APPOINTMENT_CANCELLED',
    message: appointmentMessage('APPOINTMENT_CANCELLED', appointment.patientName, appointment, appointment.professionalName),
  });

  res.json({ id: req.params.id, status: 'CANCELADO' });
});

module.exports = { availableSlots, listAppointments, createAppointment, updateAppointmentStatus, rescheduleAppointment, cancelAppointment };
