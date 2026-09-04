const { auth, db } = require('../data/firebase');
const { HttpError } = require('../utils/httpError');

async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');

  if (!token) return next(new HttpError(401, 'Token de autenticacao ausente.'));

  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: userDoc.exists ? userDoc.data().role : decoded.role || 'PACIENTE',
      profileId: userDoc.exists ? userDoc.data().profileId : null,
    };
    return next();
  } catch (_error) {
    return next(new HttpError(401, 'Token invalido ou expirado.'));
  }
}

function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Usuario nao autenticado.'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Acesso nao permitido.'));
    return next();
  };
}

module.exports = { authenticate, authorize };
