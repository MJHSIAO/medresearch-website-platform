# 系統管理員與院內授權設定

2026-10-30 已由使用者確認院方登入識別欄位為 `sub`。登入身分確認用的欄位表格已移除；`/internal` 現為一般院內專區，只顯示登入者名稱、目前角色、管理入口及院內消息，不再顯示 claims、UID 候選值或診斷欄位。

## 正式伺服器設定

於伺服器私有 `.env.docker`（本機使用 `.env`）設定：

```dotenv
ADMIN_IDENTITY_CLAIM=sub
SYSTEM_ADMIN_IDS=管理者實際回傳的sub值
```

`SYSTEM_ADMIN_IDS` 必須與經院方驗證的 `sub` 完整相同，區分大小寫。若實際 sub 等於員編，名單就填該員編；若 sub 為 UID，就填該 UID。不使用姓名、前端角色或 localStorage 判斷。多個值用逗號分隔；真實名單不得提交 Git。

範例環境檔已填 `ADMIN_IDENTITY_CLAIM=sub`，管理員名單留空。取得新版不會自動改寫伺服器既有 `.env.docker`，須由維運調整該檔案。

設定後以原 Compose 配置重新建立本站容器（`up -d --force-recreate --no-deps medresearch-app`），再重新登入；單純 restart 不會重讀 env_file。管理員登入直接進 `/admin`，一般院內人員進 `/internal`。系統管理員擁有全部管理功能，不需兼任醫研部總管理員。

## 存取與撤權

每次 API 或管理頁請求重新計算角色及單位範圍。匿名導向登入；一般人員不能進管理頁。舊 admin-demo 網址會以 HTTP 308 轉到正式 `/admin`，瀏覽器網址列同步更新；正式入口仍由後端驗證身分與權限，不提供角色切換。人員授權操作見 [管理指南](management-guide.md)。

沒有名單時登入者仍可使用一般院內專區，不自動提升第一位登入者。若名單非空但 ADMIN_IDENTITY_CLAIM 為空，會拒絕啟動以避免授權歧義。

## 驗證

`/api/version` 應回傳 `2026.10.30.4`。登入後核對目前角色與可用功能，不再透過網頁展示身分欄位。維運診斷不得輸出完整 Token、Cookie 或 Secret。單程序 Session 與部署限制不變。

`python -m tests.check_portal` 驗證 sub 名單比對、一般人員拒絕、撤權、診斷區不外露、登出與子路徑。
