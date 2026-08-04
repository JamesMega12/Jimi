import http from 'http';

const data = JSON.stringify({
  title: "Replace Synthetic Pump Access Cover",
  priority: "Required",
  changeType: "Physical / Hardware Change",
  affectedEquipment: "Model X-100 Pump Assembly",
  appliesTo: "All Model X-100 Pump Assemblies in active field service",
  effectiveDate: "01-07-2026",
  productionStart: "All active units before 2026",
  rawSummary: "The old pump access cover has been found to be defective under high pressure. We need to replace it with the new part to prevent leaks and improve reliability.",
  rawProcedure: "1. Turn off main power.\n2. Depressurize the system.\n3. Remove the 4 bolts on the old cover.\n4. Take off the old cover.\n5. Install the new cover (Part #998877).\n6. Tighten the 4 bolts.\n7. Restore power and verify no leaks.",
  fcoDraft: {
    fcoMetadata: {
      fcoTitle: "Replace Synthetic Pump Access Cover",
      priority: "Required"
    },
    technicalContent: {
      draftSummary: "The old pump access cover has been found to be defective under high pressure. We need to replace it with the new part to prevent leaks and improve reliability.",
      draftProcedure: "1. Turn off main power.\n2. Depressurize the system.\n3. Remove the 4 bolts on the old cover.\n4. Take off the old cover.\n5. Install the new cover (Part #998877).\n6. Tighten the 4 bolts.\n7. Restore power and verify no leaks.",
    }
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/fco/rewrite',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log(JSON.stringify(parsed.diagnostics, null, 2));
    } catch(e) {
      console.log("Failed to parse response body:");
      console.log(body);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
