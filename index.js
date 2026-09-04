require('dotenv').config();

const { onRequest } = require('firebase-functions/v2/https');
const app = require('./api/server');

exports.api = onRequest(
  {
    region: process.env.FUNCTION_REGION || 'southamerica-east1',
    cors: true,
    maxInstances: 10,
  },
  app,
);

if (require.main === module) {
  const port = Number(process.env.PORT || 3333);
  app.listen(port, () => {
    console.log(`OdontoMed API running on http://localhost:${port}`);
  });
}
