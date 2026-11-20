# 操作紀錄姓名顯示（2026-11-20）

## 狀態與資料來源

本機功能完成並經使用者確認，已授權提交及推送 GitHub；實際結果以 Git 紀錄為準，未部署正式站。正式站實際登入已確認回傳欄位名稱含 unique_name、sub，沒有 name／preferred_username。unique_name 的實際姓名值尚未驗證，使用者要求繼續維持待驗證，OIDC_NAME_CLAIM 預設留空。設定與啟用步驟見 [登入授權說明](login-authorization.md)。不在 Repository 保存真實帳號與姓名對應。

新增 optional audit.actor_name 與 actor_name_claim，actor 員編及原有紀錄格式繼續相容。每次操作從已驗證的 Session claims 取得所設定的姓名，保存為當時快照；不依人員名單回填、不接受前端送出的操作者資料、不改歷史紀錄。空白設定／缺值／不合法姓名維持員編。姓名不參與授權，未新增角色或修改任何授權範圍。

## 修改檔案與目的

| 檔案 | 目的 |
| --- | --- |
| backend/identity.py | 共用姓名字串檢查及明確設定欄位的讀取；不猜測欄位 |
| backend/config.py | 讀取 OIDC_NAME_CLAIM，預設留空 |
| backend/auth.py | 登入顯示名稱優先使用已設定的有效姓名，保留原後備規則 |
| backend/management.py | 管理請求讀取可信姓名，所有共用 audit 寫入姓名快照 |
| assets/js/management-views.js | 工作台及紀錄頁顯示姓名（員編），舊項目保留員編並跳脫 HTML |
| .env.example、.env.docker.example | 預設不指定未確認姓名欄位，說明待驗證狀態 |
| tests/check_audit_identity.py | 姓名來源、快照、持久化、舊紀錄及權限測試 |
| tests/check_audit_display.mjs | 新舊顯示、異常值及 HTML 跳脫測試 |
| tests/check_oauth_login.py | JWT 與 UserInfo 模擬驗證流程中的姓名及不合法值測試 |
| tests/serve_management_fixture.py | 只在本機的虛構姓名預覽與無姓名歷史項目，寫入隔離暫存目錄 |
| docs/login-authorization.md、docs/management-guide.md、README.md | 設定、操作及待院方確認的界線 |
| docs/audit-identity-review.md | 修改與實際驗證紀錄 |
| PLANS.md | 記錄本次範圍、待驗證項目與使用者確認後的提交／推送授權 |

## 實際驗證

- 通過 tests.check_audit_identity：設定欄位限定、字串檢查、不使用表單／Session 顯示名／授權名單冒充 OAuth 姓名；保存重讀、姓名異動快照、舊紀錄完整保留、跨單位拒絕、匿名／一般人員拒絕、即時撤權。公開資料未帶入稽核姓名。
- 通過 tests.check_oauth_login：兩種已驗證身分來源的虛構姓名／異常值；原 OAuth 四參數、state、防重放、JWT 簽章／audience／時間檢查及安全錯誤處理保留。
- 通過 tests.check_backend、tests.check_management、tests.check_personnel、tests.check_portal、tests.check_documents 的既有回歸檢查。
- 通過 tests/check_audit_display.mjs：姓名（員編）、舊資料員編、異常姓名回退及 HTML 跳脫；通過既有 JSON／JavaScript／CSS／HTML 資源與 Markdown 本機連結靜態檢查。
- 瀏覽器以虛構人體生物資料庫管理員，使用 Enter 儲存原有單位資料；紀錄頁及工作台立即出現姓名（員編），重新整理後保留。原始 2020 年無姓名示範紀錄維持原員編及日期，正式資料未修改。
- 操作紀錄頁於 1280px、768px 及 320px 實測，scrollWidth 等於視窗寬度，沒有整頁水平捲動；320px 姓名與員編完整換行，Enter 可開啟管理選單及操作紀錄頁。預覽使用虛構帳號，不含真實姓名對應。

院方姓名值與正式部署後端到端驗收仍待完成。本機 HTTP 與私有 JSON 寫入為實際功能；隔離帳號與 OAuth 欄位值為測試資料，不等於完成正式院方姓名整合。
