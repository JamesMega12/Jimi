> **SYNTHETIC TEST FIXTURE — NOT A REAL SLB OR ASD-STE100 STANDARD.**
> This document is original test content created for the Jimi repository to validate the
> system-knowledge ingestion and retrieval pipeline before the approved STE handbook is
> available. It must never be treated as real SLB or STE guidance, and must be removed once
> the approved handbook is ingested (see `docs/SYSTEM_KNOWLEDGE.md`).

# Synthetic STE Test Guide

## 1. Units and Symbols

Rule SYN-U1: In this synthetic test guide, write the expression "degrees Celsius" as "degC".
Do not write "°C" or "degrees C". Place the unit directly after the numeric value with a
single space, for example "50 degC".

## 2. Spelling and Word Usage

Rule SYN-C1 (synthetic canary rule): In this synthetic test guide, write the word
"approximately" as "approx-QX7". This is an artificial, fictional convention created only to
prove that retrieval pulled its answer from this synthetic source rather than from the base
model's general knowledge. It carries no technical meaning, is not a real abbreviation, and
must never appear in production writing guidance. Remove this rule before the approved
handbook is ingested.

## 3. Abbreviations

| Approved abbreviation | Meaning | Notes |
| --- | --- | --- |
| QRG | Quick Reference Guide | Define on first use in a document. |
| SYN | Synthetic | Marks a rule as belonging to this test fixture, never a real standard. |
| TFX | Test Fixture | Used only inside this synthetic guide. |

## 4. Sentence Construction

Rule SYN-S1: Keep instructional sentences short. Cover one action per sentence. Start each step
with a strong imperative verb such as "Open", "Check", or "Record". Avoid joining multiple
actions into a single sentence with conjunctions.
