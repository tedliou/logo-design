# logo-design

[English](README.en.md)

想替部落格、小店或作品集做一個標誌，卻只能拿到「看起來還不錯」的插圖時，問題通常不在畫功，而在沒有人先問清楚這個標誌要說什麼、為什麼長這樣。logo-design 是一個 Claude Code plugin，讓 Claude 和你一起把標誌做到商標等級：每個元素說得出理由，構成可以量測，16 px 的分頁圖示也認得出來。

Claude 負責研究、量測、畫圖與檢查，你只在六個關卡做決定。答不出來的問題，Claude 會換成對比、看圖或先提預設讓你否決，不會一直重問。

## 內容

| 元件 | 做什麼 |
| --- | --- |
| `designing-logos` skill | 向量標誌的完整流程：提問、照片量測與取色、意義與形式兩張九宮格、方向與變體、構成規格、交付包 |
| `designing-pixel-logos` skill | 整個標誌都是像素風的設計，以及向量標誌在 16、32 px 的手排像素版本 |
| `logo-critic` 子代理 | 用乾淨的上下文看接觸表，先回答「第一眼看到什麼」，再依評估準則指出要淘汰的方向；它看不到設計理由，所以不會被說服 |

## 流程

```
開始：品牌名稱，可附照片、舊標誌
  P0 提問 ─────────── G1 確認簡報
  P1 照片量測與取色 ── G2 選 2 到 3 個特徵、抽象程度（有照片時）
  P2 意義九宮格 ────── G3 接受建議的母題、選概念句
  P3 形式九宮格與方向 ─ G4 選方向，保留其他方向的局部
  P4 變體矩陣 ──────── G5 每個屬性選一個（要比的屬性超過兩個時）
  P5 構成與交付 ────── G6 確認構成規則、色彩與交付清單
```

- 意義九宮格決定標誌要說什麼：中央是核心句，周圍八格各用一個視角（主體、名字、對象、行動、方法、類比、時間、張力）找主題，每個主題再展開八個畫得出來的母題。
- 形式九宮格決定怎麼畫：選定的概念句放中央，八格各用一種形式操作（剪影、骨架、動勢、圖地、減法、融合、替換、切割）畫一張縮圖。
- 每一關的答案、來源與理由都寫進工作簿資料夾，換一個 session 也能從檔案接著做。

## 安裝

```bash
claude plugin marketplace add tedliou/logo-design
```

```bash
claude plugin install logo-design@logo-design
```

腳本用 Node.js 20 以上執行，算圖與讀照片用 [sharp](https://sharp.pixelplumbing.com/)。安裝 plugin 後，在 plugin 的資料夾執行一次 `npm install`。也可以把環境變數 `LOGO_SHARP_FROM` 設成任何已經裝了 sharp 的專案的 `package.json` 路徑。

## 使用

直接說「幫我設計一個 logo」「把這張照片變成標誌」「用九宮格幫我想品牌主題」就會觸發，也可以明確呼叫：

```text
/logo-design:designing-logos 阿德單車 ~/Pictures/shop.jpg
```

- 工作簿預設放在 `~/logo-work/<名稱>/`，用環境變數 `LOGO_WORK_ROOT` 改位置。照片會複製進工作簿，原檔不會被改動。
- 只想要品牌主題的九宮格時，Claude 會用 ideation 範圍，做到 G3 就停。
- 你在各專案說過的穩定偏好會記在 `~/logo-work/taste.md`，下一個專案不再問。

定稿的交付包包含：

- 彩色、單色與反白 SVG
- 16 到 1024 px 的 PNG
- favicon.ico
- 構成圖
- 印刷質感的展示稿
- 說明每個元素意義與決策紀錄的一頁 HTML

每個檔案都標了用途，用不到的可以在 G6 拿掉。

## 限制

- Claude 不會生成點陣圖。標誌是 Claude 寫的 SVG，展示稿的紙纖維、套色錯位與顆粒用 SVG 濾鏡模擬，比不上攝影等級的印刷質感。
- 相似商標檢查只是用 Claude 能用的工具搜尋，不是法律上的商標檢索。要註冊時，你需要自己到 WIPO Global Brand Database 與各國商標局查。
- 美感由你決定。評審子代理與腳本只負責刪掉明顯不合格的選項。
- 研究出處分成三種查證狀態，見 `skills/designing-logos/references/evidence.md`。標成「待對照」的出處，引用前要再核對原文。

## 評測

`evals/` 是給 `claude plugin eval` 用的題目：

- E3 檢查三種請求分別觸發哪個 skill。
- E4 檢查只要九宮格時，流程停在 G3、沒有畫任何 SVG。

```bash
claude plugin eval . --ablation none --allow-tools Bash --runs 1
```

完整流程的比較（有 skill 的 medium effort 對上沒有 skill 的 max effort）需要人看圖判斷，做法寫在 `skills/designing-logos/evals/README.md`。

## 授權

MIT
