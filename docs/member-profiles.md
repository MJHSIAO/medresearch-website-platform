# 本部個人介紹與論文成果

2026-11-23，本機開發並展示後，使用者已確認並授權提交、推送 GitHub，未部署正式站。九位成員沿用 `people.json` 原紀錄、姓名、職稱、順序、分組、`profile_href` 與既有授權。部門介紹的「查看介紹」及姓名搜尋改至 `person.html?id=成員ID`，院方醫師介紹另提供外部連結。

## 管理方式與字數

管理中心 → 單位成員 → 編輯 → 本站個人介紹。可啟停個人頁、選用同單位照片或上傳 PNG/JPEG（5 MB 內）。空白欄位不產生公開空區塊。短簡介仍由既有「簡介」管理，完整介紹另存，不互相覆蓋。

| 欄位 | 上限（字元） |
| --- | ---: |
| 英文姓名／學位、公開電子郵件 | 各 200 |
| 公開電話／分機 | 100 |
| 完整介紹、研究成果／榮譽／專利 | 各 20000 |
| 現職、學歷、經歷、研究領域／專長 | 各 10000 |
| 院方醫師介紹網址 | 2048 |
| 其他外部連結 | 最多 20 筆，名稱 100、網址 2048 |
| 單筆論文完整引用文字 | 5000 |
| 論文成果類型、連結 | 80、2048 |
| 論文年份 | 1800–2100 或空白 |

文字欄位即時統計，伺服器亦驗證限制。純文字呈現，保留換行，禁止插入 HTML。論文引用容許數學符號並轉義輸出。

「管理論文與成果」獨立儲存，修改成員不會覆蓋成果。每位最多 2000 筆、每批最多 50 筆，以空白行分隔完整引用；可逐筆編輯或確認刪除，年份可修正。前後台均每頁 20 筆，可搜尋引用文字及篩選年份，不截斷長引用。發布後的成果會隨公開個人頁顯示，沒有另外的成果草稿狀態。新增／修改／刪除均有稽核及版本資料；尚未提供獨立成果的歷史還原介面。

## 來源與資料保留

查核日期 2026-11-23，公開專業資料取自下列院方頁面，照片下載 7 張至本機素材。原始網址、原頁日期保留於後台資料，不在個人介紹加上匯入提示。來源是歷史公開履歷，不代表已由本人確認現況。

| 成員 | 來源 | 原頁日期 | 成果筆數 |
| --- | --- | --- | ---: |
| 張至宏 | [ViceR](https://depart.femh.org.tw/medresearch/ViceR.html) | 2025-07-03 | 59 |
| 吳彥雯 | [DirMR](https://depart.femh.org.tw/medresearch/DirMR.html) | 2025-07-03 | 0 |
| 姜智耀 | [院方醫師介紹](https://www.femh.org.tw/section/sectionDetail2.aspx?CID=0406&&DoctorID=97737) | 未提供 | 0 |
| 李明怡 | [MYL](https://depart.femh.org.tw/medresearch/MYL.html) | 2025-07-03 | 12 |
| 周三芳 | [SFC](https://depart.femh.org.tw/medresearch/SFC.html) | 2025-07-03 | 21 |
| 張瓊方 | [CFC](https://depart.femh.org.tw/medresearch/CFC.html) | 2025-12-12 | 25 |
| 陳燦麒 | [TCC](https://depart.femh.org.tw/medresearch/TCC.html) | 2026-08-07 | 109 |
| 廖秀蓉 | [HJL](https://depart.femh.org.tw/medresearch/HJL.html) | 2026-10-27 | 68 |
| 萬恩慈 | [本部名單](https://depart.femh.org.tw/medresearch/staff.html) | 2026-05-04 | 0 |

合計 294 筆，含期刊論文、研討會論文及邀請演講。萬恩慈只有公開姓名／職稱，未補寫照片或履歷。廖秀蓉一筆榮譽原頁字元損壞未擅自推測，後台「資料核對記錄」標示待確認。未逐一驗證所有論文外部網站仍可取得全文。

## 儲存、權限與遷移

- `people.profile` 為個人介紹；`data/publications.json` 為初始成果，實際修改延用私有 JSON Store，並有版本衝突檢查。不是 localStorage 模擬。
- 新 API 沿用 Session、CSRF、來源驗證及既有 people 單位範圍；單位管理員限授權單位，總管理員跨單位。未新增角色或授權帳號。
- 公開 API 同時檢查成員、單位及個人頁啟用狀態；停用頁面不提供完整介紹或成果。上傳照片只有公開有效引用才能匿名取得，未發布或停用後須授權。既有來源照片屬已公開的靜態素材，隱藏頁面不等於撤除原始公開網址。
- 升級標記 `member-profiles-2026-11-23`，先備份既有狀態，再僅補缺少欄位；保留自訂內容及被刪除的人員。一次性遷移不會在之後重啟時復活已刪成果。
- 個人頁需要現有 Python 後端 API；單純 GitHub Pages 無此管理及個人頁動態服務。院方真實 OAuth 姓名欄位仍待驗證，未改其設定；本機預覽為隔離測試帳號，未正式部署。

## 檔案清單與用途

| 新增／修改 | 用途 |
| --- | --- |
| `person.html`、`assets/css/member-profile.css`、`assets/js/member-profile.js` | 共用個人頁、響應式與介紹顯示 |
| `assets/js/member-profile-editor.js`、`assets/js/member-publications.js` | 編輯欄位與前後台共用成果清單 |
| `data/people.json`、`data/publications.json`、`assets/images/people/`（7 張） | 九位既有成員介紹、294 筆成果及照片 |
| `backend/member_profiles.py` | 個人頁／成果 API、驗證、權限與持久化 |
| `backend/personnel.py`、`backend/management.py`、`backend/documents.py` | 接入既有儲存、公開過濾、照片引用與下載保護 |
| `backend/store.py`、`backend/main.py` | 保守升級與啟動接入 |
| `backend/analytics.py` | 個人頁歸屬單位的瀏覽統計 |
| `assets/js/management.js`、`assets/js/file-picker.js` | 重用成員表單、上傳與圖片篩選 |
| `assets/js/data-service.js`、`assets/js/search.js` | 卡片、姓名搜尋導向本站個人頁 |
| `assets/js/main.js`、`assets/js/announcements.js` | 個人頁不顯示舊站整理提示，其他頁及正式公告維持 |
| `tests/check_member_profiles.py`、`tests/check_member_profiles.mjs` | 新功能、隔離、遷移與長文字驗證 |
| `tests/check_department_search.mjs`、`scripts/check-navigation-search.mjs` | 更新搜尋入口及本機連結／素材檢查 |
| `README.md`、`PLANS.md`、相關管理／權限／導覽文件與本文件 | 功能、限制與操作說明 |

## 實際驗證結果

- 通過 `tests.check_member_profiles`：九位公開頁、獨立長篇成果、分頁／篩選／版本衝突、CSRF、跨單位拒絕、照片上傳及停用／單位隱藏後的匿名下載拒絕、持久化及保守遷移。
- 通過 `tests.check_department`、`tests.check_personnel`、`tests.check_management`、`tests.check_documents`、`tests.check_analytics` 既有回歸。
- 通過 `tests/check_member_profiles.mjs`、`tests/check_department_search.mjs` 及 `scripts/check-navigation-search.mjs --static-only`：長篇引用不截斷、轉義、批次限制、搜尋、JSON、JavaScript 語法、CSS 括號、本機 HTML 資源及 Markdown 連結。
- 比對 HEAD 確認所有既有成員欄位與其他單位紀錄保留。
- 瀏覽器實測介紹儲存後前台同步，論文批次新增、搜尋、確認刪除、重新開啟仍為原有 59 筆；測試文字已清除。使用 Enter 操作儲存、成果分頁及確認；Esc 關閉手機選單、成果視窗關閉後焦點返回原按鈕。
- 公開頁 1280／768／320px 的 document scrollWidth 分別為 1265／753／305px；320px 編輯表單及成果視窗亦為 305px，無整頁水平捲動。照片正常載入，未見整理提示文案。
- 本機預覽使用隔離暫存資料與測試帳號；未執行院方登入、正式部署。

## 使用者確認後的組織圖調整

依使用者提供的 PNG，新增 assets/images/department-organization.png（SHA256 C0AED2331A2C35E14DC964F488F52247FCDE6FBAABC1B1A04CAFD6E090AB583A）。data/pages.json 的查看組織架構改至此圖，data-service.js 相容舊私有資料中的 structure.html 連結，resource-directory.js 與 resource-directory.css 提供同頁原生 dialog、關閉／Esc 與焦點返回、手機圖內捲動及文字等價說明。保留舊頁來源 metadata，未變更任何隸屬單位資料。tests/check_department_search.mjs 與既有連結檢查同步更新。

組織圖已實測桌機／320px 同頁開啟、Enter 操作、Esc 關閉及焦點返回；手機 document scrollWidth 為 305px（視窗 320px），700px 圖片僅在 281px 圖內區域捲動，照片原圖載入寬度 1448px。
