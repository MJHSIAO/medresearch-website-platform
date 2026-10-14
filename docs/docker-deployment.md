# Docker 部署與既有 Server 整合

## 部署位置與流量

依使用者提供的 Compose 與 `docker ps`，`voice-public-web` 已占用對外 443，在容器內 8443 終結 TLS，並與 `chat-app` 共用 `app_internal`（實際名稱 `femh-app-internal`）。本專案新增 `medresearch-app:8000`，只加入此網路，不發布任何 Host Port，也不掛載憑證。

```text
https://aics.femh.org.tw/medresearch/
  → 現有 voice-public-web:8443（TLS）
  → /medresearch/ 路徑分流，移除前綴
  → medresearch-app:8000（FastAPI + 既有靜態網站 + OAuth2）
```

`/medresearch` 以 308 導向 `/medresearch/` 並保留 query string。該 location 使用 `absolute_redirect off`，讓 Location 保持相對網址，避免將容器內 TLS 埠 8443 帶到對外 443 的網址。其他 voice/chat 路由維持現有設定。Uvicorn 的 `--root-path /medresearch` 讓目錄補斜線等 Redirect 保留外部前綴；前端登入、登出、`api/me`、Demo 入口均使用專案相對路徑。登入 Cookie 的 Path 依 `APP_BASE_URL` 設為 `/medresearch`。

`Dockerfile` 使用 Python 3.12、非 root 使用者、明確 COPY 清單與 `/healthz` Healthcheck。Compose 設定唯讀檔案系統、資源及 Log 上限；不加入資料庫或其他登入系統。既有記憶體 Session 只支援 **一個容器、一個 worker**；重啟或重新部署會使登入失效，需重新登入。不要以 `--scale` 或增加 workers 擴充。

## 1. 放置專案與環境檔

將**目前工作目錄的完整版本**（包括尚未提交的 `backend/` 與 `requirements.txt`）複製到 server。不要只從尚未含後端變更的 Git commit 取得。以下假設獨立的 `medresearch-website-platform/` 放在現有 Compose 的同一層：

```text
現有服務目錄/
├── docker-compose.yml                    # 使用者現有檔案
├── asr/nginx.conf.template               # 現有 TLS / voice / chat 設定
├── certs/                               # 現有憑證
└── medresearch-website-platform/
    ├── Dockerfile
    ├── requirements.txt
    ├── backend/
    ├── .env.docker                       # 只在 server 建立
    └── deployment/
        ├── docker-compose.medresearch.yml
        └── nginx-medresearch.locations.conf
```

先進入「現有服務目錄」，執行：

```bash
cp medresearch-website-platform/.env.docker.example medresearch-website-platform/.env.docker
chmod 600 medresearch-website-platform/.env.docker
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

將產生的值填入 `.env.docker` 的 `SESSION_SECRET`，並在 server 本機填寫院方核發的 `OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET`。其餘網址已設定為本次選定路徑：

```dotenv
APP_BASE_URL=https://aics.femh.org.tw/medresearch
OIDC_REDIRECT_URI=https://aics.femh.org.tw/medresearch/auth/callback
APP_ENV=production
OIDC_DEBUG_CLAIMS=false
```

請資訊處將 **`https://aics.femh.org.tw/medresearch/auth/callback`** 登記為該 Client 的 Redirect URI；未登記前網站可以提供公開頁，但院內登入不能完成。容器需能透過 server 的既有網路連到院方 Discovery、Token、UserInfo 與 JWKS；必要的院內 DNS、Proxy 或 CA 由院方確認，不要停用 TLS 憑證驗證。

環境檔只在執行時載入，`.gitignore` 與 `.dockerignore` 排除真實 `.env`；不將 Secret 放入 Dockerfile、Build Args 或映像。`docker compose config` 的完整輸出會包含環境變數，檢查設定請用 `config --quiet`，不要將含 Secret 的輸出貼到聊天或提交。

## 2. 合併 Compose，單獨啟動新服務

附檔是 **Compose 補充檔**，需要與使用者提供的原 Compose 一起使用；不獨立建立網路。先確認既有 Stack 的 Compose Project Name：

```bash
docker inspect femh-genai-wwservice-voice-public-web-1 \
  --format '{{ index .Config.Labels "com.docker.compose.project" }}'
```

依目前容器名稱預期為 `femh-genai-wwservice`，以下 `-p` 須使用實際查到的值。繼續在現有服務目錄執行：

```bash
docker compose -p femh-genai-wwservice \
  -f docker-compose.yml \
  -f medresearch-website-platform/deployment/docker-compose.medresearch.yml \
  config --quiet

docker compose -p femh-genai-wwservice \
  -f docker-compose.yml \
  -f medresearch-website-platform/deployment/docker-compose.medresearch.yml \
  up -d --build --no-deps medresearch-app

docker compose -p femh-genai-wwservice \
  -f docker-compose.yml \
  -f medresearch-website-platform/deployment/docker-compose.medresearch.yml \
  ps medresearch-app
```

這只建置／啟動新服務，不重建既有 voice/chat。`/healthz` 只檢查本站程序，不會呼叫院方 OAuth2，因此 Healthy 不代表院方登入已驗證。

若專案放在其他位置，可在上述指令前設定 `MEDRESEARCH_PROJECT_DIR` 與 `MEDRESEARCH_ENV_FILE` 為 server 上的絕對路徑。若既有 `VOICE_APP_INTERNAL_SUBNET` 使用非預設值，沿用原 Stack 的 `.env`／環境設定，讓 `FORWARDED_ALLOW_IPS` 與真實代理網路一致。此信任僅適用於受控的內部容器網路；新服務不得額外發布對外 port。

多份 Compose 的相對路徑均以**第一份 Compose 檔所在目錄**為準；補充檔預設路徑已依上述結構安排。合併規則見 [Docker 官方說明](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)。

## 3. 加入 Nginx 路徑分流

本次只有原 Compose，沒有現行 `asr/nginx.conf.template` 的內容，所以無法直接產出已核對完整路由的替代檔。`deployment/nginx-medresearch.locations.conf` 是可插入的 **location 範例**，不得整份覆蓋現有 template。

1. 備份現有 `asr/nginx.conf.template` 與正在使用的 Nginx 產出設定。
2. 將範例內容插入現有 `server_name aics.femh.org.tw`、`listen 8443 ssl` 的 **server 區塊內**。也可使用 `include`，但需自行加上對應唯讀 volume；目前補充 Compose 不會改動 voice 的掛載。
3. 確認沒有重複的 `/medresearch` location，並讓新路由沿用現有必須的 WAF／來源限制；現有 template 未提供，這部分須在 server 核對。
4. 保留既有 `NGINX_ENVSUBST_FILTER: ^VOICE_|^CHAT_APP_`，避免 `$host`、`$scheme`、`$remote_addr`、`$medresearch_upstream` 等 Nginx 變數被模板替換。範例使用 Docker DNS `127.0.0.11` 動態解析容器名稱，讓新服務更新後可解析新 IP。

原 Compose 把 template 掛載到 `/etc/nginx/templates/default.conf.template`。若現有 image 使用標準 Nginx entrypoint，先確認腳本：

```bash
docker compose -p femh-genai-wwservice -f docker-compose.yml \
  exec -T voice-public-web test -x /docker-entrypoint.d/20-envsubst-on-templates.sh
```

確認腳本存在、新服務 Healthy 且已備份後，重新產生設定並測試；只有 `nginx -t` 成功才 Reload：

```bash
docker compose -p femh-genai-wwservice -f docker-compose.yml \
  exec -T voice-public-web sh -c \
  '/docker-entrypoint.d/20-envsubst-on-templates.sh && nginx -t && nginx -s reload'
```

若此 image 使用自訂模板流程，依其現有流程產出設定再執行 `nginx -t`，不要套用未知的腳本。只修改 template 後直接 `nginx -s reload` **不會**自動重新產生設定。測試失敗時不要重啟入口容器，先還原 template 與產出設定。

範例的 `rewrite ... break` 配合變數 `proxy_pass` 將已移除前綴的 URI 與原 query string 轉送；`^~` 讓此路徑優先於其他 regex location。行為依據 [Nginx Proxy 文件](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) 與 [Location 文件](https://nginx.org/en/docs/http/ngx_http_core_module.html)。

## 4. Server 驗證

```bash
curl -I https://aics.femh.org.tw/medresearch
curl -fsS https://aics.femh.org.tw/medresearch/healthz
curl -fsS https://aics.femh.org.tw/medresearch/api/me
curl -fsS https://aics.femh.org.tw/medresearch/data/units.json >/dev/null
```

預期無斜線網址回傳 308、Healthcheck 回傳 `{"status":"ok"}`、未登入 `api/me` 回傳 `{"authenticated":false}`。另檢查 `/medresearch/ai-center/`、`/medresearch/admin-demo/` 與搜尋、圖片；目錄自動補斜線的 Location 必須包含 HTTPS 與 `/medresearch/`。確認 `/medresearch/.env.docker`、`/medresearch/backend/config.py`、`/medresearch/.git/config` 均回傳 404。

完成院方登記後，以瀏覽器實際登入、callback、重整與登出；Cookie 應為 Secure，Session Cookie 應為 HttpOnly，Path 均為 `/medresearch`。前端角色切換與 `localStorage` 仍只是 UI Demo，不是正式安全控制。最後檢查既有 voice/chat 入口與原本健康檢查均可用。

使用者確認院方 `Account/Login` 已在密碼錯誤時保留原頁並提示，成功才回本站 callback。本站已撤回 `login.html` 提示頁及所有失敗轉址；callback 串接失敗回報 400，登入服務連線／設定失敗回報 503，不自動重試、不誤報密碼錯誤。舊 `/medresearch/login.html` 網址會轉至 `/medresearch/auth/login`，即使 server 留有舊 HTML 檔也不會顯示本站登入頁。此次登入轉址修正需更新 `backend/main.py` 並重建本站容器；另同步 `ai-center/js/main.js` 修正此次驗證發現的重複程式／語法錯誤。新的完整專案已移除 `login.html`。

授權網址仍只傳 `response_type`、`client_id`、`redirect_uri`、`state`；已移除 scope／nonce／PKCE。沿用既有 `OIDC_*` 環境變數，更新映像並重啟本站容器後才會套用。

## 更新與回復

更新本站使用相同兩個 `-f` 與同一個 `-p`，只執行 `up -d --build --no-deps medresearch-app`。可將 `MEDRESEARCH_IMAGE` 設為版本標籤，保留上一版映像；回復時使用上一個標籤並執行 `up -d --no-build --no-deps medresearch-app`。

移除本站時，先還原 Nginx 路由、產生設定、`nginx -t` 與 Reload，再以合併 Compose 執行 `stop medresearch-app` 及 `rm -f medresearch-app`。不要對現有共用 Stack 執行 `down`，也不要刪除共用網路或憑證。

## 驗證範圍

有 Python 依賴與 Docker Compose CLI 的開發環境可在專案根目錄重跑離線檢查：

```bash
python -m tests.check_backend
python -m tests.check_docker_deployment
python -m tests.check_oauth_login
python tests/check_compose_integration.py /path/to/server/docker-compose.yml
node scripts/check-navigation-search.mjs --static-only
```

後端測試使用示意憑證與模擬 Provider 回應，不會完成院內帳號登入；OAuth2 測試涵蓋四參數授權、Authlib 真實換 Token／UserInfo 流程、state 拒絕與重放、Token／UserInfo 失敗及未驗證身分不可作 fallback。Compose 檢查使用暫存環境檔，不需 Docker daemon。瀏覽器測試方式見 `docs/navigation-search.md`。

2026-10-14 對照參考專案後，`backend/auth.py` 的 Token 交換改採 `client_secret_post`，Client 憑證放在後端表單內。此修正需更新該檔並依上述 Compose 指令重建 `medresearch-app`；既有環境變數無需更名。授權端仍只傳四個參數，密碼錯誤由院方原頁處理，本站不新增失敗轉址。參考專案的 HIS JWT audience 不適用於直接推定本 Client 的設定，本站依下述 audience 設定選擇身分驗證方式。

### Callback 診斷

可在 `.env.docker` 加入 `OIDC_AUDIENCE=`，值填院方確認的 JWT Access Token 預期 audience；留空或省略為未設定，不會預設為 Client ID 或其他專案的值。非空 audience 會啟用 RS256 JWT Access Token 驗證，使用 Discovery 的 issuer／jwks_uri 檢查簽章、audience、效期與 sub，成功不再讀取 UserInfo。留空則維持原 UserInfo 模式。首次需同步更新 `backend/config.py`、`backend/auth.py`、`backend/main.py` 並重建容器；日後只修改環境值也需以 Compose `up -d --force-recreate --no-deps medresearch-app`（沿用上述 project 與兩個 `-f` 參數）重建容器，單純 `restart` 不會重新載入 env_file。

若日誌只有 `OAuth2 callback rejected: OIDCConfigurationError`，舊版尚未區分失敗原因。更新 `backend/auth.py`、`backend/main.py` 並重建本站容器後，從網站重新登入一次；日誌會增加固定的 `reason` 代碼，不輸出 Provider 回應本文、Token、Secret 或使用者資料，也不必開啟 `OIDC_DEBUG_CLAIMS`。

| reason | 意義 |
| --- | --- |
| `discovery_invalid_json`／`discovery_invalid_object` | Discovery 回應格式不符 |
| `discovery_missing_endpoints` | Discovery 缺少必要端點 |
| `token_invalid_json` | Token 交換流程取得無法解析的 JSON |
| `token_missing_access_token` | Token 回應缺少 Access Token |
| `userinfo_invalid_response` | UserInfo 回應無法轉成身分資料 |
| `userinfo_missing_sub` | UserInfo 缺少非空字串 sub；若已設定 audience 仍見此碼，確認容器已套用新版程式與環境設定 |
| `jwks_unavailable`／`jwks_invalid_response` | JWKS 無法取得或格式不符 |
| `access_token_invalid` | JWT 演算法、kid／簽章、issuer、audience 或時間驗證失敗 |
| `access_token_missing_sub` | 已驗證的 JWT 缺少非空字串 sub |

先依代碼定位，再確認院方契約；不因缺少 sub 就改信任未驗證的 Token 或猜測員工欄位。瀏覽器仍維持原本的通用錯誤訊息，callback 不做失敗轉址。

本文件的 Server 指令是部署與驗證步驟，不代表已在遠端執行。實際本機檢查結果記錄於 `docs/phase-1-acceptance.md`。目前無遠端 server 連線與完整 Nginx template，遠端 TLS／WAF、容器 Build／啟動及院內實際 OAuth2 登入仍需部署後驗證。
