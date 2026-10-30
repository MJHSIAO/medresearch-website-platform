# 醫學研究部多單位網站平台

正式網站採原生 HTML、CSS、JavaScript、JSON 與 FastAPI，透過院方 OAuth2 登入。公開網站、管理中心共用資料來源；正式管理資料儲存在伺服器私有目錄，不使用瀏覽器角色切換或 localStorage。

## 啟動與部署

1. 安裝 `requirements.txt`，複製 `.env.example` 為 `.env`，填入院方 Client、Callback、Session Secret 及 APP_BASE_URL。
2. 使用 `uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 1` 啟動。
3. 開啟網站，從「院內人員登入」完成院方登入；登入成功進入 `/internal`。
4. 依 [首次授權說明](docs/login-authorization.md) 確認經院方驗證的員工識別欄位，設定第一位系統管理員。
5. 管理員進入 `/admin`，使用「人員權限」指定員編、角色與單位。

正式環境使用 HTTPS；Docker 與既有反向代理的 `/medresearch/` 部署見 [部署文件](docs/docker-deployment.md)。只使用一個 worker、一個容器實例。Session 保存在記憶體，重啟後需重新登入。

## 管理功能

- 單位管理員：管理自己被授權單位的介紹、服務、聯絡資訊、成員、消息、附件與歷史版本。
- 醫研部總管理員：跨單位內容管理、單位排序、首頁服務與推薦消息、網站資訊；新增／停用單位管理員。
- 系統管理員：包含以上全部功能，另可任命高階管理員及調整共用主色與版面寬度，不需要兼任其他角色。
- 每次 API 操作重新檢查伺服器授權；修改授權立即生效。禁止前端指定內容擁有者、跨單位寫入、高階角色越權與停用最後一位系統管理員。
- 內容支援草稿、發布、到期、下架、歷史檢視與回復；儲存有版本衝突檢查。
- PNG、JPEG、PDF 上傳上限 5 MB；未發布引用的檔案只有授權管理員能讀取。院內消息只透過登入後 API 提供。

操作與限制詳見 [正式管理指南](docs/management-guide.md) 及 [角色矩陣](docs/role-permission-matrix.md)。

## 資料與備份

`data/` 是初始公開資料。`DATA_DIRECTORY` 預設 `var/`，私有 `state.json` 保存授權、內容覆寫、版本、稽核及附件索引；附件亦存於同目錄。Git 忽略此目錄，後端不提供目錄靜態存取。Docker 使用 `medresearch-data` 持久化資料卷。更新 Git 不會覆蓋管理中心的正式內容；備份與還原須涵蓋整個目錄／資料卷。

後端 `/data/*.json` 先過濾內部、草稿、待確認及封存資料，公開頁不會收到這些內容。首頁排除過期消息，推薦消息優先。所有單位使用 `unit.html?unit={id}`；AI 中心保留原本跨域整合主視覺。

`npm run build` 只產生公開靜態資源，不能作為正式管理系統；正式運作需啟動 FastAPI。正式管理網址為 `/admin`；舊 `/admin-demo/` 與其內頁以 HTTP 308 轉址至 `/admin`，網址列同步更新，不提供角色預覽。

## 驗證

- `python -m tests.check_backend`
- `python -m tests.check_oauth_login`
- `python -m tests.check_portal`
- `python -m tests.check_management`
- `python -m tests.check_docker_deployment`
- `python -m tests.check_compose_integration /path/to/server/docker-compose.yml`（需 Docker CLI 與實際主 Compose）
- `node scripts/check-navigation-search.mjs --static-only`

院方真實登入與正式伺服器部署必須在院方環境驗證。線上洽詢寄信仍未啟用；上傳未整合防毒服務；稽核為應用層紀錄，並非外部不可竄改保全。未確認院方資訊繼續標示待確認，不移除必要的來源說明。
