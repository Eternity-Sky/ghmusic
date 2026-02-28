/**
 * ghmusic - 前端逻辑
 * 从 /api/index.json 加载爬取数据，无后端
 */

const API_BASE = '/ghmusic/api';

let allTracks = [];
let filteredTracks = [];
let currentIndex = -1;
let isPlaying = false;

const audio = document.getElementById('audio');
const searchInput = document.getElementById('search');
const trackListEl = document.getElementById('track-list');
const nowCover = document.getElementById('now-cover');
const nowTitle = document.getElementById('now-title');
const nowArtist = document.getElementById('now-artist');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const seekBar = document.getElementById('seek');

function formatTime(sec) {
  if (sec == null || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function loadData() {
  try {
    const apiBase = import.meta.env.DEV ? '' : (import.meta.env.BASE_URL || '');
    const res = await fetch(`${apiBase}api/index.json`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    allTracks = (data.tracks || []).filter(t => t && t.id);
    filteredTracks = [...allTracks];
    renderTracks();
    if (allTracks.length > 0 && currentIndex < 0) {
      currentIndex = 0;
      updateNowPlaying();
    }
  } catch (e) {
    console.warn('加载数据失败:', e);
    trackListEl.innerHTML = `
      <div class="empty-state">
        <p>请先运行 <code>npm run build</code> 生成爬取数据</p>
        <p>或检查 public/api/index.json 是否存在</p>
      </div>
    `;
  }
}

function renderTracks() {
  if (filteredTracks.length === 0) {
    trackListEl.innerHTML = '<div class="empty-state"><p>暂无曲目</p></div>';
    return;
  }
  trackListEl.innerHTML = filteredTracks.map((t, i) => {
    const idx = allTracks.findIndex(x => x.id === t.id);
    const playing = currentIndex === idx;
    const hasAudio = t.audio;
    return `
      <div class="track-row ${playing ? 'playing' : ''}" data-index="${idx}">
        <div class="cover-wrap">
          <img src="${t.cover || 'https://picsum.photos/80'}" alt="" loading="lazy">
        </div>
        <div class="track-info">
          <div class="title">${escapeHtml(t.title)}</div>
          <div class="artist">${escapeHtml(t.artist)}</div>
        </div>
        <span class="duration">${formatTime(t.duration)}</span>
        <button class="play-btn ${playing && isPlaying ? 'playing' : ''}" aria-label="播放"
          ${!hasAudio ? 'disabled title="无可用音频"' : ''}>▶</button>
      </div>
    `;
  }).join('');

  trackListEl.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.play-btn')) return;
      const idx = parseInt(row.dataset.index, 10);
      if (!isNaN(idx)) playTrack(idx);
    });
  });

  trackListEl.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = e.target.closest('.track-row');
      if (!row) return;
      const idx = parseInt(row.dataset.index, 10);
      if (!isNaN(idx) && !btn.disabled) playTrack(idx);
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function playTrack(index) {
  const t = allTracks[index];
  if (!t) return;
  if (!t.audio) {
    console.warn('该曲目无音频链接');
    return;
  }
  currentIndex = index;
  audio.src = t.audio;
  audio.play().catch(console.warn);
  isPlaying = true;
  updateNowPlaying();
  updateControls();
  renderTracks();
}

function updateNowPlaying() {
  const t = allTracks[currentIndex];
  if (!t) {
    nowCover.src = '';
    nowCover.alt = '';
    nowTitle.textContent = '—';
    nowArtist.textContent = '—';
    return;
  }
  nowCover.src = t.cover || '';
  nowCover.alt = t.title;
  nowTitle.textContent = t.title;
  nowArtist.textContent = t.artist;
}

function updateControls() {
  const playBtn = document.getElementById('play');
  if (isPlaying) {
    playBtn.textContent = '⏸';
  } else {
    playBtn.textContent = '▶';
  }
}

function prevTrack() {
  if (allTracks.length === 0) return;
  currentIndex = (currentIndex - 1 + allTracks.length) % allTracks.length;
  playTrack(currentIndex);
}

function nextTrack() {
  if (allTracks.length === 0) return;
  currentIndex = (currentIndex + 1) % allTracks.length;
  playTrack(currentIndex);
}

audio.addEventListener('timeupdate', () => {
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  seekBar.value = pct;
  timeCurrent.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatTime(audio.duration);
  seekBar.max = 100;
});

audio.addEventListener('ended', () => {
  nextTrack();
});

audio.addEventListener('play', () => {
  isPlaying = true;
  updateControls();
  renderTracks();
});

audio.addEventListener('pause', () => {
  isPlaying = false;
  updateControls();
  renderTracks();
});

seekBar.addEventListener('input', () => {
  const pct = parseFloat(seekBar.value);
  if (audio.duration) {
    audio.currentTime = (pct / 100) * audio.duration;
  }
});

document.getElementById('play').addEventListener('click', () => {
  if (allTracks.length === 0) return;
  if (currentIndex < 0) currentIndex = 0;
  if (isPlaying) {
    audio.pause();
  } else {
    if (audio.src && audio.currentTime > 0) {
      audio.play();
    } else {
      playTrack(currentIndex);
    }
  }
});

document.getElementById('prev').addEventListener('click', prevTrack);
document.getElementById('next').addEventListener('click', nextTrack);

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    filteredTracks = [...allTracks];
  } else {
    filteredTracks = allTracks.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.artist || '').toLowerCase().includes(q) ||
      (t.album || '').toLowerCase().includes(q)
    );
  }
  renderTracks();
});

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  });
});

loadData();
