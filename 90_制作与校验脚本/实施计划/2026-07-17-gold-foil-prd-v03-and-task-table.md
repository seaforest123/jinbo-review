# Gold Foil PRD V0.3 and Seven-Week Task Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a corrected PRD V0.3 and a standalone four-role, seven-week task-and-acceptance Word document without changing the approved product scope.

**Architecture:** Use `python-docx` and the existing gold-foil document helpers. Revise the supplied V0.2 in place into a new workspace copy, preserving existing styles; generate the operational task table as a separate landscape DOCX with seven weekly sections. Verify structure first, then render both documents through Word-to-PDF fallback and inspect every page.

**Tech Stack:** Bundled Python 3, `python-docx`, OOXML helpers, Microsoft Word PDF export, Poppler PNG rendering.

## Global Constraints

- Preserve `C:\Users\Andrew\Downloads\金箔非遗小程序产品需求文档PRD-V0_2.docx` unchanged.
- Output files go to `D:\WeChatProjects\miniprogram-1\docs\gold-foil-heritage\`.
- PRD output version is V0.3; the separate task table version is V0.1.
- Preserve the approved positioning, P0/P1/P2 scope, 28 functional requirement IDs and four-role structure.
- Use the approved gold visual system; PRD remains A4 portrait and the task table uses A4 landscape.
- Do not create placeholders for student names.
- Do not commit or push repository changes; the user authorized document creation only.

---

### Task 1: Revise PRD V0.2 into V0.3

**Files:**
- Create: `scripts/revise_gold_foil_prd_v03.py`
- Read: `C:\Users\Andrew\Downloads\金箔非遗小程序产品需求文档PRD-V0_2.docx`
- Create: `docs/gold-foil-heritage/金箔非遗小程序产品需求文档PRD-V0.3.docx`

**Interfaces:**
- Consumes: existing DOCX paragraph text, header, core properties, risk table 24, acquisition paragraphs and schedule table 26.
- Produces: a preserved-format V0.3 DOCX used by Task 3.

- [ ] **Step 1: Create a revision script with explicit replacement assertions**

The script must stop if any expected V0.2 sentence or table is missing. It must update the subtitle, running header, core title, version note, stale V0.2 update sentence, risk responses, acquisition wording and schedule rows.

- [ ] **Step 2: Replace the risk table**

Build a six-column table with the exact headers `风险`, `影响域／等级`, `触发信号`, `应对预案`, `状态／下次复核`, `责任人`. Preserve all eight risks; set initial states and review dates; make temporary route and authorization fallbacks internal-only until professional confirmation.

- [ ] **Step 3: Restart acquisition numbering**

Apply a new Word numbering definition to the three paragraphs under `建议动作`, so the rendered list starts at 1 rather than 6.

- [ ] **Step 4: Strengthen the seven-week schedule**

Add formal filming, editing, subtitles, professional review, content import, trial-version release, analytics verification and the approved P0 fallback rule. Add a reference to the standalone task table.

- [ ] **Step 5: Generate and structurally verify V0.3**

Run:

```powershell
& $BUNDLED_PYTHON scripts/revise_gold_foil_prd_v03.py
```

Expected: exit code 0 and the V0.3 DOCX exists. Verify the cover, header and core title all contain `V0.3`; no stale sentence says the current document should update to V0.2; all 28 functional IDs remain.

### Task 2: Build the Four-Role Seven-Week Task and Acceptance Table

**Files:**
- Create: `scripts/build_gold_foil_7week_task_docx.py`
- Create: `docs/gold-foil-heritage/金箔非遗项目四岗位7周任务与验收表V0.1.docx`

**Interfaces:**
- Consumes: approved weekly milestones, four roles and PRD requirement IDs.
- Produces: a standalone landscape execution document with 28 role-week task records.

- [ ] **Step 1: Configure the landscape document**

Use A4 landscape, 1.5 cm side margins, the existing gold palette, running header/footer, real heading styles and repeated table headers.

- [ ] **Step 2: Add front matter and execution rules**

Include document metadata, role definitions, status values, evidence rules, blocker escalation and the statement that authenticity, authorization and informed consent are veto conditions.

- [ ] **Step 3: Add seven weekly sections**

Each week contains four rows: product/front-end, 3D/technical, content/archive and research/practice. Each row contains main task, collaboration/dependency, deliverable, acceptance standard, reviewer and initial status `未开始`.

- [ ] **Step 4: Add final P0 acceptance and handoff checklists**

Include product, content, device, data, research, practice, repository/backup and evidence-package checks. Reference the relevant PRD IDs or numbered sections.

- [ ] **Step 5: Generate and structurally verify the task table**

Run:

```powershell
& $BUNDLED_PYTHON scripts/build_gold_foil_7week_task_docx.py
```

Expected: exit code 0, 7 week headings, 28 role-week rows, all rows have deliverables and acceptance standards, and no template placeholders appear.

### Task 3: Render, Inspect and Finalize Both Documents

**Files:**
- Verify: `docs/gold-foil-heritage/金箔非遗小程序产品需求文档PRD-V0.3.docx`
- Verify: `docs/gold-foil-heritage/金箔非遗项目四岗位7周任务与验收表V0.1.docx`

**Interfaces:**
- Consumes: the two DOCX files from Tasks 1 and 2.
- Produces: final QA-approved deliverables only; PDF and PNG files remain temporary.

- [ ] **Step 1: Run document audits**

Run ZIP integrity, heading, section, accessibility and table-geometry audits. Treat the decorative metric strip as the only acceptable headerless layout table.

- [ ] **Step 2: Render through the canonical renderer**

Run `render_docx.py` for each file. If LibreOffice remains unavailable, export temporary PDFs through hidden Microsoft Word and rasterize with Poppler.

- [ ] **Step 3: Inspect every rendered page**

Check headers, footers, version labels, numbering restart, long table rows, repeated headers, clipping, overlaps, blank-page anomalies and font consistency.

- [ ] **Step 4: Correct and re-render**

Apply only identified layout or content corrections, regenerate the affected document and repeat all relevant checks.

- [ ] **Step 5: Final verification and cleanup**

Confirm the two final DOCX files exist, remove temporary PDF/PNG artifacts, and deliver links to both files with a concise summary of the changes.
