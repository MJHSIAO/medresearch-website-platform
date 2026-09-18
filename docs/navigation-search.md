# 導覽與搜尋 UX — 2026-09-18

## 分支與範圍

工作分支為 feature/medresearch-platform-v1。開始時 HEAD 是 7679e8a（退回前次導覽搜尋變更），檔案樹與 2ff6196 相同，工作目錄乾淨。此版只修改檔案並測試，不 commit/push/merge，不操作 main 或獨立 ai-center-website-demo。

維持原生 HTML/CSS/JavaScript/JSON；未加入框架、搜尋套件、CMS、後端或正式登入。重用共用程式，不複製六份版型。

## 首頁與留白

- 首頁絕不建立本頁 Sidebar，因為它是跨單位資訊入口，不是長篇文章；共用導覽函式也明確排除 home。
- 桌機首頁 Hero 保留原本 `clamp(4rem, 10vw, 8rem)`，搜尋框放在標題／簡介之後，不塞入 Header。
- Hero 下內容區 section padding 從 `clamp(3rem, 7vw, 5.5rem)` 改為 `clamp(2.25rem, 5.25vw, 4.125rem)`，縮減 25%。標題與部分卡片最小高度適度縮減，卡片原有閱讀內距保留。
- 手機 section 1.75rem，Hero 3rem；單位 Hero 2.25rem，避免卡片文字貼邊。
- 首頁保留常用入口，接著優先最新消息、隸屬單位，再研究資源、任務、生態系及聯絡區。

## Sticky Header

外層 #site-header 使用 sticky、top 0、z-index 100、白底；來源提醒置於正常文件流，不永久占用高度。ResizeObserver 量測 Header 寫入 --header-height；不支援時以 resize 更新。section 的 scroll-margin-top 及側欄 top 共用此值。主選單 70rem 以下收合，跨斷點解除頁面捲動鎖定。

## 長頁快捷導覽

- 六個共用子站以實際 section[id] 與 h2 建目錄；選配區塊自然加入，未存在的區塊不顯示。
- 六個完整介紹頁沿用既有 h2 分段；資料來源移至內文末尾，避免同時有左右兩個側欄。
- 一般內容頁僅在至少四段時加入，目前是部門介紹與研究資源總覽；短篇不強加 Sidebar。
- 桌機左側 sticky，側欄高度可捲動且不與 Header 重疊。沿用標準 anchor 與 scroll-behavior；使用者偏好減少動態時取消動畫。
- IntersectionObserver 更新 .is-active/aria-current，搭配 requestAnimationFrame 節流的被動 scroll 監控處理超長區塊；無 Observer 時仍可正常跳轉。
- 992px 以下為預設收合的「本頁導覽」按鈕，aria-expanded/aria-controls 同步。Enter/Space 展開，Tab 進入項目，選取後收合且焦點移至對應區塊。Escape 收合並返回按鈕；觸控高度至少 44px。
- 首頁、新聞頁、短內容及 AI 獨立版型不加入 Sidebar。

## 搜尋資料

| JSON | 欄位 |
| --- | --- |
| site | name、description、platform_name、contact.unit/address、principles |
| units | name、short_description、full_description、purpose、goals、services、research_fields |
| people | name、title、bio、所屬單位名稱 |
| news | title、summary、content/body、category、published_at（原值與顯示格式）、event_date |

使用 GET 表單和 q 參數，trim、lowercase、Unicode NFKC 後 includes 比對。標題／姓名完全符合 100 分，標題包含 75、摘要包含 50、正文包含 25；依分數排列，相同分數依標題排序。結果含類型標籤、標題、摘要與連結。空白不建立索引，顯示輸入提示；零結果有提示；讀取失敗有重試說明。HTML 顯示皆 escape，關鍵字用 textContent。

visibility 必須 public/both；單位 status 必須 active；消息僅 published 或 expired；無 status 的成員依既有 visibility，有 status 時只接受 active/published/expired。共用 MedData.isPublic/publicUnit/publicNews，排除 internal/draft/pending_review/archived，並排除非公開單位下的成員與消息。過期消息可搜尋，首頁及子站最新三則仍排除過期。

getUnits/getNews 保留 Demo localStorage 覆寫。此為前端展示篩選，不是資料保密控制；公開 JSON 不得放機密或真實個資。

全部使用專案相對路徑；AI 頁尾為 ../search.html。共用 news/unit 採根目錄 HTML + query string，沒有實體 news/units 子資料夾。單位及成員結果另開分頁，新聞結果同頁進入詳細頁。

## 已知範圍限制

第一版只做連續關鍵字比對，不做同義詞、中文斷詞、錯字修正、圖片 OCR 或附件全文，也不搜尋所有固定 HTML 文字及 pages.json。例如「研究倫理」不會自動等同「研究誠信」。未改變院方資料或新增推測內容。

## 可重跑驗證

```powershell
node scripts/check-navigation-search.mjs "C:\path\to\playwright\index.mjs" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
node scripts/build-site.mjs
```

Playwright 僅為開發測試工具，不是網站 dependency。腳本使用隔離瀏覽器與限本機測試伺服器，以 /medresearch-website-platform/ 前綴測試。截圖輸出至系統暫存目錄，結束關閉伺服器及瀏覽器；不使用使用者瀏覽器的帳號或儲存資料。

CSS 括號檢查不等同完整 validator；自動化鍵盤與尺寸檢查不等同正式 WCAG、螢幕閱讀器或跨瀏覽器驗收。實際結果記錄於 phase-1-acceptance.md。
