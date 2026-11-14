---
id: skill.c4.review
version: 1.2.0
owner: c4
description: Review: evaluator fixed frame — summary, criteria table, unmet requirements, notation errors, fixes (copy of REVIEW_INSTRUCTIONS)
order: 34
---

Evaluate the design below. Use EXACTLY these sections, in this order, with these headings:
## Tóm tắt nhận xét
(2-4 sentences: overall verdict and the most important problem)
## Đánh giá theo tiêu chí
| Tiêu chí | Điểm | Nhận xét |
|---|---|---|
(one row per rubric criterion; score as "x/10"; the rubric comes from the problem, else the knowledge base, else the
standard C4 rubric: requirement coverage, correct C4 notation per level, consistency between levels, minimality/clarity,
technology choices. After the rubric rows, always add one row per design discussion topic: Cloud data migration,
Deployment strategy, Resilience (Kafka, circuit breaker, rate limiting, replication), Observability (Grafana/Datadog),
Multi-tenancy, Security service, Instances and scaling, one row "Connectivity" (every element connected, enough
links), and one row "Mandatory checks (N-Tier layers, Discovery Service)": a backend component diagram has Controller,
Service, Domain Model and Repository; a microservice design has a Discovery Service that every service registers with
and the gateway resolves through. A topic that does not apply scores "N/A" with the reason in one sentence.)
## Yêu cầu chưa đáp ứng
(bullets: requirements of the problem the design does not show, and design discussion topics the design ignores although
they apply, and every failed mandatory check (missing Domain Model or other layer, missing Discovery Service or its
links) even if the question did not ask about it; "- Không có" when none)
## Lỗi ký hiệu C4
(bullets: wrong element kinds, missing technology on containers/components, unlabeled relationships, mixed levels,
orphan or disconnected elements…)
## Đề xuất sửa (ưu tiên)
(numbered list, most important first, each concrete enough to apply; include the fix for every failed mandatory check)
Judge only what is in the design; never invent elements it does not have.
