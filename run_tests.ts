import { validateDraft } from './src/server/validationService';
import { FCORequestData } from './src/types';

const mockReqData: FCORequestData = {
    title: 'Test',
    priority: '',
    changeType: '',
    detectedChangeType: '',
    confirmedChangeType: false,
    fcoDraft: {
        visualPlaceholders: [
            { id: '1', type: 'Figure', number: '1', caption: 'Control board layout', linkedSection: '', status: 'placeholder_only', notes: '' },
            { id: '2', type: 'Table', number: '1', caption: 'Connector pinout', linkedSection: '', status: 'placeholder_only', notes: '' }
        ]
    }
} as any;

function check(testName: string, parsed: any, expectedErrors: string[]) {
    const res = validateDraft(parsed, mockReqData);
    const errs = res.validationErrors.filter(e => e.includes('PLACEHOLDER_'));
    
    const passed = expectedErrors.every(e => errs.some(err => err.includes(e))) && 
                   errs.every(err => expectedErrors.some(e => err.includes(e)));
                   
    console.log(`Test: ${testName} -> ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) {
        console.log(`  Expected:`, expectedErrors);
        console.log(`  Actual:  `, errs);
    }
}

function buildSummary(paragraph: string) {
    return {
        paragraph,
        components: { problem: 'p', cause: 'c', solution: 's', benefit: 'b' }
    };
}

// 1. Preserved exactly
check('Preserved exactly', {
    rewrittenSummary: buildSummary('[Insert Figure 1: Control board layout]\n[Insert Table 1: Connector pinout]'),
    rewrittenProcedure: { sections: [{ steps: ['do it'] }] }
}, []);

// 2. Removed
check('Removed', {
    rewrittenSummary: buildSummary('The control board layout is required before installation.'),
    rewrittenProcedure: { sections: [{ steps: ['do it'] }] }
}, ['PLACEHOLDER_REMOVED', 'PLACEHOLDER_REMOVED']);

// 3. Downgraded to plain reference
check('Downgraded to plain reference', {
    rewrittenSummary: buildSummary('See Figure 1 before continuing.'),
    rewrittenProcedure: { sections: [{ steps: ['do it'] }] }
}, ['PLACEHOLDER_EXPLICIT_SYNTAX_LOST', 'PLACEHOLDER_REMOVED']);

// 4. Caption changed
check('Caption changed', {
    rewrittenSummary: buildSummary('[Insert Figure 1: Updated board layout]\n[Insert Table 1: Connector pinout]'),
    rewrittenProcedure: { sections: [{ steps: ['do it'] }] }
}, ['PLACEHOLDER_CAPTION_CHANGED']);

// 5. Type changed
check('Type changed', {
    rewrittenSummary: buildSummary('[Insert Table 1: Control board layout]\n[Insert Table 1: Connector pinout]'),
    rewrittenProcedure: { sections: [{ steps: ['do it'] }] }
}, ['PLACEHOLDER_TYPE_CHANGED']);

// 6. Number changed
check('Number changed', {
    rewrittenSummary: buildSummary('[Insert Figure 2: Control board layout]\n[Insert Table 1: Connector pinout]'),
    rewrittenProcedure: { sections: [{ steps: ['do it'] }] }
}, ['PLACEHOLDER_NUMBER_CHANGED']);

// 7. Duplicate introduced
check('Duplicate introduced', {
    rewrittenSummary: buildSummary('[Insert Figure 1: Control board layout]\n[Insert Figure 1: Control board layout]\n[Insert Table 1: Connector pinout]'),
    rewrittenProcedure: { sections: [{ steps: ['do it'] }] }
}, ['PLACEHOLDER_DUPLICATE_AFTER_REWRITE']);

// 8. New placeholder invented
check('New placeholder invented', {
    rewrittenSummary: buildSummary('[Insert Figure 1: Control board layout]\n[Insert Figure 2: Cable routing]\n[Insert Table 1: Connector pinout]'),
    rewrittenProcedure: { sections: [{ steps: ['do it'] }] }
}, ['PLACEHOLDER_ADDED_BY_REWRITE']);
