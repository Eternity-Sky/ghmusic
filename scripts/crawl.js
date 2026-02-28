/**
 * ghmusic 爬虫 - 构建时运行，抓取音乐数据
 * 无后端，数据存为静态 JSON，可后期作为 API 使用
 * 
 * 数据源: MusicBrainz (元数据) + 可扩展
 * 运行: npm run crawl 或 npm run build
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../public/api');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'ghmusic/1.0 (https://github.com/user/ghmusic)',
      'Accept': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** MusicBrainz 搜索 - 无需 API Key，需遵守 1 req/sec */
async function crawlMusicBrainz() {
  const tracks = [];
  const artists = new Map();
  const albums = new Map();

  const queries = ['rock', 'jazz', 'electronic', 'classical', 'pop'];
  
  for (const q of queries) {
    try {
      const data = await fetchJSON(
        `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&fmt=json&limit=15`
      );
      for (const rec of data.recordings || []) {
        const artist = rec['artist-credit']?.[0]?.artist || {};
        const artistName = artist.name || 'Unknown';
        const artistId = artist.id || `a-${artistName}`;
        
        if (!artists.has(artistId)) {
          artists.set(artistId, {
            id: artistId,
            name: artistName,
            tracks: [],
          });
        }
        artists.get(artistId).tracks.push(rec.id);

        const track = {
          id: rec.id,
          title: rec.title,
          artist: artistName,
          artistId,
          duration: rec.length ? Math.round(rec.length / 1000) : null,
          album: rec.releases?.[0]?.title || null,
          albumId: rec.releases?.[0]?.id || null,
          // MusicBrainz 不提供音频链接，使用 Cover Art Archive 或占位
          cover: rec.releases?.[0]?.id 
            ? `https://coverartarchive.org/release/${rec.releases[0].id}/front-250`
            : null,
          audio: null, // 可后续从 relations 或其它源补充
          source: 'musicbrainz',
        };
        tracks.push(track);

        if (rec.releases?.[0] && !albums.has(rec.releases[0].id)) {
          albums.set(rec.releases[0].id, {
            id: rec.releases[0].id,
            title: rec.releases[0].title,
            artist: artistName,
            cover: track.cover,
          });
        }
      }
      await sleep(1100); // 遵守 1 req/sec
    } catch (e) {
      console.warn(`MusicBrainz crawl [${q}]:`, e.message);
    }
  }

  return {
    tracks: [...new Map(tracks.map(t => [t.id, t])).values()],
    artists: [...artists.values()],
    albums: [...albums.values()],
  };
}

/** 内置演示曲目 - 使用免费可商用音源占位，用户可替换为爬取结果 */
function getDemoTracks() {
  return [
    {
      id: 'demo-1',
      title: 'Ambient Flow',
      artist: 'Demo Artist',
      artistId: 'demo-artist',
      duration: 180,
      album: 'Demo Album',
      albumId: 'demo-album',
      cover: 'https://picsum.photos/seed/music1/300/300',
      audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      source: 'demo',
    },
    {
      id: 'demo-2',
      title: 'Calm Piano',
      artist: 'Demo Artist',
      artistId: 'demo-artist',
      duration: 240,
      album: 'Demo Album',
      albumId: 'demo-album',
      cover: 'https://picsum.photos/seed/music2/300/300',
      audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      source: 'demo',
    },
    {
      id: 'demo-3',
      title: 'Electronic Beat',
      artist: 'Demo Artist',
      artistId: 'demo-artist',
      duration: 200,
      album: 'Demo Album',
      albumId: 'demo-album',
      cover: 'https://picsum.photos/seed/music3/300/300',
      audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      source: 'demo',
    },
  ];
}

async function main() {
  console.log('[ghmusic] 开始爬取...');
  
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let tracks = [];
  let artists = [];
  let albums = [];

  try {
    const mb = await crawlMusicBrainz();
    tracks = mb.tracks;
    artists = mb.artists;
    albums = mb.albums;
    console.log(`[ghmusic] MusicBrainz: ${tracks.length} tracks`);
  } catch (e) {
    console.warn('[ghmusic] MusicBrainz 失败，使用演示数据:', e.message);
  }

  const demos = getDemoTracks();
  const allTracks = [...demos, ...tracks.filter(t => t.id && !demos.find(d => d.id === t.id))];
  const allArtists = [...new Map([
    ...demos.map(t => [t.artistId, { id: t.artistId, name: t.artist, tracks: [t.id] }]),
    ...artists.map(a => [a.id, a]),
  ]).values()];

  const api = {
    tracks: allTracks,
    artists: allArtists,
    albums,
    meta: {
      updated: new Date().toISOString(),
      total: allTracks.length,
    },
  };

  writeFileSync(
    join(OUTPUT_DIR, 'index.json'),
    JSON.stringify(api, null, 2),
    'utf-8'
  );
  writeFileSync(
    join(OUTPUT_DIR, 'tracks.json'),
    JSON.stringify({ tracks: allTracks }, null, 2),
    'utf-8'
  );
  writeFileSync(
    join(OUTPUT_DIR, 'artists.json'),
    JSON.stringify({ artists: allArtists }, null, 2),
    'utf-8'
  );

  console.log(`[ghmusic] 完成: ${allTracks.length} 首曲目 -> public/api/`);
}

main().catch(console.error);
