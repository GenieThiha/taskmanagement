# Project Overview

**Project:** Task Management Web Application (TMA-2026)
**Code:** TMA-2026
**Methodology:** Waterfall (Sequential SDLC)
**Current Phase:** Phase 3 — Design (HLD approved)
**Go-Live:** Q3 2026
**Sponsor:** Chief Technology Officer
**Classification:** Internal / Confidential

---

## Purpose

Internal task manager for small organisations (≤50 users). Supports task creation, assignment, prioritisation, status tracking, and real-time notifications across a team.

---

## In Scope

- User authentication and authorisation (login, registration, role management)
- Task creation, assignment, prioritisation, and status tracking
- Dashboard with summary metrics and activity feed
- Email & in-app notifications for task events
- REST API backend with JSON responses
- Responsive single-page front-end application
- Relational database persistence and Redis session caching

## Out of Scope

- Mobile native applications (iOS / Android)
- Third-party calendar integrations
- AI-powered task suggestions
- Multi-tenancy / SaaS features

---

## Waterfall Phase Gates

| Phase | Artefact | Status |
|-------|----------|--------|
| 1 — Requirements | Business Requirements Document (BRD) v1.0 | Approved |
| 2 — System Design | Software Requirements Specification (SRS) v1.2 | Approved |
| 3 — HLD | `TMA_HLD_Waterfall.pdf` v1.0 | Approved |
| 4 — LLD | Low-Level Design | Pending |
| 5 — Implementation | Source code | Pending |
| 6 — Testing | Test Plan | Pending |
| 7 — Deployment | Deployment Runbook | Pending |

Each phase gate requires formal sign-off (Lead Architect, Project Manager, CTO, QA Lead) before the next phase begins.

---

## Roles & Permissions

| Role | Capabilities |
|------|-------------|
| `admin` | Full access; manage users; archive projects; all PATCH /users/:id |
| `manager` | Create projects; assign tasks; view all team tasks |
| `member` | Create and manage own tasks; view assigned tasks |

Hierarchy: `admin > manager > member`
