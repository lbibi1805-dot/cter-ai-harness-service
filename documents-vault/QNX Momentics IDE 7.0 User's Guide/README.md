---
title: "QNX Momentics IDE 7.0 User's Guide — Master Index"
category: "master-index"
tags: [qnx, master-index, rtos]
---

# QNX Momentics IDE 7.0 User's Guide — Master Index

> Vault đã reformat Full: 122 files → YAML frontmatter, xóa header rác HTML, sửa typo, dedup, wikilink chéo. Entry-point cho LLM/Obsidian.

## Cấu trúc
```
QNX Momentics IDE 7.0 User's Guide/
├── README.md (bạn đang đọc)
├── About-This-Guide.md
└── System-Architecture/
    ├── System Architecture.md + The Philosophy...
    ├── Thread-and-Processes/ (+ CodeSnippet/ 24 APIs)
    ├── Thread-Scheduling/ (priority, policies)
    ├── Synchronization-services/ (Mutex, Semaphore...)
    ├── Clock-and-timer-services/ (+ CodeSnippets/)
    ├── Interrupt-Handling/ (+ CodeSnippets/)
    └── IPC/ (Channels, Pulses, Shared_Memory, MessageQueues, Signals...)
```

## Quick Navigation — Theo Thư Mục

| # | Thư mục | Số file | INDEX |
|---|---|---|---|
| 1 | `.` | 1 | [[00-INDEX.md|INDEX]] |
| 2 | `System-Architecture` | 2 | [[System-Architecture/00-INDEX.md|INDEX]] |
| 3 | `System-Architecture/Clock-and-timer-services` | 1 | [[System-Architecture/Clock-and-timer-services/00-INDEX.md|INDEX]] |
| 4 | `System-Architecture/Clock-and-timer-services/CodeSnippets` | 10 | [[System-Architecture/Clock-and-timer-services/CodeSnippets/00-INDEX.md|INDEX]] |
| 5 | `System-Architecture/IPC` | 14 | [[System-Architecture/IPC/00-INDEX.md|INDEX]] |
| 6 | `System-Architecture/IPC/CodeSnippets/Creating-Shared-Memory-Object` | 8 | [[System-Architecture/IPC/CodeSnippets/Creating-Shared-Memory-Object/00-INDEX.md|INDEX]] |
| 7 | `System-Architecture/IPC/CodeSnippets/Message` | 11 | [[System-Architecture/IPC/CodeSnippets/Message/00-INDEX.md|INDEX]] |
| 8 | `System-Architecture/IPC/CodeSnippets/MessageQueues` | 8 | [[System-Architecture/IPC/CodeSnippets/MessageQueues/00-INDEX.md|INDEX]] |
| 9 | `System-Architecture/IPC/CodeSnippets/Signals` | 4 | [[System-Architecture/IPC/CodeSnippets/Signals/00-INDEX.md|INDEX]] |
| 10 | `System-Architecture/IPC/CodeSnippets/Typed Memory` | 3 | [[System-Architecture/IPC/CodeSnippets/Typed Memory/00-INDEX.md|INDEX]] |
| 11 | `System-Architecture/IPC/Shared_Memory` | 4 | [[System-Architecture/IPC/Shared_Memory/00-INDEX.md|INDEX]] |
| 12 | `System-Architecture/Interrupt-Handling` | 5 | [[System-Architecture/Interrupt-Handling/00-INDEX.md|INDEX]] |
| 13 | `System-Architecture/Interrupt-Handling/CodeSnippets` | 10 | [[System-Architecture/Interrupt-Handling/CodeSnippets/00-INDEX.md|INDEX]] |
| 14 | `System-Architecture/Synchronization-services` | 9 | [[System-Architecture/Synchronization-services/00-INDEX.md|INDEX]] |
| 15 | `System-Architecture/Thread-Scheduling` | 5 | [[System-Architecture/Thread-Scheduling/00-INDEX.md|INDEX]] |
| 16 | `System-Architecture/Thread-and-Processes` | 3 | [[System-Architecture/Thread-and-Processes/00-INDEX.md|INDEX]] |
| 17 | `System-Architecture/Thread-and-Processes/CodeSnippet` | 24 | [[System-Architecture/Thread-and-Processes/CodeSnippet/00-INDEX.md|INDEX]] |

## Quy ước Reformat
- **YAML frontmatter** mỗi file: `title`, `category`, `source`, `tags`
- **H1** chuẩn: tên hàm/API
- **Đã xóa**: header table `|   |   |` + `Link to this page` (59 files), duplicate IPC block, footer date
- **Đã sửa**: `Synchonization services` → `Synchronization-services`, `Thread-Schedulling` → `Thread-Scheduling`
- **Liên kết**: mỗi thư mục có `00-INDEX.md` với wikilink `[[file|title]]` để AI traverse offline
- **External URL** `https://www.qnx.com/...` vẫn giữ để tra gốc

## Gợi ý truy vấn cho AI
- "pthread_attr_* APIs" → `Thread-and-Processes/00-INDEX.md` + `CodeSnippet/00-INDEX.md`
- "MsgSend vs mq_send" → `IPC/00-INDEX.md` → `MsgSend(), MsgSend_r().md` + `MessageQueues/00-INDEX.md`
- "Mutex vs Semaphore" → `Synchronization-services/00-INDEX.md`

---
*Reformatted 122 files — 17 folders — 2026-08-30*