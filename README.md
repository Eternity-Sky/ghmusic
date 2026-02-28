# ghmusic

无后端音乐网站，全爬取，GitHub Pages 部署。深色简洁设计，数据可后期作为自有 API 使用。

## 特性

- **无后端**：纯静态站点，无服务器
- **全爬取**：构建时从 MusicBrainz 等源抓取元数据
- **深色主题**：简洁现代 UI
- **API 就绪**：`public/api/` 下 JSON 可单独作为 API 使用

## 快速开始

```bash
npm install
npm run dev      # 开发（先执行 crawl 生成数据）
npm run crawl    # 仅爬取数据
npm run build    # 爬取 + 构建
```

## 部署到 GitHub Pages

1. 推送代码到 GitHub 仓库 `ghmusic`
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**
3. 推送到 `main` 分支会自动部署

访问：`https://<username>.github.io/ghmusic/`

## 数据源

- **酷狗音乐**：曲目元数据 + 音源
  - 搜索：songsearch.kugou.com
  - 播放链接：m.kugou.com getSongInfo
- 可在 `scripts/crawl.config.js` 修改搜索关键词

## 后期作为 API

`public/api/` 目录下的 JSON 文件可直接作为 API：

- `index.json` - 完整数据
- `tracks.json` - 曲目列表
- `artists.json` - 艺人列表

部署后访问：`https://<username>.github.io/ghmusic/api/tracks.json`
