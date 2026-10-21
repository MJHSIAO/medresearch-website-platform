# 醫學研究部多單位網站平台

本專案是「醫學研究部多單位網站平台」，已開始正式版開發。公開網站沿用既有內容；管理功能仍在串接中，不能將目前本機預覽當作正式授權或發布系統。採用原生 HTML、CSS、JavaScript 與 JSON，可由一般靜態網站伺服器提供服務，不依賴 React、Vue、CMS、資料庫或原人工智慧中心專案。

## 快速開始

必須透過本機 HTTP 伺服器開啟，避免瀏覽器阻擋 `fetch()` 讀取 JSON。可在專案根目錄執行：

```powershell
python -m http.server 4173
```

然後開啟 `http://localhost:4173/`。行政後台 Demo 位於 `http://localhost:4173/admin-demo/`。

## 主要頁面

- `index.html`：醫學研究部首頁，以常用研究服務為優先。
- `news.html`、`news-detail.html`：公開消息查找及詳細內容。
- `units.html`：隸屬單位列表。
- `unit.html`、`unit-about.html`：六個非人工智慧中心單位的資料驅動子站及完整介紹。
- `ai-center/`：人工智慧中心官網第一版獨立多頁子站。
- `content-page.html`：研究服務、儀器、表單等一般內容共用版型。
- `contact.html`：聯絡資訊及洽詢分類 Demo。
- `admin-demo/`：角色切換、單位資料、消息、媒體及操作紀錄 Demo。

## 資料與同步方式

網站內容資料集中於 `data/`。`data/units.json` 的每一個單位只有一筆主要資料；醫學研究部首頁、單位列表、單位首頁及完整介紹頁會讀取同一筆資料。`owner_unit_id` 表示消息的主要負責單位，`related_unit_ids` 表示共同顯示單位，跨單位消息不重複建立。人工智慧中心子站的基本介紹、聯絡資訊與消息也讀取相同資料及 Demo 覆寫層。

六個非人工智慧中心單位共用一套子站模板，固定呈現單位介紹、目標、主要業務、重點領域、成員、消息、聯絡與官方來源；空間、申請流程、規範、課程及智財入口等差異內容由 `resource_links` 與 `special_sections` 選配。

主站的單位卡片會以新分頁開啟各單位網站，讓使用者保留醫學研究部入口頁；各子站前往醫學研究部或其他隸屬單位時也採相同行為，單一網站內的錨點與內頁則維持同頁導覽。

公開頁面只顯示 `visibility` 為 `public` 或 `both`，且狀態為 `published` 或 `expired` 的消息。首頁另外排除 `expired`；歷史消息頁仍可搜尋及查閱過期內容。`internal`、`draft`、`pending_review` 與 `archived` 不會在公開頁面顯示。

## 行政後台 Demo

既有後台提供三種功能預覽視角：

- 人工智慧中心管理員：管理及發布自己單位內容，不可修改其他單位或全站設定。
- 醫學研究部總管理員：查看全部單位、管理首頁及推薦、查看全站紀錄。
- 系統管理員：擁有所有內容、醫研部及系統管理功能；帳號角色與系統設定仍待後端實作。

`localStorage` 只供 UI Demo 使用，不是正式資料庫或權限系統。角色切換只改變前端畫面，正式系統必須由後端依登入身分設定 `owner_unit_id` 並驗證每一次讀寫權限。

「清除本機預覽資料」會清除以 `medresearch_demo_` 開頭的瀏覽器資料。圖片與附件只做瀏覽器端預覽，不會上傳到伺服器；請勿輸入病人資料、個資或院內機密。

## 內容狀態

公開內容已依醫學研究部原官網整理，涵蓋七個隸屬單位、研究資源、研究團隊、核心實驗室、儀器設備、部門介紹及公開消息；六個非人工智慧中心單位、完整成員名單及公開新聞圖片的資料查核日期為 2026-09-07。每筆單位、一般內容頁與公開消息保留 `source_url`，正式規章、表單版本、聯絡資訊與後續異動仍以原官網為準。未公開或無法確認的資訊不以推測內容補入。

## 本階段未實作

正式 CMS、正式資料庫、完整角色／單位權限對應、不可竄改稽核、真實檔案上傳、正式寄信、病人資料及任何院內機密資料仍不在本階段範圍。`admin-demo/` 仍是 UI Demo；雖然本版已新增院內 OAuth2 登入，任何未來的敏感 API 仍必須在後端逐次驗證 Session、角色與單位範圍。

## 院內 OAuth2 Login

已對照另一個專案的 `routers/access.py`：Token 交換採 `client_secret_post`，以表單傳送 `grant_type`、`code`、`client_id`、`client_secret`，本站另保留原授權請求的 `redirect_uri`。參考專案使用另一組 HIS issuer／audience 驗證 JWT Access Token；本站依 OIDC_AUDIENCE 選擇 JWT Access Token 或受保護 UserInfo 取得身分，不複製其他 Client 的 audience、帳密表單或前端 Token 儲存方式。此差異仍須以本 Client 的院內實際登入驗證。

帳密輸入與密碼錯誤提示由院方 `Account/Login` 頁面處理；依使用者確認的流程，密碼錯誤留在院方原頁，成功後才 callback。本站不提供登入提示頁、不將登入失敗導向 `login.html`。院方成功回傳 code 後，本站才核對 state、換 Token 與驗證身分；串接失敗維持在 callback 回報 400，連線／設定失敗回報 503，不自動重試或誤報密碼錯誤。舊 `login.html` 網址僅相容轉至 `auth/login`，重新進入院方授權流程。

2026-10-14 使用者確認院方允許保留 `state`。授權網址只傳 `response_type=code`、`client_id`、`redirect_uri`、每次新產生的 `state`；不傳 `scope`、`nonce`、`code_challenge` 或 `code_challenge_method`。從本站的 `auth/login` 開始每次登入，不重用舊的授權網址。

FastAPI Backend 透過院方 Discovery 取得 OAuth2 endpoints，由 Authlib 執行 Authorization Code Flow 與一次性 `state` 驗證。後端交換 Access Token；設定 OIDC_AUDIENCE 時，以 Discovery 的 issuer／JWKS 驗證 RS256 簽章、aud、exp、iat、nbf（若存在）及非空 sub，再建立身分，失敗不降級至 UserInfo。未設定 audience 時沿用受保護的 UserInfo API；不依賴 ID Token 或 Token 回應中的未驗證身分欄位。FastAPI 同時提供既有靜態網站；Client Secret、Access Token、Refresh Token、Authorization Code 與完整 ID Token 不會送到前端或存入 `localStorage`。為相容既有部署，`OIDC_*` 環境變數及後端既有類別名稱保留。

### 本機設定與啟動

需求為 Python 3.10 以上。請在專案根目錄執行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

編輯 `.env`，填入院方核發的完整 Client ID、Client Secret，以及至少 32 字元的隨機 `SESSION_SECRET`。可用下列指令產生 Session Secret，輸出只貼入本機 `.env`：

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

接著啟動：

```powershell
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

開啟 `http://localhost:8000/`，點選主導覽的「院內人員登入」。登入後可用 `http://localhost:8000/api/me` 確認 `authenticated`、基本使用者資料、暫定角色與實際 claim 名稱；登出網址為 `http://localhost:8000/auth/logout`。

### `.env` 欄位

| 欄位 | 用途 |
| --- | --- |
| `OIDC_DISCOVERY_URL` | 院方 Discovery URL；已填入範例檔 |
| `OIDC_CLIENT_ID` | 院方核發的完整 Client ID |
| `OIDC_CLIENT_SECRET` | 院方核發的 Client Secret，只能存在執行環境 |
| `OIDC_REDIRECT_URI` | 必須與院方登記值完全一致 |
| `OIDC_AUDIENCE` | 選填；填院方確認的 JWT Access Token audience 即啟用 JWT 驗證，字串 aud 必須相符或陣列 aud 必須包含此值；留空沿用 UserInfo |
| `SESSION_SECRET` | 至少 32 字元的隨機 Session 簽章密鑰 |
| `APP_BASE_URL` | 本機為 `http://localhost:8000`；正式環境必須使用 HTTPS |
| `APP_ENV` | 本機 `development`；正式環境設為 `production` |
| `OIDC_DEBUG_CLAIMS` | 僅限本機短暫設為 `true` 以檢視 claims；正式環境保持 `false` |

開發環境需要請資訊處登記的 Redirect URI 是：

```text
http://localhost:8000/auth/callback
```

Redirect URI 必須與院方 OAuth2 Server 登記的值完全一致。Docker 部署範例為 `https://aics.femh.org.tw/medresearch/auth/callback`，正式使用前仍需確認已由院方登記。

### Discovery 實際能力（2026-10-07 查詢）

| 項目 | Discovery 回傳值 |
| --- | --- |
| issuer | `https://intraauth.femh.org.tw` |
| authorization endpoint | `https://intraauth.femh.org.tw/INTRAAUTHSERVER/oauth/authorize` |
| token endpoint | `https://intraauth.femh.org.tw/INTRAAUTHSERVER/oauth/token` |
| userinfo endpoint | `https://intraauth.femh.org.tw/INTRAOPENIDAPI/identity/userinfo` |
| JWKS URI | `https://intraauth.femh.org.tw/INTRAAUTHSERVER/.well-known/keys` |
| 支援 scopes | `offline_access openid profile email org_profile` |
| PKCE | `plain`、`S256`；本專案依院方需求不傳 PKCE 參數 |
| ID Token 簽章 | `RS256` |

Discovery 未提供 `end_session_endpoint`，所以第一階段登出只清除本站 Session。程式不把上述 endpoints 寫死，執行時讀取 Discovery 的 Authorization、Token，以及所選模式的 UserInfo 或 issuer／JWKS。JWT 模式每次登入重新取得 JWKS，依 kid 選擇唯一 RSA 簽章金鑰；不接受 Token 自帶的金鑰網址。上表是伺服器曾宣告的能力，本站不要求 scope 或使用 ID Token。

### Claims 確認與權限邊界

Discovery 曾宣告的 `claims_supported` 不代表實際 UserInfo 一定只有這些欄位。尚未使用有效院內帳號完成登入，因此實際 claim 名稱必須在串接後確認，不能先假定 `email`、`department`、`role` 或 `group` 一定存在。後端要求經驗證的 JWT Access Token 或 UserInfo 有非空字串 `sub` 作為穩定身分識別；若院方使用不同欄位，需確認規格後調整，不猜測欄位，也不以未驗證 ID Token 補上身分。

登入成功時後端固定只記錄 claim 名稱。若需要短暫檢查候選欄位，可在本機把 `OIDC_DEBUG_CLAIMS=true` 後重新啟動；此時 `/api/me` 會在 `claims` 顯示實際內容，Log 只額外輸出常見候選欄位，不會輸出 Client Secret、Authorization Code、Access Token、Refresh Token 或完整 ID Token。完成欄位確認後應立即改回 `false`。

第一階段所有成功登入者只取得 `internal_user`，`department` 與 `unit_id` 保持空值。後續應由院方確認穩定的員工識別、單位及群組 claim，再建立「claim 值 → 網站 unit id／role」的伺服器端 allowlist；不得由前端、使用者輸入或 `localStorage` 決定角色。`unit_admin` 只能操作對應單位，`site_admin` 可跨醫研部單位，`system_admin` 才能管理共用版型與帳號權限。

目前 Session 資料保存在單一 FastAPI 程序的記憶體，Session Cookie 只保存簽章後的不透明 session id，並設為 HttpOnly、SameSite=Lax；當 `APP_BASE_URL` 使用 HTTPS 時會自動啟用 Secure。另有一個不含身分資料的 `medresearch_auth=1` 可讀 Cookie，只用來避免靜態 Demo 呼叫不存在的 API；它可被竄改，絕不參與授權，畫面仍以 `/api/me` 為準。這適合第一階段單程序測試，正式多 worker／多主機部署前需改用受控的伺服器端 Session Store（例如 Redis），並完成資安、Proxy HTTPS 與金鑰輪替設定。

GitHub Pages 仍只是靜態 Demo，無法保管 Client Secret、建立後端 Session 或保護院內資料；正式登入只能在 FastAPI 部署環境運作。若 Client Secret 曾出現在 HTML、JavaScript、JSON、Git 記錄或 GitHub，必須立即請資訊處 Rotate／重新核發，不能只刪除目前檔案。

## 導覽與搜尋 UX（2026-09-18）

首頁維持無側欄入口，提供完整搜尋框；主要內容順序為最新消息、隸屬單位、研究資源及其他資訊。共用主導覽 sticky，長頁錨點依其實際高度偏移。

六個單位子站、完整介紹及四段以上的一般內容頁使用本頁導覽。桌機左側 sticky，手機為預設收合的目錄；不套用到首頁、短內容、新聞頁或 AI 獨立版型。

`search.html?q=關鍵字` 搜尋 site/units/people/news JSON，沿用公開篩選及 Demo 覆寫。操作、欄位、限制與可重跑測試見 `docs/navigation-search.md`。

## Docker 部署

`Dockerfile` 包含既有 FastAPI／OAuth2 與靜態網站，使用非 root、單一 worker 及 Healthcheck。Server 整合用 `deployment/docker-compose.medresearch.yml` 合併原 Compose，接上既有 `app_internal`，由 `voice-public-web` 分流 `https://aics.femh.org.tw/medresearch/`，不另外占用 Host Port。

請依 [Docker 部署說明](docs/docker-deployment.md) 建立 `.env.docker`、登記 `/medresearch/auth/callback`、加入 Nginx location，再單獨啟動新服務。該文件含路徑設定、更新、回復與實際驗證步驟。

## 專案文件索引

詳細範圍、資訊架構、權限矩陣、內容模型、發布流程、Demo 操作、文字與圖片編輯方式及驗收紀錄請參閱 `docs/` 及 `PLANS.md`；日常內容維護請先看 `docs/content-editing-guide.md`。




## 正式版開發起點（2026-10-16）

依使用者決定，移除網站與後台對外標題、導覽及提示中的 Demo 品牌字樣；尚未啟用的功能改為明確狀態說明，未核定的院方內容仍保留示意／待確認標記。未連接寄信的聯絡表單停止收件操作，顯示「線上洽詢尚未開放」。

角色統一為單位管理員、醫研部總管理員及擁有全部功能的系統管理員，詳見 [權限矩陣](docs/role-permission-matrix.md)。此次不是正式授權系統交付：後端仍只建立 internal_user，管理頁仍未加上存取限制，內容仍是本機預覽。既有檔名、路徑與儲存鍵保留以相容現有連結及資料。

只修改本機專案，不 commit、push 或部署。首次系統管理員的經驗證員工識別與伺服器儲存方案仍待設定；不將真實員編、姓名或權限名單寫入公開 JSON 或版本庫。

## 2026-10-21 登入後授權更新

已加入登入後院內專區、本人身分確認與系統管理員環境名單。登入成功改至 internal；admin 與舊 admin-demo 管理路徑由後端驗證 Session，非管理員回傳 403。後端不再提供舊角色切換編輯頁。這取代前述「後端固定 internal_user／管理頁尚未保護」的階段限制；內容寫入與單位授權管理仍未開放。

[設定與驗證步驟](docs/login-authorization.md)。
