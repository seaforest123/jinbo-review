# Gold Foil Week 1 Kickoff Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and verify a print-ready Word kickoff pack for the first week of the gold-foil heritage project.

**Architecture:** A deterministic `python-docx` builder creates one A4 portrait document using shared gold-project typography and table helpers. A structural verifier checks required sections and forms; Word/PDF rendering is then inspected page by page.

**Tech Stack:** Bundled Python 3, python-docx, OOXML table geometry helpers, Microsoft Word COM fallback, Poppler.

## Global Constraints

- Output: `D:\WeChatProjects\miniprogram-1\docs\gold-foil-heritage\金箔非遗项目第1周启动包V0.1.docx`.
- Source PRD and task-table files are read-only inputs and must not be modified.
- Use A4 portrait pages and the existing gold/brown visual language.
- Include the five approved components and the shared professional-interview gate.
- Do not expose a temporary craft route as professionally confirmed content.
- Final delivery contains only the requested DOCX; render artifacts remain internal.

---

### Task 1: Build the kickoff packet

**Files:**
- Create: `D:\WeChatProjects\miniprogram-1\scripts\build_gold_foil_week1_kickoff_docx.py`
- Create: `D:\WeChatProjects\miniprogram-1\docs\gold-foil-heritage\金箔非遗项目第1周启动包V0.1.docx`

**Interfaces:**
- Consumes: the approved design and the existing PRD/task-table wording.
- Produces: a nine-part Word packet with explicit styles, tables, headers, footers, and page breaks.

- [ ] Implement page geometry, styles, numbering, callouts, forms, and fixed-DXA tables.
- [ ] Add all approved content and intentionally blank writable fields.
- [ ] Save the DOCX and assert the required headings and forms exist.

### Task 2: Run structural audits

**Files:**
- Test: `D:\WeChatProjects\miniprogram-1\docs\gold-foil-heritage\金箔非遗项目第1周启动包V0.1.docx`

**Interfaces:**
- Consumes: the generated DOCX.
- Produces: ZIP integrity, table geometry, section, heading, and accessibility evidence.

- [ ] Test DOCX ZIP integrity.
- [ ] Run `table_geometry.py`, `section_audit.py`, `heading_audit.py`, and `a11y_audit.py`.
- [ ] Correct every high, medium, or table-geometry finding before rendering.

### Task 3: Render and visually inspect

**Files:**
- Test: the generated DOCX.
- Internal output: `D:\WeChatProjects\miniprogram-1\.tmp_week1_kickoff_render\`.

**Interfaces:**
- Consumes: the structurally valid DOCX.
- Produces: page PNGs and a verified final DOCX.

- [ ] Attempt canonical `render_docx.py` rendering.
- [ ] If LibreOffice is unavailable, export through Microsoft Word and rasterize with Poppler.
- [ ] Inspect every page for clipping, overlap, blank pages, broken forms, and awkward wrapping.
- [ ] Revise and repeat rendering until every page passes.

