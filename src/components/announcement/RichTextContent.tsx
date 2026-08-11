import React from "react";
import { RichSpan, parseRichText } from "./richTextMarkup";

// Client-side renderer for the rich content markup (Phase 5): bold/italic/
// links + one level of nested bullets. Used wherever Summary/Reason/Action
// content is displayed (accepted cards, suggestion preview, Final Review) so
// authored **bold**/*italic*/[link](url)/"- " markup actually renders instead
// of showing as literal characters.

function SpanView({ span }: { span: RichSpan }) {
  let node: React.ReactNode = span.text;
  if (span.bold) node = <strong>{node}</strong>;
  if (span.italic) node = <em>{node}</em>;
  if (span.href) {
    node = (
      <a href={span.href} target="_blank" rel="noreferrer" className="text-teal-700 underline hover:text-teal-800">
        {node}
      </a>
    );
  }
  return <>{node}</>;
}

export function RichTextContent({ text, className }: { text: string; className?: string }) {
  const blocks = parseRichText(text);
  return (
    <div className={className ?? "space-y-2"}>
      {blocks.map((block, i) =>
        block.type === "paragraph" ? (
          <p key={i} className="text-sm leading-relaxed">
            {block.spans.map((s, j) => (
              <React.Fragment key={j}>
                <SpanView span={s} />
              </React.Fragment>
            ))}
          </p>
        ) : (
          <ul key={i} className="list-disc pl-5 text-sm space-y-1">
            {block.items.map((item, j) => (
              <li key={j}>
                {item.spans.map((s, k) => (
                  <React.Fragment key={k}>
                    <SpanView span={s} />
                  </React.Fragment>
                ))}
                {item.subItems && item.subItems.length > 0 && (
                  <ul className="list-disc pl-5 mt-1">
                    {item.subItems.map((sub, k) => (
                      <li key={k}>
                        {sub.map((s, l) => (
                          <React.Fragment key={l}>
                            <SpanView span={s} />
                          </React.Fragment>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
