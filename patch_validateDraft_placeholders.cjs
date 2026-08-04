const fs = require('fs');
const file = 'src/server/validationService.ts';
let content = fs.readFileSync(file, 'utf8');

const targetOld = `      const summaryText = parsed?.rewrittenSummary?.paragraph || '';
      let procedureText = '';
      if (parsed?.rewrittenProcedure?.sections) {
          parsed.rewrittenProcedure.sections.forEach((sec: any) => {
              if (sec.steps) {
                  sec.steps.forEach((step: any) => {
                      procedureText += (typeof step === 'string' ? step : step.text || '') + '\\n';
                  });
              }
          });
      }
      
      const detectedInOutput = consolidatePlaceholders(detectPlaceholders(summaryText, 'Summary'), detectPlaceholders(procedureText, 'Procedure'));
      
      // Normalize original placeholders
      const normalizedOriginals = originalPlaceholders.map(p => {`;

const targetNew = `      const summaryText = parsed?.rewrittenSummary?.paragraph || '';
      let procedureText = '';
      if (parsed?.rewrittenProcedure?.sections) {
          parsed.rewrittenProcedure.sections.forEach((sec: any) => {
              if (sec.steps) {
                  sec.steps.forEach((step: any) => {
                      procedureText += (typeof step === 'string' ? step : step.text || '') + '\\n';
                  });
              }
          });
      }
      
      let detectedInOutput = [];
      if (scope === 'full') {
        detectedInOutput = consolidatePlaceholders(detectPlaceholders(summaryText, 'Summary'), detectPlaceholders(procedureText, 'Procedure'));
      } else if (scope === 'summary') {
        detectedInOutput = detectPlaceholders(summaryText, 'Summary');
      } else if (scope === 'procedure') {
        detectedInOutput = detectPlaceholders(procedureText, 'Procedure');
      }
      
      // Normalize original placeholders
      let normalizedOriginals = originalPlaceholders.map(p => {
          const type = p.type.charAt(0).toUpperCase() + p.type.slice(1).toLowerCase();
          return {
              id: p.id,
              type,
              number: String(p.number).trim(),
              caption: (p.caption || '').trim(),
              linkedSection: p.linkedSection || 'Summary',
              status: p.status,
              notes: p.notes
          };
      });
      
      if (scope === 'summary') {
         normalizedOriginals = normalizedOriginals.filter(o => o.linkedSection === 'Summary');
      } else if (scope === 'procedure') {
         normalizedOriginals = normalizedOriginals.filter(o => o.linkedSection === 'Procedure');
      }
      
      // We also need to map the next line properly but it's handled below.
      // Wait, let's just replace the block cleanly.`;

content = content.replace(targetOld, targetNew);
fs.writeFileSync(file, content);
