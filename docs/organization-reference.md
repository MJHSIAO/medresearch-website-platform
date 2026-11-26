# 2026-11-26 組織架構圖與共用單位圖示（本機待確認）

## 使用者確認後正式套用（2026-11-26）

使用者已確認示範並明確授權「修改程式跟上傳 GIT」。一般部門介紹、督導列表及七個介紹頁現在直接採用新版，無需 preview 參數，不顯示示範橫幅或示範頁名；舊示範網址仍相容。下方「本機待確認／僅示範」文字保留為先前階段紀錄，以本節為現行狀態。

共用元件使用 assets/js/department-directory.js、assets/css/department-directory.css；測試為 tests/check_department_directory.mjs。全站頁首／頁尾加入督導入口，初始 site.json 同步；已保存的舊網站設定也能顯示新入口。搜尋直接索引公開啟用的督導介紹，排除院內及草稿項目。既有督導頁的其他審查網站、自訂額外卡片、resource-group-1 與 governance-card-1-* 錨點保留，不覆蓋私有資料。

仍保留原圖視覺呈現的限制；督導介紹目前由公開 organization.json 維護，尚未提供管理中心編輯表單。未新增角色、未操作原 ai-center-website-demo、未部署正式伺服器。Git 提交與推送結果以本次交付及遠端紀錄為準。

確認後重新執行通過：check_department_directory、check_department_search、check_resource_search、check_biobank_search，以及後端 check_department、check_portal、check_management，涵蓋公開資料同步及既有角色隔離。瀏覽器以無示範參數的一般部門頁、督導列表、受試者保護中心介紹、搜尋及首頁 × 320／1280px 共 10 組核對，無示範標示、全站有督導入口，scrollWidth 分別等於 clientWidth 305／1265px。搜尋可直接到新的督導介紹頁。

## 實作與限制

修改前，部門介紹的「查看組織架構」使用原生 dialog 顯示舊 PNG，文字說明寫在 resource-directory.js；首頁／列表使用 main.js 的不同線條圖示，單位子站則使用文字簡稱。

本次依使用者提供的「醫學研究部組織架構圖2.png」替換圖片，SHA256 為 C662FD0BC74AE365540DEFEBD01598E494FB27DC53D655A7739A6D89B0D8BEB0，1536 × 1024。保留研究圖示、標題、配色、裝飾、左右等高框與實線／虛線關係。

評估原生 HTML／SVG 後，為避免改變附件圖示、字形、漸層與裝飾，採用使用者允許的原圖方案：圖片作為視覺呈現，上方疊加等比例 HTML 連結，另以 JSON 維護文字階層、節點位置及連結。**尚未完成整張圖的純 HTML／SVG 重建**；改動圖片中的文字／圖形仍需更新 PNG，並同步 JSON。文字階層與單位入口已可維護，非整張圖片內容都能自動依後台編輯重繪。

圖片預設完整呈現，可切換「放大閱讀／顯示完整圖」；放大時只在圖內捲動。手機預設展開文字導覽，保留七個直接隸屬單位、四組下層組織與七個業務督導單位。關閉按鈕固定於彈窗頂端，Enter 開啟、Tab 切換、Escape 關閉並返回原按鈕。

人體生物資料庫依附件放在共同研究室之下；保留網站原有獨立資料與入口，不刪除其公開資訊或管理範圍。舊文字中的「生物安全第三等級實驗室」改為附件的「生物安全第二等級實驗室」。督導單位導向既有審查頁各自卡片，不新建虛構單位介紹。

## 七個圖示與資料來源

共用 assets/images/unit-icons.svg 以七個 symbol 保存附件圖示的白色輪廓，沒有另選或重新設計圖案。SVG 是從所提供 PNG 輪廓取樣轉換，非原作者提供的向量原稿；放大輪廓精細度仍受來源圖片解析度限制。可由 node scripts/trace-organization-icons.mjs 直接從保存的附件重建，不需額外套件。

| 單位 | SVG symbol |
| --- | --- |
| 學術研發室 | academic-office（書籍與成長圖） |
| 臨床試驗中心 | clinical-trial-center（勾選板） |
| 共同研究室 | core-laboratory（顯微鏡） |
| 動物實驗室 | animal-laboratory（掌印） |
| 細胞治療中心 | cell-therapy-center（細胞群） |
| 人工智慧中心 | ai-center（AI 晶片） |
| 創新智財產學中心 | innovation-ip-center（燈泡） |

首頁、隸屬單位列表、部門介紹單位卡片、各單位子站及完整介紹使用 MedUI.unitIcon。同專案 ai-center/ 舊有內頁的頁首／頁尾也引用相同 AI symbol；原 ai-center-website-demo 專案未操作。人體生物資料庫不屬附件的七個圖示，維持既有圖示，沒有推定新的標準。

單位名稱與公開範圍仍讀取 data/units.json 及現有後端管理資料，不增加第二筆單位主資料、不使用 localStorage。organization.json 只保存公開組織圖的結構及位置，由既有 /data 路由精確允許唯讀取得，不加入管理集合、不提供寫入權限。

## 修改與新增檔案

- [department-organization.png](../assets/images/department-organization.png)：替換為附件原圖。
- [unit-icons.svg](../assets/images/unit-icons.svg)：新增七個共用輪廓圖示。
- [organization.json](../data/organization.json)：新增層級、座標與督導名稱。
- [organization-chart.js](../assets/js/organization-chart.js)：新增圖上連結、文字導覽、縮放與彈窗互動。
- [resource-directory.js](../assets/js/resource-directory.js)：重用架構圖元件、單位圖示、督導卡片錨點。
- [data-service.js](../assets/js/data-service.js)：部門介紹卡片共用單位識別碼。
- [main.js](../assets/js/main.js)：共用 SVG renderer，替換首頁／列表舊圖示。
- [units.js](../assets/js/units.js)：子站、識別區與完整介紹共用圖示。
- [base.css](../assets/css/base.css)：共用圖示尺寸與對齊。
- [resource-directory.css](../assets/css/resource-directory.css)：架構圖、連結焦點與手機文字導覽。
- [content-page.html](../content-page.html)：載入共用架構圖元件。
- [ai-center/main.js](../ai-center/js/main.js)、[ai-center/style.css](../ai-center/css/style.css)：既有 AI 內頁共用晶片圖示。
- [management.py](../backend/management.py)：組織圖公開結構的唯讀路由。
- [trace-organization-icons.mjs](../scripts/trace-organization-icons.mjs)：從保存的 PNG 重建七個 SVG 輪廓。
- [check-navigation-search.mjs](../scripts/check-navigation-search.mjs)：新增圖示資源、單位及督導入口檢查。
- [README.md](../README.md)、[PLANS.md](../PLANS.md)、本文件：本機變更與驗證記錄。

## 已實際執行

- 全站 static-only：JSON、JavaScript 語法、CSS 括號、HTML／Markdown 本機資源與既有 JSON 連結檢查。
- 靜態建置與 git diff --check 通過；附件原檔與替換圖片的 SHA256 相同。
- check_department_search.mjs、check_resource_search.mjs、check_biobank_search.mjs：單一資料來源、搜尋與未公開內容排除。
- tests.check_department、tests.check_portal、tests.check_management：公開同步、單位隔離、三種角色、撤權、持久化及原有管理控制回歸。
- 內建瀏覽器：首頁、列表、七個子站與七個完整介紹 × 320／1280px 共 32 組；document scrollWidth 均等於 clientWidth（305／1265px），同單位均引用相同 SVG symbol。另測 AI 原內頁兩種寬度，無整頁水平捲動且頁首／頁尾同用 AI symbol。
- 組織圖彈窗桌機及 320px：圖片為 1536 × 1024；手機完整圖寬約 264px，放大後畫布 1200px 在圖內捲動，整頁仍為 305px。文字層級含第二等級實驗室與共同研究室下的人體生物資料庫；Enter、Tab、Escape 與焦點返回已實測。

本機隔離預覽使用虛構帳號及暫存資料；未修改正式管理資料、未執行院方登入、Push 或部署。Windows 沙箱的 Node 子程序及 Python 暫存寫入限制，於取得執行允許後完成上述檢查；既有 Authlib／Starlette 棄用提示未在此次處理。

## 第二輪：卡片、拖曳與督導介紹示範

使用者要求先看示範，因此本輪僅在 `content-page.html?page=department-about&preview=department-v2` 啟用新排版、拖曳與督導介紹；無 preview 參數的入口保留第一輪行為，沒有寫入正式管理資料或變更角色權限。

隸屬單位使用雙欄卡片，圖示與標題並排，介紹文字另起一區，移除每張重複的「單位介紹」標籤；700px 以下單欄。沿用原有八個公開服務入口及單位摘要，不建立第二筆隸屬單位資料。

架構圖放大後採 1800px 畫布，可按住滑鼠左鍵在任意圖面（包含單位連結上）拖曳。位移超過 6px 才視為拖曳；捕捉滑鼠指標、放開後阻止誤觸連結，處理取消與丟失捕捉。一般點擊、鍵盤 Enter／方向鍵及觸控原生捲動保留。縮小完整圖時取消拖曳狀態。

部門介紹新增七個督導卡片，示範導覽新增「督導單位」。每個督導單位共用 `content-page.html?page=governance&preview=department-v2&supervised={id}` 介紹版型，包含宗旨、主要任務及來源；架構圖右側連結同步進入對應介紹。資料集中在 `data/organization.json` 原有七個 supervised 節點，不混入隸屬單位資料或建立新管理角色。這些示範介紹尚未納入管理中心編輯及全站搜尋。

### 實際核對的原官網來源

2026-11-26 七頁均實際取得 HTTP 200；以下日期是原頁標示的更新日期，並非承諾章程或名單現行有效。任務以摘要呈現，不完整轉載章程、個人聯絡或委員名單。

| 督導單位 | 原官網 | 原頁更新 |
| --- | --- | --- |
| 學術倫理委員會 | [ReseachEthics](https://depart.femh.org.tw/medresearch/ReseachEthics.html) | 2026-11-11 |
| 受試者保護諮議委員會 | [RecipCommittee](https://depart.femh.org.tw/medresearch/RecipCommittee.html) | 2025-07-03 |
| 受試者保護中心 | [RecipCenter](https://depart.femh.org.tw/medresearch/RecipCenter.html) | 2025-07-03 |
| 研究發展委員會 | [RD](https://depart.femh.org.tw/medresearch/RD.html) | 2025-07-03 |
| 實驗動物照護及使用小組 | [Animal](https://depart.femh.org.tw/medresearch/Animal.html) | 2025-07-03 |
| 人體生物資料庫倫理委員會 | [BioBank](https://depart.femh.org.tw/medresearch/BioBank.html) | 2025-07-03 |
| 生物安全委員會 | [BioSafe](https://depart.femh.org.tw/medresearch/BioSafe.html) | 2025-07-03 |

BioBank 原頁標題及內容為人體生物資料庫，並非獨立倫理委員會介紹。示範明確註記差異，只整理可確認的監督關係並連到既有章程 PDF，不把資料庫服務、成員或成果寫成委員會內容。沒有自行補造聯絡方式、現任名單或規則。

### 本輪檔案及驗證

新增 [department-directory.js](../assets/js/department-directory.js)、[department-directory.css](../assets/css/department-directory.css) 與 [check_department_directory.mjs](../tests/check_department_directory.mjs)；修改 [main.js](../assets/js/main.js)、[resource-directory.js](../assets/js/resource-directory.js)、[organization-chart.js](../assets/js/organization-chart.js)、[content-page.html](../content-page.html)、[organization.json](../data/organization.json)、[連結檢查](../scripts/check-navigation-search.mjs)、README、PLANS 與本文件。沿用現有後端路由，無新增後端權限或資料寫入。

已實際通過：check_department_directory.mjs（示範開關、共用摘要、隱藏本部不復活、七個介紹來源、拖曳門檻／指標捕捉／誤點抑制／取消與原生觸控）；既有 check_department_search、check_resource_search、check_biobank_search。

瀏覽器實測部門示範、督導列表、七個介紹及原版部門頁 × 320／1280px 共 20 組，scrollWidth 均等於 clientWidth（305／1265px），原版頁面沒有示範新增區塊。實際滑鼠拖曳使架構圖 scrollLeft 0→600、scrollTop 0→230；從受試者保護中心連結開始拖曳後仍留在彈窗，接著 Enter 能進入正確介紹頁。未執行正式院方登入或部署。

最後全站 static-only 通過 JSON、JavaScript、CSS 括號、本機資源、介紹參數與章程檔案連結。320px 圖面以方向鍵右捲後 scrollLeft 為 29px，整頁仍為 305px；Escape 關閉後焦點返回「查看組織架構」。已檢視手機單欄及桌機雙欄示範畫面。
