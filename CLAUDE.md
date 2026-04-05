# Project: mordenEhDownloader

## 打包部署流程

每次 `npm run build` 完成後，**必須詢問使用者**是否需要將打包結果部署到測試目錄：

- 目標路徑：`C:\Users\qwe70\Downloads\eh-downloader-v2.1.1\dist`
- 操作：清除目標 dist 後，將專案 `dist/` 複製過去
- 指令：`rm -rf "C:/Users/qwe70/Downloads/eh-downloader-v2.1.1/dist" && cp -r dist "C:/Users/qwe70/Downloads/eh-downloader-v2.1.1/dist"`

**規則：**
1. Build 後第一次要問：「需要部署到測試目錄嗎？」
2. 使用者確認後，同一個 context 內後續的 build 都直接部署，不再詢問
3. 使用者拒絕則同一個 context 內不再詢問
