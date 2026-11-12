---
id: policy.diagram-syntax
version: 1.0.0
owner: harness
description: PlantUML / C4-PlantUML and Mermaid syntax rules for diagrams the model writes itself (12/11 plan 03)
order: 30
---

<diagram_syntax>
## DIAGRAM SYNTAX (PlantUML / C4-PlantUML / Mermaid)

Every diagram you write must render without a syntax error. Syntax seen in reference material or in an earlier diagram of the conversation never overrides these rules; only an explicit user request does (for example "no legend").

PlantUML / C4-PlantUML:
1. One diagram = one ```plantuml block with exactly one `@startuml` … `@enduml` pair and nothing else in the block.
2. C4: include exactly one library for the level: `!include <C4/C4_Context>`, `<C4/C4_Container>`, `<C4/C4_Component>` or `<C4/C4_Sequence>` (one include, no URLs mixed with stdlib).
3. Aliases are ASCII `lower_snake_case` (letters, digits, `_`), no spaces, `-` or Vietnamese diacritics, unique within the diagram. Labels may use any language.
4. Use the exact macro signatures: `Person(alias, "Label", "Desc")`, `System(alias, "Label", "Desc")` / `System_Ext(...)`, `Container(alias, "Label", "Tech", "Desc")`, `ContainerDb(...)`, `ContainerQueue(...)` (same 4 arguments, `_Ext` for external), `Component(alias, "Label", "Tech", "Desc")`, `Rel(from, to, "Label", "Tech")`.
5. Boundaries: `System_Boundary(alias, "Label") { … }` or `Container_Boundary(alias, "Label") { … }`. Never draw a `Rel` to or from a boundary; connect the elements inside it.
6. Every label is inside `"..."`, on one line (use `\n` for a line break), with inner double quotes removed or escaped.
7. Directions only with `Rel_D` / `Rel_U` / `Rel_L` / `Rel_R` or `Lay_*`. Never mix raw PlantUML arrows (`-->`) with C4 macros in one diagram.
8. Never write Mermaid syntax (`flowchart`, `graph TD`, `-->|x|`) inside a plantuml block, and never PlantUML inside a mermaid block.
9. End every C4 diagram except sequence with `SHOW_LEGEND()` before `@enduml`.
10. Before answering, check every block against this list. In research mode, call `validate_diagram` on every PlantUML block and fix each reported error.

Mermaid: every label with spaces, glyphs or punctuation is quoted (`A["δ<sub>l</sub> ≥ 3"]`); no raw text line outside a node or edge label; one statement per line.

Correct example (C4 Container, microservices with one database per service):
```plantuml
@startuml
!include <C4/C4_Container>
HIDE_STEREOTYPE()

title Ticketing - Container

Person(customer, "Customer", "Books tickets")
System_Boundary(ticketing, "Ticketing System") {
  Container(web_app, "Web App", "React", "Booking UI")
  Container(booking_service, "Booking Service", "Spring Boot", "Manages bookings")
  Container(payment_service, "Payment Service", "Spring Boot", "Handles payments")
  ContainerDb(booking_db, "Booking DB", "PostgreSQL", "Bookings")
  ContainerDb(payment_db, "Payment DB", "PostgreSQL", "Payments")
}
System_Ext(payment_gateway, "Payment Gateway", "Card processing")

Rel_D(customer, web_app, "Books tickets", "HTTPS")
Rel(web_app, booking_service, "Calls API", "REST/JSON")
Rel_R(booking_service, payment_service, "Requests payment", "REST/JSON")
Rel_D(booking_service, booking_db, "Reads/writes", "JDBC")
Rel_D(payment_service, payment_db, "Reads/writes", "JDBC")
Rel_R(payment_service, payment_gateway, "Charges card", "HTTPS")

SHOW_LEGEND()
@enduml
```
</diagram_syntax>
