# Usability Engineering — Condensed Knowledge Base
## Course: COSC3159/COSC3160 | Weeks 1–11 (no Week 7)

---

## Core Definitions

- **Usability** (ISO 9241-11): extent to which specified users achieve specified goals with effectiveness, efficiency, and satisfaction in a specified context.
- **Utility**: whether the system has the functions needed. Usability: whether users can use those functions effectively.
- **Usability engineering**: systematic approaches, processes, methods, and techniques for designing usable interfaces.
- **Heuristic**: pragmatic rule for reaching a good-enough solution; does not guarantee optimal outcomes.
- **Heuristic evaluation**: systematic UI inspection against heuristics to identify usability problems.
- **User-centered design (UCD)**: design approach prioritising users, empirical measurement, and iteration.

---

## Nielsen's 5 Usability Attributes

| Attribute | Measured by | Primary user group |
|---|---|---|
| Learnability | Time/tasks to reach proficiency | Novice users |
| Efficiency | Time to complete tasks | Expert users |
| Memorability | Time to re-learn after absence | Casual/infrequent users |
| Error prevention | Error count, recovery time, severity | All users |
| Satisfaction | Subjective feedback, surveys | All users |

---

## Nielsen's 10 Usability Heuristics

**H1 — Simple and Natural Dialogue**
Interfaces should contain only relevant information in a natural order. Remove unnecessary elements; group related items; guide attention through layout, font, color, and size.

**H2 — Speak the User's Language**
Use words, phrases, and icons familiar to the user — not system or developer terminology. Design from user logic, not internal system logic.

**H3 — Minimize User Memory Load**
Present options visibly rather than requiring recall. Use menus, dropdowns, defaults, autocomplete, placeholders, and context-aware suggestions.

**H4 — Consistency**
Same visual style (fonts, colors, layout), same interaction patterns, and same terminology across all screens. Users should not wonder whether different things mean the same thing.

**H5 — Feedback**
Always inform users what the system is doing and how it interpreted their input. Feedback must be timely, relevant, specific, and instructional — not abstract.

**H6 — Clearly Marked Exits**
Users must be able to leave any state. Provide visible undo, cancel, back, and restart options. Example: Ctrl+Z. Encourage exploration without fear of irreversible mistakes.

**H7 — Shortcuts**
Provide accelerators for experienced users: keyboard shortcuts, abbreviations, customizable shortcuts, and interaction history reuse. These go beyond standard GUI navigation.

**H8 — Good Error Messages**
Messages must be clear, polite, helpful, and specific. Avoid codes and jargon. Guide users toward a solution. Offer ways to recover previous error-free states.

**H9 — Prevent Errors**
Design to eliminate errors before they occur: predefined choices, confirmation dialogs for destructive actions, distinct interfaces for different modes/roles, unambiguous instructions.

**H10 — Help and Documentation**
Ideally the interface is self-descriptive. When documentation is needed, make it accessible, searchable, and task-oriented.

---

## Norman's Interaction Principles

1. **Affordances** — relationship between product properties and user capabilities; what the UI supports ("what is this for?")
2. **Signifiers** — visual cues showing where interaction should occur
3. **Mappings** — correspondence between controls, actions, and results
4. **Feedback** — perceived result of an action
5. **Constraints** — what the UI is not intended to do
6. **Conceptual model** — simplified explanation of how the system works

---

## Heuristic Evaluation Procedure (4 steps)

1. **Choose heuristics** — Nielsen's 10 (and/or Norman's principles)
2. **Prepare team, templates, scope** — 5–8 evaluators find 75–85% of problems; define one task, page, user group, device
3. **Evaluate independently** — each evaluator works alone for 1–2 hours; two passes: first for structure/familiarity, second for issue identification; include good design as well as problems
4. **Consolidate** — discuss agreement/disagreement, prioritize by severity, identify short- and long-term fixes

**Each finding must include:** UI element/location · task context · problem description · heuristic violated · severity (0–4) · recommendation

**Severity scale:** 0 = not a problem · 1 = cosmetic · 2 = minor · 3 = major · 4 = catastrophe (fix before release)

**Tactful writing:**
- Poor: "The menu is a complete mess."
- Better: "Menus are not organized by function, making it difficult for users to locate related actions."

---

## Usability Evaluation Methods — Comparison

| Method | Type | Users needed | Stage | Best for |
|---|---|---|---|---|
| Heuristic evaluation | Expert inspection | No real users | Any stage | Finding UI principle violations quickly |
| Formative user testing | Qualitative observation | 5+ representative users | Prototype/iteration | Finding problems to fix in next iteration |
| Field study | Qualitative observation | Real users in real context | Working system | Finding real-context problems |
| Controlled experiment | Quantitative | Multiple groups | Prototype or live | Testing hypotheses (e.g., A vs B) |
| Questionnaire | Self-report | Large sample | After use | Comparing groups; scalable opinion data |
| Interview | Verbal exploration | Small sample | Before or after design | Motives, context, exploratory insight |
| Focus group | Group discussion | 6–9 users, 1–2 hours | Before or after design | Broad needs and holistic experience |
| User logs / analytics | Behavioral trace | Many users | Live system | Actual use patterns at scale |
| A/B testing | Quantitative comparison | Large groups | Live system | Comparing design variants by outcome metric |
| Observation | Behavioral | Real users | Real context | Task analysis; unexpected behaviors |

**Key distinctions:**
- Questionnaire vs Interview: questionnaires are structured, scalable, comparable; interviews are richer, flexible, costly at scale.
- Formative vs Summative testing: formative = improve the design (qualitative); summative = measure whether goals are met (quantitative).
- Heuristic evaluation vs User testing: evaluators inspect the UI vs users interact with the UI.

---

## Usability Engineering Lifecycle (5 stages)

1. **Needs Analysis** — know the user, competitive analysis, set measurable usability goals
2. **UI Design** — parallel design (independent alternatives), participatory design (users react to concrete designs), coordinated design (consistency across product lines)
3. **UI Prototyping** — horizontal (breadth, simplified features) or vertical (depth, full features for few areas); apply guidelines; use paper, fake data, simplified algorithms
4. **Usability Testing** — empirical testing with real users; qualitative (why?) and quantitative (whether goals met?)
5. **Iterative Design** — revise based on findings; field feedback after release; released products act as prototypes for later versions

**Heuristic evaluation placement:** most applicable at the UI prototyping stage and between iterations, before committing to user testing.

---

## User-Centered Design (UCD) — 3 Principles

1. **Early focus on users and tasks** — study user characteristics, behavior, and context from the start; technology is the means, not the goal
2. **Empirical measurement** — define usability goals and measures early; evaluate alternatives regularly throughout development
3. **Iterative design** — understanding of users improves over time; designers rarely solve problems correctly on the first attempt

---

## User Testing — Key Elements

### Test plan checklist
What to test · what data to collect · who the users are · ethical concerns · how data will be collected and analyzed · criteria for success.

### Test users
Must represent intended users. Between-subjects: different users test different systems. Within-subjects: same users test multiple systems.

### Test tasks — good task criteria
Represents typical use · covers important interface areas · outcome/goal-oriented (not step-by-step instructions) · realistic scenario · organized simple to complex · keeps user confidence intact.

### Number of users
5 users ≈ 84% of problems (Nielsen-Landauer model; L = 31% per user). Having the right users matters more than having more users.

### Ethics in user testing
- Respect time · make user comfortable · obtain informed consent · preserve privacy · give user control to stop at any time
- Tell users: the system, not the user, is being tested
- Debrief after testing; protect identity; avoid having a user's manager observe

### Performance measurements
- Learnability: task completion time for novices
- Efficiency: task time for experts
- Memorability: re-learning time after absence
- Error prevention: error count, recovery time
- Satisfaction: subjective expressions and survey scores

---

## Knowing the User

**User cube (Nielsen):** 3 dimensions — computer usage experience · task domain knowledge · novice-to-expert learning curve.

**3 user interaction dimensions:** Cognition/knowledge · Action/skills · Emotion/attitude.

**Norman's 7 action-cycle questions:** What do I want? → What are my options? → What can I do now? → How do I do it? → What happened? → What does it mean? → Did I succeed?

**Knowledge in the head vs world:** External cues (labels, menus, feedback) reduce memory burden. H3 directly addresses this.

**Task analysis outputs:** list of user goals · information needs · communication needs · activities · intermediate and final outcomes · acceptability criteria.

---

## Standards and Accessibility

**Types:** national · international · vendor · in-house.

**WCAG (international):** Perceivable · Operable · Understandable · Robust.

**Why standards matter:** skill transfer across systems · lower training cost · error prevention · user confidence · reduced support load.

**Internationalization (I18N):** universal system structure supporting all users across contexts.
**Localization (L10N):** adapting UI/content to a specific language, culture, or user group. Translation includes culture, not just language. Icons and number formats vary by culture.

---

## Contemporary Practice (Week 11)

**Interaction design** asks: What is the product's purpose? Who uses it? How, where, when? By what means does the user interact?

**Contemporary qualitative methods:** cultural probes · diary studies · questionnaire · focus groups · contextual inquiry · observation · heuristic analysis.

**Contemporary quantitative methods:** analytics · survey · A/B testing · crowdsourcing · user experiments.

**A/B testing procedure:**
1. Identify design variable (independent variable)
2. Prepare Design A (existing) and Design B (new)
3. Assign users to groups
4. Define outcome measure (dependent variable, e.g., click rate)
5. Collect data over fixed period
6. Compare and analyze statistically

---

## Common Exam Mistakes to Avoid

- Confusing utility (does the system have the feature?) with usability (can users use it effectively?)
- Writing tasks as step-by-step instructions instead of goal-oriented scenarios
- Recruiting convenient users who are not representative of the target population
- Reporting heuristic findings without naming the specific heuristic violated
- Using vague language: "bad design," "hard to read," "confusing interface"
- Ignoring severity, frequency, or user impact
- Making recommendations not connected to observed findings
- Writing reflective essays without linking to specific course concepts, methods, or frameworks
