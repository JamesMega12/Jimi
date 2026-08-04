export interface StyleNormalizationResult {
  rulesApplied: {
    ruleId: string;
    original: string;
    normalized: string;
    source: string;
  }[];
  styleIssuesDetected: string[];
  styleValidationPassed: boolean;
  normalizedText: string;
}

export function normalizeStyle(text: string, activeRules: string[]): StyleNormalizationResult {
  const result: StyleNormalizationResult = {
    rulesApplied: [],
    styleIssuesDetected: [],
    styleValidationPassed: true,
    normalizedText: text
  };

  let newText = text;

  // Temperature Normalization Rule - Check if exact-rule was requested or it's default approved
  // We're converting to 'degC' without replacing numbers
  const cRegex = /(\d+(?:\.\d+)?)\s*(?:°C|degrees Celsius|degrees C)/gi;
  if (cRegex.test(newText)) {
      newText = newText.replace(cRegex, (match, p1) => {
         const norm = `${p1} degC`;
         result.rulesApplied.push({
            ruleId: 'temperature-degC',
            original: match,
            normalized: norm,
            source: 'SLB Communications Handbook'
         });
         return norm;
      });
  }

  const fRegex = /(\d+(?:\.\d+)?)\s*(?:°F|degrees Fahrenheit|degrees F)/gi;
  if (fRegex.test(newText)) {
      newText = newText.replace(fRegex, (match, p1) => {
         const norm = `${p1} degF`;
         result.rulesApplied.push({
            ruleId: 'temperature-degF',
            original: match,
            normalized: norm,
            source: 'SLB Communications Handbook'
         });
         return norm;
      });
  }

  const rRegex = /(\d+(?:\.\d+)?)\s*(?:°R|degrees Rankine|degrees R)/gi;
  if (rRegex.test(newText)) {
      newText = newText.replace(rRegex, (match, p1) => {
         const norm = `${p1} degR`;
         result.rulesApplied.push({
            ruleId: 'temperature-degR',
            original: match,
            normalized: norm,
            source: 'SLB Communications Handbook'
         });
         return norm;
      });
  }

  result.normalizedText = newText;
  return result;
}
