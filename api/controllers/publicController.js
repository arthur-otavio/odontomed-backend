const { db } = require('../data/firebase');
const { asyncHandler } = require('../utils/asyncHandler');

const getHomeData = asyncHandler(async (_req, res) => {
  const [settingsDoc, professionalsSnap, proceduresSnap, specialtiesSnap] = await Promise.all([
    db.collection('clinic_settings').doc('main').get(),
    db.collection('professionals').where('active', '==', true).limit(12).get(),
    db.collection('procedures').where('active', '==', true).limit(20).get(),
    db.collection('specialties').where('active', '==', true).get(),
  ]);

  res.json({
    clinic: settingsDoc.exists ? settingsDoc.data() : null,
    professionals: professionalsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    procedures: proceduresSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    specialties: specialtiesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  });
});

module.exports = { getHomeData };
