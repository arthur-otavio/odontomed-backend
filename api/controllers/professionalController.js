const { db, FieldValue } = require('../data/firebase');
const { asyncHandler } = require('../utils/asyncHandler');

const listProfessionals = asyncHandler(async (req, res) => {
  let query = db.collection('professionals').orderBy('name');
  if (req.query.includeInactive !== 'true') query = query.where('active', '==', true);
  const snap = await query.get();
  res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
});

const createProfessional = asyncHandler(async (req, res) => {
  const ref = await db.collection('professionals').add({
    ...req.body,
    active: req.body.active !== false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ id: ref.id });
});

const updateProfessional = asyncHandler(async (req, res) => {
  await db.collection('professionals').doc(req.params.id).set({
    ...req.body,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  res.json({ id: req.params.id });
});

module.exports = { listProfessionals, createProfessional, updateProfessional };
