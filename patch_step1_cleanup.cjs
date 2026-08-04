const fs = require('fs');
let code = fs.readFileSync('src/components/Step1Context.tsx', 'utf8');

// Remove effectiveDateError and validateEffectiveDate declarations
code = code.replace(/  const \[effectiveDateError, setEffectiveDateError\] = useState<string \| null>\(null\);\n/, '');
code = code.replace(/  const validateEffectiveDate = \([\s\S]*?return null;\n  };\n\n/, '');

// Remove dateErr from handleNextClick
code = code.replace(/      const dateErr = validateEffectiveDate\(formData\.fcoDraft\?\.fcoMetadata\.effectiveDate \|\| formData\.effectiveDate\);\n      setEffectiveDateError\(dateErr\);\n\n/, '');

// Another one in handleNextClick's else block
code = code.replace(/      const dateErr = validateEffectiveDate\(formData\.fcoDraft\?\.fcoMetadata\.effectiveDate \|\| formData\.effectiveDate\);\n      setEffectiveDateError\(dateErr\);\n      if \(dateErr\) \{\n        return;\n      \}\n/, '');

// Update the condition
code = code.replace(/      if \(!title \|\| !priority \|\| !affectedEquipment \|\| dateErr\) \{/, '      if (!title || !priority || !affectedEquipment) {');

fs.writeFileSync('src/components/Step1Context.tsx', code);
