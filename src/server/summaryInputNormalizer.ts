export function summaryInputNormalizer(rawText: string): string {
    if (!rawText) return "";
    let cleanText = rawText;

    // Remove labels
    const labels = [
        "Summary:",
        "Purpose/Scope:",
        "Background:",
        "Background/Description:",
        "Background/Description of Non-Conformance:",
        "Description of Non-Conformance:",
        "Impact/Risk:",
        "Corrective Action:",
        "Problem:",
        "Cause:",
        "Solution:",
        "Benefit:",
    ];
    
    // Remove numbered labels
    const numberedPrefixes = /^\s*(?:\d+\.|[ivxIVX]+\.|[a-zA-Z]\.)\s*(Summary|Purpose\/Scope|Background.*|Description.*|Impact.*|Corrective.*|Problem|Cause|Solution|Benefit):?/gm;
    cleanText = cleanText.replace(numberedPrefixes, '');

    for (const label of labels) {
        const regex = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gim');
        cleanText = cleanText.replace(regex, '');
    }

    // Convert bulleted lists to natural phrases (comma separated)
    // Find blocks of bullets
    const bulletRegex = /(?:^|\n)\s*(?:[-•o]|\d+\.|[ivxIVX]+\.)\s+(.+)/g;
    
    let match;
    let items = [];
    let lastIndex = 0;
    let replacedText = cleanText;

    // A simpler approach for bullet smoothing is just to replace "\n- " with ", " 
    // We will do a basic replacement of standard bullets into a comma separated list.
    replacedText = replacedText.replace(/(?:^|\n)\s*(?:[-•o]|\d+\.|[ivxIVX]+\.)\s+([^\n]+)/g, (m, p1) => {
        return `, ${p1.trim()}`;
    });

    // Clean up excessive commas or spaces
    replacedText = replacedText.replace(/\s*,\s*,/g, ',');
    replacedText = replacedText.replace(/:\s*,/g, ':');
    replacedText = replacedText.replace(/\.\s*,/g, '.');

    return replacedText.trim() || rawText;
}
