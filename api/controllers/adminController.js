const { db, FieldValue, Timestamp } = require('../data/firebase');
const { asyncHandler } = require('../utils/asyncHandler');

const dashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const [patients, today, week, month, pending, cancelled] = await Promise.all([
    db.collection('patients').where('active', '==', true).get(),
    db.collection('appointments').where('startsAt', '>=', Timestamp.fromDate(dayStart)).where('startsAt', '<=', Timestamp.fromDate(dayEnd)).get(),
    db.collection('appointments').where('startsAt', '>=', Timestamp.fromDate(now)).where('startsAt', '<=', Timestamp.fromDate(weekEnd)).get(),
    db.collection('appointments').where('startsAt', '>=', Timestamp.fromDate(monthStart)).get(),
    db.collection('appointments').where('status', '==', 'AGUARDANDO_CONFIRMACAO').get(),
    db.collection('appointments').where('status', '==', 'CANCELADO').get(),
  ]);

  res.json({
    totalPatients: patients.size,
    todayAppointments: today.size,
    weekAppointments: week.size,
    monthAppointments: month.size,
    pendingAppointments: pending.size,
    cancellations: cancelled.size,
    nextAppointments: week.docs.slice(0, 8).map((doc) => ({ id: doc.id, ...doc.data(), startsAt: doc.data().startsAt.toDate().toISOString() })),
  });
});

const listNotifications = asyncHandler(async (_req, res) => {
  const snap = await db.collection('notifications').orderBy('createdAt', 'desc').limit(100).get();
  res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
});

const createBlockedSlot = asyncHandler(async (req, res) => {
  const ref = await db.collection('blocked_slots').add({
    professionalId: req.body.professionalId || 'ALL',
    startsAt: Timestamp.fromDate(new Date(req.body.startsAt)),
    endsAt: Timestamp.fromDate(new Date(req.body.endsAt)),
    reason: req.body.reason || 'Bloqueio administrativo',
    createdAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ id: ref.id });
});

const updateClinicSettings = asyncHandler(async (req, res) => {
  await db.collection('clinic_settings').doc('main').set({
    ...req.body,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  res.json({ id: 'main' });
});

module.exports = { dashboard, listNotifications, createBlockedSlot, updateClinicSettings };
