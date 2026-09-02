# 內容模型

## 單位 `units`

每個單位只有一筆主要資料，主站卡片、單位列表、單位首頁及完整介紹共同讀取。

| 欄位 | 用途 |
| --- | --- |
| `id` | 不變的內部識別碼 |
| `name` | 正式名稱；結構性欄位 |
| `slug` | 網址代碼；結構性欄位 |
| `short_description` | 100–150 字簡介，供卡片與搜尋結果使用 |
| `full_description` | 單位首頁與完整介紹內容 |
| `hero_image` / `hero_alt` | 主視覺與替代文字 |
| `services` | 主要服務項目 |
| `research_fields` | 研究方向或特色 |
| `members` | 主管及成員摘要 |
| `contact` | 聯絡窗口、電話、信箱、地址 |
| `status` | 單位啟用狀態 |
| `visibility` | `public`、`internal` 或 `both` |
| `display_order` | 全站顯示順序；結構性欄位 |
| `site_href` / `site_about_href` | 選用；指定獨立單位子站及介紹頁入口 |
| `updated_at` / `updated_by` | 最後更新資訊 |

## 最新消息 `news`

| 欄位 | 用途 |
| --- | --- |
| `id` | 消息識別碼 |
| `owner_unit_id` | 主要負責單位；正式系統由後端依登入身分設定 |
| `related_unit_ids` | 共同顯示單位，避免跨單位消息重複建立 |
| `category` | 類別 |
| `title` / `summary` / `content` | 標題、摘要與本文 |
| `cover_image` / `cover_alt` | 封面圖片與替代文字 |
| `attachments` | 附件名稱、格式、大小及正式儲存資訊 |
| `visibility` | `public`、`internal` 或 `both` |
| `status` | `draft`、`pending_review`、`published`、`expired`、`archived` |
| `published_at` / `event_date` / `expires_at` | 發布、活動及截止日期 |
| `created_*` / `updated_*` | 稽核欄位 |

## 公開顯示規則

- 公開頁：只讀 `public`、`both`。
- 公開消息：只顯示 `published` 與供歷史查詢的 `expired`。
- 首頁消息：只顯示未過期的 `published`。
- `internal` 不得因搜尋、URL 參數或關聯推薦而出現在公開頁。
- `draft`、`pending_review`、`archived` 只在有權限的後台範圍中呈現。

## Demo 覆寫層

原始 JSON 是預設資料。Demo 將單位編輯結果存於 `medresearch_demo_unit_{id}`，新增或編輯消息存於 `medresearch_demo_news`。讀取時合併覆寫，因此同一筆單位資料能同步出現在後台預覽與所有公開版型。此做法不是正式資料庫。

