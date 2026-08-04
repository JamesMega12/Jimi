fetch('http://localhost:3000/api/fco/suggest-title', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    draftSummary: "Replace the leaking seal on the pump.",
    baseProductCode: "AUTOPROFILER",
    fcoNumber: "8299443"
  })
}).then(r => r.json()).then(console.log).catch(console.error);
