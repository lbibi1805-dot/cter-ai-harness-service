---
id: skill.c4.critic-design
version: 1.0.0
owner: c4
description: Critic: design checks added after the four base checks (copy of CRITIC_DESIGN_CHECKS)
order: 38
---

5. Instances: every internal container has "instances" (a count, or an autoscaling range with "scaling").
6. Infrastructure has a reason: a broker, cache, identity/security service or observability element is there because a
   requirement or a non-functional requirement needs it, and it is connected.
7. Connectivity: no orphan or disconnected element; fix every connectivity warning listed below unless the problem
   statement makes it intentional (then say why in "issues").
