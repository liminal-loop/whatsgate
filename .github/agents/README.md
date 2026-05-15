# WhatsGate Agent Catalog (Optimized)

This folder contains a compact, non-overlapping agent set aligned to GitHub-centric build and delivery workflows.

## Optimized Agent Set

1. `Autopilot Team Lead`
1. `Product & Implementation Planner`
2. `Build Engineer (App + GitHub)`
3. `Quality Gate Reviewer`
4. `Application Security Reviewer`
5. `OSS Compliance Governor`
6. `GitHub Delivery & CI/CD Engineer`
7. `Architecture & ADR Planner`
8. `Documentation Writer`

## Responsibility Map (Single Responsibility)

- `Autopilot Team Lead`: team orchestrator from requirement intake to final delivery.
- `Product & Implementation Planner`: requirements shaping, spec alignment, implementation plans.
- `Build Engineer (App + GitHub)`: code changes, tests, and integration delivery.
- `Quality Gate Reviewer`: verification, regression, and release confidence.
- `Application Security Reviewer`: OWASP-driven review and SAST/SCA finding triage.
- `OSS Compliance Governor`: license/provenance/notice compliance and release gating.
- `GitHub Delivery & CI/CD Engineer`: Actions workflows, pipeline reliability, release safety.
- `Architecture & ADR Planner`: architecture trade-offs, decision capture, design governance.
- `Documentation Writer`: docs, runbooks, and developer-facing technical writing.

## Recommended Workflow

1. Start with `Autopilot Team Lead` and provide the requirement.
2. Team lead runs planning, build, quality, security, OSS compliance, CI/CD, architecture, and docs phases as needed.
3. Team lead asks clarifications only when details are blocker-level ambiguous.

## Autopilot Kickoff Prompt

Use this in Chat with `Autopilot Team Lead`:

"Requirement: <describe feature/change>. Objectives: <business goals>. Scope: <in/out>. Acceptance criteria: <list>. Constraints: <security/compliance/performance/deployment>. Run in autopilot mode: ask only critical clarifications, then execute end-to-end and report results with risks and follow-ups."
