const fs = require('fs');
const file = 'src/components/Step3Review.tsx';
let content = fs.readFileSync(file, 'utf8');

// add useState
content = content.replace("import React from 'react';", "import React, { useState } from 'react';");

// find start of component
const componentStart = "export default function Step3Review({ apiResponse, rawProcedureText, onStartNew, formData, developerMode, onUpdateFormData }: Step3ReviewProps) {";

// add state inside component
const stateCode = `
  const [isAccepted, setIsAccepted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const handleAccept = () => {
    if (onUpdateFormData && apiResponse) {
      onUpdateFormData({
        ...formData,
        fcoDraft: {
          ...formData.fcoDraft!,
          technicalContent: {
            ...formData.fcoDraft!.technicalContent,
            acceptedSummary: apiResponse.rewrittenSummary.paragraph,
            acceptedProcedure: buildDisplayProcedure(apiResponse.rewrittenProcedure, formData.fcoDraft?.technicalContent?.procedureReadinessSuggestions || [])
          }
        }
      });
      setIsAccepted(true);
    }
  };
  
  const handleDismiss = () => {
    onStartNew();
  };
`;
content = content.replace(componentStart, componentStart + stateCode);

fs.writeFileSync(file, content);
