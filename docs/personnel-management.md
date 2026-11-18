# 成員排序與授權移除（2026-11-18）

沿用正式 FastAPI、原有三種角色及私有 `DATA_DIRECTORY/state.json`，不是 localStorage 模擬。初次展示僅修改本機；後續使用者已確認並授權提交與推送，實際結果以 Git 紀錄為準。未部署、未改初始公開資料或院方帳號；Git 推送不等於正式伺服器已更新。

## 使用方式與資料

「單位成員」先選所屬單位，拖曳把手或以「上移／下移」及 Enter 調整，再按「儲存順序」。重新整理及公開頁面使用相同保存順序，單位成員摘要亦同步。調整期間先儲存或重新載入，再切換單位／編輯／新增／刪除；其他頁面導覽及重新整理會捨棄尚未儲存的排序。手機表格在自身區域橫向捲動，可聚焦後使用方向鍵。

`people.display_order` 為單位內非負整數，舊資料沒有此欄位時保留既有相對順序，新成員加入最後。完整名單版本、登入、CSRF 及單位範圍由後端檢查；同時編輯發生衝突回傳 409，不覆蓋新資料。寫入使用既有鎖及原子 JSON 替換，保留成員歷史與操作紀錄，不加入資料庫或套件。

「人員權限」依既有單位順序分組，再按原有角色「系統管理員 → 醫研部總管理員 → 單位管理員」及姓名／識別值排序。高階角色原資料未保存單位隸屬，放在「全站管理」組，不猜測所屬單位。姓名選填，無姓名則以識別值呈現；新增、修改及刪除後重新排序。多單位管理員在各單位分列。

## 刪除與一致性

- 兩頁刪除均先顯示姓名及影響範圍；取消／Escape 不寫入。確認版本涵蓋成員與相關授權，期間有變動須重新確認，不會部分刪除。
- 刪除成員只移除目前單位名單並更新摘要／前台，保留院方登入帳號、其他單位名單及已建立內容。單位角色只可操作自己的單位。
- 原有成員與授權沒有共同識別欄位，不以姓名比對。高階管理員可於成員表單選填 `account_identity`，只可選擇已有該單位授權或全站角色的帳號，同帳號於同單位不得重複關聯。單位管理員不能自行設定關聯。此欄位只存私有資料，公開 JSON 回應遞迴移除，不進公開搜尋。
- 刪除明確關聯的成員，若為此帳號在本單位最後一筆成員關聯，同一交易中移除此單位的 `unit_admin` 授權；其他單位保留。全站角色及伺服器保留角色不依附公開成員資格，不會因名單刪除而撤銷；確認視窗會說明。
- 人員權限刪除只撤銷所選列的單位範圍，全站角色刪除只撤銷管理授權，不刪院方帳號／公開成員／內容。移除授權或縮減範圍時清除不再適用的私人帳號關聯。停用授權保留關聯但立即禁止管理存取。
- 系統管理員可處理高階角色；醫研部總管理員仍只能管理單位管理員；一般單位角色不開放人員權限入口或 API。伺服器保留管理員不可刪，最後一位有效系統管理員不得移除。移除自身權限後返回仍可管理的後台或院內專區。

## 新 API

`GET/PUT /api/manage/people/order/{unit_id}`；`GET /api/manage/people/{id}/delete-preview` 與 `DELETE /api/manage/people/{id}`；`POST /api/manage/grants/delete-preview` 與 `DELETE /api/manage/grants`。授權刪除指定 identity 及單一 unit，全站角色用 null；所有寫入沿用既有 CSRF、角色、範圍及版本控制。

## 本機預覽

`python -m tests.serve_management_fixture --port 8011 --personnel-preview` 僅監聽 127.0.0.1，用虛構人員、測試 Session 及臨時目錄；正式 Docker 不複製 tests，也不提供測試登入路由。預覽操作實際寫入隔離目錄，重新整理會保留，關閉測試服務後清除；正式後端的相同功能保存於正式私有資料卷。本次未測院方真實登入或部署。

## 檔案清單

| 新增／修改檔案 | 目的 |
| --- | --- |
| [backend/personnel.py](../backend/personnel.py)（新增） | 排序、刪除預覽、範圍刪除、一致性與摘要同步 |
| [backend/management.py](../backend/management.py) | 接入 API、姓名／關聯驗證、公開順序與私有欄位過濾 |
| [assets/js/management-personnel.js](../assets/js/management-personnel.js)（新增） | 拖曳／上下移、保存、分組排序、確認視窗與列表更新 |
| [assets/js/management-views.js](../assets/js/management-views.js) | 人員模組載入與頁面路由 |
| [assets/js/management.js](../assets/js/management.js) | 姓名、明確帳號關聯及單位表單 |
| [assets/css/management.css](../assets/css/management.css) | 既有風格的把手、分組、視窗及可捲動表格 |
| [tests/check_personnel.py](../tests/check_personnel.py)、[tests/check_personnel_sort.mjs](../tests/check_personnel_sort.mjs)（新增） | 真實 API、持久化、權限、一致性及排序回歸 |
| [tests/serve_management_fixture.py](../tests/serve_management_fixture.py) | 選用隔離示範及識別提示 |
| [scripts/check-navigation-search.mjs](../scripts/check-navigation-search.mjs) | 檢查新動態載入資源 |
| [README.md](../README.md)、[management-guide.md](management-guide.md)、[role-permission-matrix.md](role-permission-matrix.md)、[phase-1-acceptance.md](phase-1-acceptance.md)、本文件 | 操作、權限及實測紀錄 |
