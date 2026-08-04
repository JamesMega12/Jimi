export function summaryPhraseNormalizer(segments: any) {
  let opFocus = segments.operationalFocus || '';
  let context = segments.context || '';
  let intent = segments.deploymentIntent || '';
  let outcome = segments.expectedOutcome || '';

  // Clean prefixes if any
  opFocus = opFocus.replace(/^[\*]*(operationalFocus):[\*]*\s*/i, '');
  context = context.replace(/^[\*]*(context):[\*]*\s*/i, '');
  intent = intent.replace(/^[\*]*(deploymentIntent):[\*]*\s*/i, '');
  outcome = outcome.replace(/^[\*]*(expectedOutcome):[\*]*\s*/i, '');

  // Lowercase first letters
  if (opFocus && opFocus.length > 0) opFocus = opFocus.charAt(0).toLowerCase() + opFocus.slice(1);
  if (context && context.length > 0) context = context.charAt(0).toLowerCase() + context.slice(1);
  if (intent && intent.length > 0) intent = intent.charAt(0).toLowerCase() + intent.slice(1);
  if (outcome && outcome.length > 0) outcome = outcome.charAt(0).toLowerCase() + outcome.slice(1);

  // Clean trailing punctuation
  if (opFocus.endsWith('.')) opFocus = opFocus.slice(0, -1);
  if (context.endsWith('.')) context = context.slice(0, -1);
  if (intent.endsWith('.')) intent = intent.slice(0, -1);
  if (outcome.endsWith('.')) outcome = outcome.slice(0, -1);

  // Strip forbidden fragments
  const forbiddenFragments = [
      "this fco mandates the use of",
      "the current issue is",
      "4. corrective action:",
      "purpose/scope:",
      "impact/risk:",
      "this change",
      "to this fco"
  ];

  const stripForbidden = (str: string) => {
      let result = str;
      for (const f of forbiddenFragments) {
          const regex = new RegExp(f, 'gi');
          result = result.replace(regex, '');
      }
      return result.trim();
  };

  opFocus = stripForbidden(opFocus);
  context = stripForbidden(context);
  intent = stripForbidden(intent);
  outcome = stripForbidden(outcome);

  // If operational focus doesn't seem to start with a verb, we can't easily auto-fix all verbs but we ensure it doesn't start with "the" or "this"
  opFocus = opFocus.replace(/^(the |this |that |a |an |to )/i, '');

  return { opFocus, context, intent, outcome };
}
