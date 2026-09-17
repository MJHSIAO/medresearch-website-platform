# 長頁導覽與全站搜尋

## 本次範圍

延續原生 HTML/CSS/JavaScript/JSON；沒有加入框架、第三方搜尋、資料庫或後端。沒有修改獨立人工智慧中心來源 Repository。本專案內 AI 子站僅新增頁尾全站搜尋連結。

## 版面與導覽

- 共用 section 桌機 padding 由 `clamp(3rem, 7vw, 5.5rem)` 調成 `clamp(2.25rem, 5.25vw, 4.125rem)`，縮減 25%；手機為 1.75rem。Hero、區塊標題、內容頁與卡片間距同步適度縮減，保留卡片內文空間。
- 外層 `#site-header` 設為 sticky、top 0、z-index 100、白底。來源提醒維持正常文件流，不占固定導覽高度。
- `ResizeObserver` 量測 Header，寫入 `--header-height`，供錨點 scroll-margin-top 與側欄 top 使用；無支援時以 resize 事件更新。
- 六個共用子站以實際存在的 `section[id]` 與 h2 產生單一快捷導覽，既有上方單位導覽保留但不再 sticky。
- 寬度大於 62rem 時顯示左側 sticky 欄，其餘為水平可滑動列，不固定於視窗。連結保留標準 anchor、鍵盤操作與 focus 樣式。
- 高亮使用 IntersectionObserver，另以 requestAnimationFrame 節流的被動 scroll 事件補足超長 section 的門檻空隙。不支援 Observer 時仍可使用標準錨點。
- 沿用全站平滑捲動；偏好減少動態效果時不使用平滑動畫。
- 主選單在 70rem 以下收合，避免新增搜尋入口後擠壓 Header。

## 搜尋來源與欄位

| 資料來源 | 搜尋欄位 |
| --- | --- |
| `data/site.json` | name、description、platform_name、contact.unit/address、principles |
| `data/units.json` | name、short_description、full_description、purpose、goals、services、research_fields |
| `data/people.json` | name、title、bio、所屬單位名稱 |
| `data/news.json` | title、summary、content/body、category、published_at（原值及顯示日期）、event_date |

首頁 GET 表單提交到 `search.html?q=…`，支援 Enter。搜尋去除前後空白、Unicode NFKC 正規化及英文大小寫差異。完全符合標題 100 分、標題包含 75 分、摘要包含 50 分、正文包含 25 分；依分數排列並標明內容類型，相同分數依標題排序。

空白顯示「請輸入搜尋關鍵字」，零結果有獨立提示。資料載入失敗會顯示重試提示。顯示內容均以文字或 HTML escaping 輸出。

## 公開狀態與 Demo

共用 `MedData.isPublic/publicUnit/publicNews`。visibility 必須為 public 或 both；單位 status 必須 active；新聞只允許 published 或 expired。成員無 status 時依既有 visibility，若有 status 僅允許 active/published/expired。internal、draft、pending_review、archived 均被排除，且非公開單位下的成員與消息不納入搜尋。過期消息仍可搜尋，首頁仍排除過期消息。

單位與新聞透過 getUnits/getNews 讀取，同步套用 localStorage Demo 覆寫；不改角色權限與後台儲存格式。這是前端展示篩選，不是保護機密資料的安全控制；公開 JSON 絕對不可存放機密或真實個資。

## 連結與限制

- 所有結果使用相對路徑；以 `/medresearch-website-platform/` 前綴測試，不跳回網域根目錄。
- 單位與成員連結另開新分頁；成員導向共用子站成員區或 AI 介紹頁。新聞導向詳細頁。
- 本專案沒有實體 `news/`、`units/` 目錄，使用根目錄 HTML 與 query string。AI 子頁頁尾以 `../search.html` 連回搜尋。
- 目前是單一連續關鍵字比對，不包含斷詞、同義詞、錯字校正、圖片 OCR、附件內文或外部網站搜尋。例如「研究倫理」不會自動匹配「研究誠信」。
- 不索引全部 HTML 固定文案或 `data/pages.json`；範圍限於上表四個來源。

## 可重跑檢查

`scripts/check-navigation-search.mjs` 需 Node.js、可用的 Playwright 安裝及 Chromium/Edge 執行檔。這些僅用於開發測試，不是網站執行依賴，也不新增 npm dependency。

```powershell
node scripts/check-navigation-search.mjs "C:\path\to\playwright\index.mjs" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
```

腳本啟動限本機的臨時伺服器，以隔離瀏覽器 context 測試，不使用使用者的瀏覽器登入資料。涵蓋 JSON、JS 語法、CSS 括號、HTML 相對資源、新聞圖片、五種寬度、sticky、六個單位錨點與高亮、搜尋狀態與權重、Demo、燈箱及角色入口；結束關閉瀏覽器與伺服器。截圖輸出到系統暫存目錄。

CSS 括號檢查不等同完整 CSS validator；自動化鍵盤檢查不等同完整 WCAG 或螢幕閱讀器驗收。建置另執行 `npm run build`（或 `node scripts/build-site.mjs`）。
