const { auth, db, FieldValue } = require('../data/firebase');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('55')) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return null;
}

const me = asyncHandler(async (req, res) => {
  const doc = await db.collection('users').doc(req.user.uid).get();
  res.json({ id: req.user.uid, ...(doc.exists ? doc.data() : req.user) });
});

const registerPatient = asyncHandler(async (req, res) => {
  const { name, email, password, phone, document } = req.body;
  if (!name || !email || !password || !phone) throw new HttpError(400, 'Nome, e-mail, senha e telefone sao obrigatorios.');

  const normalizedPhone = normalizePhone(phone);
  const created = await auth.createUser({ displayName: name, email, password, ...(normalizedPhone ? { phoneNumber: normalizedPhone } : {}) });
  const patientRef = db.collection('patients').doc(created.uid);

  await db.runTransaction(async (tx) => {
    tx.set(patientRef, {
      name,
      email,
      phone,
      document: document || null,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection('users').doc(created.uid), {
      email,
      name,
      role: 'PACIENTE',
      profileId: created.uid,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  await auth.setCustomUserClaims(created.uid, { role: 'PACIENTE' });
  res.status(201).json({ id: created.uid, name, email, role: 'PACIENTE' });
});

module.exports = { me, registerPatient };
