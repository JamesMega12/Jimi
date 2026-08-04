const pdf = require('pdf-parse');
const fs = require('fs');
async function run() {
   const buf = fs.readFileSync('src/server/data/uploads/STE_QRG_6861590_AC-Sep-2022 Online_6861590_01.pdf');
   const data = await pdf(buf);
   console.log(data.text.substring(0, 500));
}
run();
