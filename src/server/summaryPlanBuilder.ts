export function cleanSummaryForPrompt(rawSummary: string): string {
    if (!rawSummary) return '';
    
    const labelsToRemove = [
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Summary:/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Purpose\/Scope:/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Background(?:\/Description(?: of Non-Conformance)?)?:/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Description of Non-Conformance:/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Impact\/Risk:/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Corrective Action:/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Problem:/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Cause:/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Solution:/img,
        /^\s*(?:[A-Za-z0-9]+\.|o|-|\*)?\s*Benefit:/img,
    ];

    let cleaned = rawSummary;
    for (const regex of labelsToRemove) {
        cleaned = cleaned.replace(regex, "");
    }
    
    // Clean up excessive blank lines left over
    cleaned = cleaned.replace(/\n\s*\n+/g, '\n\n').trim();

    return cleaned;
}
