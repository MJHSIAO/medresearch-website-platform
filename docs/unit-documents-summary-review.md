# 單位文件、共用檔案與摘要調整（2026-11-18）

初次展示先在本機完成；後續使用者已確認移除示範文件並提交、推送文件管理及摘要變更。六份示意文件與 HTML 素材已移除，保留人體生物資料庫原始 PDF、正式換檔及消息關聯。原人工智慧中心獨立專案未修改。

## 檢查結果與管理方式

| 入口 | 管理的資料與儲存 | 前台位置 |
| --- | --- | --- |
| 單位文件與表單（原「文件表單」） | data/documents.json 預設值；管理後保存在私有 state.content.documents。檔案由 file.href 引用 | 對外：所屬單位 unit.html 的文件下載區及全站下載總目錄；院內：登入後的院內專區 |
| 共用檔案庫（原「檔案與附件」） | 私有 DATA_DIRECTORY 的實體 PDF／PNG／JPEG，加 state.files 上傳紀錄 | 單獨上傳不會發布；供文件與消息編輯器選用 |
| 消息附件 | state.content.news 的 attachments 等欄位引用同一實體檔案 | 對應消息詳細頁；不自動建立文件下載項目 |

三者沿用既有 Store、登入與管理 API，不是三套重複上傳系統。檔案庫顯示引用；同單位可重用既有檔案。更換某文件的 file.href 不會改掉其他內容的引用；移除關聯不會直接刪除實體檔案。仍被公開內容引用的檔案維持公開。後端禁止不同公開範圍的已發布內容共用同一實體檔案。

單一單位管理員由後端取得唯一授權單位；多單位及高階管理員選擇授權範圍內單位。建立後歸屬固定。單位管理員不能讀寫其他單位文件或檔案庫。總管理員及系統管理員可跨單位。院內範圍代表所有已登入院內人員可讀取，管理權限另外依單位驗證。

文件具備名稱、分類、說明、版本、文件日期、草稿／發布／下架、對外／院內範圍；列表及編輯器標示歸屬與發布位置。日期與伺服器 updated_at 分開，舊項目沿用原日期，儲存不把歷史日期自動改成今天。

單位摘要沿用原 short_description，新增 1–100 字檢查與字數統計；full_description 完整介紹獨立保存。首頁、隸屬單位、部門介紹單位卡片及搜尋共用單位資料，重新載入即可同步。私有或未啟用單位不透過部門介紹卡片露出。

## 已完成與環境界線

- 已完成：真實 HTTP 上傳、私有 JSON 與實體檔案持久儲存、後端角色／單位／CSRF 驗證、公開與院內清單、受保護下載／預覽、共用選用、摘要同步。沿用既有歷史及稽核。
- 測試環境：先前六份 HTML 文件及文件示範模式已移除；本機預覽仍以虛構帳號及暫存測試目錄隔離寫入，不影響正式資料。原始九份 PDF 保留。
- 正式部署：需啟用既有 FastAPI 服務、院方 SSO、HTTPS、持久 DATA_DIRECTORY、備份與維運；純靜態託管不能提供登入、寫入或院內權限。
- 未提供：Word／Excel、大檔分段、病毒掃描、物件儲存或多程序資料庫；保留現有 PDF／PNG／JPEG、5 MB 限制。內建預覽瀏覽器未呈現 PDF 內容時，可另開檢視或下載，不能把空白內嵌畫面當作內容已成功顯示。

## 修改檔案

| 檔案（相對專案根目錄） | 目的 |
| --- | --- |
| assets/js/management-shell.js | 導覽名稱釐清，保留既有路由 |
| assets/js/management-views.js | 文件歸屬、發布位置與範圍；檔案庫用途及引用提示 |
| assets/js/management.js | 共用檔案選用元件載入；單位摘要欄位及字數驗證 |
| assets/js/document-editor.js | 日期、範圍、發布位置、上傳及既有檔案選用 |
| assets/js/file-picker.js（新增） | 文件與消息共用的單位範圍檔案選用視窗 |
| assets/js/news-editor.js | 選用既有檔案；區分消息附件與單位下載 |
| assets/js/documents.js | 共用全站、單位及院內文件清單與下載／預覽 |
| assets/js/units.js | 各單位文件下載區及導覽入口 |
| unit.html | 載入共用文件元件及樣式 |
| assets/js/internal.js | 登入後載入院內文件清單 |
| assets/js/data-service.js | 部門單位卡片從單位主資料解析摘要 |
| assets/js/main.js | 部門介紹卡片共用摘要 |
| assets/js/search.js | 搜尋同步更新後的單位卡片摘要 |
| assets/css/documents.css | 單位內嵌清單與窄版文件卡片 |
| assets/css/management.css | 共用檔案選用視窗及手機樣式 |
| backend/documents.py | 日期／範圍／同單位檔案驗證、引用檢查及共用下載解析 |
| backend/management.py | 自動單位歸屬、範圍檔案庫、引用資訊、院內 API、摘要限制 |
| backend/analytics.py | 受保護文件下載及預覽；排除院內下載與預覽統計 |
| backend/portal.py | 院內文件區及共用資源 |
| scripts/check-navigation-search.mjs | 新共用資源及單位下載錨點檢查 |
| tests/check_unit_documents.py（新增） | 文件、檔案重用、院內下載與摘要持久儲存測試 |
| tests/check_documents.py | 更新合法院內範圍後保留無效範圍拒絕檢查 |
| tests/check_resource_search.mjs | 摘要共用、來源資料保留、私有單位卡片排除 |
| tests/serve_management_fixture.py | 本機隔離文件示範資料與醒目提示 |
| docs/management-guide.md | 操作說明、發布位置、正式與 Demo 界線 |
| docs/content-model.md | 文件日期、院內範圍、檔案引用及摘要模型 |
| docs/role-permission-matrix.md | 沿用角色範圍與院內讀取規則 |
| docs/unit-documents-summary-review.md（本文件） | 本次檢查結果、檔案清單與驗證記錄 |

## 實際驗證

- 通過 tests.check_unit_documents、check_documents、check_management、check_analytics、check_personnel、check_biobank、check_portal、check_resources。測試使用隔離目錄：自動歸屬、跨單位拒絕、CSRF、共用檔案、院內登入及匿名拒絕、草稿／下架、歷史日期、儲存重讀、摘要 100 字限制、完整介紹不變與既有功能回歸。
- 通過 check_resource_search.mjs、check_biobank_search.mjs、check_news_editor.mjs、check_personnel_sort.mjs；涵蓋搜尋公開過濾、單位卡片摘要及既有人員排序。
- 通過靜態檢查：JSON 解析、JavaScript 語法、CSS 括號、HTML 內部資源、JSON 資源目標及 Markdown 本機連結；完成 build-site.mjs 建置及 git diff --check。
- 瀏覽器實測：從共用檔案庫上傳 PDF 成功，保持未引用狀態；文件選用同單位既有檔案並發布，重新整理後保留 2020-01-02 文件日期。生物資料庫與 AI 單位各自顯示自身文件，院內文件只出現在院內清單。
- 瀏覽器實測：摘要修改同步首頁、隸屬單位及部門介紹卡片；101 字為無效，完整介紹保持原文，示範後已還原原摘要。
- 桌機 1280px、平板 768px 與手機 320px 實測：公開單位文件、院內文件、後台列表／編輯與檔案選用無整頁水平捲動；文件搜尋可篩至 0 筆，Enter 開啟選用／預覽、Escape 關閉並返回原焦點。
- 尚未執行正式 SSO、正式部署與院方環境驗收；未宣稱這些項目通過。
