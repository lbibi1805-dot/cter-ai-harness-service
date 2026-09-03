---
title: "INDEX: System-Architecture/IPC"
category: "index"
tags: [qnx, index]
---

# INDEX: System-Architecture/IPC

> Tổng hợp 14 tài liệu trong `System-Architecture/IPC` — wikilink cho AI/Obsidian Graph.

| # | File | Mô tả |
|---|---|---|
| 1 | [[Channels and connections.md|Channels and connections]] | In the QNX Neutrino RTOS, message passing is directed towards channels and connections, rather than targeted directly fr |
| 2 | [[Events.md|Events]] |  |
| 3 | [[Interprocess Communication (IPC).md|Interprocess Communication (IPC)]] | Interprocess Communication plays a fundamental role in the transformation of the microkernel from an embedded realtime k |
| 4 | [[Message copying.md|Message copying]] | Since our messaging services copy a message directly from the address space of one thread to another without intermediat |
| 5 | [[Message-passing API.md|Message passing API]] | The message-passing API consists of the following functions: |
| 6 | [[Pipes and FIFOs.md|Pipes and FIFOs]] | Pipes and FIFOs are both forms of queues that connect processes. |
| 7 | [[POSIX message queues.md|POSIX message queues]] | POSIX defines a set of nonblocking message-passing facilities known as _message queues_. |
| 8 | [[Priority inheritance and messages.md|Priority inheritance and messages]] | A server process receives messages and pulses in priority order. As the threads within the server receive requests, they |
| 9 | [[Pulses.md|Pulses]] |  |
| 10 | [[Robust implementations with Send-Receive-Reply.md|Robust implementations with Send Receive Reply]] | Architecting a QNX Neutrino application as a team of cooperating threads and processes via Send/Receive/Reply results in |
| 11 | [[Signals.md|Signals]] |  |
| 12 | [[Simple messages.md|Simple messages]] | For simple single-part messages, the OS provides functions that take a pointer directly to a buffer without the need for |
| 13 | [[Synchronous message passing.md|Synchronous message passing]] | Synchronous messaging is the main form of IPC in the QNX Neutrino RTOS. |
| 14 | [[Typed memory.md|Typed memory]] | Typed memory is POSIX functionality defined in the 1003.1 specification. It's part of the advanced realtime extensions,  |

---
*Auto-generated — 14 files — IPC*