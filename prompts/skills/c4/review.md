---
id: skill.c4.review
version: 1.1.0
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
Multi-tenancy, Security service, Instances and scaling, and one row "Connectivity" (every element connected, enough
links). A topic that does not apply scores "N/A" with the reason in one sentence.)
## Yêu cầu chưa đáp ứng
(bullets: requirements of the problem the design does not show, and design discussion topics the design ignores although
they apply; "- Không có" when none)
## Lỗi ký hiệu C4
(bullets: wrong element kinds, missing technology on containers/components, unlabeled relationships, mixed levels,
orphan or disconnected elements…)
## Đề xuất sửa (ưu tiên)
(numbered list, most important first, each concrete enough to apply)
Judge only what is in the design; never invent elements it does not have.
