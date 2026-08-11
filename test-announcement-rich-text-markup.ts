// Unit tests for the rich content markup parser (Phase 5): bold/italic/link
// span extraction, one-level nested list parsing, and the plain-paragraph
// fallback when no markup is present. Pure, framework-free.
// Run: npx tsx test-rich-text-markup.ts

import { parseInlineSpans, parseRichText, RichBlock } from "./src/components/announcement/richTextMarkup";

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

console.log("\nparseInlineSpans:");
{
  assert(
    JSON.stringify(parseInlineSpans("plain text")) === JSON.stringify([{ text: "plain text" }]),
    "plain text with no markup -> a single unformatted span"
  );

  const bold = parseInlineSpans("do **not order** this");
  assert(bold.length === 3 && bold[1].text === "not order" && bold[1].bold === true && !bold[1].italic, "bold span extracted with surrounding text preserved");

  const italic = parseInlineSpans("this is *emphasized* text");
  assert(italic.some((s) => s.text === "emphasized" && s.italic === true && !s.bold), "italic span extracted");

  const link = parseInlineSpans("see [the standard](https://example.com/std) for details");
  const linkSpan = link.find((s) => s.href);
  assert(!!linkSpan && linkSpan.text === "the standard" && linkSpan.href === "https://example.com/std", "link span extracted with text and href");

  const mixed = parseInlineSpans("**Old Part:** grease fitting — *Do Not order*.");
  assert(mixed[0].text === "Old Part:" && mixed[0].bold === true, "bold label prefix extracted");
  assert(mixed.some((s) => s.italic && s.text === "Do Not order"), "italic clause extracted alongside a bold prefix in the same string");

  assert(parseInlineSpans("").length === 1 && parseInlineSpans("")[0].text === "", "empty string -> single empty span, no crash");
}

console.log("\nparseRichText -- plain-paragraph fallback:");
{
  const blocks = parseRichText("Just a plain sentence with no markup at all.");
  assert(blocks.length === 1 && blocks[0].type === "paragraph", "plain text with no markup produces exactly one paragraph block");

  const twoParas = parseRichText("First paragraph.\n\nSecond paragraph.");
  assert(twoParas.length === 2 && twoParas.every((b) => b.type === "paragraph"), "blank-line-separated text stays two separate paragraphs (extends the old \\n{2,} split)");

  const wrapped = parseRichText("This sentence\nwraps onto a second line.");
  assert(wrapped.length === 1 && wrapped[0].type === "paragraph", "a single soft-wrapped line (no blank line) stays one paragraph");
}

console.log("\nparseRichText -- one-level nested lists:");
{
  const flat = parseRichText("- item one\n- item two\n- item three");
  assert(flat.length === 1 && flat[0].type === "list" && (flat[0] as any).items.length === 3, "three flat bullet lines -> one list block with 3 items");

  const nested = parseRichText("All existing iron must be recorded.\n- All new iron must be added.\n- Record CoC regardless of who inspected.");
  assert(nested.length === 2 && nested[0].type === "paragraph", "a lead-in paragraph followed by bullets stays a separate paragraph block");
  const listBlock = nested[1] as Extract<RichBlock, { type: "list" }>;
  assert(listBlock.type === "list" && listBlock.items.length === 2, "bullets after the paragraph form a 2-item list block");

  const subNested = parseRichText("- Assign Action Items\n  - DGM\n  - BL PSD\n  - TLM / Maintenance Manager\n- Leadership Review");
  const blocks2 = subNested;
  assert(blocks2.length === 1 && blocks2[0].type === "list", "top items + indented sub-items still form a single list block");
  const items = (blocks2[0] as Extract<RichBlock, { type: "list" }>).items;
  assert(items.length === 2, "two top-level items (Assign Action Items, Leadership Review)");
  assert((items[0].subItems?.length ?? 0) === 3, "first item carries 3 nested sub-items (one level of nesting)");
  assert(items[0].subItems![2][0].text === "TLM / Maintenance Manager", "sub-item text preserved in order");
  assert(!items[1].subItems, "second item (no indented lines under it) has no sub-items");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
