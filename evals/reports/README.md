# Eval reports

| File | Nội dung |
|---|---|
| `eval-report-vi.ipynb` | Báo cáo eval tiếng Việt (biểu đồ + nhận xét) |
| `eval-report-en.ipynb` | English report, storytelling version |
| `report_lib.py` | Đọc dữ liệu + vẽ biểu đồ dùng chung cho 2 notebook |
| `data/` | `cache-<label>.json` (`npm run eval:cache`), `reference-resolution.json` (`REF_EVAL_OUT`), `incident-gemini-503.json`, `qa-run1-partial.json`, `latency-*.json` |

Kết quả QA/essay đọc từ `../results/` (`npm run eval`, `npm run eval:essay`).

## Chạy lại

```bash
# 1. harness local trỏ DEV (không bao giờ prod), rồi:
HARNESS_URL=http://localhost:3000 npm run eval -- --judge
HARNESS_URL=http://localhost:3000 npm run eval:essay -- --judge
HARNESS_URL=http://localhost:3000 npm run eval:cache -- --label v2-k2 --scenario long
REF_EVAL_OUT=evals/reports/data/reference-resolution.json npx vitest run tests/unit/modules/context/referenceResolution.golden.test.ts
# 2. mở notebook trong thư mục này và Run All (cần pandas, matplotlib), hoặc:
python -m nbconvert --to notebook --execute --inplace eval-report-vi.ipynb
```

Mỗi case eval gọi model thật và tạo hội thoại trên dev: xoá hội thoại và file vault tạm sau khi chạy.
