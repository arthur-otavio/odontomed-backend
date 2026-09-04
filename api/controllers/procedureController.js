const { db, FieldValue } = require('../data/firebase');
const { asyncHandler } = require('../utils/asyncHandler');

const listProcedures = asyncHandler(async (_req, res) => {
  const snap = await db.collection('procedures').orderBy('name').get();
  res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
});

const createProcedure = asyncHandler(async (req, res) => {
  const ref = await db.collection('procedures').add({
    ...req.body,
    active: req.body.active !== false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ id: ref.id });
});

const updateProcedure = asyncHandler(async (req, res) => {
  await db.collection('procedures').doc(req.params.id).set({
    ...req.body,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  res.json({ id: req.params.id });
});

module.exports = { listProcedures, createProcedure, updateProcedure };
