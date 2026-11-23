# 醫學研究部本部整合（2026-11-23，本機）

## 權限與操作

本部管理員沿用 `unit_admin`，授權單位為 `medresearch`，不新增高階角色。系統管理員或醫研部總管理員在「人員權限」選擇「單位管理員」、勾選「醫學研究部（本部）」。`site_admin` 仍為可跨單位的醫研部總管理員，兩者不同。本次未設定任何真實帳號授權，OAuth 與待驗證的姓名欄位不變。

本部管理員可維護本部介紹、摘要、簡稱、聯絡資訊、成員、消息、文件與檔案；不能操作子單位、一般內容頁、首頁服務、全站公告、人員授權及系統外觀。沿用伺服器角色、單位、CSRF、版本衝突與即時撤權驗證。

本部介紹從「單位資料」編輯；人員沿用新增、職稱、排序、歷史及刪除確認。本部另有「本部顯示區域」與公開介紹連結，控制主管／成員分區，兩區都引用同一筆 people 資料。公開成員不會自動成為管理帳號。

## 前台、來源與舊資料

沿用 `content-page.html?page=department-about`，依序顯示本部介紹、組織與主管、本部成員、八個隸屬單位。本部不算自己的隸屬單位。首頁及原導覽保留，姓名搜尋連到 `#department-members`。介紹使用 units 主資料，頁面 JSON 只保存版面與入口，避免重複維護主管姓名及文案。

本次以瀏覽器實際讀取 [原官網成員頁](https://depart.femh.org.tw/medresearch/staff.html)，原頁更新 **2026-05-04**，本次查核 **2026-11-23**。匯入九筆公開人員：院長室研究副院長、部主任、研究醫師、五位研究員及專員。保留來源日期與原站公開介紹網址；未推測未公開的業務、分機或電子郵件。研究副院長註明原站所屬院長室，本站以本部管理範圍維護主管介紹，不改變院方組織歸屬。

未逐頁重新擷取個人介紹；僅保留原成員頁提供的連結，研究醫師使用其直接院網連結。本部介紹沿用專案已保存內容；子單位原有成員未重匯或覆寫。未知聯絡資料不補造，歷史日期不改為新發布日期。

唯一的本部資料保存在 data/units.json，成員共用 data/people.json。既有私有 state 啟動時先做一次性原始備份，再補缺少的本部及人員；保留其他單位、授權、檔案、版本與稽核。舊一般頁面已自訂的本部介紹會移入本部主資料，包含僅曾編輯一般頁面的情況。遷移冪等，相同 ID 不覆蓋，刪除後不重新補回。

右側使用 loopback 隔離服務、虛構登入身分與暫存資料；管理寫入為實際 HTTP 與私有 JSON，不是 localStorage 模擬。初次本機展示後，使用者已確認並授權提交、推送；實際結果以 Git 紀錄為準，未部署正式站或建立正式管理員。

## 修改檔案

| 檔案 | 目的 |
| --- | --- |
| data/units.json、data/people.json、data/pages.json | 本部單一資料、九位人員、既有部門頁入口與來源 |
| backend/management.py、backend/personnel.py | 本部人員的既有範圍授權、分組及連結驗證 |
| backend/store.py、backend/main.py | 備份、一次性升級及自訂介紹保留 |
| backend/analytics.py | 本部統計選項去重，保留範圍限制 |
| assets/js/data-service.js、assets/js/main.js | 本部與子單位分開、共用資料解析與公開過濾 |
| assets/js/resource-directory.js、assets/js/search.js | 成員錨點、來源日期及搜尋導覽 |
| assets/js/management.js | 分組與介紹連結編輯、授權提示、單位去重 |
| assets/js/management-views.js、assets/js/news-editor.js、assets/js/document-editor.js、assets/js/management-analytics.js | 移除本部的舊額外重複選項 |
| tests/check_department.py、tests/check_department_search.mjs | 權限、CRUD、遷移、公開同步與搜尋測試 |
| tests/serve_management_fixture.py | 本機本部管理員預覽，不進正式容器 |
| scripts/check-navigation-search.mjs | 本部單一資料、成員及內部入口一致性 |
| README.md、PLANS.md、docs/role-permission-matrix.md、docs/management-guide.md、docs/navigation-search.md、本文件 | 操作、來源、權限與驗證記錄 |

## 實際驗證

- 通過 tests.check_department：授權、本部內容與人員維護、排序／刪除、公開同步、稽核、跨單位與全站限制、撤權、文件歸屬、不安全連結及異常分組拒絕；備份、保留自訂頁面／授權、冪等及刪除不復活。
- 通過 check_management、check_personnel、check_analytics、check_documents、check_unit_documents、check_resources、check_backend 的既有回歸測試。
- 通過 check_department_search.mjs、check_resource_search.mjs、check_biobank_search.mjs、check_personnel_sort.mjs：八個子單位不混入本部、介紹及姓名同步、順序、內部／草稿排除、搜尋錨點。
- 瀏覽器：本部管理員只看到本部、九位人員與原職稱；Enter 儲存成功。前台顯示四個區塊，主管兩位與成員七位分區；成員錨點及姓名搜尋可導覽。授權表單有本部選項與角色差異提示，未儲存真實授權。
- 前台 1280／768／320px 的 scrollWidth 為 1265／753／305px；320px 成員表單亦無整頁水平捲動。未執行正式部署與院方正式帳號驗收。

## 使用者確認後的文案調整

依使用者要求，移除本部成員簡介中「原官網所列」等贅述、區塊的匯入與實作說明，以及本部頁面的來源提示區。保留姓名、職稱、已公開的實驗室介紹及個人介紹連結；來源網址、更新／查核日期仍留在資料欄位與本文件，其他頁面的來源提示維持。未編造新簡介。

## 本站個人頁後續整合

九位成員已改用本站個人介紹，院方醫師連結及來源資料保留；舊的外部介紹導向由啟用的本站個人頁取代。[來源、限制與檔案清單](member-profiles.md)。
