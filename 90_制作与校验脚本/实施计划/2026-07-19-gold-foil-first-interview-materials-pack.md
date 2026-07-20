# Gold Foil First Interview Materials Pack Implementation Plan

> **For Codex:** Execute this plan in the current workspace. The work is additive and must not modify unrelated user files.

**Goal:** Generate ten independent, printable and fillable Word documents for the first professional interview, aligned with the approved design specification and verified structurally and visually.

**Architecture:** A single Python builder owns the shared A4 gold/brown document system and ten content-specific build functions. A separate verifier checks file count, filenames, required phrases, route neutrality, authorization boundaries, document integrity, and basic table structure. Microsoft Word PDF export is used as the rendering fallback when the canonical LibreOffice renderer is unavailable.

**Tech Stack:** Python 3, python-docx, WordprocessingML helpers, Microsoft Word COM export, Poppler page rendering.

---

### Task 1: Establish shared output contract

**Files:**
- Create: `scripts/build_gold_foil_interview_materials_pack.py`
- Create: `scripts/verify_gold_foil_interview_materials_pack.py`
- Output: `docs/gold-foil-heritage/首次专业访谈材料包_V0.1_20260719/`

1. Reuse the approved project color system, typography, header/footer and numbering helpers.
2. Define the exact ten filenames and common document metadata.
3. Define reusable title, section, table, checkbox, fill-line and warning components.

### Task 2: Build documents 00—04

**Files:**
- Modify: `scripts/build_gold_foil_interview_materials_pack.py`

1. Build the total directory and use-order document.
2. Build the one-page project overview.
3. Build the five-screen paper prototype without deciding the craft route.
4. Build the demonstration script and screen-by-screen feedback form.
5. Build the 60-minute interview guide with required, optional and follow-up question levels.

### Task 3: Build documents 05—09

**Files:**
- Modify: `scripts/build_gold_foil_interview_materials_pack.py`

1. Build itemized recording and material-use authorization choices.
2. Build identity and contact verification fields.
3. Build four WeChat appointment and change templates.
4. Build equipment, printing, environment and exit checklists.
5. Build the post-interview minutes, conclusion and confirmation form.

### Task 4: Generate and run automatic acceptance checks

**Files:**
- Modify: `scripts/verify_gold_foil_interview_materials_pack.py`

1. Generate all ten DOCX files.
2. Reopen every package as a ZIP/DOCX and verify names and required phrases.
3. Reject unapproved craft claims, generic blanket authorization, and missing third-party-rights warnings.
4. Run available document structure, accessibility, heading and table-geometry audits.

### Task 5: Render and visually inspect every page

**Files:**
- Render only: `.tmp_interview_pack_render/`

1. Attempt the canonical document renderer once.
2. If LibreOffice is unavailable, export every DOCX to PDF through Microsoft Word.
3. Render all PDF pages to PNG with Poppler.
4. Inspect every page for clipping, broken tables, blank spill pages, tiny text and unusable fill areas.
5. Fix defects and repeat generation, checks and rendering until all pages pass.

### Task 6: Final verification and delivery

1. Run a fresh generation and verifier pass.
2. Confirm exactly ten final Word files exist in the package folder.
3. Confirm the total directory accurately indexes the other nine files.
4. Deliver the total-directory Word document as the entry point and state that the remaining files are in the same folder.
