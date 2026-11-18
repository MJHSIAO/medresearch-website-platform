# 人體生物資料庫九份文件統一管理

初次整合於本機展示；後續使用者已確認移除全部示範文件，並授權將文件管理與單位摘要變更提交、推送。Git 更新不等於正式部署；不操作原人工智慧中心獨立專案。

## 使用方式與資料保存

九份原有辦法及表單已移入 data/documents.json，每份一筆，owner_unit_id 固定 biobank。後台「單位文件與表單」可修改名稱、分類、說明、版本、日期、狀態及更換檔案；沿用單位權限、CSRF、版本衝突、歷史與稽核。前台單位「文件下載」、全站總目錄及搜尋共用相同 records，不保留第二份下載清單。

原「辦法及表單」區塊與 #biobank-forms 錨點仍存在，改為導向 #unit-documents。組織、作業流程、收費、法規及歷史公告保留。三份相關原始 PDF（委員名單與兩份法規指引）留在各自用途區塊，此次未移入九份表單清單。

| 文件 ID | 原始檔案（保留不變） | 日期 |
| --- | --- | --- |
| biobank-consent | assets/documents/biobank/2026416163558.pdf | 2026-01-15 |
| biobank-withdrawal | assets/documents/biobank/20260314001.pdf | 2025-09-03 |
| biobank-usage-plan | assets/documents/biobank/20260314002.pdf | 待確認 |
| biobank-agreement | assets/documents/biobank/20260314003.pdf | 待確認 |
| biobank-confidentiality | assets/documents/biobank/20260314004.pdf | 待確認 |
| biobank-management-rules | assets/documents/biobank/20260314005.pdf | 待確認 |
| biobank-ethics-charter | assets/documents/biobank/20260314006.pdf | 待確認 |
| biobank-benefit-sharing | assets/documents/biobank/20260314007.pdf | 待確認 |
| biobank-report-remedy | assets/documents/biobank/20260314008.pdf | 2025-11-29 |

日期與差異依專案已保存的來源說明，未重新查核原站或推定檔名日期。原「參與者退出」實際為銷毀記錄單，另有通報救濟文件名稱差異，完整提醒均保留於 summary／唯讀 source_note。六份日期不明文件以空字串保存，不顯示匯入日期作為文件日期。source_checked_at 另標示原始查核日。

原始檔案沒有重傳、複製、改名或改內容。管理下載使用既有 /api/documents/{id}/download，以目前發布狀態控制清單及新下載入口。舊 assets 網址仍是公開靜態素材：下架只移出清單，換檔後原網址仍提供原 PDF；後台明確提示。原始公開 PDF 不能直接改為院內限定，如需新的院內版本，須更換為私有上傳檔案。原始檔案只對精確初始清單放行，任意靜態路徑不接受。

## 既有管理資料升級

啟動依序執行既有資源／單位升級，再執行 biobank-documents-2026-11-18。沒有 state.json 時直接使用初始資料，不建立正式狀態。已有 state 時，先保存 state.before-biobank-documents-2026-11-18.json，再原子寫入：

- 只補入九份缺少的文件；同 ID 或同單位同檔案已有管理項目則保留，避免重複。
- 舊單位表單連結的自訂名稱／說明帶入新增文件；其餘自訂入口、段落、單位、文件、授權、附件、歷史與稽核保留。
- 僅移除已搬移九份文件的舊清單引用，改為統一入口；原值仍在升級前備份。
- 標記一次性完成，重啟不覆蓋後台編輯，也不恢復管理員刻意移除的文件。

狀態備份不能取代完整資料卷備份；本次未連線或修改正式 DATA_DIRECTORY。預覽使用本機 8013 隔離暫存目錄及虛構單位管理員；只有原始公開文件來自專案。

## 本次新增與修改檔案

| 檔案 | 目的 |
| --- | --- |
| [data/documents.json](../data/documents.json) | 新增九份文件，保存原始檔案、來源及日期 |
| [data/units.json](../data/units.json) | 舊表單區改為共用下載入口，保留錨點 |
| [backend/documents.py](../backend/documents.py) | 原始 PDF 精確清單驗證、共用下載、來源保存及未知日期 |
| [backend/store.py](../backend/store.py)、[backend/main.py](../backend/main.py) | 一次性補入、備份與啟動整合 |
| [assets/js/documents.js](../assets/js/documents.js) | 原 PDF 預覽下載、日期待確認、來源與差異提醒 |
| [assets/js/document-editor.js](../assets/js/document-editor.js) | 空白日期、原始檔案保留提示 |
| [assets/js/search.js](../assets/js/search.js) | 搜尋來源說明，排除非公開單位文件 |
| [scripts/check-navigation-search.mjs](../scripts/check-navigation-search.mjs) | 檢查初始文件與原始檔案連結 |
| [tests/check_biobank_documents.py](../tests/check_biobank_documents.py)（新增） | 九份文件、升級與實際 API 的整合測試 |
| [tests/check_documents.py](../tests/check_documents.py)、[tests/check_biobank.py](../tests/check_biobank.py)、[tests/check_biobank_search.mjs](../tests/check_biobank_search.mjs) | 更新文件數、原始資源保留與搜尋路徑的回歸檢查 |
| [tests/serve_management_fixture.py](../tests/serve_management_fixture.py) | 九份真實公開文件的本機隔離預覽 |
| [README.md](../README.md)、[PLANS.md](../PLANS.md)、[biobank-integration.md](biobank-integration.md)、[management-guide.md](management-guide.md)、[content-model.md](content-model.md)、本文件 | 操作、資料模型、檔案清單與驗證紀錄 |

## 已實際執行的檢查

- check_biobank_documents：九份 PDF 內容及大小、原始與受管理網址、一次性備份／補入／重啟、既有自訂資料與同檔案去重、單位隔離、來源保留、未知日期、下架、換檔與歷史回復。
- check_documents、check_biobank、check_unit_documents、check_analytics、check_management：既有文件生命週期、20 份原始本機資源、32 則歷史日期、院內與公開隔離、摘要同步、角色與統計回歸。
- check_biobank_search.mjs、check_resource_search.mjs：公開文件搜尋、來源提醒及既有搜尋功能。
- 靜態檢查：JSON、JavaScript 語法、CSS 括號、HTML／JSON／Markdown 本機連結與資源存在。
- build-site.mjs 建置及 git diff --check 通過；提交與推送結果以 Git 紀錄為準。
- 瀏覽器：後台顯示九份文件，更新名稱同步前台並還原；空白日期儲存後仍為空白，前台顯示日期待確認。舊表單錨點導向下載區、分類篩至四份作業文件、搜尋原始退出提醒；Enter 開啟預覽、Escape 關閉並回到觸發按鈕。
- 桌機 1280px、平板 768px 及手機 320px 的文件區；320px 的後台列表與編輯器，均無整頁水平溢出。內建瀏覽器 PDF 顯示限制沿用原有另開與下載方式，未宣稱 PDF 全瀏覽器內嵌驗收或正式 SSO／遠端部署已通過。

## 示範文件移除

六份初始示範文件及 assets/documents/demo 下的六份 HTML 已移除，九份原始 PDF 不變。啟動時執行 retire-demo-documents-2026-11-18，一次性備份 state.before-retire-demo-documents-2026-11-18.json，移除 is_demo=true 或仍引用舊示範素材的文件；保留已更換正式檔案的項目、歷史、稽核、授權與實體上傳檔案。歷史紀錄不會重新授權已移除的 HTML 路徑。預覽工具的三份人工文件範例模式亦已移除。

新增 tests/check_document_retirement.py 驗證清理、備份、正式換檔保留及重啟冪等；README、PLANS、管理指南、資料模型與既有測試一併更新。刪除的 HTML：animal-guide、biosafety-form、lab-form、research-form、research-guide、trial-checklist。

移除示範文件後，實際重跑通過 check_document_retirement、check_documents、check_biobank_documents、check_unit_documents、check_management、check_analytics、check_biobank、check_personnel、check_resources、check_portal，以及四組搜尋／消息／人員 JavaScript 測試、靜態連結語法檢查、建置與 diff 檢查。正式上線仍需重建既有後端服務，啟動時才會執行舊資料清理與備份；Git 推送不代表已部署。
