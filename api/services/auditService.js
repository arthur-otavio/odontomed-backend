const { db, FieldValue } = require('../data/firebase');

async function auditLog({ actorId, action, entity, entityId, metadata = {} }) {
  await db.collection('audit_logs').add({
    actorId,
    action,
    entity,
    entityId,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  });
}

module.exports = { auditLog };
