const serverless = require('serverless-http');
const app = require('../../server/index');
const db = require('../../server/db');

let dbInitialized = false;

const serverlessHandler = serverless(app);

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  if (!dbInitialized) {
    try {
      await db.initDb();
      dbInitialized = true;
    } catch (err) {
      console.error('[Netlify Function DB Init Error]', err);
    }
  }

  return await serverlessHandler(event, context);
};
