import { validateDraft } from './src/server/validationService';
import { FCORequestData } from './src/types';

function testValidation() {
  const reqData: FCORequestData = {
    title: 'Test',
    fcoDraft: {
      fcoMetadata: { fcoTitle: 'Test' },
      visualPlaceholders: [
        {
          id: '1',
          type: 'figure',
          number: '1',
          caption: 'Old Access Cover Removal',
          linkedSection: 'Procedure',
          status: 'placeholder_only'
        }
      ]
    }
  } as any;
  
  const parsed = {
    rewrittenSummary: { 
      paragraph: '',
      problem: 'Something was broken.',
      solution: 'We fixed it.'
    },
    rewrittenProcedure: {
      sections: [
        {
          steps: ['See Figure 1.']
        }
      ]
    }
  };
  
  const res = validateDraft(parsed, reqData);
  console.log('Validation Errors:', res.validationErrors);
}
testValidation();
