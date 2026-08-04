const p = "This urgent Field Change Order (FCO) requires immediate field execution to Replace the faulty gasket to prevent leak.";
const expectedPrefix = "This urgent Field Change Order (FCO) requires immediate field execution to";
let paragraph = p.replace(/^This (urgent|required|preferred) FCO .*? to/i, '').trim();
paragraph = paragraph.replace(/^This (urgent|required|preferred) Field Change Order \(FCO\) .*? to/i, '').trim();

if (paragraph.length > 0) {
    if (paragraph.charAt(0) === paragraph.charAt(0).toUpperCase() && paragraph.charAt(1) !== paragraph.charAt(1).toUpperCase()) {
        paragraph = expectedPrefix + " " + paragraph.charAt(0).toLowerCase() + paragraph.slice(1);
    } else {
        paragraph = expectedPrefix + " " + paragraph;
    }
} else {
    paragraph = expectedPrefix + " ... [Information required from submitter]";
}
console.log(paragraph);
