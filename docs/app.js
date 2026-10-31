const state = { left: null, right: null };
const G = (id) => document.getElementById(id);

const dropLeft = G('dropLeft'), dropRight = G('dropRight');
const pathLeft = G('pathLeft'), pathRight = G('pathRight');
const countLeft = G('countLeft'), countRight = G('countRight');
const compareBtn = G('compareBtn'), statusBar = G('statusBar');
const resultArea = G('resultArea'), resultTitle = G('resultTitle');
const resultSummary = G('resultSummary'), diffList = G('diffList');

function checkBrowserSupport() {
  const supportsDirectoryPicker = typeof window.showDirectoryPicker === 'function';
  const supportsFolderInput = 'webkitdirectory' in document.createElement('input');
  if (supportsDirectoryPicker || supportsFolderInput) {
    statusBar.textContent = '浏览器模式 · 文件只在本地读取，不会上传';
    statusBar.className = 'status-bar status-info';
  } else {
    statusBar.textContent = '当前浏览器不支持文件夹选择，请使用 Chrome 或 Edge';
    statusBar.className = 'status-bar status-err';
  }
}

async function readDirHandle(h) { const i = []; for await (const e of h.values()) i.push({ name: e.name, isDirectory: e.kind === 'directory' }); return i; }

function readDirEntryAsFlat(e) {
  return new Promise((r) => {
    const reader = e.createReader(), all = [];
    function next() { reader.readEntries((entries) => { if (entries.length === 0) r(all.map((x) => ({ name: x.name, isDirectory: x.isDirectory }))); else { all.push(...entries); next(); } }, () => r([])); }
    next();
  });
}

function parseFileListAsFlat(files, folderName) {
  const seen = new Set(), items = [];
  for (const f of files) {
    const rel = f.webkitRelativePath; if (!rel) continue;
    const parts = rel.split('/'); if (parts.length < 2) continue;
    const name = parts[1]; if (seen.has(name)) continue; seen.add(name);
    items.push({ name, isDirectory: parts.length > 2 });
  }
  return { name: folderName, items };
}

function renderDropZone(side, data) {
  const el = side === 'left' ? dropLeft : dropRight;
  const pathEl = side === 'left' ? pathLeft : pathRight;
  const countEl = side === 'left' ? countLeft : countRight;
  if (data) {
    el.classList.add('has-content');
    pathEl.textContent = data.name;
    const fileCount = data.items.filter((i) => !i.isDirectory).length;
    const dirCount = data.items.filter((i) => i.isDirectory).length;
    const parts = [];
    if (fileCount > 0) parts.push(fileCount + ' 个文件');
    if (dirCount > 0) parts.push(dirCount + ' 个文件夹');
    countEl.textContent = '共 ' + data.items.length + ' 项（' + parts.join('，') + '）';
  } else { el.classList.remove('has-content'); pathEl.textContent = ''; countEl.textContent = ''; }
  compareBtn.disabled = !(state.left && state.right);
}

function normalizeName(name) {
  const dot = name.lastIndexOf('.');
  let base = dot > 0 ? name.slice(0, dot) : name;
  base = base.replace(/[_\s-]v?\d+(\.\d+)?$/i, '');
  return base;
}

function compare() {
  if (!state.left || !state.right) return;
  const left = state.left.items, right = state.right.items;
  const leftSet = new Set(), rightSet = new Set();
  for (const item of left) leftSet.add(normalizeName(item.name));
  for (const item of right) rightSet.add(normalizeName(item.name));

  const diffs = [];
  for (const base of leftSet) { if (!rightSet.has(base)) diffs.push({ name: base, side: 'left' }); }
  for (const base of rightSet) { if (!leftSet.has(base)) diffs.push({ name: base, side: 'right' }); }

  diffs.sort((a, b) => a.name.localeCompare(b.name));

  resultArea.hidden = false;
  if (diffs.length === 0) {
    resultTitle.textContent = '比较结果';
    resultSummary.textContent = '两个文件夹内容完全一致';
    diffList.innerHTML = '<div class="diff-empty">没有发现差异</div>';
    return;
  }

  const leftCount = diffs.filter((d) => d.side === 'left').length;
  const rightCount = diffs.filter((d) => d.side === 'right').length;
  resultTitle.textContent = '比较结果';
  resultSummary.textContent = '共 ' + diffs.length + ' 处差异（仅左侧 ' + leftCount + ' / 仅右侧 ' + rightCount + '）';

  let html = '';
  for (const d of diffs) {
    const isLeft = d.side === 'left';
    html += '<div class="diff-item">' +
      '<span class="icon">' + (isLeft ? '\u25C0' : '\u25B6') + '</span>' +
      '<span class="name">' + escapeHtml(d.name) + '</span>' +
      '<span class="tag ' + (isLeft ? 'tag-left-only' : 'tag-right-only') + '">' + (isLeft ? '仅左侧' : '仅右侧') + '</span>' +
      '</div>';
  }
  diffList.innerHTML = html;
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function clearError(side) { const el = document.querySelector('.path-error[data-side="' + side + '"]'); if (el) el.remove(); }

function showError(side, msg) {
  clearError(side);
  const dropArea = side === 'left' ? dropLeft : dropRight;
  const err = document.createElement('div'); err.className = 'path-error'; err.setAttribute('data-side', side); err.textContent = msg;
  dropArea.after(err);
}

function setupDragDrop(el, side) {
  el.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', function (e) { e.preventDefault(); e.stopPropagation(); el.classList.remove('drag-over'); });
  el.addEventListener('drop', async function (e) {
    e.preventDefault(); e.stopPropagation(); el.classList.remove('drag-over'); clearError(side);
    const dt = e.dataTransfer;
    if (!dt.items || dt.items.length === 0) { showError(side, '未检测到拖入内容'); return; }
    const item = dt.items[0];
    let entry = null;
    if (typeof item.getAsEntry === 'function') entry = item.getAsEntry();
    else if (typeof item.webkitGetAsEntry === 'function') entry = item.webkitGetAsEntry();
    if (!entry) { showError(side, '无法识别拖入的内容'); return; }
    if (!entry.isDirectory) { showError(side, '请拖入文件夹而非文件'); return; }
    const items = await readDirEntryAsFlat(entry);
    state[side] = { name: entry.name, items };
    renderDropZone(side, state[side]);
  });
}

function setupClickToBrowse(el, side) {
  const openPicker = async function () {
    clearError(side);
    if (typeof window.showDirectoryPicker === 'function') {
      try { const h = await window.showDirectoryPicker(); const items = await readDirHandle(h); state[side] = { name: h.name, items }; renderDropZone(side, state[side]); return; }
      catch (err) { if (err.name === 'AbortError' || err.name === 'SecurityError') return; }
    }
    (side === 'left' ? G('folderPickerLeft') : G('folderPickerRight')).click();
  };
  el.addEventListener('click', openPicker);
  el.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openPicker();
  });
}

G('folderPickerLeft').addEventListener('change', function () {
  const files = G('folderPickerLeft').files; if (!files || files.length === 0) return;
  clearError('left'); const name = files[0].webkitRelativePath.split('/')[0];
  state.left = parseFileListAsFlat(files, name); renderDropZone('left', state.left); this.value = '';
});

G('folderPickerRight').addEventListener('change', function () {
  const files = G('folderPickerRight').files; if (!files || files.length === 0) return;
  clearError('right'); const name = files[0].webkitRelativePath.split('/')[0];
  state.right = parseFileListAsFlat(files, name); renderDropZone('right', state.right); this.value = '';
});

compareBtn.addEventListener('click', compare);

window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) {
  const target = e.target instanceof Element ? e.target : null;
  if (!target || !target.closest('.drop-area')) e.preventDefault();
});

checkBrowserSupport();
setupDragDrop(dropLeft, 'left'); setupDragDrop(dropRight, 'right');
setupClickToBrowse(dropLeft, 'left'); setupClickToBrowse(dropRight, 'right');
