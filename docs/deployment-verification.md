# 正式站版本與管理員啟用

2026-10-30 實測正式站：`/medresearch/admin-demo/` 仍提供「內容管理後台 Demo」，舊 JavaScript 仍含角色切換；`/medresearch/admin` 與 `/medresearch/internal` 均為 404。Git 上傳不會取代正在執行的舊容器，必須在正式伺服器重新建置並建立本站容器。

## 保留現有資料

更新前備份目前伺服器的 `data/news.json`、新聞圖片與附件，以及整個既有 `DATA_DIRECTORY`／資料卷。若消息直接在伺服器改過，先比對、保留並合併，不能直接用本機舊檔覆蓋，也不要使用 hard reset。備份存於公開靜態目錄之外。

本版不會將正式內容清空或重設為展示資料；新版管理內容保存在持久化資料卷。不可使用 `docker compose down -v`。公開／院內消息仍依發布狀態與範圍過濾。

## 更新正在執行的服務

在正式伺服器的專案目錄先確認目前分支與 Git 更新，目標為 `feature/medresearch-platform-v1`。處理完本機內容差異後，才以 fast-forward 方式取得 Git 新版。不要重建其他服務。

回到現有主 Compose 目錄，沿用原來相同的 project name 及主 Compose（下例 project name 須與現有 stack 相同）：

```bash
docker compose -p femh-genai-wwservice \
  -f docker-compose.yml \
  -f medresearch-website-platform/deployment/docker-compose.medresearch.yml \
  up -d --build --force-recreate --no-deps medresearch-app
```

本次修正版的公開版本端點是 `/medresearch/api/version`，必須回傳 `version: "2026.10.30.4"` 及 `management: "server_authorized"`。任何頁面亦帶有 `X-Medresearch-Version` 回應標頭。`healthz` 成功只表示服務存活，不代表已更新到此版。

若版本端點仍為 404，請確認重建的服務、build context、執行映像，以及反向代理是否把整個 `/medresearch/` 指到同一個 `medresearch-app:8000`。不要只複製前端檔案或只重啟舊映像。

正式管理網址為 `/medresearch/admin`。舊 `/medresearch/admin-demo/` 及其內頁會先以 HTTP 308 轉到正式 `/medresearch/admin`，網址列不再保留 demo；正式管理入口及 `/medresearch/internal` 在未登入時導向登入，不應直接看到角色選擇或編輯頁。

## 第一位系統管理員

院方識別欄位已確認為 `sub`，身分欄位確認表格已移除。維運於伺服器私有 `.env.docker` 設定：

```dotenv
ADMIN_IDENTITY_CLAIM=sub
SYSTEM_ADMIN_IDS=管理者實際回傳的sub值
```

名單採完整、區分大小寫的比對；若 sub 是員編則填員編，若是 UID 則填 UID。真實值只存伺服器，不提交 Git。環境檔修改後沿用上面的 force-recreate 指令，再重新登入。

系統管理員登入後直接進管理中心；一般院內人員進 `/internal`。院內專區不再顯示 Token 欄位、候選值或身分診斷資料。詳見 [登入與授權設定](login-authorization.md)。
