---
title: "QNX-TESTING — Master Index"
category: "master-index"
tags: [qnx, testing, master-index]
---

# QNX-TESTING — Master Index

> Tài liệu kiểm thử & đo coverage trong QNX Momentics IDE 7.0 — đã reformat cho Obsidian.

## Flow

```
Writing and building test programs.md (GTest)
        ↓
Running test programs.md (Launch → Run, C/C++ Unit view)
        ↓
Measuring code coverage.md (Coverage launch, GCOV_PREFIX)
   ↙           ↘
Importing...   Exporting... (HTML report)
```

## Quick Navigation

| # | File | Chức năng |
|---|---|---|
| 1 | [[Unit Testing.md|Unit Testing]] | Tổng quan 3 framework (Boost, GTest, Qt) + link tới 4 sub-doc |
| 2 | [[Writing and building test programs.md|Writing and building test programs]] | GTest: `gtest/gtest.h`, `RUN_ALL_TESTS()`, link libgtest.so |
| 3 | [[Running test programs.md|Running test programs]] | Launch Config (Run, Test Runner), C/C++ Unit view screenshot |
| 4 | [[Measuring code coverage.md|Measuring code coverage]] | Build flags, Coverage launch, `GCOV_PREFIX`, `.gcda/.gcno`, qconn signals, `sleep()` caveat |
| 5 | [[Importing Code Coverage results.md|Importing Code Coverage results]] | Import GCC coverage (.gcda) từ target, GCOV_PREFIX, Target Navigator |
| 6 | [[Exporting Code Coverage results.md|Exporting Code Coverage results]] | Export HTML report `index.html` → browser |

## Quy ước Reformat
- YAML frontmatter `title/category/source/tags` cho AI
- Xóa header rác `|   |   |` + `Link to this page` + footer date
- `UntiRunning test programs tled.md` → `Running test programs.md` (typo)
- Code ` #include <gtest/gtest.h>` bọc ```c, profiling error bọc ```
- Mỗi file có wikilink trong `00-INDEX.md`

---
*Reformatted 6 files — 2026-08-30*