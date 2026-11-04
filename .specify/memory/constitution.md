<!--
Sync Impact Report (temporary; remove before committing)
- Version change: (unfilled template) → 1.0.0
- Modified principles: none renamed (template placeholders replaced)
- Added principles: I. Micro-Learning First; II. Personalized Learning Engine;
  III. Learner Control; IV. Evidence-Based Learning Methods;
  V. Cross-Platform, Web-First; VI. Separated Architecture
- Added sections: Technology & Scope Constraints; Development Workflow & Quality Gates
- Removed sections: none
- Deferred TODOs: none. RATIFICATION_DATE set to the date of first adoption (2026-11-04).
- Source: requirement.txt (Vietnamese overview specification of the Japanese learning system)
-->
# Japanese Learning Platform Constitution

## Core Principles

### I. Micro-Learning First
Every daily learning session MUST be completable in 5–15 minutes. Content MUST be authored as
short learning units that can be finished in a single sitting, and the daily plan MUST NOT
exceed the time budget the learner has declared (e.g. 5, 10, 15, or 30 minutes).
Rationale: the target users are office workers with little fixed study time; a session that
does not fit their day is a session that does not happen.

### II. Personalized Learning Engine
Learning paths MUST be generated per learner from level, goal, available daily time, target
timeline, desired skills, and assessment results. The system MUST NOT impose a single fixed
path (such as N5 → N4 → N3) on all users. Content MUST be modeled as discrete learning units
that the Learning Engine allocates dynamically, adjusting difficulty from observed results,
raising review frequency for items not yet remembered, and re-planning after learning gaps.
The engine MUST decide and present what to learn, what to review, and for how long each day.
Rationale: personalization is the product's core differentiator and the foundation for later
AI Tutor phases.

### III. Learner Control
A learner MUST be able to start learning immediately without building a plan themselves, and
MUST also be able to override the system. At minimum the learner can: change goals, adjust
daily time, pause and resume the path, prioritize a skill, skip mastered content, skip the
placement assessment, and request a full path rebuild. Automation MUST NOT remove these
options.
Rationale: adaptive automation earns trust only when the user can always correct it.

### IV. Evidence-Based Learning Methods
Features MUST be grounded in the methods the product commits to: micro-learning, spaced
repetition for vocabulary review, learning by doing (reading, listening, writing, and
practice rather than passive content), adaptive learning, and daily habit building. Review
scheduling MUST be driven by recorded recall results. Progress (time spent, results,
completion, weak areas, goal attainment) MUST be tracked and visible to the learner.
Rationale: these methods are the product's promise; features that bypass them dilute it.

### V. Cross-Platform, Web-First
The client MUST be built with Flutter. Phase 1 targets the web browser on desktop, and UX/UI
decisions are optimized for it. All code MUST nonetheless be written cross-platform:
platform-specific behavior MUST be isolated behind abstractions so that Android/iOS can be
added from the same codebase. Mobile delivery is out of scope until Phase 3.
Rationale: expanding from Web to Mobile MUST NOT require rebuilding the system.

### VI. Separated Architecture
Frontend, Backend, and Learning Content MUST be separate concerns with explicit contracts
between them. The Backend exposes a REST API (or equivalent) and owns accounts, learning
profiles, content, and progress persistence. Learning content MUST be data managed
independently of client code, so it can be added or revised without a client release.
Rationale: separation keeps the system extensible for new content types, new clients, and
advanced AI features.

## Technology & Scope Constraints

- **Framework**: Flutter for all client applications.
- **Backend**: REST API or equivalent; the specific stack is decided in the implementation plan
  and MUST honor Principle VI.
- **Data**: a database stores accounts, learning profiles, content, and progress.
- **Authentication**: registration, login, and account management are required.
- **Modules in scope**: User Management, Learning Assessment, Learning Goal, Personalized
  Learning, Learning Content (vocabulary, Kanji, grammar, listening, reading), Daily Learning,
  Review System, Progress Tracking, Notification, Admin Management.
- **Phasing**: work MUST be scoped to the active phase.
  - Phase 1 (MVP): Web app, accounts, placement assessment, goal setting, personalized path,
    short lessons, vocabulary, grammar, review, progress tracking.
  - Phase 2: advanced AI personalization, listening and reading practice, weakness analysis,
    path adjustment suggestions.
  - Phase 3: Android/iOS apps, multi-device sync, learning notifications.
  - Phase 4: AI Tutor, conversation practice, pronunciation assessment, work-scenario
    speaking practice.
- Features from a later phase MUST NOT be built early unless the constitution is amended or
  the plan records an explicit justification.

## Development Workflow & Quality Gates

- Every feature specification MUST state which phase it belongs to and which success
  criteria it supports:
  1. a learner can start learning without building a plan;
  2. a daily lesson fits in 5–15 minutes;
  3. the path fits the learner's level and goal;
  4. weaknesses are detected and improvements suggested;
  5. progress and goal attainment are trackable;
  6. Web can expand to Mobile without a rebuild.
- Implementation plans MUST include a Constitution Check against Principles I–VI before design
  work begins and again after design is complete.
- Learning Engine behavior (path generation, difficulty adjustment, review scheduling) MUST
  have automated tests that exercise representative learner profiles.
- Changes to API contracts or content schemas MUST be documented and MUST NOT silently break
  existing clients or stored content.
- Added complexity (extra services, abstractions, dependencies) MUST be justified in the plan
  against the simpler alternative.

## Governance

This constitution supersedes other project practices. Amendments MUST be proposed in writing,
state the rationale and affected principles, and include a migration note for any existing
specs, plans, or code that become non-compliant. An amendment takes effect once the project
owner approves it and this file is updated.

Versioning follows semantic versioning:
- MAJOR: backward-incompatible removal or redefinition of a principle or governance rule.
- MINOR: a new principle or section, or materially expanded guidance.
- PATCH: clarification, wording, or typo fixes without semantic change.

Compliance review: every spec, plan, and pull request MUST be checked against this
constitution. Violations MUST be fixed or explicitly justified in the plan's complexity
tracking; unjustified violations block approval. The original overview in `requirement.txt`
is the reference for product intent.

**Version**: 1.0.0 | **Ratified**: 2026-11-04 | **Last Amended**: 2026-11-04
