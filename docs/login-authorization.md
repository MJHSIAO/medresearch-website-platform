# 登入身分確認與第一位系統管理員

本版先完成院方登入後的身分確認與系統管理員存取控制。沒有自動任命第一位登入者；未設定或不符名單者都是一般院內人員。

## 第一次啟動

1. 更新完整專案，依 README 或 Docker 部署文件啟動 FastAPI；不可用靜態 HTTP server 測試登入。
2. 保留 `ADMIN_IDENTITY_CLAIM`、`SYSTEM_ADMIN_IDS` 空白。
3. 從網站的 `auth/login` 開始新的院方登入流程。成功後會導向同一部署前綴的 `internal`。
4. 在「登入身分確認」核對自己的識別值與欄位名稱。頁面只顯示自己經驗證的 sub 與有限的員工識別候選值，以及所有欄位名稱；不顯示 Token、Secret 或完整 claims。候選值不會自動用於授權。
5. 確認院方契約中的穩定識別欄位；`sub` 不必然是員編。若畫面沒有員編欄位，請由維運人員核對院方規格，不要猜測。

## 設定系統管理員

只在伺服器 `.env` 或 `.env.docker` 填寫：

```dotenv
ADMIN_IDENTITY_CLAIM=院方確認的欄位名稱
SYSTEM_ADMIN_IDS=該欄位的實際識別值
```

多個識別值以逗號分隔。採區分大小寫的完整字串比對，不接受陣列、數字、姓名比對或前端傳入角色。範例檔刻意留空，真實員編及授權名單不得提交 Git。若只填名單而沒有指定欄位，啟動會拒絕設定。

變更後重新啟動程序；Docker env_file 變更需重新建立容器（依 docker-deployment.md 的 Compose 指令使用 `up -d --force-recreate --no-deps medresearch-app`），單純 restart 不會重讀新的 env_file。重新登入後確認角色為系統管理員，並可進入 `admin`。

## 存取行為

- 匿名進入 internal、admin 或舊 admin-demo 路徑：導向院方登入起點。
- 一般人員：可查看自己的 internal；直接開 admin 或舊管理頁回傳 403。
- 系統管理員：可進入系統管理入口。舊 admin-demo 網址同樣顯示受保護的新管理入口，不再提供角色切換表單。
- `/api/me` 每次根據伺服器設定與經驗證的 session claims 計算角色；不採用 Cookie 提示、localStorage 或先前快取角色作授權。
- 身分頁與管理頁皆設定 no-store；登出後無法再次讀取。設定更新需重啟，現有單程序 Session 隨程序重啟失效。

## 尚未開放

本次不包含單位管理員與醫研部總管理員名單維護、正式內容保存／發布、附件上傳、版型或系統設定寫入。系統管理員定義仍涵蓋全部功能，後續管理 API 必須接同樣的後端驗證。未完成的功能不提供假儲存按鈕。

單程序記憶體 Session 限制保持不變，禁止多 worker。靜態 build／GitHub Pages 無登入或存取保護，不能部署為院內管理系統。既有公開 JSON 僅含公開資料及明確測試資料，任何真實院內內容都必須另由受保護 API 提供。

## 檢查

`python -m tests.check_portal` 驗證匿名、一般人員、系統管理員、偽造前端角色、撤權、登出、字串比對、HTML 跳脫、Token 不外露與子路徑。
