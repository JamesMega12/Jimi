const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `async function processRewrite(req: express.Request, res: express.Response) {
  const reqBody = req.body as (FCORequestData & { jobId?: string });`,
  `async function processRewrite(req: express.Request, res: express.Response) {
  const reqBody = req.body as (FCORequestData & { jobId?: string });
  reqBody.rewriteScope = reqBody.rewriteScope || 'full';`
);

fs.writeFileSync(file, content);
