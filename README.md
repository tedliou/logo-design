# logo-design

[English](README.en.md)

logo-design 是 Claude Code 的標誌設計 plugin。Claude 會先問清楚標誌要說什麼，再量測照片、發想、畫圖與檢查，最後交付可以當正式標誌使用的檔案：每個元素說得出理由，構成可以量測，16 px 的分頁圖示也認得出來。

直接請模型畫標誌，常常只拿到一張好看的插圖，因為沒有人先問這個標誌要說什麼、為什麼長這樣。這個 plugin 把這些問題排進流程：Claude 負責研究、量測、畫圖與檢查，你最多在六個關卡做決定。答不出來的問題，Claude 會換成對比選項、看圖選擇，或先提預設讓你否決，不會一直重問。

## 包含的元件

| 元件 | 做什麼 |
| --- | --- |
| `designing-logos` skill | 向量標誌的完整流程：提問、照片量測與取色、意義與形式兩張九宮格、方向與變體、構成規格、交付包 |
| `designing-pixel-logos` skill | 整個標誌都是像素風的設計，以及向量標誌在 16、32 px 逐格排出的像素版本 |
| `logo-critic` 子代理 | 用乾淨的上下文看接觸表（所有候選在各種尺寸與底色的縮圖排成一張），先回答「第一眼看到什麼」，再依[評估準則](skills/designing-logos/references/rubric.md)建議淘汰哪些方向。它看不到設計理由，所以不會被說服 |

## 流程

下圖左欄是 Claude 做的階段，右欄是你做決定的關卡。

```
開始：品牌名稱，可附照片、舊標誌
  P0 提問 ─────────── G1 確認簡報
  P1 照片量測與取色 ── G2 選 2 到 3 個特徵與抽象程度（有照片時）
  P2 意義九宮格 ────── G3 接受建議的母題、選概念句
  P3 形式九宮格與方向 ─ G4 選方向，保留其他方向的局部
  P4 變體矩陣 ──────── G5 每個屬性選一個（要比較的屬性超過兩個時）
  P5 構成與交付 ────── TM 相似商標檢索（要註冊或正式商用時）
                      G6 確認構成規則、色彩與交付清單
```

- 意義九宮格決定標誌要說什麼：中央是核心句，周圍八格各用一個視角（主體、名字、對象、行動、方法、類比、時間、張力）找主題，每個主題再展開八個畫得出來的母題。
- 形式九宮格決定怎麼畫：選定的概念句放中央，八格各用一種形式操作（剪影、骨架、動勢、圖地、減法、融合、替換、切割）畫一張縮圖。
- 變體矩陣一次只換一個屬性，例如眼睛、線寬或圓角，其他固定。要比較的屬性只有一兩個時，這些問題併進 G4 一起問。
- 每一關的答案、來源與理由都寫進工作簿資料夾，換一個 session 也能從檔案接著做。

## 安裝

```bash
claude plugin marketplace add tedliou/logo-design
```

```bash
claude plugin install logo-design@logo-design
```

腳本需要 Node.js 20 以上，算圖與讀照片用 [sharp](https://sharp.pixelplumbing.com/)。安裝 plugin 後，到 plugin 的資料夾裝一次 sharp：

```bash
cd ~/.claude/plugins/cache/logo-design/logo-design/0.1.0 && npm install
```

也可以把環境變數 `LOGO_SHARP_FROM` 設成另一個已安裝 sharp 的專案的 `package.json` 路徑。沒有 sharp 時，提問、九宮格與工作簿照常運作，照片量測、取色、接觸表與交付包會停下來並提示安裝方式。

## 使用

直接說「幫我設計一個 logo」「把這張照片變成標誌」「用九宮格幫我想品牌主題」就會觸發，也可以明確呼叫：

```text
/logo-design:designing-logos 阿德單車 ~/Pictures/shop.jpg
```

- 工作簿預設放在 `~/logo-work/<名稱>/`，用環境變數 `LOGO_WORK_ROOT` 改位置。照片會複製進工作簿，Claude 不會改動原檔。
- 只想要品牌主題時，Claude 只做意義九宮格，做到 G3 就停。
- 你在各專案說過的穩定偏好會記在 `~/logo-work/taste.md`，下一個專案不再問。

定稿的交付包包含：

- 彩色、單色與反白 SVG
- 16 到 1024 px 的 PNG
- favicon.ico
- 構成圖：網格、角度與曲線半徑疊在標誌上
- 展示稿：用 SVG 濾鏡模擬紙纖維、套色錯位與顆粒
- 一頁 HTML，說明每個元素的意義，並附決策紀錄

每個檔案都標了用途，用不到的可以在 G6 拿掉。

## 限制

- Claude 不用影像生成模型畫圖。標誌是 Claude 寫的 SVG，PNG 與 favicon.ico 都由 SVG 輸出，小尺寸的像素版本是逐格排出來的。展示稿的質感比不上攝影。
- 相似商標檢查是 Claude 用網頁搜尋找同主題、同手法的標誌，不等同法律上的商標檢索。要註冊時，你需要自己到 WIPO Global Brand Database 與各國商標局查詢，Claude 會先準備關鍵字與圖形分類建議。
- 美感由你決定。`logo-critic` 與檢查腳本只負責刪掉明顯不合格的選項。
- skill 的規則引用了設計與行銷研究，每條出處標了查證狀態：讀過期刊摘要、只有二手資料、待對照原文，見 `skills/designing-logos/references/evidence.md`。待對照的出處，引用前要再核對原文。

## 開發者：評測

完整流程有五個評測案例（E0 到 E4），做法見 `skills/designing-logos/evals/README.md`。其中 E0 到 E2 要人看圖判斷，用自己的照片跑。`evals/` 放的是不需要看圖的兩個案例，給 `claude plugin eval` 用：

- E3 檢查三種請求分別觸發哪個 skill。
- E4 檢查只要九宮格時，流程停在 G3、沒有畫任何 SVG。

```bash
claude plugin eval . --ablation none --allow-tools Bash --runs 1
```

## 授權

MIT
