const fs = require('fs');

function removeBanner(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Remove handleFillManually
  content = content.replace(/\s*const handleFillManually = \(\) => onChange\(prev => editComponents\(prev, EMPTY\)\);/g, '');
  content = content.replace(/\s*const handleFillManually = \(\) => onChange\(prev => editComponents\(prev, EMPTY_COMPONENTS\)\);/g, '');

  // Remove EmptySectionStart import
  content = content.replace(/EmptySectionStart,\s*/, '');
  content = content.replace(/,\s*EmptySectionStart/, '');
  content = content.replace(/EmptySectionStart/, '');

  // Remove hasComponents boolean
  content = content.replace(/\s*const hasComponents = [^;]+;/g, '');

  // Remove the block
  // We need to carefully remove {!hasComponents && ...} and {hasComponents && ( ... )}
  
  // The first block:
  const blockStart = content.indexOf('{!hasComponents && (');
  if (blockStart !== -1) {
    let openCount = 0;
    let blockEnd = -1;
    for (let i = blockStart; i < content.length; i++) {
      if (content[i] === '{') openCount++;
      if (content[i] === '}') {
        openCount--;
        if (openCount === 0) {
          blockEnd = i;
          break;
        }
      }
    }
    if (blockEnd !== -1) {
      content = content.substring(0, blockStart) + content.substring(blockEnd + 1);
    }
  }

  // The second block wrapper {hasComponents && ( ... )}
  // We just want to remove `{hasComponents && (` and the closing `)}` at the very end of that block.
  // Wait, there might be other things. Let's just use regex to replace `{hasComponents && (` and find the matching `)}`.
  
  const hasCompStart = content.indexOf('{hasComponents && (');
  if (hasCompStart !== -1) {
    let openCount = 0;
    let hasCompEnd = -1;
    for (let i = hasCompStart; i < content.length; i++) {
      if (content[i] === '(') openCount++; // Wait, the block starts with '{hasComponents && (' which has '{' and '('.
      // Actually it's easier to count { and } since it's a JSX expression.
    }
  }
}
