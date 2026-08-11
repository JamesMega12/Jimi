// Temporary feature flags for Announcement functionality that's implemented
// (types, persistence, snapshot, DOCX export) but not yet ready to expose.
// Flip to true to re-enable -- no other code changes needed. Framework-free
// so it's safely importable by both client components and server export code.

// Figures (numbered caption placeholders): hidden from the Details/Review UI
// and stripped from the exported .docx while this is false. The underlying
// Figure type, persistence, and snapshot threading are untouched -- any
// figure data already in a draft (e.g. from the sample) survives, it's just
// not shown or exported.
export const ANNOUNCEMENT_FIGURES_ENABLED = false;
