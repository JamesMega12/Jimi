import fs from 'fs';
import path from 'path';
import { InstructionPack, InstructionTrace } from './types';
import { defaultSummaryPack } from './defaultSummaryPack';
import { defaultProcedurePack } from './defaultProcedurePack';
import { getActiveRegistry } from './activeRegistryService';

/**
 * Loads an instruction pack by its scope.
 * It checks the active registry first.
 */
export async function loadInstructionPack(scope: "summary" | "procedure"): Promise<InstructionPack> {
  const registry = getActiveRegistry();
  const scopeConfig = registry[scope];

  if (scopeConfig.source === 'configured') {
    const draftPath = path.join(process.cwd(), 'data', 'instructionPacks', 'drafts', `${scopeConfig.activePackId}.json`);
    try {
      if (fs.existsSync(draftPath)) {
        const content = fs.readFileSync(draftPath, 'utf-8');
        const draftData = JSON.parse(content);
        return {
          id: draftData.id,
          name: draftData.name,
          scope: draftData.scope,
          version: draftData.version,
          status: 'active',
          content: draftData.content,
          description: draftData.description
        };
      } else {
        console.warn(`Configured pack ${scopeConfig.activePackId} not found, falling back to bundled default.`);
      }
    } catch (err) {
      console.error(`Failed to load configured pack ${scopeConfig.activePackId}, falling back to bundled default:`, err);
    }
  }

  // Fallback or explicit bundled_default
  if (scope === "summary") {
    return defaultSummaryPack;
  }
  
  if (scope === "procedure") {
    return defaultProcedurePack;
  }
  
  throw new Error(`Unknown instruction pack scope: ${scope}`);
}

/**
 * Retrieves the current instruction trace metadata.
 */
export async function getInstructionTrace(): Promise<InstructionTrace> {
  const registry = getActiveRegistry();
  
  let summaryPackSource: "bundled_default" | "configured" = "bundled_default";
  let summaryPackId = defaultSummaryPack.id;
  let summaryPackVersion = defaultSummaryPack.version;
  
  try {
    const sPack = await loadInstructionPack("summary");
    summaryPackId = sPack.id;
    summaryPackVersion = sPack.version;
    summaryPackSource = registry.summary.source === 'configured' && sPack.id !== defaultSummaryPack.id ? 'configured' : 'bundled_default';
  } catch (e) {}

  let procedurePackSource: "bundled_default" | "configured" = "bundled_default";
  let procedurePackId = defaultProcedurePack.id;
  let procedurePackVersion = defaultProcedurePack.version;
  
  try {
    const pPack = await loadInstructionPack("procedure");
    procedurePackId = pPack.id;
    procedurePackVersion = pPack.version;
    procedurePackSource = registry.procedure.source === 'configured' && pPack.id !== defaultProcedurePack.id ? 'configured' : 'bundled_default';
  } catch (e) {}

  return {
    summaryPack: {
      id: summaryPackId,
      version: summaryPackVersion,
      source: summaryPackSource
    },
    procedurePack: {
      id: procedurePackId,
      version: procedurePackVersion,
      source: procedurePackSource
    }
  };
}
