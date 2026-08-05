# System-owned knowledge source

Jimi's FCO rewrite path (`POST /api/fco/rewrite`, `server.ts`) retrieves relevant
writing-guidance passages from a knowledge base and injects them into the Gemini
prompt as advisory context (`src/server/groundingContextBuilder.ts`). This document
describes the **system-owned** tier of that knowledge base: a source registered in
`data/systemKnowledge/manifest.json`, ingested automatically on server start,
persisted across restarts, and always eligible for retrieval regardless of the
legacy `retrievalMode` toggle -- distinct from a user uploading a reference
document through `SourceTruthAdminPage.tsx`.

As of this writing, `data/systemKnowledge/manifest.json` declares one entry: a
small, clearly-labelled **synthetic test fixture**
(`data/systemKnowledge/sources/synthetic-ste-fixture-v1.md`) used to validate the
whole pipeline before the real approved STE handbook is available. It contains
only original test content, is not a real SLB or ASD-STE100 standard, and must be
removed once the real handbook is ingested (steps below).

**Scope note:** only the FCO rewrite path consumes retrieval today. Technical
Alert and Announcement do not -- see "Known limitations" below.

## Architecture

```
data/systemKnowledge/
  manifest.json                    # declares sources: id, name, version, file, docType, enabled
  sources/<file>                   # the source itself (.md/.txt/.pdf/.docx), committed
  normalized/<base>.normalized.md  # auto-generated Markdown-shaped cache, committed
  normalized/<base>.override.md    # optional hand-correction, takes precedence if present

src/server/systemKnowledge/
  types.ts                    # SystemKnowledgeManifestEntry, SystemKnowledgeSourceStatus, KnowledgeProvenance
  manifest.ts                 # manifest/paths/hashing
  sourceNormalizer.ts         # PDF/DOCX/MD/TXT -> Markdown-shaped text (## headings + blank-line paragraphs)
  systemKnowledgeService.ts   # orchestrates normalize -> chunk -> embed -> persist, idempotently

src/server/routes/systemKnowledgeRoutes.ts   # /api/knowledge/system/* (dev-gated diagnostics)
scripts/systemKnowledge.ts                   # CLI: sync / status / convert
```

Ingested sources are stored as `KBDocument`/`KBChunk` records in the existing
`src/server/data/kb_documents.json` / `kb_chunks.json` files (same store the
legacy user-upload path uses), tagged `sourceType: 'system_knowledge'`. This
reuses the existing storage, chunking (`chunkingService.ts`), embedding
(`embeddingService.ts`), and retrieval (`retrievalService.ts`) code rather than
building a second store.

### Why a normalization step exists

`chunkExtractedText` (`chunkingService.ts`, unchanged by this feature) already
knows how to chunk on `##` headings and blank-line-separated paragraphs -- that's
its default path. The legacy upload extractor (`textExtractionService.ts`) never
gives it that shape: it strips every blank line, and raw PDF text has no `#`
markers, so every prior real upload collapsed into one `"General Guidelines"`
section with blind 400-word cuts (visible today in `kb_documents.json`'s
previously-uploaded SLB handbook, all 352 chunks under that one label).
`sourceNormalizer.ts` is a boundary in front of the chunker that converts
PDF/DOCX/MD/TXT into the Markdown shape the chunker was designed for, so real
section titles survive into chunk metadata. It is best-effort for PDF (heading
detection, header/footer stripping, and paragraph reconstruction are heuristics,
not a layout engine) -- see "Known limitations."

### Identity, versioning, change detection

Each manifest entry's `id` is the permanent `KBDocument` id across re-ingests
(never a random id). Re-ingestion is skipped when a fingerprint --
`sha256(normalized text) + ingestion-config-version + active-embedding-backend-id`
-- matches the already-indexed record. Any of the three changing (source edited,
chunking rules bumped via `INGESTION_CONFIG_VERSION` in
`systemKnowledgeService.ts`, or the embedding backend switching) triggers
re-ingestion automatically, replacing the chunk set atomically
(`replaceDocumentChunks`) so stale chunks from a previous version cannot linger.

### Retrieval-time kill switch vs. ingestion-time disable

Two distinct mechanisms, both safe:
- `SYSTEM_KNOWLEDGE_DISABLED=true` (env var) -- retrieval-time only, does not
  touch the persisted index. `retrieveRelevantChunks` returns
  `provenance.status: 'disabled'` immediately. Flip it off and retrieval works
  again with no re-ingestion needed. This is the mechanism used to prove Case 3
  below.
- `"enabled": false` on a manifest entry -- ingestion-time. The next sync removes
  that source's chunks entirely. Used to retire a source permanently (e.g. the
  synthetic fixture, once real handbook is live) without deleting its manifest
  entry outright.

## Replacing the synthetic fixture with the approved handbook

1. **Place the file.** Put the approved PDF (or DOCX) at
   `data/systemKnowledge/sources/<name>.pdf`. Commit it -- per project decision,
   the approved handbook is a versioned deployment asset in this repo, the same
   way `data/systemKnowledge/sources/synthetic-ste-fixture-v1.md` is today.
2. **Convert and inspect.**
   ```
   npm run knowledge:convert
   ```
   Writes `data/systemKnowledge/normalized/<name>.normalized.md`. **Read it.**
   This is the actual text the chunker will see. If a multi-column section or a
   table extracted badly, copy the normalized file to
   `data/systemKnowledge/normalized/<name>.override.md` and hand-correct it --
   the override always wins over the auto-generated version, and is never
   silently overwritten.
3. **Update the manifest.** Edit `data/systemKnowledge/manifest.json`: point the
   entry's `file` at the new source, bump `version`, drop `"synthetic": true`
   (or replace the whole entry -- `id` can stay the same to preserve history, or
   change if you want a clean identity for the real handbook).
4. **Ingest.**
   ```
   npm run knowledge:sync
   ```
   (Or just restart the app -- the bootstrap hook in `server.ts` calls this on
   every start automatically, skipping unchanged sources.)
5. **Verify extraction succeeded.**
   ```
   npm run knowledge:status
   ```
   Confirms `status: indexed`, chunk count, content hash, and any
   `normalizationWarnings` (`no_headings_detected`, `repeated_lines_stripped:N`,
   `low_paragraph_density`) -- a non-empty warnings list here means look at the
   normalized file again before trusting retrieval quality.
6. **Confirm the expected number of chunks was created.** `knowledge:status`'s
   `chunks=N` line, or `GET /api/knowledge/system/status` (requires
   `NODE_ENV!=production` or `ENABLE_DEVELOPER_KNOWLEDGE_ENDPOINT=true` /
   `ENABLE_KNOWLEDGE_DEMO_MODE=true`, same gate as the existing
   `/api/fco/instruction-packs/*` routes). There is no pre-set "expected" count
   for a 100+ page document yet -- establish a baseline on first successful
   ingest and watch for it moving unexpectedly on later re-ingests.
7. **Confirm which version is active.** `knowledge:status` / `GET .../status`
   report `version` and `contentHash` per source.
8. **Inspect column/table extraction failures.**
   `POST /api/knowledge/system/extract-preview {"sourceId": "<id>"}` runs
   normalization + chunking WITHOUT embedding or indexing -- returns
   `sectionTitles[]` (spot-check these look like real headings, not garbled
   fragments) and `warnings[]`, safe to call repeatedly.
9. **Confirm persistence after restart.** Stop and restart with the project's
   normal dev workflow (`npm run dev`; on Windows, `netstat -ano | grep ":3000"
   | grep LISTENING` then `taskkill //PID <pid> //F` to stop it -- `Ctrl-C` /
   killing the `npm` wrapper PID does not reliably kill the underlying `tsx`
   process, see `.claude/skills/run-techcom-workspace/SKILL.md`). Run
   `npm run knowledge:status` again: same source id, same version, same content
   hash, same `indexedAt` timestamp -- an unchanged `indexedAt` is the proof
   nothing was silently re-embedded.
10. **Restore the previous version if ingestion fails.** The prior source file,
    manifest entry, and normalized/override files are all in git history --
    `git checkout <prior-commit> -- data/systemKnowledge/` and
    `npm run knowledge:sync --force` (or restart). The KB store keeps the last
    successfully indexed chunk set for a source until a *new* successful ingest
    replaces it; a failed ingest attempt sets `status: 'failed'` with
    `errorMessage` but does not clear the previously-indexed chunks.
11. **Remove the synthetic fixture.** Delete its entry from
    `data/systemKnowledge/manifest.json` and delete
    `data/systemKnowledge/sources/synthetic-ste-fixture-v1.md` (and its
    `normalized/` cache file, if present). The next sync (or restart) prunes its
    `KBDocument`/`KBChunk` records automatically. Confirm with:
    ```
    grep -r "approx-QX7" src/server/data/ data/systemKnowledge/
    ```
    which should return nothing once removal is complete.

## Observability

`retrieveRelevantChunks` (`retrievalService.ts`) returns a `provenance` object on
every call:

```ts
{
  status: 'ok' | 'empty' | 'disabled' | 'error',
  systemSources: [{ id, name, version, contentHashShort, chunkCount }],
  searchedChunkCount: number,
  embeddingBackend: string,
  backendMismatchCount: number,   // chunks embedded under a different backend than the current query -- see below
  error?: string,
}
```

`'empty'` (nothing indexed) and `'error'` (retrieval itself broke) are
distinguishable from each other and from a genuinely relevant-but-not-found
result -- previously all three collapsed into a single `console.warn` inside
`processRewrite`. The FCO rewrite response's `grounding` field surfaces this as
`grounding.systemKnowledge` and `grounding.retrievalStatus`, and every retrieval
also emits a structured `logEvent('info'|'error', 'knowledge_retrieval', {...})`
line -- chunk ids and scores only, never chunk text or user content, per
`logger.ts`'s existing privacy contract.

**Embedding backend mismatch** (`backendMismatchCount`): each chunk records which
embedding backend produced its vector (`gemini-text-embedding-004`, 768-dim, or
`local-hashed-bow-v1`, 256-dim -- see `embeddingService.ts`). If the currently
active backend differs from a chunk's recorded one, that chunk cannot be
meaningfully scored against a fresh query embedding (cosine similarity between
different-dimension vectors is defined as 0 by `retrievalService.ts`); previously
this failed **silently**. Now it is counted and surfaced as a `retrievalWarnings`
entry ("N indexed chunk(s) were embedded with a different backend... Reindex to
fix.") -- run `POST /api/kb/documents/reindex-all` (existing legacy route) to
re-embed everything under the current backend.

## Development-mode diagnostic routes (`/api/knowledge/system/*`)

Gated behind the same check as the existing `/api/fco/instruction-packs/*` /
`/api/fco/ste-guidance/*` routes (`NODE_ENV!=production` OR
`ENABLE_DEVELOPER_KNOWLEDGE_ENDPOINT=true` OR `ENABLE_KNOWLEDGE_DEMO_MODE=true`):

| Route | Purpose |
|---|---|
| `GET /status` | Manifest + ingestion state per source: hash, chunk count, warnings, `indexedAt`. |
| `POST /sync {force?}` | Ingest every enabled source (skips unchanged unless `force`). |
| `POST /extract-preview {sourceId}` | Normalize + chunk WITHOUT indexing -- inspect section detection before committing. |
| `POST /retrieval-probe {query}` | Run real hybrid retrieval against the current index; returns chunk ids/scores/sections. |

None of these expose full document text to the frontend by default (`status` and
`extract-preview` return metadata and section titles, not full chunk bodies);
`retrieval-probe` does return matched chunk text previews (240 chars) for
debugging, same as the existing `/api/kb/test-retrieval` route's precedent.

## Test suite

`npm test` (`test-runner.mjs`, unchanged) globs `test-fco-unit-*.ts` and picked up
five new files automatically, all offline / deterministic / no API key (they
force the local hashed-embedding fallback and point `JIMI_KB_DATA_DIR` /
`JIMI_SYSTEM_KNOWLEDGE_DIR` at a scratch temp directory per run --
`test-support/systemKnowledgeTestHarness.ts`):

| File | Proves |
|---|---|
| `test-fco-unit-system-knowledge-ingestion.ts` | Chunking, real section titles (not the `"General Guidelines"` catch-all), metadata, stable id, content hash. |
| `test-fco-unit-system-knowledge-retrieval.ts` | Case 1 (temperature), Case 2 (canary), Case 4 (non-applicable, via self-vs-unrelated score discrimination). |
| `test-fco-unit-system-knowledge-disabled.ts` | Case 3: the kill switch is retrieval-time only and does not mutate the index. |
| `test-fco-unit-system-knowledge-change-detection.ts` | Case 6: no-op skip on unchanged source; automatic re-ingest + stale-chunk removal on a mutated one. |
| `test-fco-unit-system-knowledge-provenance.ts` | `ok`/`empty`/`disabled`/`error` are mutually distinguishable; logs never leak chunk text. |

Case 5 (restart persistence) and a live-model end-to-end check are manual --
see step 9 above, and `test_manual_system_knowledge_rewrite.ts` (requires
`GEMINI_API_KEY`, intentionally excluded from `test-runner.mjs`'s glob since that
runner's own header comment requires "no server, no API key" for everything it
picks up).

## Known limitations for the real, ~100+ page handbook

A passing synthetic-fixture test proves the *pipeline*, not readiness for the
real document. Specifically still unvalidated until the real handbook is
ingested and reviewed:

- **Multi-column reading order.** `pdf-parse`'s `getText()` returns a flat text
  stream; `sourceNormalizer.ts`'s heuristics operate on that stream and cannot
  reconstruct true column order if the extractor interleaves columns.
- **Tables split across pages / large tables.** The normalizer's PDF path has no
  table-cell reconstruction (DOCX does, via the reused `docxParserService.ts`
  table logic) -- a PDF table currently degrades to plain paragraph text.
- **Repeated headers/footers and page numbers.** Handled by a frequency
  heuristic (a line repeating on >=40% of pages is stripped) and a page-number
  regex -- tune the thresholds in `sourceNormalizer.ts` if the real handbook's
  running headers don't repeat verbatim.
- **Chapter/subsection detection.** Heading detection is regex-based (numbered
  headings, "Chapter N", short ALL-CAPS lines) -- verify via
  `extract-preview`'s `sectionTitles[]` that real chapter titles are actually
  recognized, not swallowed into `"General Guidelines"`.
- **Chunk boundaries separating a rule from its exception/example.** The
  underlying chunker (`chunkingService.ts`, unchanged) has zero chunk overlap
  and a flat 400-word cap on the default path -- a rule and its immediately
  following exception can land in different chunks with no cross-reference.
- **Ingestion time at 100+ pages.** Not yet measured; the embedding step is one
  sequential API call per chunk (`documentIngestionService.ts`'s existing
  pattern, reused by `systemKnowledgeService.ts`) -- for hundreds of chunks with
  a real Gemini key this could take minutes, not the near-instant local-fallback
  ingest seen with the 5-chunk synthetic fixture.
- **Duplicate/overlapping chunks, metadata accuracy, partial-ingestion
  failures.** Not exercised by a 5-chunk fixture; watch `normalizationWarnings`
  and chunk-count sanity on the first real ingest.

If the extractor turns out to be inadequate for the real handbook's layout, the
fix is scoped to `sourceNormalizer.ts` (or its two normalize functions) --
`systemKnowledgeService.ts` and everything downstream (chunking, embedding,
storage, retrieval) only ever sees the normalized text, not the source format,
so the extractor can be replaced without touching the retrieval layer.

## Deferred: Technical Alert and Announcement

Both workflows currently get their STE guidance from hardcoded rules
(`src/server/technicalAlertSteRules.ts`, transcribed from the real handbook) and
static prompt text (`technicalAlertPrompts/*`, `announcementPrompts/*`), not from
retrieval. Wiring them onto this system-knowledge source would mean reworking
those prompts and their existing deterministic gate tests
(`test-technical-alert-v2-*.ts`) -- both currently pass and cover real behavior,
so that's out of scope here to avoid regressing two working workflows alongside
a new one. `retrieveRelevantChunks` / `filterChunksBySettings` are already
workflow-agnostic (they take a `FCORequestData`-shaped object, not literally the
FCO type) if that wiring is undertaken later.

## Other decisions still open

- **Production persistence.** The JSON-file store lives under `process.cwd()`
  and is fine for a local dev / single-instance deployment; on an ephemeral
  filesystem (e.g. Cloud Run, which `server.ts`'s `PORT` handling already
  anticipates) it will not persist and would need a real datastore.
- **Multi-instance ingestion.** No distributed lock exists; two instances
  syncing concurrently could race. Fine for one dev server, not for a scaled
  deployment.
- **Version pinning on generated content.** `grounding.systemKnowledge.sources`
  records which source version influenced a given rewrite response, but nothing
  persists that pin into `fcoDraft` (the canonical state) -- doing so would be a
  canonical-state change and was deliberately left out of this feature's scope.
