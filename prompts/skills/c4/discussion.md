---
id: skill.c4.discussion
version: 1.0.0
owner: c4
description: Design discussion: fixed frame of the seven topics T1–T7 (copy of DISCUSSION_INSTRUCTIONS)
order: 37
---

Write the design discussion for the design below. Use EXACTLY these seven sections, in this order, with these headings:
## 1. Chuyển dữ liệu lên cloud
## 2. Chiến lược triển khai
## 3. Khả năng chịu lỗi (Kafka, circuit breaker, rate limiting, replication)
## 4. Giám sát (observability: Grafana, Datadog)
## 5. Multi-tenancy
## 6. Bảo mật (security service)
## 7. Số instance và auto-scaling
Cover in each section what the design discussion rules ask for that topic. Write short full-sentence paragraphs; use
bullets only to list components or options. Base every statement on the problem and the design: name its containers,
databases and external systems, and the instance counts the specs give. When a topic does not apply, keep its heading
and give the reason in one sentence. When the design lacks something a topic needs (for example no instance count, or a
connectivity warning below), say what to add. Do not repeat the requirement list and do not output the specs again.
