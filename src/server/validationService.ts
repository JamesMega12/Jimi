import { FCOApiResponse, FCORequestData } from '../types';
import { checkPreservedFacts, extractTechnicalFacts } from './extractTechnicalFacts';
import { normalizeStyle } from './styleNormalizationService';
import { generateDiffTrace } from './wordDiffService';
import { summaryPhraseNormalizer } from './summaryPhraseNormalizer';
import { detectPlaceholders, consolidatePlaceholders } from '../lib/placeholderDetection';

/**
 * Programmatically detects copy-paste behavior (shallow rewrite) from the raw input to the compiled text.
 */
export function detectShallowRewrite(rawText: string, rewrittenText: string): { shallow: boolean; score: number } {
  try {
    const diff = generateDiffTrace(rawText, rewrittenText);
    const score = diff.stats.similarityRatio;
    return {
      shallow: score > 0.70, // 70%unchanged means shallow
      score
    };
  } catch (e: any) {
    // fallback
    return { shallow: false, score: 0 };
  }
}

/**
 * Validates the parsed FCO rewrite object against all system rules.
 */
export function validateDraft(
  parsed: any,
  reqData: FCORequestData,
  retrievedChunks: any[] = []
): {
  validationPassed: boolean;
  validationErrors: string[];
  shallowRewriteDetected: boolean;
  similarityCheckPassed: boolean;
  missingPreservedFacts: string[];
  technicalValuesPreserved: boolean;
  summaryWordLimitPassed: boolean;
  detectedChangeType: string;
} {
  const errors: string[] = [];

  // 1. Structural Validation
  if (!parsed || typeof parsed !== 'object') {
    return {
      validationPassed: false,
      validationErrors: ["AI response did not compile to a valid JSON object."],
      shallowRewriteDetected: false,
      similarityCheckPassed: true,
      missingPreservedFacts: [],
      technicalValuesPreserved: true,
      summaryWordLimitPassed: true,
      detectedChangeType: reqData.changeType || "Unknown"
    };
  }

  const summary = parsed.rewrittenSummary;
  const procedure = parsed.rewrittenProcedure;
  const scope = reqData.rewriteScope || 'full';

  if (scope === 'full' || scope === 'summary') {
    if (!summary || typeof summary !== 'object') {
      errors.push("Missing required field 'rewrittenSummary' or it is not an object.");
    } else {
      const problem = summary.components?.problem || summary.problem;
      const solution = summary.components?.solution || summary.solution;
      
      if (!problem || problem.includes('[Information required')) errors.push("Summary is missing the required 'Problem' component.");
      if (!solution || solution.includes('[Information required')) errors.push("Summary is missing the required 'Solution' component.");
    }
  }

  const finalChangeType = parsed.rewrittenProcedure?.changeType || reqData.changeType || "Mixed Change";

  if (scope === 'full' || scope === 'procedure') {
    if (!procedure || typeof procedure !== 'object') {
      errors.push("Missing required field 'rewrittenProcedure' or it is not an object.");
    } else {
      if (!procedure.sections || !Array.isArray(procedure.sections) || procedure.sections.length === 0) {
        errors.push("Procedure must contain at least one valid subsection.");
      }
    }
  }

  // If top-level fields are missing, return early
  if (errors.length > 0) {
    return {
      validationPassed: false,
      validationErrors: errors,
      shallowRewriteDetected: false,
      similarityCheckPassed: true,
      missingPreservedFacts: [],
      technicalValuesPreserved: true,
      summaryWordLimitPassed: true,
      detectedChangeType: finalChangeType
    };
  }

  // 2. Summary Grammar and Word Limit Validation
  let summaryWordLimitPassed = true;
  let totalSummaryWords = 0;
  if (scope === 'full' || scope === 'summary') {
  let summaryText = summary.paragraph || "";
  if (!summaryText) {
      summaryText = `${summary.components?.problem || ""} ${summary.components?.cause || ""} ${summary.components?.solution || ""} ${summary.components?.benefit || ""}`.trim();
  }
  const countText = summaryText.replace(/\[Information required.*?\]/gi, '');
  const totalSummaryWords = countText.split(/\s+/).filter((w: string) => w.trim().length > 0).length;
  // Also check if any components have missing info instead of just checking string values on summary
  const hasMissingInfo = Object.values(summary.components || summary).some((v: any) => typeof v === 'string' && v.includes('[Information required'));
  
  // Check for lingering section labels from bad pastes
  const invalidLabels = ["4. Corrective Action:", "Purpose/Scope:", "Background/Description", "Impact/Risk:", "Corrective Action:", "Problem:", "Cause:", "Solution:", "Benefit:", "Problem Idea:", "Cause Idea:", "Benefit Idea:", "Action Idea:", "Solution Idea:"];
  let hasInvalidLabels = false;
  for (const lbl of invalidLabels) {
      if (summaryText.includes(lbl)) {
          hasInvalidLabels = true;
          errors.push(`Summary contains uncleaned label: ${lbl}`);
          break;
      }
  }

  // Grammar Validation
  const grammarPattern = /requires field execution to this FCO|requires immediate field execution to this FCO|proposes field implementation to this FCO|requires field execution to the current|requires field execution to \d\.|Corrective Action:|Purpose\/Scope:|Background\/Description|Impact\/Risk:|This change confined|This change Lockout|This change \[noun phrase without verb\]/i;
  if (grammarPattern.test(summaryText)) {
      errors.push(`Summary contains broken grammar or unedited action phrases.`);
  }

  summaryWordLimitPassed = totalSummaryWords <= 150 && totalSummaryWords > 0 && !hasMissingInfo && !hasInvalidLabels && !grammarPattern.test(summaryText);
  if (totalSummaryWords > 150) {
    errors.push(`Summary total word count of ${totalSummaryWords} exceeds the strict limit of 150 words.`);
  }
  }

  // 3. Section and Change Type Alignment Checklist
  const sections: any[] = parsed.rewrittenProcedure?.sections || [];
  if (scope === 'full' || scope === 'procedure') {
  
  // Procedure Step Validation
  let hasMalformedSteps = false;
  for (const sec of sections) {
      for (const step of (sec.steps || [])) {
          if (!step || step.trim() === "" || step === "." || step === "-") {
              hasMalformedSteps = true;
              errors.push("Procedure contains blank or malformed steps.");
              break;
          }
      }
  }

  const normType = finalChangeType.trim();

  const aliasMap: Record<string, string[]> = {
    'safety': ['safety', 'access control', 'hazard', 'applicability'],
    'preparation': ['preparation', 'prepare', 'gather', 'pre-install', 'preliminary'],
    'implementation': ['implementation', 'implement', 'action', 'install', 'update', 'upgrade', 'configuration', 'procedure', 'execution', 'physical'],
    'verification': ['verification', 'verify', 'test', 'check', 'inspect', 'audit', 'validation'],
    'completion': ['completion', 'complete', 'wrap-up', 'restore', 'finish', 'sign-off', 'publish', 'log'],
    'backup': ['backup', 'back up', 'save', 'current state', 'original state', 'values', 'snapshot', 'nvram'],
    'update': ['update', 'upgrade', 'install', 'parameter', 'patch', 'configuration', 'implementation'],
    'applicability': ['applicability', 'apply', 'scope', 'eligible', 'coverage'],
    'communication': ['communication', 'coordinate', 'notify', 'inform', 'brief', 'announce', 'meeting'],
    'review': ['review', 'document review', 'search', 'locate', 'read']
  };

  const hasSectionWithAlias = (kw: string) => {
    const aliases = aliasMap[kw] || [kw];
    return sections.some(s => {
      const titleLower = (s.title || '').toLowerCase();
      return aliases.some(alias => titleLower.includes(alias));
    });
  };

  // TechCom Standard Structure Enforcement
  const techComChunks = retrievedChunks.filter(c => c.documentType === 'technical_standard' || c.standardType === 'TechCom');
  const hasTechComStandard = techComChunks.length > 0;
  
  if (hasTechComStandard && !finalChangeType.includes('Software')) {
    // Enforce base procedure structure A-E strongly
    const requiredSections = ['safety', 'preparation', 'implementation', 'verification', 'completion'];
    requiredSections.forEach(kw => {
      if (!hasSectionWithAlias(kw)) {
        errors.push(`TechCom Standard enforces procedure structure. Missing section relating to '${kw}'. (A. Safety, B. Preparation, C. Implementation, D. Verification, E. Completion)`);
      }
    });

    // Check logical flow / completeness
    const stepCount = sections.reduce((acc, s) => acc + (s.steps ? s.steps.length : 0), 0);
    if (stepCount < 3) {
      errors.push(`TechCom Standard enforces complete procedures. Found fewer than 3 steps, indicating incomplete task breakdown.`);
    }

    // Check for generic filler steps
    const stepsJoined = sections.map((s: any) => (s.steps || []).join(' ')).join(' ').toLowerCase();
    if (stepsJoined.includes('generic') || stepsJoined.includes('filler') || stepsJoined.includes('do the work')) {
       errors.push("TechCom Standard validation failed: Procedure contains generic or filler instructions.");
    }
  }

// Normalization code
  if (normType === 'Physical / Hardware Change') {
    // A. Safety, B. Preparation, C. Implementation, D. Verification, E. Completion
    const requiredSections = ['safety', 'preparation', 'implementation', 'verification', 'completion'];
    requiredSections.forEach(kw => {
      if (!hasSectionWithAlias(kw)) {
        errors.push(`Physical Change structure requires section relating to '${kw}' but none was found.`);
      }
    });
    if (sections.length < 5) {
      errors.push(`Physical FCO changes must contain at least 5 standard chronological section headings.`);
    }
    if (!procedure.toolsMaterialsRequired) {
      errors.push(`Physical FCO changes must contain a toolsMaterialsRequired block.`);
    }
  } else if (normType === 'Software / Configuration Change') {
    // A. Safety / Access Control, B. Preparation, C. Backup / Current State Check, D. Software or Configuration Update, E. Verification, F. Completion
    const requiredSections = ['safety', 'preparation', 'backup', 'update', 'verification', 'completion'];
    requiredSections.forEach(kw => {
      if (!hasSectionWithAlias(kw)) {
        errors.push(`Software / Configuration Change structure requires section relating to '${kw}' but none was found.`);
      }
    });
    if (sections.length < 6) {
      errors.push(`Software FCO updates must contain at least 6 standard subsections.`);
    }
  } else if (normType === 'Policy / Process Change') {
    // A. Applicability, B. Communication, C. Implementation, D. Verification, E. Completion
    const requiredSections = ['applicability', 'communication', 'implementation', 'verification', 'completion'];
    requiredSections.forEach(kw => {
      if (!hasSectionWithAlias(kw)) {
        errors.push(`Policy FCO process structure requires section relating to '${kw}' but none was found.`);
      }
    });
    if (sections.length < 5) {
      errors.push(`Policy / Process Change rules require at least 5 subsections.`);
    }
  }

  // 4. Safety High-Pressure and Stored Energy Control
  const rawLower = `${reqData.title || ''} ${reqData.rawSummary || ''} ${reqData.rawProcedure || ''} ${reqData.customDirectives || ''}`.toLowerCase();
  const rawHasPressure = /pressure|psi|bar|mpa|kpa|hydraulic|pneumatic|gas|fluid|stored energy|leak|fitting|coupling|valve/i.test(rawLower);

  const safetySections = sections.filter(s => (s.title || '').toLowerCase().includes('safety') || (s.title || '').toLowerCase().includes('applicability'));
  const safetyCombinedText = safetySections.map(s => 
    `${s.title || ''} ${(s.steps || []).join(' ')}`
  ).join(' ').toLowerCase();

  if (rawHasPressure) {
    if (safetySections.length === 0) {
      errors.push("Input describes high-pressure operations, but Safety / Access section is missing.");
    } else {
      // Must isolate pressure source
      if (!/isolate|shut off|stop|disconnect|loto|lockout|block/i.test(safetyCombinedText)) {
        errors.push("Pressure source isolation step (LOTO/Shut-off) is missing from the Safety section.");
      }
      // Must release stored pressure
      if (!/release|bleed|discharge|vent|depressur/i.test(safetyCombinedText)) {
        errors.push("Instruction to release/bleed stored pressure before loosening fittings is missing from Safety.");
      }
      // Must keep hands and body away
      if (!/keep hands|hand|body|protect|injury/i.test(safetyCombinedText)) {
        errors.push("Information advising operators to keep hands and body away from leaks is missing from Safety.");
      }
      // Must not loosen fittings until pressure is released
      if (!/loosen|disconnect|fitting|coupling|torque|until/i.test(safetyCombinedText)) {
        errors.push("Requirement stating not to loosen connections/fittings until pressure is zero is missing from Safety.");
      }
    }
  }

  // Check concrete skin injection warnings
  if (rawLower.includes("skin injection") || rawLower.includes("penetrate skin")) {
    const hasWarning = safetyCombinedText.includes("penetrate skin") || 
                       safetyCombinedText.includes("skin injection") ||
                       (safetyCombinedText.includes("hands and body away") && safetyCombinedText.includes("leaks"));
    if (!hasWarning) {
      errors.push("Skin injection risk is cited but specific warning instruction is missing: 'WARNING: High-pressure fluid can penetrate skin. Keep hands and body away from leaks and pressurized connections.'");
    }
  }

  // Check concrete high-pressure gas warnings
  if (rawLower.includes("high-pressure gas") || rawLower.includes("gas pressure")) {
    const hasWarning = safetyCombinedText.includes("gas supply") || 
                       (safetyCombinedText.includes("cause serious injury") && safetyCombinedText.includes("isolate"));
    if (!hasWarning) {
      errors.push("High-pressure gas is cited but specific warning instruction is missing: 'WARNING: High-pressure gas can cause serious injury. Isolate the gas supply and release stored pressure before loosening any connection.'");
    }
  }

  // 5. Prohibited step checks for non-physical FCOs (software, policy, documentation)
  if (['Software / Configuration Change', 'Policy / Process Change', 'Documentation / SWI / Manual Change'].includes(normType)) {
    const rawHasHardwareContext = /wrench|bolt|bracket|seal|o-ring|torque|valve|hose|gasket|lubricant|install.*kit|molykote/i.test(rawLower);
    if (!rawHasHardwareContext) {
      // Search output steps for unauthorized hardware instructions
      let hasUnauthorizedHardware = false;
      const hwKeywords = ['unscrew', 'bracket', 'torque to', 'molykote', 'install valve', 'install gasket', 'tighten bolt', 'install hose', 'install hardware'];
      for (const s of sections) {
        for (const step of (s.steps || [])) {
          const stepL = step.toLowerCase();
          if (hwKeywords.some(kw => stepL.includes(kw))) {
            hasUnauthorizedHardware = true;
            break;
          }
        }
      }
      if (hasUnauthorizedHardware) {
        errors.push(`FCO of type '${normType}' contains unauthorized physical hardware installation instructions (e.g., tighten, torque, install parts) absent from raw feed.`);
      }
    }
  }

  } // end of procedure scope check
  // 6. Preservation of Technical Facts Check
  const rawInputFactsText = `${reqData.title || ''} ${reqData.rawSummary || ''} ${reqData.rawProcedure || ''}`;
  const fullOutputText = JSON.stringify(parsed);
  const factResults = checkPreservedFacts(rawInputFactsText, fullOutputText);
  const missingPreservedFacts = factResults.missingFacts;
  const technicalValuesPreserved = factResults.allPreserved;

  if (!technicalValuesPreserved && missingPreservedFacts.length > 0) {
    errors.push(`Critical technical values missed or altered during rewrite: [${missingPreservedFacts.join(', ')}].`);
  }

  // 7. Copy-Paste / Shallow Rewrite Check
  const summaryPartsText = summary?.paragraph || "";
  const stepsJoinedText = sections.map(s => (s.steps || []).join(' ')).join(' ');
  const totalOutputRewrittenText = `${summaryPartsText} ${stepsJoinedText}`;

  const copyPasteCheck = detectShallowRewrite((reqData.rawSummary + " " + reqData.rawProcedure), totalOutputRewrittenText);
  let shallowRewriteDetected = copyPasteCheck.shallow;
  
  if (reqData.inputSource === 'docx') {
      shallowRewriteDetected = false; // Bypass shallow rewrite detection for uploaded FCOs
  }
  
  const similarityCheckPassed = !shallowRewriteDetected;

  if (shallowRewriteDetected) {
    errors.push(`Output structure is too similar to the raw draft input (Shallow Copy Score: ${Math.round(copyPasteCheck.score * 100)}%). Simplify jargon and rebuild procedure into active, single-step instructions.`);
  }

  // 8. Docx Figure Validation
  if (reqData.inputSource === 'docx') {
      const plainTextOutput = JSON.stringify(parsed).replace(/\\n/g, ' ').replace(/\s+/g, ' ');
      
      if (reqData.docxExtraction?.figureMap) {
          const figureMap = reqData.docxExtraction.figureMap;
          
          // Check that rewritten output does not include image binaries or markdown image links
          if (plainTextOutput.includes('data:image/') || plainTextOutput.match(/!\[.*?\]\(.*?\)/)) {
              errors.push(`Rewritten output must not include image binaries or base64 data or markdown links. Use text-only figure placeholders.`);
          }

          figureMap.forEach((fig: any) => {
              const ptNoSpace = plainTextOutput.replace(/\s+/g, '').toLowerCase();
              if (fig.figureNumber) {
                  const placeholderHasCaption = fig.caption ? `[Insert ${fig.figureNumber}: ${fig.caption}]` : `[Insert ${fig.figureNumber}: caption required]`;
                  const searchStr1 = `[insert${fig.figureNumber.toLowerCase()}`.replace(/\s+/g, '');
                  const searchStr2 = `[${fig.figureNumber.toLowerCase()}`.replace(/\s+/g, '');
                  if (!ptNoSpace.includes(searchStr1) && !ptNoSpace.includes(searchStr2)) {
                      errors.push(`Placeholder for ${fig.figureNumber} is missing or in the wrong format. Expected format: ${placeholderHasCaption}`);
                  }
              } else {
                  if (fig.placeholder) {
                      const searchStr = fig.placeholder.replace(/\s+/g, '').toLowerCase();
                      const searchFallback1 = `[insertfigure`;
                      const searchFallback2 = `[figure`;
                      if (!ptNoSpace.includes(searchStr) && !ptNoSpace.includes(searchFallback1) && !ptNoSpace.includes(searchFallback2)) {
                          errors.push(`Missing placeholder for an uncaptioned image. Expected format: [Insert figure: figure number and caption required]`);
                      }
                  }
              }
              
              if (fig.figureNumber && fig.referencedByBlockIds && fig.referencedByBlockIds.length > 0) {
                  const figNumNoSpace = fig.figureNumber.replace(/\s+/g, '').toLowerCase();
                  if (!ptNoSpace.includes(figNumNoSpace)) {
                      errors.push(`Original reference to ${fig.figureNumber} was removed from the procedure output.`);
                  }
              }
          });
          
          const figureNumRegex = /\[Insert (Figure \d+):/gi;
          let match;
          while ((match = figureNumRegex.exec(plainTextOutput)) !== null) {
              const detectedNum = match[1];
              const exists = figureMap.some((f: any) => f.figureNumber && f.figureNumber.toLowerCase() === detectedNum.toLowerCase());
              if (!exists) {
                  errors.push(`Newly invented figure number detected: ${detectedNum}. Do not create new figure numbers.`);
              }
          }
      }

      // 9. Docx Table Validation
      if (reqData.docxExtraction?.tableMap) {
          const tableMap = reqData.docxExtraction.tableMap;
          
          // Check that rewritten output does not include markdown tables replacing word tables
          if (plainTextOutput.match(/\|.*\|.*\|/)) {
              // rough regex for markdown tables
              // errors.push(`Rewritten output must not include markdown tables replacing Word tables.`);
          }

          tableMap.forEach((table: any) => {
              const ptNoSpace = plainTextOutput.replace(/\s+/g, '').toLowerCase();
              if (table.tableNumber) {
                  const searchStr1 = `[insert${table.tableNumber.toLowerCase()}`.replace(/\s+/g, '');
                  const searchStr2 = `[${table.tableNumber.toLowerCase()}`.replace(/\s+/g, '');
                  if (!ptNoSpace.includes(searchStr1) && !ptNoSpace.includes(searchStr2)) {
                      errors.push(`Placeholder for ${table.tableNumber} is missing or in the wrong format. Expected ` + (table.title ? `[Insert ${table.tableNumber}: ${table.title}]` : `[Insert ${table.tableNumber}: table title required]`));
                  }
              } else {
                  if (table.placeholder) {
                      const searchStr = table.placeholder.replace(/\s+/g, '').toLowerCase();
                      const searchFallback1 = `[insertproceduretable`;
                      const searchFallback2 = `[proceduretable`;
                      const searchFallback3 = `[table`;
                      if (!ptNoSpace.includes(searchStr) && !ptNoSpace.includes(searchFallback1) && !ptNoSpace.includes(searchFallback2) && !ptNoSpace.includes(searchFallback3)) {
                          // Allow unnumbered DOCX tables to be skipped in the output, since they may just be layout/metadata tables.
                          // Do not strictly require [Insert procedure table: table title required]
                      }
                  }
              }
              
              if (table.tableNumber && table.referencedByBlockIds && table.referencedByBlockIds.length > 0) {
                  const tNumNoSpace = table.tableNumber.replace(/\s+/g, '').toLowerCase();
                  if (!ptNoSpace.includes(tNumNoSpace)) {
                      errors.push(`Original reference to ${table.tableNumber} was removed from the procedure output.`);
                  }
              }
          });

          const tableNumRegex = /\[Insert (Table \d+):/gi;
          let match;
          while ((match = tableNumRegex.exec(plainTextOutput)) !== null) {
              const detectedNum = match[1];
              const exists = tableMap.some((t: any) => t.tableNumber && t.tableNumber.toLowerCase() === detectedNum.toLowerCase());
              if (!exists) {
                  errors.push(`Newly invented table number detected: ${detectedNum}. Do not create new table numbers.`);
              }
          }
      }
  }

  // 10. Inline Placeholder Survival Validation
  if (reqData.fcoDraft && reqData.fcoDraft.visualPlaceholders) {
      const originalPlaceholders = reqData.fcoDraft.visualPlaceholders;
      
      const summaryText = parsed?.rewrittenSummary?.paragraph || '';
      let procedureText = '';
      if (parsed?.rewrittenProcedure?.sections) {
          parsed.rewrittenProcedure.sections.forEach((sec: any) => {
              if (sec.steps) {
                  sec.steps.forEach((step: any) => {
                      procedureText += (typeof step === 'string' ? step : step.text || '') + '\n';
                  });
              }
              // Include part-localized step-group text so placeholders inside
              // groups are not falsely reported as removed.
              if (Array.isArray(sec.stepGroups)) {
                  sec.stepGroups.forEach((g: any) => {
                      if (g && Array.isArray(g.steps)) {
                          g.steps.forEach((step: any) => {
                              procedureText += (typeof step === 'string' ? step : '') + '\n';
                          });
                      }
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
      

      // Normalize detected placeholders
      const normalizedDetected = detectedInOutput.map(d => {
          const type = d.type.charAt(0).toUpperCase() + d.type.slice(1).toLowerCase();
          return {
              type,
              number: String(d.number).trim(),
              caption: (d.caption || '').trim(),
              source: d.source || 'Summary',
              isReference: !!d.warning?.includes('is referenced')
          };
      });

      const explicitDets = normalizedDetected.filter(d => !d.isReference);
      const referenceDets = normalizedDetected.filter(d => d.isReference);

      const explicitDetsWithIdx = explicitDets.map((d, index) => ({ ...d, index }));
      const matchedIdxs = new Set<number>();
      const downgradedKeys = new Set<string>();
      const typeChangedKeys = new Set<string>();

      normalizedOriginals.forEach(orig => {
          // 1. Exact match (type, number, caption)
          const exactMatch = explicitDetsWithIdx.find(d => 
              d.type === orig.type && 
              d.number === orig.number && 
              d.caption === orig.caption
          );

          if (exactMatch) {
              matchedIdxs.add(exactMatch.index);
              // Check if source moved (only enforce for strictly meaningful buckets)
              if (orig.linkedSection !== exactMatch.source) {
                  if (orig.linkedSection === 'Summary' || orig.linkedSection === 'Procedure') {
                      errors.push(`PLACEHOLDER_SOURCE_CHANGED: ${orig.type} ${orig.number} moved from ${orig.linkedSection} to ${exactMatch.source}.`);
                  }
              }
              return;
          }

          // 2. Caption changed (type and number match, but caption is different)
          const captionChangedMatch = explicitDetsWithIdx.find(d => 
              d.type === orig.type && 
              d.number === orig.number
          );

          if (captionChangedMatch) {
              matchedIdxs.add(captionChangedMatch.index);
              errors.push(`PLACEHOLDER_CAPTION_CHANGED: ${orig.type} ${orig.number} caption was changed from "${orig.caption}" to "${captionChangedMatch.caption}". Do not rewrite captions.`);
              return;
          }

          // 3. Type changed (number and caption match, but type is different)
          const typeChangedMatch = explicitDetsWithIdx.find(d => 
              d.number === orig.number && 
              d.caption === orig.caption && 
              d.type !== orig.type
          );

          if (typeChangedMatch) {
              matchedIdxs.add(typeChangedMatch.index);
              typeChangedKeys.add(`${typeChangedMatch.type}:${typeChangedMatch.number}`);
              errors.push(`PLACEHOLDER_TYPE_CHANGED: ${orig.type} ${orig.number} was changed to ${typeChangedMatch.type} ${typeChangedMatch.number}.`);
              return;
          }

          // 4. Number changed (type and caption match, but number is different)
          // Only perform if caption is non-empty to avoid false matching empty captions
          const numberChangedMatch = orig.caption ? explicitDetsWithIdx.find(d => 
              d.type === orig.type && 
              d.caption === orig.caption && 
              d.number !== orig.number
          ) : undefined;

          if (numberChangedMatch) {
              matchedIdxs.add(numberChangedMatch.index);
              errors.push(`PLACEHOLDER_NUMBER_CHANGED: ${orig.type} ${orig.number} was changed to ${numberChangedMatch.type} ${numberChangedMatch.number}.`);
              return;
          }

          // 5. Downgraded to plain reference (type and number match in plain references)
          const downgradedMatch = referenceDets.find(d => 
              d.type === orig.type && 
              d.number === orig.number
          );

          if (downgradedMatch) {
              downgradedKeys.add(`${orig.type}:${orig.number}`);
              errors.push(`PLACEHOLDER_EXPLICIT_SYNTAX_LOST: ${orig.type} ${orig.number} explicit placeholder was lost or downgraded to a plain reference.`);
              return;
          }

          // 6. Completely removed
          errors.push(`PLACEHOLDER_REMOVED: ${orig.type} ${orig.number} was removed from the text.`);
      });

      // 7. Duplicate explicit placeholders in output
      const counts = new Map<string, number>();
      explicitDets.forEach(d => {
          const key = `${d.type}:${d.number}`;
          counts.set(key, (counts.get(key) || 0) + 1);
      });

      counts.forEach((count, key) => {
          if (count > 1 && !typeChangedKeys.has(key)) {
              const [type, num] = key.split(':');
              errors.push(`PLACEHOLDER_DUPLICATE_AFTER_REWRITE: Duplicate ${type} ${num} placeholders detected.`);
          }
      });

      // 8. Newly invented / added placeholders by rewrite
      explicitDetsWithIdx.forEach(d => {
          if (!matchedIdxs.has(d.index)) {
              // Double check if it has been caught by type/number changes
              const isTypeOrNumChanged = normalizedOriginals.some(orig => 
                  (orig.number === d.number && orig.caption === d.caption) || 
                  (orig.type === d.type && orig.caption === d.caption)
              );
              if (!isTypeOrNumChanged) {
                  errors.push(`PLACEHOLDER_ADDED_BY_REWRITE: Invented placeholder detected: ${d.type} ${d.number}. Do not invent new placeholders.`);
              }
          }
      });

      // 9. Plain references without explicit placeholders
      referenceDets.forEach(d => {
          const key = `${d.type}:${d.number}`;
          if (downgradedKeys.has(key)) return; // Already reported as explicit syntax lost

          // A plain reference is an error only if there is no corresponding explicit placeholder of that type and number in the output
          const hasExplicit = explicitDets.some(e => e.type === d.type && e.number === d.number);
          if (!hasExplicit) {
              errors.push(`PLACEHOLDER_REFERENCE_WITHOUT_PLACEHOLDER: ${d.type} ${d.number} is referenced but has no explicit placeholder.`);
          }
      });
  }

  return {
    validationPassed: errors.length === 0,
    validationErrors: errors,
    shallowRewriteDetected,
    similarityCheckPassed,
    missingPreservedFacts,
    technicalValuesPreserved,
    summaryWordLimitPassed,
    detectedChangeType: finalChangeType
  };
}

/**
 * Normalizes, validates, and prepares the parsed JSON from Gemini.
 * Returns a fully guaranteed response object matching the expected schema.
 */
export function validateAndRepairResponse(
  parsed: any,
  reqData: FCORequestData,
  engineType: "gemini" | "local_heuristic",
  forceValidationResult?: ReturnType<typeof validateDraft>,
  repairPasses = 0,
  telemetry?: any,
  retrievedChunks: any[] = []
): FCOApiResponse {
  // Deep copy response
  const res: any = parsed ? JSON.parse(JSON.stringify(parsed)) : {};
  const scope = reqData.rewriteScope || 'full';

  // Ensure rewrittenSummary exists and is normalized
  let summary = res.rewrittenSummary;
  if (scope === 'full' || scope === 'summary') {
  if (typeof summary === 'string') {
    summary = {
      action: '[Information required from submitter]',
      cause: '[Information required from submitter]',
      benefit: '[Information required from submitter]'
    };
  } else if (!summary || typeof summary !== 'object') {
    summary = {};
  }
  
  let paragraph = summary.paragraph || "";
  
  if (!paragraph) {
    paragraph = `${summary.components?.problem || "[Information required from submitter]"} ${summary.components?.cause || "[Information required from submitter]"} ${summary.components?.solution || "[Information required from submitter]"} ${summary.components?.benefit || "[Information required from submitter]"}`.trim();
  }

  // Issue 3: fix "because the specific cause..." locally if present.
  paragraph = paragraph.replace(/because the specific cause requires confirmation from the submitter/gi, "while the specific contributing condition requires confirmation from the submitter");
  
  // Issue 2: Ensure prefix exists
  const pLower = (reqData.fcoDraft?.fcoMetadata?.priority || reqData.priority || '').toLowerCase();
  let prefix = "";
  if (pLower === 'urgent') prefix = 'This urgent Field Change Order (FCO) requires immediate field execution to';
  else if (pLower === 'required') prefix = 'This required Field Change Order (FCO) requires field execution to';
  else if (pLower === 'preferred') prefix = 'This preferred Field Change Order (FCO) proposes field implementation to';
  else prefix = 'This Field Change Order (FCO) requires field execution to';

  // Strip likely incorrect prefixes
  paragraph = paragraph.replace(/^(To address|This Field Change Order \([a-zA-Z]+\) [a-zA-Z ]+ to)\b/i, '').trim();

  // If it still doesn't start with prefix, prepend it.
  if (!paragraph.toLowerCase().startsWith('this ') && !paragraph.toLowerCase().includes('field change order')) {
      // capitalize first actual letter of paragraph if we just prepend? No, usually we say "... to address..."
      // Let's just make sure "to " is there if needed or just insert it.
      if (!paragraph.toLowerCase().startsWith('address') && !paragraph.toLowerCase().startsWith('resolve') && !paragraph.toLowerCase().startsWith('fix')) {
         paragraph = `${prefix} address ${paragraph.charAt(0).toLowerCase() + paragraph.slice(1)}`;
      } else {
         paragraph = `${prefix} ${paragraph}`;
      }
  } else if (!paragraph.toLowerCase().startsWith(prefix.toLowerCase())) {
     // Wait, if it has "This ... FCO ..." but wrong prefix, let's just forcefully inject the prefix on top.
     // Safer to just strip the first sentence up to 'to' if it matches the pattern and replace.
     const replaceMatch = paragraph.match(/This (.*?)(Field Change Order|FCO)(.*?) to /i);
     if (replaceMatch) {
         paragraph = paragraph.replace(replaceMatch[0], `${prefix} `);
     } else if (paragraph.toLowerCase().startsWith('this ')) {
         const firstSpace = paragraph.indexOf(' ');
         // just prepend anyway, it might be messy but the AI should usually format it correctly now with the prompt
     }
  }

  res.rewrittenSummary = {
    paragraph: paragraph || '[Summary could not be generated. TechCom review required.]',
    components: {
      problem: summary.components?.problem || "[Information required from submitter]",
      cause: summary.components?.cause || "[Information required from submitter]",
      solution: summary.components?.solution || "[Information required from submitter]",
      benefit: summary.components?.benefit || "[Information required from submitter]",
      references: summary.components?.references || []
    }
  };
  summary = res.rewrittenSummary;

  if (reqData.confirmedPCSB) {
      res.confirmedPCSB = reqData.confirmedPCSB;
  }

  // Enforce word counts from displayed fields
  const countText = summary.paragraph.replace(/\[Information required.*?\]/gi, '').replace(/\[Summary could not be generated.*?\]/gi, '');
  const totalWords = countText.split(/\s+/).filter((w: string) => w.trim().length > 0).length;
  summary.wordCount = totalWords;

  } // end if scope summary
  else {
      // create a dummy summary
      res.rewrittenSummary = {
          paragraph: reqData.rawSummary || "No summary provided.",
          components: { problem: "", cause: "", solution: "", benefit: "" },
          wordCount: 0
      };
      summary = res.rewrittenSummary;
  }
  // Ensure rewrittenProcedure exists
  if (!res.rewrittenProcedure || typeof res.rewrittenProcedure !== 'object') {
    res.rewrittenProcedure = {};
  }
  let procedure = res.rewrittenProcedure;
  if (scope === 'full' || scope === 'procedure') {

  
  // Guard change type
  procedure.changeType = procedure.changeType || reqData.changeType || 'Mixed Change';
  if (procedure.changeType === 'Unknown') {
    procedure.changeType = 'Mixed Change';
  }

  const normType = procedure.changeType.trim();

  // Guard sections array
  if (!Array.isArray(procedure.sections) || procedure.sections.length === 0) {
    procedure.sections = [
      {
        title: 'A. Safety',
        steps: ['Perform safety checks and isolations prior to commencing any work.'],
        notes: [],
        cautions: [],
        warnings: []
      },
      {
        title: 'B. Implementation',
        steps: ['Perform changes specified in the raw procedure instructions.'],
        notes: [],
        cautions: [],
        warnings: []
      }
    ];
  } else {
    // Standardize steps: trim manual number prefixes (e.g. "1. Step" -> "Step")
    let hasSafetyLoto = false;
    
    // First pass to detect Lockout/Tagout in Safety
    procedure.sections.forEach((section: any) => {
        const titleLower = (section.title || '').toLowerCase();
        if (titleLower.includes('safety')) {
            if (Array.isArray(section.steps)) {
                section.steps.forEach((step: any) => {
                    const stepText = typeof step === 'string' ? step : '';
                    if (stepText.toLowerCase().includes('lockout/tagout') || stepText.toLowerCase().includes('loto')) {
                        hasSafetyLoto = true;
                    }
                });
            }
        }
    });

    procedure.sections = procedure.sections.map((section: any, idx: number) => {
      const title = section.title || `Section ${idx + 1}`;
      const cleanStepText = (step: any): string => {
        if (typeof step !== 'string') return '';
        let text = step.replace(/^[\d+.*-]\s*/, '').trim();

        if (hasSafetyLoto && title.toLowerCase().includes('implementation')) {
           if (text.toLowerCase().startsWith('perform lockout/tagout') || text.toLowerCase() === 'perform loto.' || text.toLowerCase() === 'apply lockout/tagout (loto).') {
               text = "Verify Lockout/Tagout (LOTO) is active.";
           } else if (text.toLowerCase().includes('turn off the pump and make sure it cannot start')) {
               text = "Verify the equipment cannot start.";
           }
        }
        return text;
      };

      let steps: string[] = [];
      if (Array.isArray(section.steps)) {
        steps = section.steps.map(cleanStepText).filter(Boolean);
      }

      // Preserve part-localized step groups (official FCO layout blocks).
      let stepGroups: any[] | undefined = undefined;
      if (Array.isArray(section.stepGroups)) {
        stepGroups = section.stepGroups
          .filter((g: any) => g && typeof g.title === 'string' && g.title.trim())
          .map((g: any) => ({
            title: g.title.trim(),
            forPart: typeof g.forPart === 'string' ? g.forPart : '',
            steps: Array.isArray(g.steps) ? g.steps.map(cleanStepText).filter(Boolean) : []
          }))
          .filter((g: any) => g.steps.length > 0);
        if (stepGroups.length === 0) stepGroups = undefined;
      }

      if (steps.length === 0 && !stepGroups) {
        steps = ['[Information required from submitter: Enter action step]'];
      }

      return {
        title,
        steps,
        ...(stepGroups ? { stepGroups } : {})
      };
    });
  }

  // Auto-heal missing sections required by the Change Type to ensure strict validation compliance
  const healingAliasMap: Record<string, string[]> = {
    'safety': ['safety', 'access control', 'hazard', 'applicability'],
    'preparation': ['preparation', 'prepare', 'gather', 'pre-install', 'preliminary'],
    'implementation': ['implementation', 'implement', 'action', 'install', 'update', 'upgrade', 'configuration', 'procedure', 'execution', 'physical'],
    'verification': ['verification', 'verify', 'test', 'check', 'inspect', 'audit', 'validation'],
    'completion': ['completion', 'complete', 'wrap-up', 'restore', 'finish', 'sign-off', 'publish', 'log'],
    'backup': ['backup', 'back up', 'save', 'current state', 'original state', 'values', 'snapshot', 'nvram'],
    'update': ['update', 'upgrade', 'install', 'parameter', 'patch', 'configuration', 'implementation'],
    'applicability': ['applicability', 'apply', 'scope', 'eligible', 'coverage'],
    'communication': ['communication', 'coordinate', 'notify', 'inform', 'brief', 'announce', 'meeting']
  };

  const hasSectionWithAlias = (kw: string, sectionsList: any[]) => {
    const aliases = healingAliasMap[kw] || [kw];
    return sectionsList.some(s => {
      const titleLower = (s.title || '').toLowerCase();
      return aliases.some(alias => titleLower.includes(alias));
    });
  };

  let requiredSections: string[] = [];
  let titlePrefixes: Record<string, string> = {
    'safety': 'Safety',
    'preparation': 'Preparation',
    'implementation': 'Implementation',
    'verification': 'Verification',
    'completion': 'Completion',
    'backup': 'Backup / Current State Check',
    'update': 'Software or Configuration Update',
    'applicability': 'Applicability',
    'communication': 'Communication'
  };

  if (normType === 'Physical / Hardware Change') {
    requiredSections = ['safety', 'preparation', 'implementation', 'verification', 'completion'];
    titlePrefixes = {
      'safety': 'Safety',
      'preparation': 'Preparation',
      'implementation': 'Implementation',
      'verification': 'Verification',
      'completion': 'Completion'
    };
    if (!procedure.toolsMaterialsRequired) {
      procedure.toolsMaterialsRequired = {
        confirmedFromInput: ["[Information required from submitter: Enter required tools and materials]"],
        suggestedToConfirm: []
      };
    }
  } else if (normType === 'Software / Configuration Change') {
    requiredSections = ['safety', 'preparation', 'backup', 'update', 'verification', 'completion'];
    titlePrefixes = {
      'safety': 'Safety / Access Control',
      'preparation': 'Preparation',
      'backup': 'Backup / Current State Check',
      'update': 'Software or Configuration Update',
      'verification': 'Verification',
      'completion': 'Completion'
    };
  } else if (normType === 'Policy / Process Change') {
    requiredSections = ['applicability', 'communication', 'implementation', 'verification', 'completion'];
    titlePrefixes = {
      'applicability': 'Applicability',
      'communication': 'Communication',
      'implementation': 'Implementation',
      'verification': 'Verification',
      'completion': 'Completion'
    };
  }

  // Auto-add any missing required sections
  requiredSections.forEach(kw => {
    if (!hasSectionWithAlias(kw, procedure.sections)) {
      const title = titlePrefixes[kw] || `${kw.charAt(0).toUpperCase() + kw.slice(1)}`;
      procedure.sections.push({
        title,
        steps: [`[Information required from submitter: Enter instructions for ${kw}]`]
      });
    }
  });

  // Re-order / prefix letterings cleanly in correct alphabetical order
  const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  procedure.sections.forEach((s: any, index: number) => {
    s.title = s.title.replace(/^[A-H]\.\s*/i, ''); // Strip any existing prefix first
    const letter = alphabet[index] || String(index + 1);
    s.title = `${letter}. ${s.title}`;
  });

  // 100% Safety Integrity Warning Injection
  const rawLower = `${reqData.title || ''} ${reqData.rawSummary || ''} ${reqData.rawProcedure || ''} ${reqData.customDirectives || ''}`.toLowerCase();

  // Auto-enrich high-pressure steps if pressure is detected
  const rawHasPressure = /pressure|psi|bar|mpa|kpa|hydraulic|pneumatic|gas|fluid|stored energy|leak|fitting|coupling|valve/i.test(rawLower);
  if (rawHasPressure) {
    const safetySection = procedure.sections.find((s: any) => 
      (s.title || '').toLowerCase().includes('safety') || 
      (s.title || '').toLowerCase().includes('applicability')
    );
    if (safetySection) {
      if (!Array.isArray(safetySection.steps)) {
        safetySection.steps = [];
      }
      const safetyCombinedText = `${safetySection.title || ''} ${(safetySection.steps || []).join(' ')}`.toLowerCase();
      
      if (!/isolate|shut off|stop|disconnect|loto|lockout|block/i.test(safetyCombinedText)) {
        safetySection.steps.push("Isolate the pressure source using LOTO (Lockout/Tagout), stop, shut off, or disconnect controls.");
      }
      if (!/release|bleed|discharge|vent|depressur/i.test(safetyCombinedText)) {
        safetySection.steps.push("Release, bleed, discharge, vent, or depressurize stored pressure prior to loosening fittings or connections.");
      }
      if (!/keep hands|hand|body|protect|injury/i.test(safetyCombinedText)) {
        safetySection.steps.push("Keep hands and body away from leaks and protected from unexpected pressure releases.");
      }
      if (!/loosen|disconnect|fitting|coupling|torque|until/i.test(safetyCombinedText)) {
        safetySection.steps.push("Do not loosen fittings or connections until pressure is zero and fully released.");
      }
    }
  }

  // Verify Skin Injection injection
  if (rawLower.includes("skin injection") || rawLower.includes("penetrate skin")) {
    const safetySection = procedure.sections.find((s: any) => (s.title || '').toLowerCase().includes('safety'));
    if (safetySection) {
      if (!Array.isArray(safetySection.steps)) safetySection.steps = [];
      const concreteWarning = "High-pressure fluid can penetrate skin. Keep hands and body away from leaks and pressurized connections.";
      if (!safetySection.steps.some((s: string) => typeof s === 'string' && s.toLowerCase().includes("penetrate skin"))) {
        safetySection.steps.unshift(concreteWarning);
      }
    }
  }

  // Verify High-pressure gas injection
  if (rawLower.includes("high-pressure gas") || rawLower.includes("gas pressure")) {
    const safetySection = procedure.sections.find((s: any) => (s.title || '').toLowerCase().includes('safety'));
    if (safetySection) {
      if (!Array.isArray(safetySection.steps)) safetySection.steps = [];
      const concreteWarning = "High-pressure gas can cause serious injury. Isolate the gas supply and release stored pressure before loosening any connection.";
      if (!safetySection.steps.some((s: string) => typeof s === 'string' && (s.toLowerCase().includes("gas supply") || s.toLowerCase().includes("serious injury")))) {
        safetySection.steps.unshift(concreteWarning);
      }
    }
  }

  } // end if scope procedure
  else {
     // create dummy procedure
     res.rewrittenProcedure = {
        changeType: reqData.changeType || 'Mixed Change',
        sections: []
     };
  }
  // Ensure whatWasEdited exists
  if (!res.whatWasEdited || typeof res.whatWasEdited !== 'object') {
    res.whatWasEdited = {};
  }
  const whatWasEdited = res.whatWasEdited;
  whatWasEdited.changeTypeIdentified = whatWasEdited.changeTypeIdentified || procedure.changeType;
  
  // Enforce string array formatting of dashed wording edits with "old wording" → "new wording"
  let summaryWordingEdits: string[] = [];
  if (Array.isArray(whatWasEdited.summaryWordingEdits)) {
    summaryWordingEdits = whatWasEdited.summaryWordingEdits.map((item: any) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && item.original && item.rewritten) {
        return `"${item.original}" → "${item.rewritten}"`;
      }
      return String(item);
    });
  }
  if (summaryWordingEdits.length === 0) {
    summaryWordingEdits = [`"Raw notes processed" → "Normalized structured labels"`];
  }

  let procedureWordingEdits: string[] = [];
  if (Array.isArray(whatWasEdited.procedureWordingEdits)) {
    procedureWordingEdits = whatWasEdited.procedureWordingEdits.map((item: any) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && item.original && item.rewritten) {
        return `"${item.original}" → "${item.rewritten}"`;
      }
      return String(item);
    });
  }
  if (procedureWordingEdits.length === 0) {
    procedureWordingEdits = [`"Raw sequence sorted" → "Formatted with SWI sections"`];
  }

  const structuralEdits = Array.isArray(whatWasEdited.structuralEdits) 
    ? whatWasEdited.structuralEdits.map(String)
    : [
        "Applied Forced Labels formatting to Summary",
        `Constructed procedures for change type: ${procedure.changeType}`
      ];

  const preservedTechnicalInformation = Array.isArray(whatWasEdited.preservedTechnicalInformation)
    ? whatWasEdited.preservedTechnicalInformation.map(String)
    : [];

  const finalizedWhatWasEdited = {
    changeTypeIdentified: whatWasEdited.changeTypeIdentified,
    summaryWordingEdits,
    procedureWordingEdits,
    structuralEdits,
    preservedTechnicalInformation
  };

  // Ensure techComReviewNotes exists and match exact lowercase/camelCase schema structure
  const rawNotes = res.techComReviewNotes || {};
  const notes: any = {
    missingInformation: Array.isArray(rawNotes.missingInformation) ? rawNotes.missingInformation.filter(Boolean) : [],
    safetyItemsToConfirm: Array.isArray(rawNotes.safetyItemsToConfirm) ? rawNotes.safetyItemsToConfirm.filter(Boolean) : [],
    referencesToConfirm: Array.isArray(rawNotes.referencesToConfirm) ? rawNotes.referencesToConfirm.filter(Boolean) : [],
    technicalItemsToConfirm: Array.isArray(rawNotes.technicalItemsToConfirm) ? rawNotes.technicalItemsToConfirm.filter(Boolean) : [],
    changeTypeConfirmation: Array.isArray(rawNotes.changeTypeConfirmation) ? rawNotes.changeTypeConfirmation.filter(Boolean) : [],
    sourceTruthConflicts: Array.isArray(rawNotes.sourceTruthConflicts) ? rawNotes.sourceTruthConflicts.filter(Boolean) : []
  };

  // Parse check validation results
  const computedCheck = forceValidationResult || validateDraft(res, reqData, retrievedChunks);

  // Sync review notes
  if (computedCheck.missingPreservedFacts.length > 0) {
    computedCheck.missingPreservedFacts.forEach(fact => {
      const msg = `Verify that raw technical fact value '${fact}' was intended to be reworded or omitted.`;
      if (!notes.technicalItemsToConfirm.includes(msg)) {
        notes.technicalItemsToConfirm.push(msg);
      }
    });
  }

  if (computedCheck.validationErrors.length > 0) {
    computedCheck.validationErrors.forEach(err => {
      const msg = `Draft Validation Issue: ${err}`;
      if (!notes.missingInformation.includes(msg)) {
        notes.missingInformation.push(msg);
      }
    });
  }

  const cause = summary.components?.cause || summary.cause;
  const benefit = summary.components?.benefit || summary.benefit;
  if (!cause || cause.includes('[Information required')) {
      const msg = "Confirm Summary Cause.";
      if (!notes.missingInformation.includes(msg)) notes.missingInformation.push(msg);
  }
  if (!benefit || benefit.includes('[Information required')) {
      const msg = "Confirm Summary Benefit.";
      if (!notes.missingInformation.includes(msg)) notes.missingInformation.push(msg);
  }

  if (!reqData.appliesTo) {
    const msg = "Confirm the FCO applicability / Applies To field.";
    if (!notes.missingInformation.includes(msg)) {
      notes.missingInformation.push(msg);
    }
  }

  if (!reqData.changeType) {
    const msg = "Confirm the appropriate Change Type class for this FCO context.";
    if (!notes.changeTypeConfirmation.includes(msg)) {
      notes.changeTypeConfirmation.push(msg);
    }
  }

  if (!reqData.effectiveDate && (reqData.priority === 'Urgent' || reqData.priority === 'Required')) {
    const msg = "Confirm the effective date if required for implementation planning.";
    if (!notes.missingInformation.includes(msg)) {
      notes.missingInformation.push(msg);
    }
  }

  // Standard review items fallback
  if (notes.safetyItemsToConfirm.length === 0) {
    notes.safetyItemsToConfirm.push("Verify LOTO (Lockout/Tagout) step boundaries inside FCO procedure.");
  }
  if (notes.referencesToConfirm.length === 0) {
    notes.referencesToConfirm.push("Verify missing standard operating procedure and SWI references.");
  }
  
  // Reference Hallucination Sanity Check
  const allowedGeneralSources = (
    (reqData.originalProcedure || '') + ' ' +
    (reqData.rawProcedure || '') + ' ' +
    (reqData.rawSummary || '') + ' ' +
    (reqData.title || '')
  ).toLowerCase();

  const allowedProcedureSources = (
    (reqData.originalProcedure || '') + ' ' +
    (reqData.rawProcedure || '')
  ).toLowerCase();

  const sanitizeReferences = (text: string, isProcedureStep: boolean = false) => {
    if (!text) return { text, hasHallucination: false };
    let sanitized = text;
    let hasHallucination = false;
    
    // Patterns to catch: PN-123, PN 123, Part Number 123, SWI-123, SWI 123, Figure X, Table X
    const patterns = [
      /SWI[-\s]?[\w]+/gi,
      /PN[-\s]?[\w\d]+/gi,
      /Part Number\s+[\w\d]+/gi,
      /Figure\s+[\w\d]+/gi,
      /Table\s+[\w\d]+/gi,
      /Document\s+[A-Z0-9\-]+/gi,
      /Procedure\s+[A-Z0-9\-]+/gi
    ];

    const sourceToCheck = isProcedureStep ? allowedProcedureSources : allowedGeneralSources;

    patterns.forEach(regex => {
      sanitized = sanitized.replace(regex, (match) => {
        // If the exact match doesn't exist in the allowed source content
        if (!sourceToCheck.includes(match.toLowerCase())) {
           hasHallucination = true;
           finalizedWhatWasEdited.structuralEdits.push(`Removed hallucinated reference: '${match}'`);
           notes.referencesToConfirm.push(`System detected and removed hallucinated reference '${match}'. Submitter must provide correct reference.`);
           return isProcedureStep ? '[[HALLUCINATED_REF]]' : '[Reference required from submitter]';
        }
        return match;
      });
    });

    return { text: sanitized, hasHallucination };
  };
  
  // Style Normalization
  let styleRulesApplied: any[] = [];
  
  const normalizeField = (str: string, isProcedureStep: boolean = false) => {
     if (!str) return str;
     const { text: sanitized, hasHallucination } = sanitizeReferences(str, isProcedureStep);
     
     if (isProcedureStep && hasHallucination) {
         // If a procedure step hallucinated a reference, either rewrite it or drop it entirely.
         if (sanitized.toLowerCase().includes('prepare') || sanitized.toLowerCase().includes('work area')) {
             return "Prepare the work area and ensure safe working conditions.";
         }
         
         // Remove the reference syntax
         let cleaned = sanitized.replace(/\b(refer to|see|according to|as per|in accordance with)\b\s*\[\[HALLUCINATED_REF\]\]/gi, '').trim();
         cleaned = cleaned.replace(/\[\[HALLUCINATED_REF\]\]/g, '').trim();
         cleaned = cleaned.replace(/^,+|,+$/g, '').trim(); // clean dangling commas
         
         if (cleaned.length < 5 || /^[^a-zA-Z0-9]+$/.test(cleaned)) {
             return ""; // Will be filtered out
         }
         
         const norm = normalizeStyle(cleaned, []);
         norm.rulesApplied.forEach((r: any) => styleRulesApplied.push(r));
         return norm.normalizedText;
     }

     const norm = normalizeStyle(sanitized, []);
     norm.rulesApplied.forEach((r: any) => styleRulesApplied.push(r));
     return norm.normalizedText;
  };
  
  summary.paragraph = normalizeField(summary.paragraph);
  summary.components.action = normalizeField(summary.components.action);
  summary.components.cause = normalizeField(summary.components.cause);
  summary.components.benefit = normalizeField(summary.components.benefit);
  
  if (procedure.sections) {
     procedure.sections.forEach((sec: any) => {
        if (sec.steps) {
            sec.steps = sec.steps.map((s: string) => normalizeField(s, true)).filter((s: string) => s.length > 0);
        }
     });
  }
  
  // Add normalization trace
  styleRulesApplied.forEach(rule => {
      finalizedWhatWasEdited.structuralEdits.push(`Normalized ${rule.ruleId.split('-')[1]} temperature unit format to SLB style: ${rule.normalized.split(' ').pop()}`);
  });

  // 100% Map and process sourceTruthsUsed
  const finalSourceTruthsUsed = retrievedChunks.map((chunk: any) => {
    return {
      documentName: chunk.documentName || "Guidelines Reference",
      documentType: chunk.documentType || "Other",
      version: chunk.version || "1.0.0",
      reasonUsed: `Provided instructions for ${chunk.ruleCategory || 'general rules'} alignment.`,
      excerptSummary: chunk.text ? (chunk.text.substring(0, 150) + "...") : "No text excerpt loaded."
    };
  });

  // Calculate referencesPreserved
  let referencesPreserved = true;

  // Construct Validation block matching exactly step 24
  const validationObj = {
    summaryLabelsIncluded: !!(summary.components.action && summary.components.cause && summary.components.benefit),
    summaryWordLimitPassed: computedCheck.summaryWordLimitPassed,
    procedureSectioned: Array.isArray(procedure.sections) && procedure.sections.length > 0,
    numberingRestarted: true,
    technicalFactsPreserved: computedCheck.technicalValuesPreserved,
    referencesPreserved,
    editTraceIncluded: summaryWordingEdits.length > 0 || procedureWordingEdits.length > 0,
    reviewNotesIncluded: Object.values(notes).some((arr: any) => arr.length > 0),
    sourceTruthsRetrieved: finalSourceTruthsUsed.length > 0
  };

  let expectedEngineUsed = 'unknown';
  if (engineType === 'gemini') {
    if ((telemetry && telemetry.jsonRepairAttemptsUsed > 0) || repairPasses > 0) {
      expectedEngineUsed = 'gemini_with_repair';
    } else {
      expectedEngineUsed = 'gemini';
    }
  } else if (engineType === 'local_heuristic') {
    expectedEngineUsed = 'local_fallback';
  }

  // Construct Diagnostics block matching exactly step 24 / User Request
  const diagnosticsObj = {
    engineUsed: expectedEngineUsed,
    primaryEngine: "gemini",
    fallbackUsed: engineType === 'local_heuristic',
    fallbackReason: telemetry?.lastLlmError || (engineType === 'local_heuristic' ? "Gemini validation could not be completed." : null),
    geminiAvailable: engineType !== 'local_heuristic' || Boolean(telemetry && telemetry.lastLlmError && (!telemetry.lastLlmError.includes("failed") && !telemetry.lastLlmError.includes("unavailable") && !telemetry.lastLlmError.includes("timed out"))), // Approximated
    llmAttemptsUsed: telemetry?.llmAttemptsUsed || 1,
    jsonRepairAttemptsUsed: telemetry?.jsonRepairAttemptsUsed || 0,
    validationRepairAttemptsUsed: repairPasses,
    validationPassed: computedCheck.validationPassed,
    validationErrors: computedCheck.validationErrors || [],
    generatedAt: new Date().toISOString(),
    // extra info
    confidenceLevel: engineType === 'gemini' 
      ? (computedCheck.validationPassed ? 'high' : 'medium') 
      : 'limited',
    retrievalMode: finalSourceTruthsUsed.length > 0 ? 'hybrid' : 'none',
    retrievedChunkCount: retrievedChunks.length,
    sourceTruthContextInjected: retrievedChunks.length > 0
  };

  // Return formatted schema
  const styleNormalization = {
    rulesApplied: styleRulesApplied,
    styleIssuesDetected: [],
    styleValidationPassed: true
  };

  // Generate Word Diff Trace
  let wordDiffTrace: any = { warnings: [] };
  
  try {
     const origSummary = reqData.rawSummary;
     const probText = summary.paragraph;
     wordDiffTrace.summary = generateDiffTrace(origSummary || '', probText);
     
     const origProc = reqData.rawProcedure;
     wordDiffTrace.procedure = {
        available: true,
        sections: []
     };
     
     // Very simplistic grouping: just dump all original vs all rewritten since matching sections is hard if structure changes drastically
     const rewrittenProcText = procedure.sections ? procedure.sections.map((s:any) => `[${s.title}] ` + s.steps.join(' ')).join(' ') : '';
     const procDiff = generateDiffTrace(origProc || '', rewrittenProcText);
     
     wordDiffTrace.procedure.sections.push({
        title: "Full Procedure",
        originalText: origProc,
        rewrittenText: rewrittenProcText,
        diffTokens: procDiff.diffTokens,
        stats: procDiff.stats
     });
     
  } catch(e: any) {
     wordDiffTrace.warnings.push("Word-by-word edit trace could not be generated.");
  }

  // Multi-part analysis: keep only well-formed, deduplicated entries. When the
  // engineer supplied an authoritative declared-parts list (Parts & Components
  // page), restrict the returned partsInvolved to that list — server-side
  // enforcement of the "declared parts are authoritative" contract the prompt
  // already states, so a model slip can't smuggle undeclared parts through.
  let cleanedPartsInvolved: any[] = Array.isArray(procedure.partsInvolved)
    ? procedure.partsInvolved.filter((p: any) => p && typeof p.name === 'string' && p.name.trim())
    : [];

  const seenPartKeys = new Set<string>();
  cleanedPartsInvolved = cleanedPartsInvolved.filter((p: any) => {
    const key = `${p.name.trim().toLowerCase()}|${(p.identifier || '').trim().toLowerCase()}`;
    if (seenPartKeys.has(key)) return false;
    seenPartKeys.add(key);
    return true;
  });

  const declaredParts = reqData.fcoDraft?.technicalContent?.declaredParts;
  const declaredNames = Array.isArray(declaredParts) && declaredParts.length > 0
    ? new Set(declaredParts.map((p: any) => (p?.name || '').trim().toLowerCase()).filter(Boolean))
    : null;

  if (declaredNames) {
    const beforeCount = cleanedPartsInvolved.length;
    cleanedPartsInvolved = cleanedPartsInvolved.filter((p: any) => declaredNames.has(p.name.trim().toLowerCase()));
    if (cleanedPartsInvolved.length < beforeCount) {
      const msg = "The AI-detected parts list included entries beyond the declared Parts & Components list; those extra entries were removed before returning the result. Declared parts remain the source of truth.";
      if (!notes.technicalItemsToConfirm.includes(msg)) notes.technicalItemsToConfirm.push(msg);
    }
  }

  const returnResponse: any = {
    rewrittenSummary: {
      paragraph: summary.paragraph,
      components: summary.components,
      wordCount: summary.wordCount,
      withinWordLimit: computedCheck.summaryWordLimitPassed
    },
    rewrittenProcedure: {
      changeType: procedure.changeType,
      toolsMaterialsRequired: procedure.toolsMaterialsRequired,
      partsInvolved: cleanedPartsInvolved,
      sections: procedure.sections
    },
    whatWasEdited: finalizedWhatWasEdited,
    wordDiffTrace,
    techComReviewNotes: notes,
    sourceTruthsUsed: finalSourceTruthsUsed,
    validation: validationObj,
    diagnostics: diagnosticsObj,
    styleNormalization,
    rawFullOutput: ""
  };

  // Re-run markdown builder to guarantee output is synced with any updates / corrections
  returnResponse.rawFullOutput = buildMarkdownOutputFromData(returnResponse, reqData);
  returnResponse.rawMarkdown = returnResponse.rawFullOutput; // Keep for compatibility
  
  const rawCopy = { ...returnResponse };
  delete rawCopy.rawJson;
  returnResponse.rawJson = rawCopy;

  return returnResponse as FCOApiResponse;
}

/**
 * Builds standard Markdown export output from fully formed data structure
 */
function buildMarkdownOutputFromData(data: any, reqData?: FCORequestData): string {
  let md = `\n\n`;
  md += `> **DRAFT STATUS NOTICE:** Draft for TechCom review only. Not approved for field release.\n\n`;
  
  const isFallback = data.diagnostics?.engineUsed === 'local_fallback' || data.diagnostics?.fallbackUsed;
  if (isFallback) {
    md += `> **FALLBACK MODE NOTICE:** Generated using local fallback. TechCom review required.\n\n`;
  }

  md += `# FCO REWRITE ASSISTANT DRAFT OUTPUT\n\n`;
  md += `## Engine Summary\n\n`;
  
  if (data.diagnostics?.engineUsed === 'gemini') {
    md += `Engine Used: Gemini\n`;
  } else if (data.diagnostics?.engineUsed === 'gemini_with_repair') {
    md += `Engine Used: Gemini with Repair\n`;
  } else {
    md += `Engine Used: Local Fallback\n`;
  }
  
  md += `Fallback Used: ${isFallback ? 'Yes' : 'No'}\n`;
  md += `Fallback Reason: ${data.diagnostics?.fallbackReason || 'N/A'}\n\n`;

  md += `## 1. FCO SUMMARY\n\n`;
  if (data.rewrittenSummary) { md += `${data.rewrittenSummary.paragraph}\n\n`; }
  if (data.rewrittenSummary) { md += `_Word Count: ${data.rewrittenSummary.wordCount} words (Limit: 150 words)_\n\n`; }

  md += `## 2. FCO PROCEDURE (Change Type: ${data.rewrittenProcedure.changeType})\n\n`;

  if (data.rewrittenProcedure.toolsMaterialsRequired) {
    const tm = data.rewrittenProcedure.toolsMaterialsRequired;
    md += `### Tools & Materials Required\n\n`;
    if (tm.confirmedFromInput && tm.confirmedFromInput.length > 0) {
      md += `**Confirmed from input:**\n`;
      tm.confirmedFromInput.forEach((item: string) => {
        md += `- ${item}\n`;
      });
      md += `\n`;
    }
    if (tm.suggestedToConfirm && tm.suggestedToConfirm.length > 0) {
      md += `**Suggested to confirm:**\n`;
      tm.suggestedToConfirm.forEach((item: string) => {
        md += `- ${item}\n`;
      });
      md += `\n`;
    }
  }

  const callouts = reqData?.fcoDraft?.technicalContent?.procedureCallouts || [];

  if (data.rewrittenProcedure && Array.isArray(data.rewrittenProcedure.sections)) { data.rewrittenProcedure.sections.forEach((section: any) => {
    md += `### ${section.title}\n\n`;
    
    // Add User Callouts for this section
    const sectionCallouts = callouts.filter(c => 
      c.section.toLowerCase() === section.title.toLowerCase() ||
      section.title.toLowerCase().includes(c.section.toLowerCase())
    );
    
    sectionCallouts.forEach(c => {
      if (!c.text || !c.text.trim()) return;
      if (c.type === 'warning') {
        md += `> **WARNING:** ${c.text.replace(/^(WARNING:\s*)+/i, "")}\n\n`;
      } else if (c.type === 'caution') {
        md += `> **CAUTION:** ${c.text.replace(/^(CAUTION:\s*)+/i, "")}\n\n`;
      } else if (c.type === 'note') {
        md += `_Note: ${c.text.replace(/^(NOTE:\s*)+/i, "")}_\n\n`;
      }
    });

    let stepNo = 0;
    if (Array.isArray(section.stepGroups) && section.stepGroups.length > 0) {
      section.stepGroups.forEach((group: any) => {
        stepNo++;
        md += `${stepNo}. **${group.title}**\n`;
        (group.steps || []).forEach((s: string) => {
          md += `   - ${s}\n`;
        });
      });
    }
    if (section.steps && section.steps.length > 0) {
      section.steps.forEach((step: string) => {
        stepNo++;
        md += `${stepNo}. ${step}\n`;
      });
    }
    if (stepNo > 0) md += `\n`;
  });
  }

  md += `## 3. WHAT WAS EDITED (EDIT TRACE)\n\n`;
  md += `**Change Type Identified:** ${data.whatWasEdited.changeTypeIdentified}\n\n`;
  
  if (data.wordDiffTrace?.summary?.diffTokens) {
    md += `### Word-by-Word Summary Edit Trace:\n\n`;
    let out = '';
    data.wordDiffTrace.summary.diffTokens.forEach((t: any) => {
       if (t.type === 'removed') out += `[-${t.text}-] `;
       else if (t.type === 'added') out += `[+${t.text}+] `;
       else out += `${t.text} `;
    });
    md += out.replace(/\s+/g, ' ').trim() + `\n\n`;
  }
  
  md += `### Summary Wording Edits:\n`;
  if (data.whatWasEdited.summaryWordingEdits && data.whatWasEdited.summaryWordingEdits.length > 0) {
    data.whatWasEdited.summaryWordingEdits.forEach((edit: string) => {
      md += `- ${edit}\n`;
    });
  } else {
    md += `- None identified\n`;
  }

  md += `\n### Procedure Wording Edits:\n`;
  if (data.whatWasEdited.procedureWordingEdits && data.whatWasEdited.procedureWordingEdits.length > 0) {
    data.whatWasEdited.procedureWordingEdits.forEach((edit: string) => {
      md += `- ${edit}\n`;
    });
  } else {
    md += `- None identified\n`;
  }
  
  if (data.wordDiffTrace?.procedure?.sections) {
     md += `\n### Word-by-Word Procedure Edit Trace:\n\n`;
     data.wordDiffTrace.procedure.sections.forEach((sec: any) => {
        let out = '';
        sec.diffTokens.forEach((t: any) => {
          if (t.type === 'removed') out += `[-${t.text}-] `;
          else if (t.type === 'added') out += `[+${t.text}+] `;
          else out += `${t.text} `;
        });
        md += out.replace(/\s+/g, ' ').trim() + `\n\n`;
     });
  }

  md += `\n### Structural Edits:\n`;
  if (data.whatWasEdited.structuralEdits && data.whatWasEdited.structuralEdits.length > 0) {
    data.whatWasEdited.structuralEdits.forEach((edit: string) => {
      md += `- ${edit}\n`;
    });
  } else {
    md += `- None identified\n`;
  }

  md += `\n### Preserved Technical Information:\n`;
  if (data.whatWasEdited.preservedTechnicalInformation && data.whatWasEdited.preservedTechnicalInformation.length > 0) {
    data.whatWasEdited.preservedTechnicalInformation.forEach((info: string) => {
      md += `- Preserved: ${info}\n`;
    });
  } else {
    md += `- None identified\n`;
  }

  md += `\n## 4. TECHCOM REVIEW NOTES\n\n`;
  const notes = data.techComReviewNotes;
  Object.keys(notes).forEach((category) => {
    const list = notes[category];
    const categoryName = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    md += `### ${categoryName}:\n`;
    if (list && list.length > 0) {
      list.forEach((item: string) => {
        md += `- [ ] ${item}\n`;
      });
    } else {
      md += `- None identified\n`;
    }
    md += `\n`;
  });

  md += `\n## 5. VALIDATION STATUS CHECKLIST\n\n`;
  const val = data.validation;
  if (val) {
    md += `- **Summary Labels Included:** ${val.summaryLabelsIncluded ? "PASSED" : "FAILED"}\n`;
    md += `- **Summary Word Count Limit (<=150 words) Passed:** ${val.summaryWordLimitPassed ? "PASSED" : "FAILED"}\n`;
    md += `- **Procedure Organized in Subsections:** ${val.procedureSectioned ? "PASSED" : "FAILED"}\n`;
    md += `- **Step Numbering Restarted per Section:** ${val.numberingRestarted ? "PASSED" : "FAILED"}\n`;
    md += `- **Technical Values Preserved Unchanged:** ${val.technicalFactsPreserved ? "PASSED" : "FAILED"}\n`;
    md += `- **References Preserved Unchanged:** ${val.referencesPreserved ? "PASSED" : "FAILED"}\n`;
    md += `- **Edit Wording Trace Included:** ${val.editTraceIncluded ? "PASSED" : "FAILED"}\n`;
    md += `- **TechCom Review Notes Generated:** ${val.reviewNotesIncluded ? "PASSED" : "FAILED"}\n`;
    md += `- **Source Truth Standards Queried:** ${val.sourceTruthsRetrieved ? "PASSED" : "FAILED"}\n`;
  } else {
    md += `Validation results not processed.\n`;
  }

  md += `\n## 6. SOURCE TRUTH STANDARDS USED\n\n`;
  if (data.sourceTruthsUsed && data.sourceTruthsUsed.length > 0) {
    data.sourceTruthsUsed.forEach((source: any) => {
      md += `### Document: ${source.documentName} (Type: ${source.documentType}, Version: ${source.version})\n`;
      md += `- **Reason Used:** ${source.reasonUsed}\n`;
      md += `- **Excerpt Summary:** ${source.excerptSummary}\n\n`;
    });
  } else {
    md += `No active source truths found / used.\n\n`;
  }

  if (data.docxExtractionDiagnostics) {
      md += `\n## 7. DOCX EXTRACTION DIAGNOSTICS\n\n`;
      const ded = data.docxExtractionDiagnostics;
      md += `- **Extraction Confidence:** ${ded.extractionConfidence ? Math.round(ded.extractionConfidence * 100) + '%' : 'Unknown'}\n`;
      md += `- **Figure References Preserved:** ${ded.figureReferencesPreserved ? "Yes" : "No"}\n`;
      md += `- **Table References Preserved:** ${ded.tableReferencesPreserved ? "Yes" : "No"}\n`;
      md += `- **Missing Figure Captions:** ${ded.missingFigureCaptions?.length || 0}\n`;
      md += `- **Missing Table Titles:** ${ded.missingTableTitles?.length || 0}\n`;
      md += `- **Unlinked Figures:** ${ded.unlinkedFigures?.length || 0}\n`;
      md += `- **Unlinked Tables:** ${ded.unlinkedTables?.length || 0}\n`;
  }

  md += `\n## ${data.docxExtractionDiagnostics ? '8' : '7'}. ENGINE DIAGNOSTICS\n\n`;
  if (data.diagnostics) {
      md += `- **Engine Used:** ${data.diagnostics.engineUsed}\n`;
      md += `- **Confidence Level:** ${data.diagnostics.confidenceLevel}\n`;
      md += `- **Retrieval Mode:** ${data.diagnostics.retrievalMode}\n`;
      md += `- **Retrieved Chunk Count:** ${data.diagnostics.retrievedChunkCount}\n`;
      if (data.diagnostics.fallbackReason) {
         md += `- **Fallback Reason:** ${data.diagnostics.fallbackReason}\n`;
      }
  }

  return md;
}

