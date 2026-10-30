# 2026-10-30 移機後上傳前核對

- 已重新執行 check_backend、check_oauth_login、check_portal、check_management、check_docker_deployment 與 static-only，均通過。
- 已 fetch 遠端，目標分支仍為 0a68bd8，沒有其他尚未合併的遠端提交。
- 與遠端 data/news.json 逐筆比對：7 筆公開已發布／歷史消息所有欄位完全相同；僅移除 news-internal-demo 與 news-draft-demo 測試資料。
- 本次僅提交及推送程式，未登入或更新正式伺服器。若正式伺服器有未回存 Git 的 news.json、圖片或附件，實際部署前須備份並合併；不可用本地舊資料直接覆蓋。
- 新版私有管理資料由 DATA_DIRECTORY 與持久化資料卷保留。既有伺服器若使用其他儲存位置，應在部署時先確認掛載及移轉，不得清空資料卷。

---

# 2026-10-22 正式管理驗證

已執行並通過：
- check_backend：既有後端登入端點與安全錯誤回報。
- check_oauth_login：OAuth2 state、JWT 驗證與離線回呼流程。
- check_portal：管理頁存取、偽造角色拒絕、撤權、登出與子路徑。
- check_management：三種管理角色、跨單位限制、人員授權保存與撤銷、最後一位系統管理員保護、CSRF／Origin、版本衝突、歷史回復、公開／院內內容分流、上傳與下載權限、私有檔案無法直接讀取。
- check_docker_deployment：HTTPS 子路徑、Cookie scope、靜態資源與離線回呼。
- static-only：JSON 解析、全部 JavaScript 語法、CSS 括號、HTML 資源與 Markdown 本機連結。
- 瀏覽器隔離環境：新增虛構單位管理員、表單保存發布消息並於公開單位頁顯示；桌機 1440px 與手機 320px 管理頁／AI 主視覺無整頁水平溢出；Enter 可開啟新增授權表單。

尚未驗證：院方真實登入、伺服器實際第一位管理員設定、正式 Docker build／啟動與主 Compose 合併。本機未提供實際主 Compose；不將此項列為通過。隔離 UI 伺服器與虛構帳號未納入正式程式。

---

# 第一版驗收紀錄

本文件分成「可由程式檢查」與「需瀏覽器實測」兩部分。驗證日期及結果只在實際執行後填寫，不能以預期結果代替。

## 功能驗收

- [ ] 醫學研究部首頁可開啟，常用研究服務、公開未過期消息、單位與聯絡區塊可見。
- [ ] 最新消息列表可依關鍵字、單位、類別、年份、狀態篩選並載入更多。
- [ ] 消息詳細頁含麵包屑、類別、標題、單位、日期、內文、圖片替代文字、附件、相關消息及返回列表。
- [ ] 隸屬單位列表可開啟；六個非人工智慧中心單位導向共用模板子站，人工智慧中心導向第一版獨立子站。
- [x] 六個共用子站均顯示介紹、目標、業務、領域、成員、消息、聯絡、來源及適用的選配模組（2026-09-07；逐頁瀏覽器實測）。
- [ ] 單位簡短與完整介紹來自同一筆單位資料。
- [ ] 後台修改單位介紹並儲存後，公開預覽同步更新。
- [ ] 單位管理角色看不到其他單位的編輯入口與全站設定。
- [ ] 醫研部總管理員看到全部單位及跨單位功能示意。
- [ ] 最新消息支援五種後台狀態；過期消息不顯示於首頁但保留於列表。
- [x] 公開頁面不顯示 `internal`、`draft`、`pending_review`、`archived`（2026-09-07；資料篩選與頁面實測）。
- [x] 新聞封面與圖集可點擊以原始尺寸放大，並可另開新分頁查看原圖（2026-09-08；桌機、320px、Enter、Escape 與焦點返回實測）。
- [ ] 圖片及附件只做本機預覽，未宣稱已上傳。
- [ ] 重設示意資料功能可用。

## 品質驗收

- [ ] HTML 結構檢查完成。
- [x] CSS 基本語法與括號檢查完成（2026-09-07）。
- [x] 所有 JavaScript 通過語法檢查（2026-09-07）。
- [x] 所有 JSON 可解析（2026-09-07；既有 UTF-8 BOM 於驗證時正規處理）。
- [x] 本機資源與內部連結檢查完成（2026-09-07；23 個建置後 HTML 頁面及新聞圖片）。
- [x] 桌機主要頁面實測完成（2026-09-07；首頁、消息、單位列表、單位子站及消息詳細頁）。
- [x] 320px 手機版無整頁水平捲動，選單可開關（2026-09-07；六個共用子站逐頁實測）。
- [ ] Tab、Shift+Tab、Enter、Space、Escape 可操作主要導覽與表單。
- [ ] 跳到主要內容、focus 樣式、label、標題層級及替代文字檢查完成。
- [x] 瀏覽器 Console 沒有未處理 JavaScript 錯誤（2026-09-07；本次實測頁面）。

## 2026-09-18 導覽與搜尋 UX 驗證

本次在 feature/medresearch-platform-v1 修改，起點 HEAD 為 7679e8a（檔案樹與 2ff6196 一致）。使用隔離的無頭 Microsoft Edge 與本機伺服器，以 `/medresearch-website-platform/` 模擬 GitHub Pages 專案子路徑。最終完整測試 `scripts/check-navigation-search.mjs` exit code 0。

| 實際執行的檢查 | 結果 |
| --- | --- |
| 全部 JSON 解析、JavaScript 語法、CSS 括號、靜態 HTML 本機連結與資源、新聞封面／圖集檔案 | 通過（既有 JSON BOM 於驗證時處理） |
| 320、375、768、1024、1440px 各 15 個代表頁面，共 75 個頁面尺寸組合 | 無整頁水平溢出；共用 Header sticky top 0，實測高度低於 110px |
| 首頁、短篇內容、AI 頁面沒有本頁 Sidebar | 通過 |
| 六個單位各段目錄 Enter 跳轉、標題不被 Header 遮住、active／aria-current | 通過 |
| 部門介紹、研究資源總覽、細胞治療中心完整介紹的最後一段定位與底部高亮 | 通過 |
| 手機目錄展開／收合、aria-expanded／aria-controls、Tab、Enter、焦點轉到目標區塊 | 通過；所有目錄項目可見，未沿用橫向目錄 |
| 首次開啟帶 #unit-services 網址（320、1440px） | 通過，定位於 Header 下 16px；使用新文件避免視窗切換混入同頁導覽 |
| 不支援 IntersectionObserver 時的單位錨點 | 通過；不依賴高亮也可跳轉 |
| 首頁 Enter 搜尋、結果頁按鈕 Tab/Enter、trim、空白、無結果 | 通過 |
| 中文、英文、數字、中英文混合／全形正規化；100/75/50/25 排序 | 通過；研究倫理為零筆，符合目前精確詞句資料 |
| 搜尋排除 internal visibility 及 internal/draft/pending_review/archived 狀態測試資料 | 通過；單位／成員／消息未進入索引 |
| 搜尋結果連結與 AI 頁尾 ../search.html | 專案相對路徑正確，所測結果 HTTP 200 |
| 後台表單實際儲存 AI 簡介後，首頁、AI 預覽及搜尋讀取同一 Demo 覆寫 | 通過；結束後清除隔離 context 的測試資料 |
| 六個子站最新三則消息及跨單位另開分頁 | 通過 |
| 新聞多圖、Enter/Space 開燈箱、Escape 關閉、焦點返回、原圖連結新分頁、圖片原尺寸與燈箱內捲動 | 通過 |
| 手機主選單 Tab/Escape 與切換桌機後解除捲動鎖定 | 通過 |
| 四種 Demo 角色的單位／部門／系統入口 | 與既有權限矩陣相符（仍非正式權限驗證） |
| Browser console error、pageerror、所測資源 HTTP 錯誤 | 最終完整測試為 0；測試伺服器對瀏覽器自動請求的根目錄 favicon 回傳 204 |
| 靜態 build 與 git diff --check | 通過；dist/client 包含 search.html/search.js，Git 僅有 Windows 換行提示 |

人工檢視桌機首頁與單位 Sidebar、320px 首頁／收合目錄截圖，確認既有綠白風格、可讀性與無側欄首頁。未進行完整 CSS validator、WCAG／螢幕閱讀器或跨瀏覽器認證；未檢查外部院方連結的即時可用性。未部署，線上新版仍待使用者 Commit/Push。功能範圍與搜尋限制見 navigation-search.md。

## 2026-10-12 Docker 與子路徑整合驗證

保留開始時已有的未提交 OIDC／導覽變更；本次未 commit、push 或操作原 `ai-center-website-demo`。

| 實際執行的檢查 | 結果 |
| --- | --- |
| 使用提供的 `C:/Users/ai/Downloads/docker-compose.yml` 執行 Compose config 合併比較 | 通過；既有 chat/voice 服務、網路、Secrets 與 Ports 完全相同，新服務沒有 Host Port |
| 既有 `tests/check_backend.py` | 通過；根路徑公開頁、匿名 API、Session、登出及非公開檔案 404；未啟用真實 Discovery 測試 |
| 新增 `tests/check_docker_deployment.py` | 通過；HTTPS `/medresearch` 下公開資源、目錄轉址、no-store、Cookie Path/Secure/HttpOnly、模擬 callback 與登出 |
| JSON、全部 JavaScript 語法、CSS 括號及 HTML 本機資源／連結 | 通過；新增 Markdown 文件連結一併檢查 |
| `/medresearch/` 前綴，320、375、768、1024、1440px × 15 頁 | 75 組通過，沒有整頁水平溢出，Sticky Header 與六個單位目錄通過 |
| 主站與 AI 子站的登入、API、Demo 及登出連結 | 通過；匿名及模擬已登入狀態均保持在 `/medresearch/` 下 |
| 搜尋排除 internal/draft/pending_review/archived、Demo 資料覆寫與排序 | 通過 |
| 四角色入口與後台表單儲存後首頁、AI 子站及搜尋同步 | 通過；隔離瀏覽器的測試資料於結束前重設 |
| 燈箱 Enter/Space/Escape／焦點返回、手機選單 Tab/Escape、初始錨點與 Observer fallback | 通過；首次燈箱捲動檢查遇到 resize 排版時序，測試加入等待後，以 `--interactions-only` 重跑通過 |
| Python 語法、靜態 build 與 git diff --check | 通過；Git 僅提示 Windows 換行正規化 |

瀏覽器使用隔離無頭 Microsoft Edge，不使用使用者帳號／儲存資料。互動重跑的 Console/pageerror/HTTP 錯誤為 0，截圖留於系統暫存目錄。Authlib 1.8 顯示相容整合層的 DeprecationWarning，後端測試仍通過。

本機 Docker CLI 可用，但 daemon 未啟動；未執行 image Build、容器啟動或 Nginx 語法／Reload。沒有連線遠端 server，未驗證現有 WAF、TLS、院方 DNS/CA、真實 OIDC 登入或遠端 voice/chat 路由。部署與回復步驟見 [Docker 部署說明](docker-deployment.md)。

## 2026-10-14 登入失敗畫面驗證

歷史紀錄：此節的本站登入提示頁與失敗轉址已依使用者更正撤回，現行結果見本文件最後的「撤回本站登入提示頁」紀錄。

本節記錄當日首次修改：新增 `login.html` 與後端失敗轉址；當時尚待使用者確認 state。後續已確認可保留 state，OAuth2 改版及追加測試見下節。未 commit、push 或部署，也未操作原 `ai-center-website-demo`。

| 實際執行的檢查 | 結果 |
| --- | --- |
| `python -m tests.check_backend` | 通過；模擬 scope／授權拒絕、state 錯誤、連線及設定失敗，303 返回登入提示頁，匿名狀態維持、錯誤內容不外洩；原有 Session／登出檢查通過 |
| `python -m tests.check_docker_deployment` | 通過；HTTPS `/medresearch` 下失敗回到同前綴登入頁，原有 Cookie 與模擬成功登入／登出檢查通過 |
| Python AST 語法檢查 | backend／tests 的 Python 檔案通過 |
| `CHECK_SITE_PREFIX=/medresearch/` 的完整導覽／搜尋腳本 | JSON、JS 語法、CSS 括號、HTML 資源與文件連結通過；登入提示頁 320／1440px 無水平溢出，Tab／Enter 可重新登入（入口以本機 mock 驗證） |
| 既有 15 頁 × 5 種寬度與主要互動 | 75 組通過；公開搜尋排除非公開內容、後台儲存至公開預覽同步、四角色入口及鍵盤互動通過；所測頁面 Console／pageerror／HTTP 錯誤為 0 |
| `git diff --check` | 通過，僅既有 Windows 換行提示 |

測試使用 bundled Python／Node、暫存安裝的既有 requirements 依賴與隔離無頭 Edge。原 `.venv` 指向不存在的 Python，未修改；暫存依賴的 Windows 權限使第一次後端測試未能載入 Authlib，改以相同安裝權限重跑後通過。依賴顯示 Starlette／Authlib 相容層棄用提示。未啟用真實 Discovery 檢查，未驗證院內帳密或院方登入頁的密碼錯誤行為。

## 2026-10-14 OAuth2 四參數改版追加驗證

使用者後續確認院方可使用 state。已移除 scope／nonce／PKCE，授權端只傳 response_type、client_id、redirect_uri、state；沿用既有 OIDC_* 環境設定。後端以受保護的 UserInfo 建立身分，不依賴未驗證 ID Token，角色仍僅為 internal_user。

| 實際執行的檢查 | 結果 |
| --- | --- |
| 新增 `python -m tests.check_oauth_login` | 通過；使用 Authlib 真實流程與離線 HTTP mock，精確檢查四個授權參數、Token 請求不含 scope／code_verifier、Client／Bearer 認證及 UserInfo 身分 |
| state 與回應失敗 | 通過；缺少／錯誤 state、缺少 Cookie、成功回應重放均不再交換 Token；院方拒絕、Token 錯誤／非 JSON、UserInfo 401／非 JSON／缺少 sub 都回到提示頁，不建立新登入 |
| `python -m tests.check_backend`、`python -m tests.check_docker_deployment` | 通過；根路徑及 HTTPS 子路徑、成功／失敗轉址、Session、Cookie、登出及非公開檔案檢查 |
| Python AST 語法、完整導覽／搜尋腳本、`git diff --check` | 通過；JSON／JavaScript／CSS／本機資源與連結，320／1440px 登入頁及 Tab／Enter 重新登入，15 頁 × 5 寬度無水平溢出、公開篩選、單位同步、四角色入口與主要鍵盤互動通過；所測 Console／pageerror／HTTP 錯誤為 0 |

首次 OAuth2 mock 在 httpx 套用認證前攔截，導致測試認證斷言失敗；改為攔截底層 HTTP 傳送後重跑通過。未修改正式依賴版本。未連線院方、未使用真實帳密、未部署／commit／push；實際 UserInfo sub 與院方密碼錯誤留在原頁的行為仍需正式環境確認。

## 維持第一版範圍

驗收不包含正式登入、CMS、資料庫、權限驗證、上傳、寄信或院內身分整合。這些項目不得因第一版驗收完成而自動開始開發。

## 2026-10-14 撤回本站登入提示頁

依使用者更正，院方 Account/Login 已處理密碼錯誤，不應另外跳至本站 login.html。刪除本站提示頁及後端失敗轉址；callback 串接錯誤回報 400，服務連線／設定失敗回報 503，均不發出 Location。舊 login.html 網址相容轉至 auth/login，即使 server 殘留舊檔亦不顯示該頁；成功 callback 與四參數 OAuth2 保持原流程。

| 實際執行的檢查 | 結果 |
| --- | --- |
| check_oauth_login、check_backend、check_docker_deployment | 通過；登入成功、各類 callback 失敗皆不轉址、state 拒絕及重放、匿名狀態、根網址與 HTTPS 子路徑的舊頁相容轉址、Cookie 與登出 |
| Python AST、git diff --check | 通過 |
| 全部 JSON、JS 語法、CSS 括號、HTML 資源與 Markdown 連結 | 重跑通過；首次被 AI 子站既有重複 buildNavigation 中的非 async await 阻擋，移除重複區塊後通過 |
| 完整導覽／搜尋腳本，CHECK_SITE_PREFIX=/medresearch/ | 通過；15 頁 × 5 種寬度共 75 組無水平溢出，公開內容篩選、單位資料同步、四角色入口、鍵盤互動及登入／登出連結；Console／pageerror／HTTP 錯誤為 0 |

本次只操作本平台；未操作原 ai-center-website-demo、未使用院內帳密、未連線院方或部署／commit／push。院方密碼錯誤原頁提示是使用者提供的行為，並非本機測試已驗證院方頁面。

## 2026-10-14 參考專案 Token 交換對照

唯讀查看使用者提供的四個檔案與其 OAuth2 路由 `routers/access.py`，本站改採表單 `client_secret_post`。保留四參數授權、state、redirect_uri、UserInfo 與後端 Session；未複製參考專案的 HIS audience 或前端 Token 儲存方式。

- `tests.check_oauth_login`、`tests.check_backend`、`tests.check_docker_deployment` 通過：實際 Authlib 送出的表單包含 Client 憑證、不含 Basic 標頭，成功、state 拒絕／重放、Token／UserInfo 失敗及無失敗轉址皆通過。
- 完整 `check-navigation-search.mjs` 以 `/medresearch/` 前綴通過：JSON、JS 語法、CSS、HTML 資源與 Markdown 連結；15 頁 × 5 寬度（含 320px）無溢出、公開內容篩選、Demo 資料同步、四角色入口、鍵盤互動，瀏覽器錯誤為 0。
- `git diff --check` 通過，僅 Windows 換行提示。測試依賴仍有既有棄用提示。

未修改參考專案，未連線院方或遠端部署；本 Client 的真實 Token／UserInfo 相容性與院方密碼錯誤畫面仍待部署後驗證。

## 2026-10-14 Callback 設定錯誤診斷

使用者提供的線上日誌只有 OIDCConfigurationError，尚不能確認根因。新增固定白名單 reason 代碼，區分 Discovery、Token 與 UserInfo 回應驗證失敗；不輸出例外本文或遠端資料，維持原本的瀏覽器錯誤與無失敗轉址行為。

- 三組後端測試 check_oauth_login、check_backend、check_docker_deployment 通過。新增缺少 Access Token 情境、四種失敗日誌代碼與敏感測試值不得出現在日誌的斷言；不明 reason 會降為固定 configuration_error。
- 完整導覽搜尋檢查通過：JSON／JS／CSS／HTML 資源／Markdown 連結、15 頁 × 5 寬度無溢出、公開內容篩選、Demo 同步、四角色入口、鍵盤互動；瀏覽器錯誤為 0。
- git diff --check 通過，僅換行提示；依賴仍有既有棄用提示。

未部署或連線院方。須更新兩個後端檔案並重建容器，再由新 reason 日誌定位線上根因。


## 2026-10-14 啟用 audience 對應 JWT 身分驗證

OIDC_AUDIENCE 非空時改驗證 JWT Access Token，不呼叫 UserInfo；未設定時保持原 UserInfo 模式。使用 Discovery issuer／JWKS、唯一 RSA kid 與 RS256，必須通過 issuer、audience、exp、iat、nbf（若存在）及非空字串 sub 檢查。失敗不降級、不使用未驗證 ID Token；登入角色仍為 internal_user。

- 三組後端檢查 check_oauth_login、check_backend、check_docker_deployment 通過。新增真實測試 RSA 簽章、字串／陣列 audience、錯誤 issuer／audience、過期／未生效／缺少必要 claim、錯誤簽章／kid／演算法、非 JWT、缺少 sub、JWKS 失敗；兩種模式都驗證 state 與重放拒絕，JWT 模式確認不呼叫 UserInfo。
- 首次 unknown_kid 測試被測試用簽章工具覆寫 kid，修正測試金鑰的 kid 後重跑通過；正式程式明確依 kid 選唯一院方 RSA 簽章金鑰。
- 完整網站檢查通過：JSON、JS 語法、CSS、資源與連結，15 頁 × 5 寬度無溢出、公開過濾、Demo 資料同步、四角色入口與鍵盤操作；瀏覽器錯誤為 0。
- git diff --check 通過。沿用既有 Authlib <2 相依範圍；本機依賴顯示 JOSE 與整合相容層棄用提示。

尚未連線院方、部署或以真實帳號驗證。部署後必須從 auth/login 開始新流程；不可重用 callback。若 audience 已設定但仍出現 userinfo_missing_sub，需確認容器程式及 env_file 是否已更新。

## 2026-10-14 JWT 失敗原因細分

線上僅回報 access_token_invalid，根因仍待確認。新增固定 JWT 原因代碼，區分 issuer／audience、必要欄位、時間、kid、簽章、演算法與格式；不記錄實際 claims、Token 或例外本文，不放寬驗證。

- check_oauth_login、check_backend、check_docker_deployment 全部通過，驗證既有拒絕情境的新代碼與敏感值不出現在日誌。測試初次發現 Authlib 將未來 iat 歸類為 not_yet_valid，調整預期；非 JWT 格式加入明確前置檢查後重跑通過。
- 完整網站檢查通過：JSON／JS／CSS／資源與連結、15 頁 × 5 寬度無溢出、公開篩選、Demo 同步、四角色入口與鍵盤操作；瀏覽器錯誤為 0。
- git diff --check 通過，依賴仍有既有棄用提示。尚未部署或以院方帳號驗證；需更新 backend/auth.py 並從新的登入流程取得細分代碼。

## 2026-10-16 正式版起始：介面名稱與角色規則

依使用者要求移除對外標題、導覽與提示中的 Demo 品牌文字。未核定的內容仍保留示意／待確認標記；原路徑、儲存鍵及歷史紀錄保留。取消單位編輯者，系統管理員可使用全部內容與系統功能；目前只更新功能預覽，尚未完成後端授權。

實際執行結果：

- 靜態檢查通過：全部 JSON 解析、JavaScript 語法、CSS 括號、HTML 本機資源與 Markdown 連結。首次在受限環境因 Node 子程序 EPERM 未能執行，獲執行環境允許後重跑通過。
- 完整 check-navigation-search.mjs 以 /medresearch/ 前綴通過：15 頁 × 320／375／768／1024／1440px 共 75 組無整頁水平溢出、公開內容排除、單位覆寫同步、三種角色入口與主要鍵盤操作；瀏覽器錯誤為 0。測試輸出當時仍沿用 four role 文案，已改為 three，實際迴圈為三種角色。
- 本機瀏覽器另外確認系統管理員包含內容、醫研部與系統入口，消息表單顯示發布預覽且沒有送出確認按鈕；兩個聯絡頁的未開放表單均不能輸入。
- 靜態 build 與 git diff --check 通過（僅既有換行格式提示）。

未修改 backend、data 或原 ai-center-website-demo，未執行院方真實登入、遠端部署、commit 或 push。未宣稱正式授權、上傳、寄信或持久化內容管理已完成。本機官網預覽由 dist/client 提供，不能用來測試院方登入。

## 2026-10-21 登入後身分確認與後端管理入口

新增 /internal、/admin 與 SYSTEM_ADMIN_IDS／ADMIN_IDENTITY_CLAIM 設定。callback 成功改至院內專區；所有舊 admin-demo 路徑由後端驗證並提供新管理入口，不再供應 localStorage 編輯頁。未設定欄位及名單時不授予任何管理權限。

實際驗證：check_backend、check_oauth_login、check_docker_deployment、check_portal 四組離線測試通過。包含真實測試 JWT 驗簽、原 state 防重放、新角色精確字串比對、假前端角色無效、匿名轉登入、一般人員 403、系統管理員 200、撤除設定、登出、callback Session 輪替、HTML 跳脫、Token 值不顯示與部署前綴。

完整 check-navigation-search.mjs（/medresearch/）通過：JSON、JS、資源／文件連結、15 頁 × 5 寬度、公開內容排除、單位本機預覽同步、既有三角色介面與鍵盤互動；瀏覽器錯誤為 0。新伺服器產生頁使用虛構身分另外檢查 320／1440px 無水平溢出及 Tab 可到導覽；這是畫面驗證，不代表院方登入實測。git diff --check 通過。

測試沿用暫存依賴，仍有既有 Authlib／Starlette 棄用提示。未連線院方、未啟動遠端服務，未將真實員編寫入程式／環境範例或公開資料。正式內容保存、單位角色分派與授權管理表單尚未實作；本版只啟用系統管理員名單及管理頁邊界。
