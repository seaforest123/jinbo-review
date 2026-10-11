# Gold-Foil Interview Design DOCX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the approved first-interview materials-pack Markdown design into one polished, print-ready Word document without changing its substantive requirements.

**Architecture:** A dedicated `python-docx` builder reads the approved Markdown source and emits a styled DOCX using the compact reference guide preset plus a gold/brown project override. Structural audit scripts validate headings, sections, accessibility, and table geometry; Microsoft Word is used as the LibreOffice-missing render fallback, then every rendered page is inspected.

**Tech Stack:** Bundled Python 3, `python-docx`, document-skill OOXML audit scripts, Microsoft Word PDF export fallback, Poppler PNG rendering.

## Global Constraints

- Source content remains `docs/superpowers/specs/2026-07-19-gold-foil-first-interview-materials-pack-design.md`.
- Output is `docs/gold-foil-heritage/金箔非遗项目首次专业访谈材料包设计说明V0.1.docx`.
- Use A4 portrait and the existing gold/brown project visual system.
- Use real Heading 1/2/3 styles and real Word list numbering.
- Preserve all ten material definitions, content boundaries, risks, workflow, naming rules, and ten acceptance criteria.
- Do not convert uncertain craft content into confirmed facts.
- Do not modify or overwrite the Markdown source.

---

### Task 1: Build the Styled DOCX

**Files:**
- Create: `scripts/build_gold_foil_interview_design_docx.py`
- Read: `docs/superpowers/specs/2026-07-19-gold-foil-first-interview-materials-pack-design.md`
- Create: `docs/gold-foil-heritage/金箔非遗项目首次专业访谈材料包设计说明V0.1.docx`

**Interfaces:**
- Consumes: UTF-8 Markdown lines from the approved source.
- Produces: `build_document(source_path: Path, output_path: Path) -> Path`.

- [ ] Define explicit page, font, color, paragraph, list, table, header, and footer tokens.
- [ ] Create title block, metadata strip, running header, page-number footer, and restrained gold rule.
- [ ] Parse Markdown headings, prose, bullets, numbered lists, inline code, and the directory code block into native Word structures.
- [ ] Apply named callout formatting to the status block, core principles, and risk warnings.
- [ ] Generate the output DOCX and verify it reopens with `python-docx`.

### Task 2: Validate Content and Structure

**Files:**
- Create: `scripts/verify_gold_foil_interview_design_docx.py`
- Test: `docs/gold-foil-heritage/金箔非遗项目首次专业访谈材料包设计说明V0.1.docx`

**Interfaces:**
- Consumes: generated DOCX.
- Produces: exit code 0 and counts for sections, ten file definitions, risks, and acceptance criteria.

- [ ] Assert the DOCX ZIP package is valid and reopens.
- [ ] Assert all nine top-level design sections are present.
- [ ] Assert file headings `00` through `09` all exist.
- [ ] Assert route guard, authorization split, third-party rights rule, naming rule, and all ten acceptance criteria exist.
- [ ] Run `heading_audit.py`, `section_audit.py`, and `a11y_audit.py` with zero blocking findings.

### Task 3: Render and Inspect Every Page

**Files:**
- Read: generated DOCX.
- Create temporarily: `.tmp_interview_design_docx_render/`.

**Interfaces:**
- Consumes: final DOCX.
- Produces: PDF and page PNGs for internal QA only.

- [ ] Attempt the canonical `render_docx.py --emit_pdf` workflow.
- [ ] If LibreOffice is missing, export through Microsoft Word and rasterize with bundled Poppler.
- [ ] Inspect every page at 100% for clipping, overlap, orphan headings, blank pages, broken list alignment, and footer placement.
- [ ] Correct the builder and repeat rendering if any defect is found.

### Task 4: Final Verification and Delivery

**Files:**
- Deliver: `docs/gold-foil-heritage/金箔非遗项目首次专业访谈材料包设计说明V0.1.docx`

**Interfaces:**
- Consumes: latest rendered DOCX.
- Produces: one final user-facing Word link.

- [ ] Re-run content, ZIP, heading, section, accessibility, and page-count checks on the latest output.
- [ ] Confirm the DOCX is non-empty and the final render has no blank pages.
- [ ] Deliver only the DOCX; do not link internal PDF, PNG, builder, verifier, or plan files.
