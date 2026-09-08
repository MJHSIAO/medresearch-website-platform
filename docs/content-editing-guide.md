# 網站文字與圖片編輯指南

本網站以共用 JSON 資料驅動畫面。修改正式版本時，請優先編輯 `data/`，不要到六個單位頁面重複修改相同文字。

## 各區塊對應位置

| 畫面內容 | 編輯檔案 | 主要欄位或位置 |
| --- | --- | --- |
| 全站名稱、頂端提醒、主選單、醫研部聯絡資訊 | `data/site.json` | `name`、`notice`、`navigation`、`contact` |
| 首頁固定標題、服務說明、單位區及聯絡區標題 | `index.html` | 直接搜尋畫面上的中文標題 |
| 首頁常用研究服務卡片 | `data/services.json` | `title`、`description`、`href` |
| 一般內容頁 | `data/pages.json` | `title`、`summary`、`sections` |
| 單位卡片、子站主標、簡介、宗旨、目標、業務、重點領域、聯絡資訊 | `data/units.json` | 找到該單位的 `id`，修改 `short_description`、`full_description`、`purpose`、`goals`、`services`、`research_fields`、`contact` |
| 單位常用入口 | `data/units.json` | `resource_links` |
| 單位專屬文字區塊 | `data/units.json` | `special_sections` 中的 `title`、`intro`、`items` |
| 單位成員卡片 | `data/people.json` | `unit_id`、`name`、`title`、`bio`、`visibility` |
| 單位成員摘要／後台單位資料 | `data/units.json` | `members`；應與 `data/people.json` 保持一致 |
| 新聞卡片與詳細頁 | `data/news.json` | `title`、`summary`、`content`、`category`、`published_at`、`owner_unit_id`、`related_unit_ids` |
| 新聞封面圖片 | `data/news.json` ＋ `assets/images/news/` | 圖片放入資料夾，再填寫 `cover_image` 與 `cover_alt` |
| 新聞詳細頁多張圖片 | `data/news.json` ＋ `assets/images/news/` | `gallery` 中的 `src`、`alt` |
| 新聞／單位共用區塊標題與排列 | `assets/js/main.js`、`assets/js/news.js`、`assets/js/units.js` | 只有要改所有頁共用模板時才修改 |
| 共用外觀、新聞圖片比例、單位版面 | `assets/css/public-site.css`、`assets/css/responsive.css` | 只有要改所有頁外觀時才修改 |
| 人工智慧中心獨立頁面文字 | `ai-center/` | 基本單位與新聞仍讀取共用 JSON；獨立版面文字才修改此資料夾內檔案 |

## 六個單位識別碼

| 單位 | `id` |
| --- | --- |
| 學術研發室 | `academic-office` |
| 共同研究室 | `core-laboratory` |
| 動物實驗室 | `animal-laboratory` |
| 臨床試驗中心 | `clinical-trial-center` |
| 細胞治療中心 | `cell-therapy-center` |
| 創新智財產學中心 | `innovation-ip-center` |

## 新聞顯示規則

- `visibility` 必須是 `public` 或 `both`。
- `status` 必須是 `published` 才會出現在首頁及單位子站；`expired` 只保留在歷史新聞列表。
- 六個共用子站會顯示全站最新三則公開消息，讓各單位都能同步醫研部新聞。
- `owner_unit_id: "medresearch"` 表示消息由醫學研究部負責。
- 單位自己的新聞以該單位 `id` 填入 `owner_unit_id`。
- 跨單位新聞只建立一筆，其他相關單位填入 `related_unit_ids`。
- `cover_image` 使用相對路徑，例如 `assets/images/news/example.jpg`；`cover_alt` 必須說明圖片內容。

## 成員名單維護規則

- 詳細成員卡片以 `data/people.json` 為主要顯示資料，每位公開成員一筆。
- `data/units.json` 的 `members` 是單位摘要及後台預覽資料，也要同步更新。
- 未公開姓名者可寫成原官網的職務與人數，例如「照護員二名」，不得自行補造姓名。
- 公開頁只顯示 `visibility: "public"` 或 `"both"`。

## 後台 Demo 的限制

行政後台 Demo 儲存的資料只存在目前瀏覽器的 `localStorage`，可用來展示預覽，但不會修改 Repository 的 JSON，也不會自動更新 GitHub。要正式更新 GitHub Pages，仍需修改上述檔案、commit 並 push。

## 編輯後檢查

1. 確認 JSON 使用半形雙引號，最後一個項目後面沒有多餘逗號。
2. 執行 `npm run build`。
3. 確認公開頁未顯示 `internal`、草稿、待確認或封存內容。
4. 在桌機及 320px 手機寬度檢查成員、新聞圖片與導覽。
5. Commit 後 push 到 `origin/feature/medresearch-platform-v1`。
