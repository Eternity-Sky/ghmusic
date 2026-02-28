/**
 * ghmusic 爬虫 - 酷狗音乐
 * 构建时运行，抓取音源数据，存为静态 JSON
 * 参考：批量爬取某音乐网站的音源
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from './crawl.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../public/api');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const KUGOU_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.kugou.com/',
};

/** 搜索歌曲列表 - 使用 songsearch (无需签名) */
async function searchSongs(keyword, page = 1, pagesize = 30) {
  const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&platform=WebFilter&format=json&page=${page}&pagesize=${pagesize}`;
  const res = await fetch(url, { headers: KUGOU_HEADERS });
  const data = await res.json();
  return data?.data?.lists || [];
}

/** 获取单曲播放地址 - 使用 m.kugou.com getSongInfo (仅需 hash) */
async function getPlayUrl(hash) {
  const url = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
  const res = await fetch(url, { headers: KUGOU_HEADERS });
  const data = await res.json();
  if (data?.url && data?.status === 1) return data.url;
  return null;
}

/** 酷狗爬取 */
async function crawlKugou() {
  const tracks = [];
  const artists = new Map();
  const seen = new Set();

  for (const keyword of config.keywords) {
    try {
      const list = await searchSongs(keyword, 1, config.pageSize);
      for (const item of list) {
        const hash = item.FileHash;
        const fileName = item.FileName || '';
        const title = item.SongName || (fileName.includes(' - ') ? fileName.split(' - ')[1] : fileName) || '未知';
        const artist = item.SingerName || (fileName.includes(' - ') ? fileName.split(' - ')[0] : '未知');
        const id = hash || mixId || `kugou-${tracks.length}`;
        if (seen.has(id)) continue;
        seen.add(id);

        let audio = null;
        if (hash) {
          try {
            audio = await getPlayUrl(hash);
          } catch {
            /* 付费或获取失败则无音源 */
          }
        }

        const artistId = `a-${artist}`;
        if (!artists.has(artistId)) {
          artists.set(artistId, { id: artistId, name: artist, tracks: [] });
        }
        artists.get(artistId).tracks.push(id);

        tracks.push({
          id,
          title: String(title).trim() || fileName,
          artist: String(artist).trim(),
          artistId,
          duration: item.Duration ? Math.round(item.Duration / 1000) : null,
          album: item.AlbumName || null,
          cover: (item.Image || item.img || item.album_img || '').replace('{size}', '150') || null,
          audio,
          source: 'kugou',
        });
        await sleep(500);
      }
      await sleep(800);
    } catch (e) {
      console.warn(`[ghmusic] 爬取 "${keyword}" 失败:`, e.message);
    }
  }

  return {
    tracks,
    artists: [...artists.values()],
  };
}

async function main() {
  console.log('[ghmusic] 开始爬取酷狗...');
  
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let tracks = [];
  let artists = [];

  try {
    const result = await crawlKugou();
    tracks = result.tracks;
    artists = result.artists;
    const withAudio = tracks.filter(t => t.audio).length;
    console.log(`[ghmusic] 酷狗: ${tracks.length} 首 (${withAudio} 首有音源)`);
  } catch (e) {
    console.error('[ghmusic] 爬取失败:', e);
  }

  const api = {
    tracks,
    artists,
    meta: {
      updated: new Date().toISOString(),
      total: tracks.length,
      source: 'kugou',
    },
  };

  writeFileSync(join(OUTPUT_DIR, 'index.json'), JSON.stringify(api, null, 2), 'utf-8');
  writeFileSync(join(OUTPUT_DIR, 'tracks.json'), JSON.stringify({ tracks }, null, 2), 'utf-8');
  writeFileSync(join(OUTPUT_DIR, 'artists.json'), JSON.stringify({ artists }, null, 2), 'utf-8');

  console.log(`[ghmusic] 完成: ${tracks.length} 首 -> public/api/`);
}

main().catch(console.error);
