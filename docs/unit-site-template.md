# 單位子站共用模板

## 適用範圍

本模板適用於學術研發室、共同研究室、動物實驗室、臨床試驗中心、細胞治療中心及創新智財產學中心。人工智慧中心沿用已完成的獨立第一版子站，不套用此模板。

## 原官網共同內容

六個單位的原官網雖然篇幅與呈現方式不同，但都可歸納為同一組核心資訊：

1. 單位名稱與定位。
2. 單位簡介、成立宗旨或負責業務。
3. 主管及成員。
4. 主要業務、服務或研究資源。
5. 規範、流程、表單或常用資訊入口。
6. 聯絡資訊。
7. 官方來源及原頁面更新日期。

共用子站因此固定呈現「常用入口、單位介紹、發展目標、主要業務、重點領域、成員、相關消息、聯絡與資料來源」。沒有官方公開內容的欄位不以示意文字補造。

## 選配模組

| 單位 | 依原官網加入的選配內容 | 官方來源 |
| --- | --- | --- |
| 學術研發室 | 研究制度、論文獎勵、院內研究計畫、學術會議補助與能力提升文件 | [原官網](https://depart.femh.org.tw/medresearch/Office.html) |
| 共同研究室 | Wet Lab／Dry Lab／人體生物資料庫空間配置、空間申請重點、儀器及操作課程 | [原官網](https://depart.femh.org.tw/medresearch/CoreLab.html) |
| 動物實驗室 | SPF／一般飼養與操作空間、研究計畫申請及動物實驗執行流程 | [原官網](https://depart.femh.org.tw/medresearch/AnimalRoom.html) |
| 臨床試驗中心 | 臨床試驗計畫、研究協調員及 CRA 管理規範 | [原官網](https://depart.femh.org.tw/medresearch/ClinicalTrial.html) |
| 細胞治療中心 | 最新資訊、專業課程、再生醫療法規、核定收費與臨床成果 | [原官網](https://depart.femh.org.tw/medresearch/CellTherapy.html) |
| 創新智財產學中心 | 研發成果管理、專利申請與清單、讓與公告及技術移轉 | [原官網](https://depart.femh.org.tw/medresearch/IIP.html) |

資料查核日期：2026-09-04。正式規範、表單版本、資格、期限與聯絡資訊仍以官方頁面及院內最新公告為準。

## 維護方式

- 基本內容維護於 `data/units.json` 的既有欄位。
- 常用公開連結維護於 `resource_links`；外部連結一律另開新分頁。
- 單位特有內容維護於 `special_sections`，不複製 HTML。
- 新增單位時沿用 `unit.html?unit={slug}`，除非已有經核准的獨立子站。
- 公開頁僅載入 `visibility` 為 `public` 或 `both` 且 `status` 為 `active` 的單位。
