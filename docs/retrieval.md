# Retrieval 2 giai đoạn — Dense vector search + Cross-encoder rerank

> Code: `src/modules/retrieval/` (candidate generation) · `src/modules/rerank/` (reranking) · Wiring: `src/index.ts`
> Số liệu: golden 37 câu — Hit@1 69,7% → **90,9%**, MRR 0,802 → **0,947** (chi tiết `CHANGES.md` §2.1).

## Sơ đồ tổng thể

```mermaid
flowchart TD
    S([Nhan cau hoi]) --> E[Bien cau hoi thanh vector - Gemini hoac OpenAI]
    E --> V[Do cosine similarity tren Pinecone - lay 40 chunk gan nhat]
    V --> B[Cat chunk dai thanh 2 doan van chong nhau 20 phan tram - gan them breadcrumb duong dan va heading]
    B --> R[Cham diem tung cap cau-hoi-doan-van - cross-encoder bge-reranker-v2-m3]
    R --> D{Rerank co tra ve ket qua trong 5s?}
    D -->|co| T[Xep hang theo diem rerank - giu top N chunk diem cao nhat]
    D -->|khong| F[Bo qua rerank - giu nguyen thu tu cosine]
    T --> P[Ghep chunk vao prompt - single-shot 8 chunk, agent 10 chunk]
    F --> P
    P --> E2([Goi model de tra loi])
```

> **Note — Khác biệt cốt lõi giữa 2 giai đoạn:**
> - **Giai đoạn 1 (bi-encoder):** câu hỏi và chunk được biến thành vector **riêng rẽ**, rồi đo góc cosine giữa 2 vector. Nhanh, nhưng model lúc embed chunk không hề biết câu hỏi là gì → chỉ bắt được "na ná nghĩa".
> - **Giai đoạn 2 (cross-encoder `bge-reranker-v2-m3`):** nhét **cả câu hỏi + đoạn văn vào cùng một model transformer**, cho attention chạy chéo giữa từng từ của câu hỏi với từng từ của đoạn văn, rồi output đúng 1 con số: điểm liên quan. Vì nó "đọc" cả hai cùng lúc nên bắt được quan hệ sâu (ví dụ câu hỏi tiếng Anh hỏi về mutex, đoạn văn tiếng Việt viết về mutex nhưng dùng từ khác) mà cosine bỏ sót. Đắt hơn nhiều — nên chỉ chấm 40 ứng viên, không chấm cả vault.

## Ai dùng retrieval

```mermaid
flowchart TD
    S([Nhan request - file START hoac chat]) --> M{Doc mode cua request?}
    M -->|khong co mode agent| SS[Truy van vault 1 lan - goi model tra loi 1 lan]
    M -->|co mode agent| AG[Lap di lap lai - goi model - goi tool search read list]
    AG --> OK{Agent co tra loi duoc?}
    OK -->|co| E1([Tra ve cau tra loi mode agent])
    OK -->|khong| SS
    SS --> E2([Tra ve cau tra loi mode single-shot])
```

## Luong agent day du - tu request toi tra loi

```mermaid
flowchart TD
    S([Nhan request - file START hoac chat]) --> M{Request co xin mode agent?}
    M -->|khong| SS[Truy van vault 1 lan - goi model tra loi 1 lan]
    SS --> E2([Tra ve cau tra loi mode single-shot])
    M -->|co - hau to agent hoac header mode| G{Du dieu kien agent?}
    G -->|thieu - key - pinecone - provider - model| F1[Rot ve single-shot - ghi ro ly do]
    F1 --> E2
    G -->|du| R[Goi model - lan dau bat buoc phai goi tool]
    R --> W{Model doi goi tool?}
    W -->|khong - da co cau tra loi| E1([Tra ve cau tra loi mode agent])
    W -->|co| B{Con ngan sach - duoi 6 tool call va trong 180s?}
    B -->|het| F2[Goi model lan cuoi - cam goi tool - buoc phai tra loi]
    F2 --> C{Model co chiu tra loi?}
    C -->|co| E1
    C -->|van doi goi tool| ERR[Nem loi]
    ERR --> F3[Rot ve single-shot]
    F3 --> E2
    B -->|con| T[Chay tool duoc goi - search read hoac list]
    T --> TE{Tool co bi loi?}
    TE -->|co| SE[Gui cau bao loi cho model de thu lai cach khac]
    SE --> R
    TE -->|khong| R
```

### Input - output cua tung tool

| Tool | Input | Output |
|---|---|---|
| `search_vault` | `query` (bat buoc - tu khoa can tim), `folder` (tuy chon - chi tim trong thu muc nay) | Toi da 5 doan van, moi doan gom `file - heading - relevance %` + noi dung chunk. Kem `sources` = danh sach file de lam tai lieu trich dan |
| `read_document` | `path` (bat buoc - duong dan file trong vault), `heading` (tuy chon - chi doc 1 section) | Nguyen file, hoac 1 section (tu heading do den heading ngang/hon ke tiep). Path la thi bao "khong co trong vault", heading sai thi tra ve danh sach heading co san. Thanh cong thi file duoc tinh la nguon trich dan |
| `list_folder` | `folder` (tuy chon - bo trong thi liet ke goc vault) | Danh sach thu muc kem so file, hoac danh sach file trong thu muc - toi da 60 dong. Chi de kham pha, **khong** tinh la nguon trich dan |

## Vì sao 2 giai đoạn

| Quan sat tren eval | Ket luan |
|---|---|
| Cosine Hit@10 = 100%, Hit@1 = 69,7% | Tai lieu dung da co mat — van de la xep hang, khong phai recall |
| Rerank thuan Hit@1 = 90,9% vs RRF fusion 81,8% | Chon rerank thuan, loai fusion |
| Vault tieng Viet, cau hoi tieng Anh | Model da ngon ngu xu ly dung ca truot ngon ngu |
| Timeout 5s, SDK retry tat, loi thi fallback cosine | Rerank la toi uu hoa, khong phai dependency |

## Tham số (`RERANK_*` trong `.env`)

| Bien | Mac dinh | Y nghia |
|---|---|---|
| `RERANK_PROVIDER` | `none` | `pinecone` = bat, `none` = cosine cu |
| `RERANK_MODEL` | `bge-reranker-v2-m3` | Cross-encoder da ngon ngu |
| `RERANK_CANDIDATES` | `40` | So ung vien cosine truoc rerank |
| `RERANK_TOP_N` | `8` | Chunk giu lai cho prompt single-shot |
| `RERANK_TIMEOUT_MS` | `5000` | Qua han thi fallback cosine |
