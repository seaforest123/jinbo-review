# 互动工艺画册 P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a true-device-first, offline three-step candidate craft-album experience with material selection, foil placement, and rhythm tapping, illustrated by local frame-sequence candidate animations at key steps.

**Architecture:** Preserve route IDs, state machine, local learning reports, and analytics contracts. Add pure candidate frame-animation and interaction-state modules; render their view state on the experience page and fall back to existing static visuals when a frame-sequence is unavailable or fails to load.

**Tech Stack:** WeChat Mini Program WXML/WXSS/JavaScript, CommonJS modules, Node.js built-in test runner.

## Global Constraints

- Treat all visuals as candidate material and show "候选视觉示意，尚待专业确认" adjacent to every candidate image, frame-sequence, or animation.
- Use only local resources; add no remote media, network requests, CloudBase changes, cloud functions, permissions, HTTP/API gateways, triggers, or Web SDK.
- Do not read, display, record, transmit, or commit real AppIDs, CloudBase environment IDs, secrets, OpenIDs, UnionIDs, or other personal information.
- Design for an offline true-device demo of about three minutes using only single-finger tap and drag.
- **Do not generate or import video files.** Candidate motion is expressed only through local WebP/PNG frame sequences advanced by JS interval logic (`image` component + timer swapping `src`), never a `<video>` element, video codec, or file with a video extension (.mp4/.webm/.mov). Any resource path ending in a video extension must fail validation.
- Preserve route/step identifiers, learning-report schema, analytics event names, fallback behavior, and current candidate notices.

---

## File Structure

- Create `miniprogram/assets/candidate/` frame sets: 2–3 sequences, 6–10 frames each (e.g. `motion-frame-01.webp` … `motion-frame-08.webp`, `inspect-frame-01.webp` … `inspect-frame-06.webp`).
- Create `miniprogram/data/candidate-animations.js`: local frame-sequence metadata and safe lookup.
- Create `miniprogram/domain/craft-interaction.js`: pure material-selection and rhythm-tapping transitions.
- Create `tests/data/candidate-animations.test.js` and `tests/domain/craft-interaction.test.js`.
- Modify `miniprogram/domain/experience-controller.js` and `tests/domain/experience-controller.test.js`.
- Modify `miniprogram/pages/experience/index.js`, `index.wxml`, `index.wxss`, and `tests/page-shell.test.js`.
- Modify `miniprogram/pages/home/index.wxml`, `miniprogram/pages/archive/index.wxml`, and `miniprogram/pages/result/index.wxml`.

### Task 1: Candidate Frame-Animation Assets & Contract

**Files:** Create 2–3 frame sets under `miniprogram/assets/candidate/`; create `miniprogram/data/candidate-animations.js`; create `tests/data/candidate-animations.test.js`.

**Interfaces:** Export `NOTICE` and `getStepAnimation(stepId)`. A valid value is `{ frames: string[], frameIntervalMs: number, notice }`; unavailable stepId returns `null`. Every entry in `frames` is a local path under `assets/candidate/` ending in `.webp` or `.png` — never `.mp4`/`.webm`/`.mov` and never an HTTP(S) URL.

- [ ] Write a failing test asserting: `NOTICE` equals the required candidate notice; `getStepAnimation("motion")` and `getStepAnimation("inspect")` each return a `frames` array of length 6–10, a positive `frameIntervalMs`, and all frame paths start with `/assets/candidate/` and end in `.webp` or `.png`; any path ending in a video extension fails the test; unknown stepId returns `null`.
- [ ] Run `node --test tests/data/candidate-animations.test.js`, confirm failure because the module and assets are absent.
- [ ] Use imagegen to generate 2–3 candidate frame sequences (e.g. `step-motion` foil-laying breakdown, `step-inspect` rhythm-tap breakdown), 6–10 frames each, in the existing warm-paper/deep-brown/gold-layer style. No text, no real people, no branding, no photographic realism, no claim of authentic craft documentation.
- [ ] Implement a frozen registry mapping stepId to `{ frames, frameIntervalMs, notice }`; safe lookup returns a copy or `null`.
- [ ] Re-run the data test, confirm pass; visually inspect all generated frames for readability, absence of text artifacts, and absence of real-craft claims.
- [ ] Commit: `feat: add candidate frame-animation assets and contract`.

### Task 2: Pure Craft Interaction State

**Files:** Create `miniprogram/domain/craft-interaction.js`; create `tests/domain/craft-interaction.test.js`.

**Interfaces:** Export `RHYTHM_MARKERS`, `createCraftInteraction()`, `selectMaterial(state, materialId)`, `tapRhythm(state, markerId)`. State is `{ materialId: string|null, rhythmIndex: number, rhythmComplete: boolean }`; marker order is beat-1 through beat-4.

- [ ] Write a failing test that selection stores `foil-sheet`, an out-of-order beat does not advance, and four ordered beats complete.
- [ ] Run `node --test tests/domain/craft-interaction.test.js`, confirm failure because the module is absent.
- [ ] Implement immutable pure transitions. Materials accept a string or reset to `null`. Rhythm only advances when `markerId` matches `RHYTHM_MARKERS[rhythmIndex]`.
- [ ] Run `node --test tests/domain/craft-interaction.test.js`, confirm pass.
- [ ] Commit: `feat: add craft interaction state`.

### Task 3: Controller Integration

**Files:** Modify `miniprogram/domain/experience-controller.js`; modify `tests/domain/experience-controller.test.js`.

**Interfaces:** Produce `getView().craftInteraction`, `selectMaterial(materialId)`, `tapRhythm(markerId)`. Retry and successful transitions reset interaction state for the active/new step.

- [ ] Add a failing controller test: start fixture, choose `foil-sheet`, complete existing drag step, then prove only four ordered rhythm taps complete the final step.
- [ ] Run `node --test tests/domain/experience-controller.test.js`, confirm failure because the controller lacks craft interaction state/methods.
- [ ] Keep `craftInteraction` in the controller closure, initialize it entering a step, reset it on retry and transition, and expose it from `getView()`. `selectMaterial` only changes local state. `tapRhythm` invokes existing `completeStep()` only after a completed rhythm on inspect. Do not change analytics calls or learning-session outcomes.
- [ ] Run `node --test tests/domain/experience-controller.test.js tests/domain/craft-interaction.test.js`, confirm pass.
- [ ] Commit: `feat: connect craft interactions to experience`.

### Task 4: Experience Page Frame-Animation Fallback and Controls

**Files:** Modify `miniprogram/pages/experience/index.js`, `index.wxml`, `index.wxss`; modify `tests/page-shell.test.js`.

**Interfaces:** Consume `getStepAnimation`, `getStepVisual`, `craftInteraction`, `selectMaterial`, `tapRhythm`. Add `activeAnimation` (`{ frames, frameIntervalMs, currentFrameIndex }` or `null`), `animationFailed`, `craftInteraction`, and handlers `onAnimationError`, `selectMaterial`, `tapRhythm`.

- [ ] Add failing markup assertions for: active-frame-image condition (bound to `activeAnimation.frames[currentFrameIndex]`), static-image fallback when `activeAnimation` is `null` or `animationFailed` is true, select-material binding, rhythm binding, and candidate notice remaining visible in both animated and fallback states.
- [ ] Run `node --test tests/page-shell.test.js`, confirm failure.
- [ ] In `render()`/`onLoad()`/`onShow()` for the active step: load the frame sequence via `getStepAnimation`, reset `animationFailed` and `currentFrameIndex` to 0 for a newly entered step, and expose `craftInteraction`.
- [ ] Drive the frame cycle with a page-level timer (`setInterval`-equivalent) at `frameIntervalMs`, advancing `currentFrameIndex` modulo `frames.length` (loop, no autoplay of any video element). Clear the timer on step change, retry, `onHide`, and `onUnload` to avoid leaks.
- [ ] Render the current frame via a plain `image` component; on `binderror` for any frame, set `animationFailed = true`, stop the timer, and fall back to the existing static image from `getStepVisual`. Keep the candidate notice beside either form at all times.
- [ ] For observe, render 88rpx-or-larger material buttons `foil-sheet`, `paper-layer`, `tool-outline`; visually mark selection and require selection before completion. Retain motion drag unchanged. For inspect, render beat-1 through beat-4 and indicate only the expected marker; controller completes after the fourth correct tap. Preserve hint, retry, and exit.
- [ ] Style feedback with existing warm-paper, deep-brown, muted-gold variables; do not use color alone or animation-dependent layout shifts.
- [ ] Run `npm test`, confirm pass.
- [ ] Commit: `feat: add offline craft step interactions with frame animation`.

### Task 5: Surrounding-Page Cues and Verification

**Files:** Modify home, archive, and result WXML files plus `tests/page-shell.test.js`.

- [ ] Add failing assertions that home/archive include "含三步互动体验" and result includes "已完成互动".
- [ ] Run `node --test tests/page-shell.test.js`, confirm failure.
- [ ] Add only "含三步互动体验" by existing start copy. In result cards, show "已完成互动" only under existing `item.completed`. Add no player, interaction, storage, or cloud flow to these pages.
- [ ] Run `npm test` and `git diff --check`, confirm all pass and diff check produces no output.
- [ ] In developer tools and one real device, test both routes offline: select material, threshold drag, four taps, retry, exit, finish, report, then force a frame load error and verify static fallback. Confirm the candidate notice remains visible throughout and no permissions are requested.
- [ ] Commit: `feat: add interactive experience cues`.

## Plan Self-Review

- Task 1 produces real frame-sequence assets (not an empty registry) and a contract that structurally forbids video files.
- Task 4 renders motion via `image` + timer only — no `<video>` element, no video codec, no autoplay video.
- Tasks 2–4 cover the three approved interactions (material selection, drag placement, rhythm tapping); Task 5 confines surrounding pages to cues.
- `craftInteraction`, `selectMaterial`, `tapRhythm`, `getStepAnimation`, `activeAnimation`, and `animationFailed` are consistent across tasks.
