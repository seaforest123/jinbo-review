# Gold Foil Heritage Digital Experience Project

This repository contains a P0 candidate trial implementation for a WeChat Mini Program. It validates two candidate routes, a three-step lightweight digital experience, anonymous analytics, and minimum CloudBase permission boundaries. It is not a public release and does not establish unreviewed cultural or craft claims.

## Status

- Included: five P0 page shells, two candidate routes, three-step interaction, capability fallback, anonymous event contracts, and offline CloudBase rules/functions.
- Both routes remain `internal_placeholder` / `internal_approved` and are limited to `development` and `trial`.
- Excluded: real CloudBase deployment, real Mini Program configuration, professional content approval, upload, QR code generation, device acceptance, and public release.

## Local checks

```powershell
npm test
git diff --check
```

## WeChat Developer Tools

Copy `project.config.example.json` to an uncommitted local `project.config.json`, keep tourist-mode settings, and import the repository root. Verify the candidate-route flow, horizontal drag, hint, retry, exit, result actions, and route restart. A failed CloudBase call must not block the experience.

## CloudBase preparation

Read [cloudbase/README.md](cloudbase/README.md) before any deployment. Apply the four collection rules and function rules, then import `cloudbase/seed-data/` in order. Do not place real credentials, application identifiers, environment identifiers, salts, approver IDs, or raw identities in this repository.

## Task 11 boundary

Only Task 11 may configure the real AppID and CloudBase environment, deploy functions, upload the Mini Program, generate a trial QR code, and complete iOS/Android acceptance. Professional confirmation is required before public review or release.
