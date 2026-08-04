import { validateDraft } from './src/server/validationService.js';
import dotenv from 'dotenv';
dotenv.config();

function run() {
  const result = validateDraft({
    rewrittenSummary: { action: "a", cause: "b", benefit: "c" },
    rewrittenProcedure: {
       sections: [
         { title: "Hello", steps: ["hello"] }
       ]
    }
  }, {
    changeType: "Physical / Hardware Change"
  } as any, [
    { documentType: "technical_standard", standardType: "TechCom", ruleCategory: "procedure_structure" }
  ]);
  
  console.log(result.validationErrors);
}

run();
