const fs = require('fs');

const technicalAlertFiles = [
  'src/components/technical-alert/v2/SummaryWorkspace.tsx',
  'src/components/technical-alert/v2/ReasonsWorkspace.tsx',
  'src/components/technical-alert/v2/ImmediateActionWorkspace.tsx',
  'src/components/technical-alert/v2/FollowUpActionWorkspace.tsx'
];

const announcementFiles = [
  'src/components/announcement/SummaryWorkspace.tsx',
  'src/components/announcement/ReasonWorkspace.tsx',
  'src/components/announcement/ActionWorkspace.tsx'
];

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Remove EmptySectionStart import
  content = content.replace(/EmptySectionStart,\s*/g, '');
  content = content.replace(/,\s*EmptySectionStart/g, '');
  content = content.replace(/EmptySectionStart/g, '');

  // Remove handleFillManually
  content = content.replace(/\s*const handleFillManually[^;]+;/g, '');

  // Remove hasComponents boolean definition
  content = content.replace(/\s*const hasComponents = workspace\.analysis\.components !== null;/g, '');
  content = content.replace(/\s*const hasComponents = \[\] !== null;/g, ''); // just in case

  // Remove the `{!hasComponents && ... }` block
  const startBanner = content.indexOf('{!hasComponents && (');
  if (startBanner !== -1) {
    let openCount = 0;
    let endBanner = -1;
    for (let i = startBanner; i < content.length; i++) {
      if (content[i] === '{') openCount++;
      if (content[i] === '}') {
        openCount--;
        if (openCount === 0) {
          endBanner = i;
          break;
        }
      }
    }
    if (endBanner !== -1) {
      content = content.substring(0, startBanner) + content.substring(endBanner + 1);
    }
  }

  // Remove the `{hasComponents && (` prefix and the matching `)}`
  const hasCompIndex = content.indexOf('{hasComponents && (');
  if (hasCompIndex !== -1) {
    let openCount = 0;
    let hasCompEnd = -1;
    // We are looking for the `)` corresponding to the `(` right after `{hasComponents && `
    let parenOpenCount = 0;
    let startParenIndex = -1;
    for (let i = hasCompIndex; i < content.length; i++) {
      if (content[i] === '{') openCount++;
      if (content[i] === '}') {
        openCount--;
        if (openCount === 0) {
          hasCompEnd = i;
          break;
        }
      }
    }
    
    if (hasCompEnd !== -1) {
      // Actually {hasComponents && ( <div...> </div> )} 
      // Replace `{hasComponents && (` with empty string
      // and replace `)}` at the end of the block with `}` ? No, the whole thing is an expression inside {}.
      // Wait, let's just do text replacement if possible.
      // We can find `{hasComponents && (`
      // Find the closing `)}`
      
      const textToReplacePrefix = '{hasComponents && (';
      
      // Let's find the exact block end by counting { }
      let curlyOpenCount = 0;
      let blockEndIndex = -1;
      for (let i = hasCompIndex; i < content.length; i++) {
        if (content[i] === '{') curlyOpenCount++;
        if (content[i] === '}') {
          curlyOpenCount--;
          if (curlyOpenCount === 0) {
            blockEndIndex = i;
            break;
          }
        }
      }
      
      // Now block ends at blockEndIndex. It should be `)}` right before or at it.
      // Let's replace `{hasComponents && (` with ``
      // And the `)}` at the end with ``
      
      // Actually, since we're generating JSX, we can just replace {hasComponents && ( with <> and )} with </>
      const beforeComp = content.substring(0, hasCompIndex);
      const afterComp = content.substring(blockEndIndex + 1);
      const insideBlock = content.substring(hasCompIndex + '{hasComponents && ('.length, blockEndIndex);
      
      // insideBlock might end with `)`
      let cleanInside = insideBlock.trim();
      if (cleanInside.endsWith(')')) {
        cleanInside = cleanInside.substring(0, cleanInside.length - 1);
      }
      
      content = beforeComp + cleanInside + afterComp;
    }
  }

  fs.writeFileSync(file, content);
  console.log('Processed', file);
}

[...technicalAlertFiles, ...announcementFiles].forEach(processFile);

