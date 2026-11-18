# 人體生物資料庫整合（2026-11-18）

本次在目前專案完成本機開發與驗證；初次展示階段未 commit、push 或部署，後續使用者已授權提交與推送，實際結果以 Git 紀錄為準。Git 推送不等於正式伺服器部署。新增網址為 `unit.html?unit=biobank`，完整介紹沿用 `unit-about.html?unit=biobank`；共用頁首、頁尾、單位卡片及響應式目錄，未複製舊站視覺，也未操作原 ai-center-website-demo。

## 資料與入口

- `data/units.json` 新增唯一主要資料 `biobank`：介紹、宗旨、業務、目標、公開聯絡資訊、原始來源及七個專屬區塊。
- 主站首頁及隸屬單位列表自動讀取新單位，首頁數量改由公開啟用單位計算。部門介紹新增單位入口，移除寫死七個單位的標題。
- `data/people.json` 增加三筆依原官網公開的職務資料；沒有新增病人資料或私有帳號。
- `data/news.json` 新增 32 則原站歷史公告（2011-11-15 至 2023-06-12），原日期完整保留，設為公開 `expired`。首頁與子站最新消息不顯示這些歷史公告；歷史列表、詳情與搜尋仍可查閱。
- 搜尋新增專屬區塊標題、內容、文件名稱與表格文字，直接連到所在區塊；仍排除未公開／未啟用單位及非公開消息。
- 既有私有 state.json 若已保存 units／people／news，啟動時一次性補入缺少的本庫資料；保留所有已有 ID、管理編輯、授權、歷史與附件。部門介紹只更新仍等於舊初始值的摘要／單位名單，於既有單位群組追加入口，不覆蓋其他卡片及自訂摘要。先建立 `state.before-biobank-2026-11-18.json`，重啟不重覆匯入或恢復已刪項目。沒有 state.json 時直接用初始 JSON，不建立空白正式狀態。

## 官方來源與查核

2026-11-18 實際讀取下列九頁，均 HTTP 200；官網頁面沒有提供整頁更新日期，不能以本次查核日當作公告發布日或文件生效日。

| 原站頁面 | 本站分類 |
| --- | --- |
| [最新消息](https://depart.femh.org.tw/biolab/News.aspx?f=Home) | 歷史公告、消息列表及詳細頁 |
| [管理中心／關於我們](https://depart.femh.org.tw/biolab/Manage.aspx?f=Manage) | 介紹、組織與倫理監督、成員、聯絡 |
| [作業流程](https://depart.femh.org.tw/biolab/Flow.aspx?f=Flow) | 入庫／出庫文字流程、原圖及說明影片 |
| [收費標準](https://depart.femh.org.tw/biolab/Cash.aspx?f=Cash) | 三組語意化表格、備註、原圖 |
| [辦法及表單](https://depart.femh.org.tw/biolab/Rules.aspx?f=Rules) | 九份公開 PDF |
| [相關法規](https://depart.femh.org.tw/biolab/Law.aspx?f=Law) | 六個全國法規資料庫連結、兩份原站 PDF |
| [收案統計](https://depart.femh.org.tw/biolab/Statistics.aspx?f=Stat) | 收案統計摘要及完整原圖 |
| [運用情形](https://depart.femh.org.tw/biolab/Use.aspx?f=Use) | 運用摘要及完整原圖 |
| [研究成果](https://depart.femh.org.tw/biolab/Result.aspx?f=Result) | 八篇論文的年度摘要及完整原圖 |

原站流程影片與歷史公告的國衛院連結、六個法規連結均實際取得 HTTP 200。PDF 與圖表保存於本機公開素材目錄，來源網址逐筆保存在單位資料的 `source_url`。影片保留原站 MP4 外連，沒有自動播放或複製舊站腳本。

## 明確保留的來源問題

1. 原站「參與者退出」連結實際內容是「生物檢體及生物資料銷毀記錄單」（2025-09-03）。本頁保留原站標題並註明實際檔案，退出程序及適用表單請洽本庫確認。
2. 原流程圖寫結案兩個月內繳回剩餘檢體，管理準則及使用合約另有銷毀規定。本頁同時提示差異，未自行決定適用規範；未提供下載的入庫／出庫個別表單不自行製作。
3. 原收費圖沒有生效日期；保留數值、對象、規格與四項備註，正式適用費率請洽本庫。法規頁原日期保留為「原站列表日期」，不當作現行修法日期。
4. 2022-06-28 的許可展延公告只涵蓋 2022-07-01 至 2025-06-30，已屆期；目前許可效期待院方確認，不宣稱目前有效。
5. 收案統計原圖統計至 2026-05-22；運用情形及研究成果原圖未另標示統計截止日，檔名 20260611 不當作統計日期。各分類數值不加總為不重複人數。

## 新增及修改檔案

| 檔案 | 目的 |
| --- | --- |
| [index.html](../index.html)、[assets/js/main.js](../assets/js/main.js) | 公開單位動態數量、本庫卡片沿用圖示系統 |
| [data/units.json](../data/units.json) | 新增唯一單位主資料與專屬內容 |
| [data/people.json](../data/people.json) | 三位公開人員及職務 |
| [data/news.json](../data/news.json) | 32 則保留原始日期的歷史公告 |
| [data/pages.json](../data/pages.json) | 部門介紹、單位名單及入口 |
| [assets/js/units.js](../assets/js/units.js) | 共用選配表格、文件、原圖展開、歷史公告及來源日期顯示 |
| [assets/js/search.js](../assets/js/search.js) | 專屬內容與文件可搜尋並定位 |
| [assets/js/news.js](../assets/js/news.js) | 讀取歷史列表單位及狀態網址參數 |
| [assets/css/public-site.css](../assets/css/public-site.css) | 原圖展開、可捲動表格與歷史列表樣式 |
| [backend/main.py](../backend/main.py)、[backend/store.py](../backend/store.py) | 一次性新增資料整合及備份，保留既有管理資料 |
| [backend/management.py](../backend/management.py) | 分別驗證不同特色區塊的表格、連結與圖片欄位，確保後台能編輯並同步公開資料 |
| [scripts/check-navigation-search.mjs](../scripts/check-navigation-search.mjs) | 增加 JSON 單位連結、圖表與錨點檢查 |
| [tests/check_biobank.py](../tests/check_biobank.py)、[tests/check_biobank_search.mjs](../tests/check_biobank_search.mjs) | 新單位資料保留、角色、公開同步、附件及搜尋回歸 |
| [README.md](../README.md)、[unit-site-template.md](unit-site-template.md)、[phase-1-acceptance.md](phase-1-acceptance.md)、本文件 | 入口、模組欄位、來源、限制與實測紀錄 |

新增八張原始圖表（皆在 `assets/images/biobank/`）：

- [organization.png](../assets/images/biobank/organization.png)：原 `BIOLAB.png`。
- [workflow-20250813.png](../assets/images/biobank/workflow-20250813.png)：原 `流程圖20250813.png`。
- [fees-review.jpg](../assets/images/biobank/fees-review.jpg)、[fees-specimens.jpg](../assets/images/biobank/fees-specimens.jpg)、[fees-data.jpg](../assets/images/biobank/fees-data.jpg)：原 `cash1.jpg` 至 `cash3.jpg`。
- [statistics-20260611.png](../assets/images/biobank/statistics-20260611.png)、[utilization-20260611.png](../assets/images/biobank/utilization-20260611.png)、[publications-20260611.png](../assets/images/biobank/publications-20260611.png)：原 `20260611_stat.png`、`20260611_use.png`、`20260611_result.png`。

新增十二份 PDF（皆在 `assets/documents/biobank/`，內容不作修改）：

| 本機檔案 | 原站名稱／用途 |
| --- | --- |
| [20250902.pdf](../assets/documents/biobank/20250902.pdf) | 倫理委員會名單 |
| [2026416163558.pdf](../assets/documents/biobank/2026416163558.pdf) | 參與者同意書 |
| [20260314001.pdf](../assets/documents/biobank/20260314001.pdf) | 原「參與者退出」；實際為銷毀記錄單 |
| [20260314002.pdf](../assets/documents/biobank/20260314002.pdf) | 生物檢體及相關資訊運用計畫書 |
| [20260314003.pdf](../assets/documents/biobank/20260314003.pdf) | 使用合約書 |
| [20260314004.pdf](../assets/documents/biobank/20260314004.pdf) | 保密協議書 |
| [20260314005.pdf](../assets/documents/biobank/20260314005.pdf) | 管理準則 |
| [20260314006.pdf](../assets/documents/biobank/20260314006.pdf) | 倫理委員會組織章程 |
| [20260314007.pdf](../assets/documents/biobank/20260314007.pdf) | 商業運用利益回饋作業程序 |
| [20260314008.pdf](../assets/documents/biobank/20260314008.pdf) | 遭受侵害情事之通報及救濟措施作業程序 |
| [information-security.pdf](../assets/documents/biobank/information-security.pdf) | 人體生物資料庫資訊安全規範 |
| [research-specimen-guidance.pdf](../assets/documents/biobank/research-specimen-guidance.pdf) | 研究用人體檢體採集與使用注意事項 |

原始來源頁及影片的暫存查核材料移至聊天的視覺化工作目錄，未放入網站建置、未納入正式資料卷；原先已有的未追蹤 `work/` 資料保持不變。
