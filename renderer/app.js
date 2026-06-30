const state = { left: null, right: null, serverOk: false };
const dropLeft = document.getElementById('dropLeft');
const dropRight = document.getElementById('dropRight');
const pathLeft = document.getElementById('pathLeft');
const pathRight = document.getElementById('pathRight');
const countLeft = document.getElementById('countLeft');
const countRight = document.getElementById('countRight');
const compareBtn = document.getElementById('compareBtn');
const resultArea = document.getElementById('resultArea');
const resultTitle = document.getElementById('resultTitle');
const resultSummary = document.getElementById('resultSummary');
const diffList = document.getElementById('diffList');
const folderPickerLeft = document.getElementById('folderPickerLeft');
const folderPickerRight = document.getElementById('folderPickerRight');
const statusBar = document.getElementById('statusBar');
const exitBtn = document.getElementById('exitBtn');

async function checkServer() {
  try {
    const resp = await fetch('/ping');
    if (resp.ok) {
      state.serverOk = true;
      statusBar.textContent = '服务已连接';
      statusBar.className = 'status-bar status-ok';
    }
  } catch {
    statusBar.textContent = '服务未连接 - 请确保通过 http://localhost:35217 访问，而非直接打开文件';
    statusBar.className = 'status-bar status-err';
  }
}

async function readDirHandle(dirHandle) {
  const items = [];
  for await (const entry of dirHandle.values()) {
    items.push({ name: entry.name, isDirectory: entry.kind === 'directory' });
  }
  return items;
}

function readDirEntryAsFlat(dirEntry) {
  return new Promise((resolve) => {
    const reader = dirEntry.createReader();
    const allEntries = [];
    function readBatch() {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            const items = allEntries.map((e) => ({ name: e.name, isDirectory: e.isDirectory }));
            resolve(items);
          } else {
            allEntries.push(...entries);
            readBatch();
          }
        },
        () => resolve([])
      );
    }
    readBatch();
  });
}

function parseFileListAsFlat(fileList, folderName) {
  const seen = new Set();
  const items = [];
  for (const file of fileList) {
    const rel = file.webkitRelativePath;
    if (!rel) continue;
    const parts = rel.split('/');
    if (parts.length < 2) continue;
    const childName = parts[1];
    if (seen.has(childName)) continue;
    seen.add(childName);
    items.push({ name: childName, isDirectory: parts.length > 2 });
  }
  return { name: folderName, items };
}

async function readPathViaServer(dirPath) {
  try {
    const resp = await fetch('/read-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath }),
    });
    const result = await resp.json();
    if (result.error) return { error: result.error };
    return { name: result.name, items: result.items };
  } catch {
    return { error: '无法连接服务器' };
  }
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
  } else {
    el.classList.remove('has-content');
    pathEl.textContent = '';
    countEl.textContent = '';
  }
  updateCompareBtn();
}

function updateCompareBtn() {
  compareBtn.disabled = !(state.left && state.right);
}

function compare() {
  if (!state.left || !state.right) return;
  const leftItems = state.left.items;
  const rightItems = state.right.items;
  const leftMap = new Map();
  for (const item of leftItems) leftMap.set(item.name, item);
  const rightMap = new Map();
  for (const item of rightItems) rightMap.set(item.name, item);
  const diffs = [];
  for (const item of leftItems) {
    if (!rightMap.has(item.name)) diffs.push({ type: 'left-only', name: item.name, kind: item.isDirectory ? 'folder' : 'file', message: '仅在左侧存在' });
  }
  for (const item of rightItems) {
    if (!leftMap.has(item.name)) diffs.push({ type: 'right-only', name: item.name, kind: item.isDirectory ? 'folder' : 'file', message: '仅在右侧存在' });
  }
  for (const [name, leftItem] of leftMap) {
    const rightItem = rightMap.get(name);
    if (rightItem && leftItem.isDirectory !== rightItem.isDirectory) {
      diffs.push({ type: 'type-diff', name, kind: 'mixed', message: '左侧是' + (leftItem.isDirectory ? '文件夹' : '文件') + '，右侧是' + (rightItem.isDirectory ? '文件夹' : '文件') });
    }
  }
  diffs.sort((a, b) => {
    const order = { 'left-only': 0, 'right-only': 1, 'type-diff': 2 };
    if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
    return a.name.localeCompare(b.name);
  });
  resultArea.hidden = false;
  const leftName = state.left.name;
  const rightName = state.right.name;
  if (diffs.length === 0) {
    resultTitle.textContent = '完全一致';
    resultSummary.textContent = leftName + ' / ' + rightName + ' - 没有差异';
    diffList.innerHTML = '<div class="diff-empty">两个文件夹平级内容完全相同</div>';
    return;
  }
  resultTitle.textContent = '发现 ' + diffs.length + ' 处差异';
  resultSummary.textContent = leftName + ' / ' + rightName;
  diffList.innerHTML = diffs.map((d) => {
    const kindIcon = d.kind === 'folder' ? '[DIR]' : '[FILE]';
    const tagClass = d.type === 'left-only' ? 'tag-left-only' : d.type === 'right-only' ? 'tag-right-only' : 'tag-type-diff';
    const tagText = d.type === 'left-only' ? '仅左侧' : d.type === 'right-only' ? '仅右侧' : '类型不同';
    return '<div class="diff-item">' + '<span class="icon">' + (d.type === 'left-only' ? '-' : d.type === 'right-only' ? '+' : '~') + '</span>' + '<span class="name">' + kindIcon + ' ' + escapeHtml(d.name) + '</span>' + '<span class="tag ' + tagClass + '">' + tagText + '</span>' + '<span style="color:#888;font-size:12px">' + escapeHtml(d.message) + '</span>' + '</div>';
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function clearError(side) {
  const el = document.querySelector('.path-error[data-side="' + side + '"]');
  if (el) el.remove();
}

function showError(side, msg) {
  clearError(side);
  const inputId = side === 'left' ? 'inputLeft' : 'inputRight';
  const row = document.getElementById(inputId).closest('.manual-row');
  const err = document.createElement('div');
  err.className = 'path-error';
  err.setAttribute('data-side', side);
  err.textContent = msg;
  row.after(err);
}

function setupDragDrop(zoneEl, side) {
  zoneEl.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); zoneEl.classList.add('drag-over'); });
  zoneEl.addEventListener('dragleave', function (e) { e.preventDefault(); e.stopPropagation(); zoneEl.classList.remove('drag-over'); });
  zoneEl.addEventListener('drop', async function (e) {
    e.preventDefault(); e.stopPropagation(); zoneEl.classList.remove('drag-over');
    clearError(side);
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

function setupClickToBrowse(zoneEl, side) {
  zoneEl.addEventListener('click', async function () {
    clearError(side);
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const dirHandle = await window.showDirectoryPicker();
        const items = await readDirHandle(dirHandle);
        state[side] = { name: dirHandle.name, items };
        renderDropZone(side, state[side]);
        return;
      } catch (err) { if (err.name === 'AbortError' || err.name === 'SecurityError') return; }
    }
    (side === 'left' ? folderPickerLeft : folderPickerRight).click();
  });
}

folderPickerLeft.addEventListener('change', function () {
  const files = folderPickerLeft.files;
  if (!files || files.length === 0) return;
  clearError('left');
  const folderName = files[0].webkitRelativePath.split('/')[0];
  state.left = parseFileListAsFlat(files, folderName);
  renderDropZone('left', state.left);
  folderPickerLeft.value = '';
});

folderPickerRight.addEventListener('change', function () {
  const files = folderPickerRight.files;
  if (!files || files.length === 0) return;
  clearError('right');
  const folderName = files[0].webkitRelativePath.split('/')[0];
  state.right = parseFileListAsFlat(files, folderName);
  renderDropZone('right', state.right);
  folderPickerRight.value = '';
});

document.querySelectorAll('.path-btn').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    const side = btn.getAttribute('data-side');
    const input = document.getElementById(side === 'left' ? 'inputLeft' : 'inputRight');
    const dirPath = input.value.trim();
    if (!dirPath) { showError(side, '请输入文件夹路径'); return; }
    clearError(side);
    btn.textContent = '读取中'; btn.disabled = true;
    const result = await readPathViaServer(dirPath);
    btn.textContent = '读取'; btn.disabled = false;
    if (result.error) { showError(side, result.error); return; }
    state[side] = result;
    renderDropZone(side, result);
  });
  const input = document.getElementById(btn.getAttribute('data-side') === 'left' ? 'inputLeft' : 'inputRight');
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
});

compareBtn.addEventListener('click', compare);

exitBtn.addEventListener('click', async function () {
  if (!confirm('确定退出？')) return;
  try { await fetch('/shutdown', { method: 'POST' }); } catch {}
  document.body.innerHTML = '<div style="text-align:center;margin-top:40vh;color:#888;font-size:14px">服务已关闭，可以关闭此页面了。</div>';
});

checkServer();
setupDragDrop(dropLeft, 'left');
setupDragDrop(dropRight, 'right');
setupClickToBrowse(dropLeft, 'left');
setupClickToBrowse(dropRight, 'right');
