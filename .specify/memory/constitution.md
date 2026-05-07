<!--
  ╔══════════════════════════════════════════════════════════════╗
  ║                    SYNC IMPACT REPORT                       ║
  ╠══════════════════════════════════════════════════════════════╣
  ║ Version change: (none — template) → 1.0.0                  ║
  ║                                                             ║
  ║ Modified Principles:                                        ║
  ║   - [PRINCIPLE_1] → I. Offline-First PWA                    ║
  ║   - [PRINCIPLE_2] → II. Feature-Based Architecture          ║
  ║   - [PRINCIPLE_3] → III. Type Safety                        ║
  ║   - [PRINCIPLE_4] → IV. Arabic-First & Accessible           ║
  ║   - [PRINCIPLE_5] → V. Data Integrity & Sync                ║
  ║                                                             ║
  ║ Added Sections:                                             ║
  ║   - Technology Stack & Constraints                          ║
  ║   - Development Workflow & Quality Gates                    ║
  ║   - Governance (populated)                                  ║
  ║                                                             ║
  ║ Removed Sections: (none)                                    ║
  ║                                                             ║
  ║ Templates requiring updates:                                ║
  ║   ✅ plan-template.md — no changes needed                   ║
  ║       (Constitution Check section is generic/compatible)    ║
  ║   ✅ spec-template.md — no changes needed                   ║
  ║       (no constitution-specific references)                 ║
  ║   ✅ tasks-template.md — no changes needed                  ║
  ║       (task phases are generic/compatible)                  ║
  ║                                                             ║
  ║ Follow-up TODOs: (none)                                     ║
  ╚══════════════════════════════════════════════════════════════╝
-->

# Daily Tasks App (مهام اليوم) Constitution

## Core Principles

### I. Offline-First PWA

The application MUST function fully offline with local storage as the
primary persistence layer. Cloud synchronization is a secondary,
eventual-consistency mechanism.

- All static assets MUST be precached via Workbox service workers.
- Runtime caching strategies MUST be defined for every external API
  (prayer times, database sync, Google Fonts).
- The app MUST register as a Progressive Web App with a valid
  manifest, standalone display mode, and installability on all
  major platforms (iOS, Android, desktop).
- Network failures MUST NOT degrade core task management or prayer
  tracking functionality.

### II. Feature-Based Architecture

Code MUST be organized by feature domain (e.g., `tasks`, `finance`).
Each feature is a self-contained module with its own components,
hooks, types, and barrel exports.

- Feature modules MUST reside under `src/features/<name>/`.
- Shared utilities, hooks, and components MUST live under
  `src/shared/` and MUST NOT import from any feature module.
- Feature pages MUST be lazy-loaded via `React.lazy()` to minimize
  initial bundle size.
- Cross-feature dependencies MUST flow through shared abstractions,
  never via direct imports between feature directories.

### III. Type Safety

TypeScript MUST be used for all source files (`.ts` / `.tsx`).
Strict type checking is enforced at build time.

- The `any` type MUST NOT be used without an inline justification
  comment explaining why a precise type is infeasible.
- All component props, hook return values, and API contracts MUST
  have explicit type definitions.
- `tsconfig.json` strict mode MUST remain enabled.
- Type errors MUST be resolved before merging; `// @ts-ignore` is
  prohibited without an accompanying TODO and issue reference.

### IV. Arabic-First & Accessible

The user interface MUST default to Arabic (RTL) layout. Accessibility
MUST NOT be treated as an afterthought.

- The root `<html>` element MUST set `lang="ar"` and `dir="rtl"`.
- All user-visible text MUST be in Arabic unless referencing a
  proper noun or technical identifier.
- Interactive elements MUST include appropriate ARIA attributes
  (`role`, `aria-label`, `aria-modal`, etc.).
- Semantic HTML elements (`<main>`, `<nav>`, `<section>`,
  `<button>`) MUST be preferred over generic `<div>` wrappers.
- Color contrast MUST meet WCAG 2.1 AA minimum (4.5:1 for normal
  text, 3:1 for large text) against the dark background theme.

### V. Data Integrity & Sync

Local state is the source of truth. Cloud sync (Neon PostgreSQL)
operates on an eventual-consistency model. No user data may be
silently lost.

- Local writes MUST succeed immediately and independently of
  network state.
- Sync conflicts MUST be resolved by latest-timestamp-wins strategy
  with the losing version logged for audit.
- Sync failures MUST surface a user-visible status indicator
  (never fail silently).
- Daily task resets MUST preserve historical completion data before
  clearing the current day's state.
- Database schema migrations MUST be backward-compatible; breaking
  changes require a migration path documented in the PR.

## Technology Stack & Constraints

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Framework   | React 19 with Vite 8                |
| Language    | TypeScript 6 (strict mode)          |
| State/Data  | TanStack Query 5, React Context     |
| Database    | Neon PostgreSQL (serverless driver) |
| PWA         | vite-plugin-pwa / Workbox           |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable   |
| Deployment  | Vercel (with `vercel.json` config)  |
| Linting     | ESLint 8 + Prettier 3               |
| Git Hooks   | Husky 9 + lint-staged 16            |

**Constraints:**

- Target bundle size for initial load MUST remain under 200 KB
  gzipped (excluding fonts and icons).
- The app MUST render meaningful content within 2 seconds on a
  mid-range mobile device over 3G.
- Node.js version MUST be 20 LTS or later for local development.
- No new runtime dependencies may be added without documenting the
  rationale in the PR description.

## Development Workflow & Quality Gates

**Branching**: Feature branches MUST follow sequential numbering as
configured in `.specify/init-options.json`.

**Pre-commit (enforced via Husky + lint-staged):**

- All `.ts` / `.tsx` / `.js` / `.jsx` files MUST pass ESLint with
  zero errors and be formatted by Prettier.
- All `.json`, `.css`, `.html`, `.md` files MUST be Prettier-formatted.

**Pull Request requirements:**

- `npm run lint` MUST pass with zero errors.
- `npm run typecheck` MUST pass with zero errors.
- `npm run build` MUST succeed without warnings treated as errors.
- PR description MUST reference the feature spec or task ID.

**Code review expectations:**

- Verify adherence to the five Core Principles above.
- Confirm no new `any` types without justification.
- Confirm no direct cross-feature imports.
- Confirm RTL/accessibility compliance for UI changes.

## Governance

This constitution is the highest-authority document for the
Daily Tasks App project. All development practices, code reviews,
and architectural decisions MUST comply with its principles.

**Amendment procedure:**

1. Propose changes via a PR modifying this file.
2. Document the rationale and impact in the PR description.
3. Run the `/speckit-constitution` command to validate consistency
   with dependent templates.
4. Obtain explicit approval before merging.

**Versioning policy:**

- MAJOR bump: Principle removal, redefinition, or backward-
  incompatible governance change.
- MINOR bump: New principle, new section, or materially expanded
  guidance.
- PATCH bump: Wording clarification, typo fix, non-semantic
  refinement.

**Compliance review:**

- Every PR MUST be checked against the Constitution Check gate
  defined in `plan-template.md` before implementation begins.
- Quarterly audits SHOULD review principle relevance and update
  this document if the project scope evolves.

**Version**: 1.0.0 | **Ratified**: 2026-05-07 | **Last Amended**: 2026-05-07
