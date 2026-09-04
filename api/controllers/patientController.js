const { db, FieldValue } = require('../data/firebase');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');

const listPatients = asyncHandler(async (req, res) => {
  let query = db.collection('patients').orderBy('name');
  if (req.query.active === 'true') query = query.where('active', '==', true);
  const snap = await query.limit(100).get();
  res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
});

const getPatient = asyncHandler(async (req, res) => {
  if (req.user.role === 'PACIENTE' && req.user.profileId !== req.params.id) throw new HttpError(403, 'Acesso nao permitido.');
  const doc = await db.collection('patients').doc(req.params.id).get();
  if (!doc.exists) throw new HttpError(404, 'Paciente nao encontrado.');
  res.json({ id: doc.id, ...doc.data() });
});

const savePatient = asyncHandler(async (req, res) => {
  const id = req.params.id || db.collection('patients').doc().id;
  await db.collection('patients').doc(id).set({
    ...req.body,
    active: req.body.active !== false,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  res.json({ id });
});

module.exports = { listPatients, getPatient, savePatient };
