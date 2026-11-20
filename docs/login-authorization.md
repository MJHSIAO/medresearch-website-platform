# 系統管理員與院內授權設定

2026-10-30 已由使用者確認院方登入識別欄位為 `sub`。登入身分確認用的欄位表格已移除；`/internal` 現為一般院內專區，只顯示登入者名稱、目前角色、管理入口及院內消息，不再顯示 claims、UID 候選值或診斷欄位。

## 操作紀錄姓名（2026-11-20 本機調整）

本次完成院方正式站的實際登入；登入後 `/api/me` 的 `claim_names` 包含 `sub`、`unique_name`，不包含 `name` 或 `preferred_username`。此回應未公開 `unique_name` 的值，因此只能確認欄位存在，不能確認其值就是中文姓名。使用者已確認本機功能並授權提交、推送 GitHub；姓名值繼續標示待驗證，未部署正式站。

新增伺服器設定 `OIDC_NAME_CLAIM`，範例檔預設留空，避免猜測姓名來源。院方核對經後端驗證的 claim 值確為姓名後，再於私有環境檔填入對應欄位名稱；若確認為 `unique_name`，才設定 `OIDC_NAME_CLAIM=unique_name`。重建容器、重新登入並執行一次允許的操作，核對新紀錄的姓名及員編。不要提供完整 Token、Cookie、Secret 或全部 claims，不需開啟廣泛的 claims 日誌。

姓名僅從已完成現有 JWT 驗證或受保護 UserInfo 取得的 claims 讀取。空白、非字串、控制字元及超過 200 字的值不作姓名；來源欄位未設定／缺值時只記原員編，不改從帳號、人員名單或使用者送出的欄位猜測。設定的姓名也會供登入者顯示名稱使用，原有正常顯示名稱的後備規則仍保留，但不拿後備值寫成稽核姓名。

新操作在私有 audit 項目額外保存 `actor_name` 及 `actor_name_claim`，原 `actor` 員編不變。工作台近期操作及操作紀錄共用「姓名（員編）」格式；若姓名與員編相同，僅記員編。舊紀錄不遷移、不補推測姓名、不改原日期；往後姓名改變也不覆寫舊快照。角色仍依原 `ADMIN_IDENTITY_CLAIM`、保留管理員名單及伺服器授權計算，查閱紀錄的單位範圍不變。

`tests.check_audit_identity`、`tests.check_oauth_login` 及 `tests/check_audit_display.mjs` 使用虛構資料驗證來源、保存、舊資料相容及顯示。隔離預覽 `--audit-identity-preview` 以虛構 `unique_name` 展示，不代表院方實際姓名值已驗證。修改檔案與本機驗證詳見 [本次紀錄](audit-identity-review.md)。

## 正式伺服器設定

於伺服器私有 `.env.docker`（本機使用 `.env`）設定：

```dotenv
ADMIN_IDENTITY_CLAIM=sub
SYSTEM_ADMIN_IDS=管理者實際回傳的sub值
```

`SYSTEM_ADMIN_IDS` 必須與經院方驗證的 `sub` 完整相同，區分大小寫。若實際 sub 等於員編，名單就填該員編；若 sub 為 UID，就填該 UID。不使用姓名、前端角色或 localStorage 判斷。多個值用逗號分隔；真實名單不得提交 Git。

範例環境檔已填 `ADMIN_IDENTITY_CLAIM=sub`，管理員名單留空。取得新版不會自動改寫伺服器既有 `.env.docker`，須由維運調整該檔案。

設定後以原 Compose 配置重新建立本站容器（`up -d --force-recreate --no-deps medresearch-app`），再重新登入；單純 restart 不會重讀 env_file。登入後返回登入前的本站頁面（含查詢條件與錨點）；沒有有效返回頁時回到首頁。管理者可點頁首「院內專區」旁的「管理中心」直接前往 `/admin`。系統管理員擁有全部管理功能，不需兼任醫研部總管理員。

## 存取與撤權

每次 API 或管理頁請求重新計算角色及單位範圍。匿名導向登入；一般人員不能進管理頁。舊 admin-demo 網址會以 HTTP 308 轉到正式 `/admin`，瀏覽器網址列同步更新；正式入口仍由後端驗證身分與權限，不提供角色切換。人員授權操作見 [管理指南](management-guide.md)。

沒有名單時登入者仍可使用一般院內專區，不自動提升第一位登入者。若名單非空但 ADMIN_IDENTITY_CLAIM 為空，會拒絕啟動以避免授權歧義。

## 驗證

`/api/version` 應回傳 `2026.11.13.1`。登入後核對目前角色與可用功能，不再透過網頁展示身分欄位。維運診斷不得輸出完整 Token、Cookie 或 Secret。單程序 Session 與部署限制不變。

`python -m tests.check_portal` 驗證 sub 名單比對、一般人員拒絕、撤權、診斷區不外露、登出與子路徑。
