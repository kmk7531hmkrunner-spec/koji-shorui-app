// --- Mobile Error Debugger ---
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:rgba(255,0,0,0.9);color:white;padding:10px;z-index:9999;font-size:12px;word-break:break-all;';
    div.innerHTML = `⚠️ Error: ${msg}<br>Line: ${lineNo}<br>${url}`;
    document.body.appendChild(div);
    return false;
};

import { getAllProjects, saveProject, deleteProject, getProject, generateDraftName } from './src/storage.js';
import { adaptiveThreshold } from './src/image-utils.js';
import { generateSinglePdf, generateBulkPdf, drawProjectToCanvas } from './src/pdf-engine.js';
import { getPdfConfig } from './src/config-manager.js';

console.log("Main script loading (Intelligent Workflow Build)...");

// --- State ---
let currentTab = 'draft';
let currentProject = null;
let els = {}; 
let isSelectionMode = false;
let selectedIds = new Set();
let longPressTimeout = null;
let isLongPressAction = false;
let searchQuery = "";
let currentCalendarDate = new Date();
let selectedCalendarDate = null; // YYYY-MM-DD

// --- Initialization ---
async function startApp() {
    if (window.logBoot) window.logBoot("Starting App Logic (Harden Build)...");
    try {
        if (window.logBoot) window.logBoot("Stage 1: Setup Elements");
        setupElements();
        
        if (window.logBoot) window.logBoot("Stage 2: Initialize Features");
        await init();
        
        if (window.logBoot) window.logBoot("Stage 3: App Boot Successful");
    } catch (err) {
        if (window.logBoot) window.logBoot("BOOT CRASH: " + err.message);
        console.error("Critical: App start failed", err);
        // This will be caught by the unhandledrejection or the manual catch
        throw err; 
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startApp());
} else {
    startApp();
}

function setupElements() {
    if (window.logBoot) window.logBoot("Setting up elements...");
    const ids = [
        'project-list-view', 'form-view', 'project-list', 'tabs', 'fab-plus', 
        'btn-back', 'type-modal', 'project-detail-view', 'detail-summary-text',
        'bulk-action-bar', 'selected-count', 'btn-bulk-pdf-exec', 'btn-cancel-select',
        'editor-container', 'scanner-overlay', 'scanner-image',
        'btn-scanner-cancel', 'btn-scanner-done', 'btn-scanner-rotate', 'btn-scanner-filter',
        'document-preview-overlay', 'preview-canvas-container', 'btn-close-preview', 'btn-preview-pdf-out',
        'form-page-title', 'bot-container', 'fab-bot', 'btn-close-bot', 'btn-send-bot', 'bot-input', 'bot-messages'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            els[id] = el;
        } else {
            console.warn(`Element #${id} missing from HTML`);
        }
    });
    els.tabsList = document.querySelectorAll('.tab');
    if (window.logBoot) window.logBoot(`Elements cached: ${Object.keys(els).length}`);
}

async function init() {
    if (window.logBoot) window.logBoot("Initializing app features...");
    // 1. Immediately bind events to ensure UI responsiveness
    try {
        bindGlobalEvents();
        if (window.logBoot) window.logBoot("Global events bound");
        bindBotEvents();
        if (window.logBoot) window.logBoot("Bot events bound");
    } catch (e) {
        if (window.logBoot) window.logBoot("EVENT BINDING FAILED: " + e.message);
        throw e;
    }
    
    // 2. Load and render list in background
    try {
        if (window.logBoot) window.logBoot("Attempting to render list...");
        await renderList();
        if (window.logBoot) window.logBoot("Initial list render complete");
    } catch (err) {
        if (window.logBoot) window.logBoot("LIST RENDER FAILED: " + err.message);
        console.error("List render failed", err);
    }

    // 3. Bind Search Input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            renderList();
        };
    }
}

// --- List View Logic ---

async function renderList() {
    if (!els['project-list']) return;
    
    let projects = await getAllProjects();
    
    // Normalization helper (Full-width -> Half-width, Lowercase)
    const normalize = (val) => String(val || "").normalize("NFKC").toLowerCase();
    
    // Filter by search query
    if (searchQuery) {
        const q = normalize(searchQuery);
        projects = projects.filter(p => {
            const fd = p.formData || {};
            // Concatenate all searchable text and normalize it
            const content = `${p.type} ${p.workerName} ${p.date} ${fd.companyName} ${fd.supervisorName} ${fd.siteName} ${fd.address} ${fd.content} ${fd.dailyReport}`;
            return normalize(content).includes(q);
        });
    }

    if (currentTab === 'sent') {
        renderCalendar(projects);
        return;
    }
    
    // Switch UI
    if (els['project-list']) els['project-list'].classList.remove('hidden');
    if (els['calendar-view']) els['calendar-view'].classList.add('hidden');

    const filtered = projects.filter(p => p.status === currentTab);

    if (filtered.length === 0) {
        els['project-list'].innerHTML = `<div class="empty-state"><p>${currentTab === 'draft' ? '下書きはありません' : '書類はありません'}</p></div>`;
        updateSelectionUI();
        return;
    }

    els['project-list'].innerHTML = filtered.map(p => {
        const fd = p.formData || {};
        const dateStr = p.date ? p.date.split('-').slice(1).join('/') : '--/--';
        const isSelected = selectedIds.has(p.id);
        
        let mainInfoHtml = '';
        if (p.type === 'marusan') {
            const siteName = fd.siteName || '(現場名未入力)';
            const displaySite = siteName.length > 15 ? siteName.substring(0, 14) + '...' : siteName;
            mainInfoHtml = `
                <div class="info-row"><strong>担当者:</strong> ${fd.supervisorName || '(未入力)'}</div>
                <div class="info-row"><strong>現場名:</strong> ${displaySite}</div>
            `;
        } else {
            mainInfoHtml = `
                <div class="info-row"><strong>会社名:</strong> ${fd.companyName || '(未入力)'}</div>
                <div class="info-row"><strong>監督名:</strong> ${fd.supervisorName || '(未入力)'}</div>
            `;
        }

        return `
            <div class="project-card fade-in ${isSelectionMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" data-id="${p.id}" oncontextmenu="return false;">
                <div class="project-card-body">
                    <div class="project-card-header">
                        <span class="project-type-tag ${p.type}">${p.type === 'geppo' ? '月報' : (p.type === 'marusan' ? '丸産報告書' : '完了報告書')}</span>
                        <span class="project-date">📅 ${dateStr}</span>
                    </div>
                    <div class="project-main-info">
                        ${mainInfoHtml}
                    </div>
                    <div class="project-card-footer">
                        ${p.type === 'geppo' ? `<span class="project-worker">👤 ${p.workerName || '担当者未設定'}</span>` : ''}
                        <span class="card-hint">タップで詳細・プレビュー</span>
                    </div>
                </div>
                <div class="project-card-actions">
                    ${p.status === 'draft' ? `<button class="card-action-btn pdf" onclick="window.confirmGeneratePdf('${p.id}')">📄<br>PDF</button>` : `<button class="card-action-btn edit" onclick="window.editProject('${p.id}')">✏️<br>再編集</button>`}
                    ${p.status === 'draft' ? `<button class="card-action-btn edit" onclick="window.editProject('${p.id}')">✏️<br>編集</button>` : ''}
                    <button class="card-action-btn delete" onclick="window.confirmDeleteProject('${p.id}')">🗑<br>削除</button>
                </div>
            </div>
        `;
    }).join('');


    document.querySelectorAll('.project-card').forEach(card => {
        const id = card.dataset.id;
        const start = () => {
            isLongPressAction = false;
            longPressTimeout = setTimeout(() => { isLongPressAction = true; enterSelectionMode(id); }, 700);
        };
        const end = () => clearTimeout(longPressTimeout);
        const click = (e) => { 
            if (isLongPressAction) return; 
            if (isSelectionMode) {
                toggleSelection(id); 
            } else {
                if (e.target.closest('.card-action-btn')) return; // Action buttons handle their own clicks
                window.handleCardPreview(id);
            }
        };
        card.addEventListener('touchstart', start, {passive: true});
        card.addEventListener('touchend', end, {passive: true});
        card.addEventListener('mousedown', start);
        card.addEventListener('mouseup', end);
        card.addEventListener('click', click);
    });

    updateSelectionUI();
}

function enterSelectionMode(firstId) { isSelectionMode = true; selectedIds.add(firstId); renderList(); }
function toggleSelection(id) { if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); if (selectedIds.size === 0) exitSelectionMode(); else renderList(); }
function exitSelectionMode() { isSelectionMode = false; selectedIds.clear(); renderList(); }

// --- Calendar Logic ---

function renderCalendar(allProjects) {
    if (els['project-list']) els['project-list'].classList.add('hidden');
    if (els['calendar-view']) els['calendar-view'].classList.remove('hidden');

    const sentProjects = allProjects.filter(p => p.status === 'sent');
    const container = els['calendar-view'];
    const header = document.getElementById('calendar-header');
    const grid = document.getElementById('calendar-grid');

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    header.innerHTML = `
        <button onclick="window.changeCalendarMonth(-1)">◀</button>
        <span>${year}年 ${month + 1}月</span>
        <button onclick="window.changeCalendarMonth(1)">▶</button>
    `;

    // Calendar Grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let gridHtml = ['日','月','火','水','木','金','土'].map(d => `<div class="calendar-day-label">${d}</div>`).join('');
    
    for (let i = 0; i < firstDay; i++) gridHtml += `<div class="calendar-day other-month"></div>`;
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayProjects = sentProjects.filter(p => p.date === dateKey);
        const isToday = new Date().toISOString().split('T')[0] === dateKey;
        const isSelected = selectedCalendarDate === dateKey;
        
        gridHtml += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${dayProjects.length > 0 ? 'has-data' : ''} ${isSelected ? 'selected' : ''}" 
                 onclick="window.selectCalendarDate('${dateKey}')">
                ${day}
            </div>
        `;
    }
    grid.innerHTML = gridHtml;
    
    // Render Day List
    renderCalendarDayList(sentProjects);
}

window.changeCalendarMonth = (dir) => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + dir);
    renderList();
};

window.selectCalendarDate = (date) => {
    selectedCalendarDate = date;
    renderList();
};

function renderCalendarDayList(sentProjects) {
    const listContainer = document.getElementById('calendar-day-list');
    if (!selectedCalendarDate) {
        listContainer.innerHTML = '<p class="empty-state">日付を選択してください</p>';
        return;
    }

    const dayProjects = sentProjects.filter(p => p.date === selectedCalendarDate);
    if (dayProjects.length === 0) {
        listContainer.innerHTML = `<p class="empty-state">${selectedCalendarDate} の書類はありません</p>`;
        return;
    }

    listContainer.innerHTML = `<h4>${selectedCalendarDate} の書類 (${dayProjects.length}件)</h4>` + dayProjects.map(p => {
        const isSelected = selectedIds.has(p.id);
        return `
            <div class="project-card scale-in ${isSelectionMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" data-id="${p.id}">
                <div class="project-card-body">
                    <div class="project-card-header">
                        <span class="project-type-tag ${p.type}">${p.type === 'geppo' ? '月報' : '完了/丸産'}</span>
                    </div>
                    <div class="info-row"><strong>監督:</strong> ${p.formData.supervisorName || ''}</div>
                    <div class="info-row"><strong>現場:</strong> ${p.formData.siteName || ''}</div>
                </div>
                <div class="project-card-actions">
                    <button class="card-action-btn edit" onclick="window.editProject('${p.id}')">✏️<br>再編集</button>
                    <button class="card-action-btn delete" onclick="window.confirmDeleteProject('${p.id}')">🗑<br>削除</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Bind long press for calendar items
    listContainer.querySelectorAll('.project-card').forEach(card => {
        const id = card.dataset.id;
        card.onmousedown = card.ontouchstart = () => {
            longPressTimeout = setTimeout(() => { enterSelectionMode(id); }, 700);
        };
        card.onmouseup = card.ontouchend = () => clearTimeout(longPressTimeout);
        card.onclick = () => { if(isSelectionMode) toggleSelection(id); else window.handleCardPreview(id); };
    });
}

// --- Preview & Action Logic ---

window.handleCardPreview = async (id) => {
    const p = await getProject(id);
    if (!p) return;
    const overlay = els['document-preview-overlay'];
    overlay.classList.remove('hidden');
    
    // Set a loading text temporarily
    els['preview-canvas-container'].innerHTML = '<div class="loading">プレビュー画像を生成中...</div>';
    
    const bgUrl = p.type === 'kanryo' ? '/images/kanrryoutemp.jpg' : (p.type === 'marusan' ? '/images/marusan_report.jpg' : '/images/geppo.jpg');
    const config = await getPdfConfig();
    const canvas = await drawProjectToCanvas(p, bgUrl, config);
    
    els['preview-canvas-container'].innerHTML = '';
    els['preview-canvas-container'].appendChild(canvas);
    
    const btnPdf = document.getElementById('btn-preview-pdf-out');
    if (btnPdf) {
        btnPdf.style.display = p.status === 'sent' ? 'none' : 'block';
        btnPdf.onclick = async () => { 
            overlay.classList.add('hidden'); 
            await generatePdf(p.id); 
        };
    }
    document.getElementById('btn-close-preview').onclick = () => overlay.classList.add('hidden');
};

window.confirmGeneratePdf = (id) => {
    const modal = document.getElementById('pdf-filename-modal');
    const nameInput = document.getElementById('pdf-user-name');
    const typeSelect = document.getElementById('pdf-doc-type');
    
    // Auto-fill remembered name
    nameInput.value = localStorage.getItem('last_user_name') || '';
    
    modal.classList.remove('hidden');

    document.getElementById('btn-pdf-cancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-pdf-exec').onclick = () => {
        const name = nameInput.value.trim();
        if (!name) { alert('氏名を入力してください'); return; }
        
        localStorage.setItem('last_user_name', name);
        modal.classList.add('hidden');
        
        generatePdf(id, name, typeSelect.value);
    };
};

window.editProject = async (id) => {
    const p = await getProject(id);
    if (p) showForm(p.type, p);
};

window.confirmDeleteProject = (id) => {
    if (confirm('本当にこのデータを削除しますか？\n削除すると復元できません。')) {
        handleDeleteProject(id);
    }
};

// Remove old showProjectDetail since it's replaced by handleCardPreview and inline buttons
// --- Form Logic ---

function showForm(type, project = null) {
    if (els['type-modal']) els['type-modal'].style.display = 'none';
    currentProject = project || {
        id: `project_${Date.now()}`,
        status: 'draft',
        type: type,
        date: new Date().toISOString().split('T')[0],
        workerName: '',
        formData: { supportName: [] },
        receiptImage: null
    };
    els['project-list-view'].classList.add('hidden');
    els['form-view'].classList.remove('hidden');
    if (els['form-page-title']) els['form-page-title'].textContent = project ? '再編集' : '新規作成';
    renderForm();
}

function renderForm() {
    const container = els['editor-container'];
    if (!container) return;
    container.innerHTML = `
        <div class="form-container">
            <div id="dynamic-form-fields">
                ${currentProject.type === 'kanryo' ? renderKanryoFields() : (currentProject.type === 'marusan' ? renderMarusanFields() : renderGeppoFields())}
            </div>
            <div class="form-actions-bottom">
                <button class="btn btn-outline" id="btn-preview-doc">プレビュー</button>
                <button class="btn btn-primary" id="btn-save-draft">下書き保存</button>
            </div>
        </div>
    `;
    document.getElementById('btn-save-draft').onclick = handleSaveDraft;
    document.getElementById('btn-preview-doc').onclick = handleShowPreview;
    const chipGroup = document.getElementById('support-chip-group');
    if (chipGroup) {
        chipGroup.onclick = (e) => {
            const btn = e.target.closest('.chip-btn');
            if (!btn) return;
            const name = btn.dataset.name;
            const sn = currentProject.formData.supportName || [];
            const idx = sn.indexOf(name);
            if (idx > -1) { btn.classList.remove('active'); sn.splice(idx, 1); }
            else { btn.classList.add('active'); sn.push(name); }
            currentProject.formData.supportName = sn;
        };
    }
    const btnScan = document.getElementById('btn-scan-receipt');
    if (btnScan) btnScan.onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.onchange = (e) => startScanner(e.target.files[0]); input.click(); };
}

// --- Full Field Renderers ---

function renderKanryoFields() {
    const fd = currentProject.formData || {};
    return `
        <div class="form-section">
            <h3 class="section-title">基本情報</h3>
            <div class="form-group"><label class="label">👤 作業者名</label><input type="text" id="form-worker" value="${currentProject.workerName || ''}" placeholder="作業者名を入力"></div>
            <div class="form-group highlight-box"><label class="label">📅 日付</label><input type="date" id="form-date" value="${currentProject.date || ''}"></div>
            <div class="form-group"><label class="label">会社名</label><input type="text" id="field-companyName" value="${fd.companyName || ''}" placeholder="会社名を入力"></div>
            <div class="form-group"><label class="label">事業所名 <span class="label-hint-inline">（主にAHCの時）</span></label><input type="text" id="field-officeName" value="${fd.officeName || ''}" placeholder="事業所名を入力"></div>
            <div class="form-group"><label class="label">担当者名 <span class="label-hint-inline">（監督）</span></label><input type="text" id="field-supervisorName" value="${fd.supervisorName || ''}" placeholder="担当者名を入力"></div>
            <div class="form-group"><label class="label">訪問回数</label><select id="field-visitCount">
                <option value="1" ${fd.visitCount === '1' ? 'selected' : ''}>1回目</option>
                <option value="2" ${fd.visitCount === '2' ? 'selected' : ''}>2回目</option>
                <option value="3" ${fd.visitCount === '3' ? 'selected' : ''}>3回目</option>
            </select></div>
            <div class="form-group"><label class="label">状況</label><select id="field-completionStatus">
                <option value="done" ${fd.completionStatus === 'done' ? 'selected' : ''}>完了</option>
                <option value="notYet" ${fd.completionStatus === 'notYet' ? 'selected' : ''}>未</option>
            </select></div>
            <div class="form-group"><label class="label">応援選択</label><div id="support-chip-group" class="chip-group">
                ${['湧', '菊', '須', '田', '大', '下', '巻', '木', 'タン', '富'].map(name => {
                    const isActive = (fd.supportName || []).includes(name);
                    return `<button type="button" class="chip-btn ${isActive ? 'active' : ''}" data-name="${name}">${name}</button>`;
                }).join('')}
            </div></div>
        </div>
        <div class="form-section">
            <h3 class="section-title">経費・領収書</h3>
            <div class="form-group"><label class="label">駐車場代 <span class="label-hint-inline">（丸産技研は材料代に記入）</span></label>
                <div class="receipt-action-unit">
                    <input type="number" id="field-parkingFee" value="${fd.parkingFee || ''}" placeholder="金額を入力">
                    <button type="button" class="btn btn-sm btn-accent" id="btn-scan-receipt" style="margin:0;">📸 撮影</button>
                    <div id="receipt-preview-mini" class="receipt-mini-preview" onclick="handleReEditReceipt()">
                        ${currentProject.receiptImage ? `<img src="${currentProject.receiptImage}">` : '<span style="font-size:10px; color:#94a3b8;">未撮影</span>'}
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label class="label">高速代 <span class="label-hint-inline">（この現場に行くのに使った分）</span></label>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="number" id="field-highwayFee" value="${fd.highwayFee || ''}" placeholder="金額を入力" style="flex:1;">
                    <a href="https://www.driveplaza.com/dp/SearchTop" target="_blank" class="btn-search-link">🌐 料金検索</a>
                </div>
            </div>
            <div class="form-group"><label class="label">材料代 <span class="label-hint-inline">（丸産駐車場はここに書く）</span></label><input type="number" id="field-materialFee" value="${fd.materialFee || ''}" placeholder="金額を入力"></div>
        </div>
        <div class="form-section">
            <h3 class="section-title">現場詳細</h3>
            <div class="form-group"><label class="label">現場名</label><input type="text" id="field-siteName" value="${fd.siteName || ''}" placeholder="現場名を入力"></div>
            <div class="form-group"><label class="label">注文番号 <span class="label-hint-inline">（アクシア9桁、AHC英字＋5桁、三井10桁）</span></label><input type="text" id="field-orderNumber" value="${fd.orderNumber || ''}" placeholder="注文番号を入力"></div>
            <div class="form-group"><label class="label">住所</label><input type="text" id="field-address" value="${fd.address || ''}" placeholder="住所を入力"></div>
        </div>
        <div class="form-section">
            <h3 class="section-title">作業内容・報告</h3>
            <div class="form-group"><label class="label">工事内容 <span class="label-hint-inline">（開始終了時間、建新計数、多く使った材料）</span></label><textarea id="field-content" rows="4" placeholder="工事内容を入力">${fd.content || ''}</textarea></div>
            <div class="form-group"><label class="label">日報 <span class="label-hint-inline">（現場日誌）</span></label><textarea id="field-dailyReport" rows="4" placeholder="日報内容を入力">${fd.dailyReport || ''}</textarea></div>
            <div class="form-group"><label class="label">合計額 <span class="label-hint-inline">（アクシア、OTOなど）</span></label><input type="number" id="field-totalAmount" value="${fd.totalAmount || ''}" placeholder="合計金額を入力"></div>
            <div class="form-group"><label class="label">消費税</label><input type="number" id="field-taxAmount" value="${fd.taxAmount || ''}" placeholder="消費税を入力"></div>
        </div>
    `;
}

function renderMarusanFields() {
    const fd = currentProject.formData || {};
    return `
        <div class="form-section">
            <h3 class="section-title">丸産報告書 入力</h3>
            <div class="form-group highlight-box"><label class="label">📅 日付</label><input type="date" id="form-date" value="${currentProject.date || ''}"></div>
            <div class="form-group">
                <label class="label">担当者名 <span class="label-hint-inline">山田→正裕/拓実　佐藤→裕翔/祐亮</span></label>
                <input type="text" id="field-supervisorName" value="${fd.supervisorName || ''}" placeholder="担当者名を入力">
            </div>
            <div class="form-group"><label class="label">現場名</label><input type="text" id="field-siteName" value="${fd.siteName || ''}" placeholder="現場名を入力"></div>
            <div class="flex-row" style="display:flex; gap:10px;">
                <div class="form-group" style="flex:1;"><label class="label">開始時間</label><input type="time" id="field-startTime" value="${fd.startTime || ''}"></div>
                <div class="form-group" style="flex:1;"><label class="label">終了時間</label><input type="time" id="field-endTime" value="${fd.endTime || ''}"></div>
            </div>
            <div class="form-group"><label class="label">作業内容</label><textarea id="field-content" rows="6" placeholder="作業内容を詳細に記入してください">${fd.content || ''}</textarea></div>
            <div class="form-group">
                <label class="label">作業者</label>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <input type="text" id="field-worker1" value="${fd.worker1 || ''}" placeholder="作業者1">
                    <input type="text" id="field-worker2" value="${fd.worker2 || ''}" placeholder="作業者2">
                    <input type="text" id="field-worker3" value="${fd.worker3 || ''}" placeholder="作業者3">
                    <input type="text" id="field-worker4" value="${fd.worker4 || ''}" placeholder="作業者4">
                    <input type="text" id="field-worker5" value="${fd.worker5 || ''}" placeholder="作業者5">
                    <input type="text" id="field-worker6" value="${fd.worker6 || ''}" placeholder="作業者6">
                </div>
            </div>
        </div>
    `;
}

function renderGeppoFields() {
    const fd = currentProject.formData || {};
    let rowsHtml = '';
    for (let i = 0; i < 30; i++) {
        rowsHtml += `
            <div class="geppo-row" style="padding: 10px; border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? '#fff' : '#f8fafc'};">
                <div style="display:flex; gap:5px; margin-bottom:5px; align-items:center;">
                    <span style="font-weight:bold; color:var(--accent-gold); width:30px;">${i+1}</span>
                    <input type="number" id="field-row_${i}_day" value="${fd[`row_${i}_day`] || ''}" placeholder="日" style="width:50px;">
                    <input type="text" id="field-row_${i}_company" value="${fd[`row_${i}_company`] || ''}" placeholder="会社名" style="flex:2;">
                    <input type="text" id="field-row_${i}_supervisor" value="${fd[`row_${i}_supervisor`] || ''}" placeholder="監督名" style="flex:1;">
                </div>
                <div style="display:flex; gap:5px;">
                    <input type="text" id="field-row_${i}_site" value="${fd[`row_${i}_site`] || ''}" placeholder="現場名" style="flex:1;">
                    <input type="text" id="field-row_${i}_address" value="${fd[`row_${i}_address`] || ''}" placeholder="住所" style="flex:1.5;">
                </div>
            </div>
        `;
    }

    return `
        <div class="form-section">
            <h3 class="section-title">月報 基本情報</h3>
            <div class="flex-row" style="display:flex; gap:10px;">
                <div class="form-group" style="flex:1;"><label class="label">年</label><input type="number" id="field-geppo_year" value="${fd.geppo_year || new Date().getFullYear()}"></div>
                <div class="form-group" style="flex:1;"><label class="label">月</label><input type="number" id="field-geppo_month" value="${fd.geppo_month || (new Date().getMonth() + 1)}"></div>
            </div>
            <div class="form-group"><label class="label">作業者</label><input type="text" id="form-worker" value="${currentProject.workerName || ''}" placeholder="作業者名を入力"></div>
        </div>
        <div class="form-section" style="padding:0; overflow:hidden;">
            <h3 class="section-title" style="margin: 15px;">勤務・現場記録 (30日分)</h3>
            <div id="geppo-table-container">
                ${rowsHtml}
            </div>
        </div>
    `;
}

// --- Handlers & Sync ---

function syncDataToProject() {
    if (!currentProject) return;
    const dEl = document.getElementById('form-date');
    const wEl = document.getElementById('form-worker');
    if (dEl) currentProject.date = dEl.value;
    if (wEl) currentProject.workerName = wEl.value;
    const fd = currentProject.formData || {};
    document.querySelectorAll('[id^="field-"], [id^="form-"], select[id^="field-"]').forEach(el => {
        if (el.id === 'form-date' || el.id === 'form-worker') return;
        fd[el.id.replace('field-', '').replace('form-', '')] = el.value;
    });
    currentProject.formData = fd;
}

async function handleSaveDraft() {
    syncDataToProject();
    currentProject.displayTitle = generateDraftName(currentProject.date, currentProject.workerName);
    
    // If it was 'sent', move it back to 'draft'
    if (currentProject.status === 'sent') {
        currentProject.status = 'draft';
    }
    
    await saveProject(currentProject);
    els['form-view'].classList.add('hidden');
    els['project-list-view'].classList.remove('hidden');
    renderList();
}

async function handleShowPreview() {
    syncDataToProject();
    const overlay = els['document-preview-overlay'];
    overlay.classList.remove('hidden');
    const bgUrl = currentProject.type === 'kanryo' ? '/images/kanrryoutemp.jpg' : (currentProject.type === 'marusan' ? '/images/marusan_report.jpg' : '/images/geppo.jpg');
    const config = await getPdfConfig();
    const canvas = await drawProjectToCanvas(currentProject, bgUrl, config);
    els['preview-canvas-container'].innerHTML = '';
    els['preview-canvas-container'].appendChild(canvas);
    els['btn-preview-pdf-out'].onclick = async () => { 
        if (confirm('このプレビュー内容でPDFを作成しますか？')) {
            overlay.classList.add('hidden'); 
            await generatePdf(currentProject.id); 
        }
    };
    els['btn-close-preview'].onclick = () => overlay.classList.add('hidden');
}

function bindGlobalEvents() {
    const safeBind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el[event] = handler;
        else console.warn(`Element not found for binding: ${id}`);
    };

    if (els['fab-plus']) els['fab-plus'].onclick = () => { if(els['type-modal']) els['type-modal'].style.display = 'flex'; };
    safeBind('btn-close-modal', 'onclick', () => { if(els['type-modal']) els['type-modal'].style.display = 'none'; });
    
    ['kanryo', 'marusan', 'geppo'].forEach(type => { 
        safeBind(`btn-new-${type}`, 'onclick', () => showForm(type)); 
    });

    if (els['btn-back']) els['btn-back'].onclick = () => { 
        if (confirm('作業中の内容は破棄されますが、戻りますか？')) { 
            if(els['form-view']) els['form-view'].classList.add('hidden'); 
            if(els['project-list-view']) els['project-list-view'].classList.remove('hidden'); 
            renderList(); 
        } 
    };

    if (els.tabsList) {
        els.tabsList.forEach(tab => { 
            tab.onclick = () => { 
                els.tabsList.forEach(t => t.classList.remove('active')); 
                tab.classList.add('active'); 
                currentTab = tab.dataset.tab; 
                renderList(); 
            }; 
        });
    }

    safeBind('btn-bulk-pdf-exec', 'onclick', handleBulkPdf);

    // Global Click Listener for Deselection (Tap background to exit selection mode)
    document.addEventListener('click', (e) => {
        if (!isSelectionMode) return;
        
        // If clicking a card or the bulk button, don't exit
        if (e.target.closest('.project-card') || e.target.closest('#btn-bulk-pdf-exec')) return;
        
        // If clicking a modal or detail view, don't exit
        if (e.target.closest('.modal-content') || e.target.closest('.scanner-overlay')) return;
        
        exitSelectionMode();
    });
}

function updateSelectionUI() {
    const bulkBtn = document.getElementById('btn-bulk-pdf-exec');
    if (!bulkBtn) return;
    
    if (currentTab === 'sent') {
        if (isSelectionMode && selectedIds.size > 0) {
            bulkBtn.textContent = `🗑 ${selectedIds.size}件をまとめて削除`;
            bulkBtn.classList.add('btn-danger');
            bulkBtn.classList.remove('hidden');
            bulkBtn.onclick = handleBulkDelete;
        } else {
            bulkBtn.classList.add('hidden');
        }
        if (els['fab-plus']) els['fab-plus'].classList.add('hidden');
    } else {
        bulkBtn.classList.remove('btn-danger', 'hidden');
        bulkBtn.onclick = handleBulkPdf;
        if (isSelectionMode && selectedIds.size > 0) {
            bulkBtn.textContent = `📄 ${selectedIds.size}件を複数選択（まとめてPDF）`;
            if (els['fab-plus']) els['fab-plus'].classList.add('hidden');
        } else {
            bulkBtn.textContent = `📄 複数選択（まとめてPDF）`;
            if (els['fab-plus']) els['fab-plus'].classList.remove('hidden');
        }
    }
}

async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}件の書類をすべて削除しますか？\nこの操作は取り消せません。`)) return;
    
    for (const id of selectedIds) {
        await deleteProject(id);
    }
    
    exitSelectionMode();
    renderList();
    alert('削除が完了しました');
}

async function handleBulkPdf() {
    if (!isSelectionMode) {
        isSelectionMode = true;
        renderList();
        return;
    }
    if (selectedIds.size === 0) {
        alert('作成する書類を1つ以上選択してください。');
        return;
    }
    if (!confirm(`${selectedIds.size}件の書類を一括でPDF作成しますか？`)) return;
    const projects = [];
    for (const id of selectedIds) { 
        const p = await getProject(id); 
        if (p) projects.push(p); 
    }
    const config = await getPdfConfig();
    const templates = { 'kanryo': '/images/kanrryoutemp.jpg', 'marusan': '/images/marusan_report.jpg', 'geppo': '/images/geppo.jpg' };
    const doc = await generateBulkPdf(projects, templates, config);
    doc.save(`bulk_${Date.now()}.pdf`);
    
    // Automatically move all generated projects to 'sent'
    for (const p of projects) {
        if (p.status === 'draft') {
            p.status = 'sent';
            await saveProject(p);
        }
    }
    
    exitSelectionMode();
    renderList();
    alert('一括出力が完了しました');
}

async function startScanner(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const originalDataUrl = e.target.result;
        els['scanner-image'].src = originalDataUrl;
        els['scanner-overlay'].classList.remove('hidden');
        
        const filterBtn = els['btn-scanner-filter'];
        filterBtn.textContent = "元画像に戻す";
        let isFiltered = false;

        const cropper = new Cropper(els['scanner-image'], { 
            viewMode: 1, 
            autoCropArea: 0.8,
            ready() {
                // Auto-apply B&W on start
                applyFilter();
            }
        });

        function applyFilter() {
            const canvas = cropper.getCroppedCanvas();
            const ctx = canvas.getContext('2d');
            ctx.putImageData(adaptiveThreshold(ctx.getImageData(0,0,canvas.width,canvas.height)), 0, 0);
            cropper.replace(canvas.toDataURL('image/jpeg', 0.9));
            isFiltered = true;
            filterBtn.textContent = "元画像に戻す";
        }

        els['btn-scanner-cancel'].onclick = () => { els['scanner-overlay'].classList.add('hidden'); cropper.destroy(); };
        els['btn-scanner-rotate'].onclick = () => cropper.rotate(90);
        
        filterBtn.onclick = () => {
            if (isFiltered) {
                // Restore Original (Requires re-cropping or just replacing data)
                cropper.replace(originalDataUrl);
                isFiltered = false;
                filterBtn.textContent = "白黒補正する";
            } else {
                applyFilter();
            }
        };

        els['btn-scanner-done'].onclick = async () => {
            const canvas = cropper.getCroppedCanvas({ maxWidth: 1200 });
            if (isFiltered) {
                const ctx = canvas.getContext('2d');
                ctx.putImageData(adaptiveThreshold(ctx.getImageData(0,0,canvas.width,canvas.height)), 0, 0);
            }
            currentProject.receiptImage = canvas.toDataURL('image/jpeg', 0.8);
            renderForm(); 
            els['scanner-overlay'].classList.add('hidden');
            cropper.destroy();
            await saveProject(currentProject);
        };
    };
    reader.readAsDataURL(file);
}

async function handleDeleteProject(id) { await deleteProject(id); await renderList(); }

async function generatePdf(id, userName, docTypeName) {
    const p = await getProject(id); if (!p) return;
    const bgUrl = p.type === 'kanryo' ? '/images/kanrryoutemp.jpg' : (p.type === 'marusan' ? '/images/marusan_report.jpg' : '/images/geppo.jpg');
    const config = await getPdfConfig();
    const doc = await generateSinglePdf(p, bgUrl, config);
    
    // Format: yyyy_mm_dd_"名前"_"作成書類名"
    const now = new Date(p.date || Date.now());
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const filename = `${y}_${m}_${d}_${userName}_${docTypeName}.pdf`;
    
    doc.save(filename);
    
    // Automatically move to 'sent' after individual PDF output
    if (p.status === 'draft') {
        p.status = 'sent';
        await saveProject(p);
        renderList();
        alert('PDFを作成しました。データを「完了」へ移動しました');
    }
}

function showErrorOverlay(err) { document.body.insertAdjacentHTML('afterbegin', `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#000;color:red;padding:20px;z-index:9999;"><h2>Fatal Error</h2><pre>${err.stack}</pre></div>`); }

function bindBotEvents() {
    const fabBot = els['fab-bot'];
    if (fabBot) {
        let isDragging = false;
        let hasMoved = false;
        let startX, startY, initialX, initialY;

        const startDrag = (e) => {
            isDragging = true;
            hasMoved = false;
            const touch = e.type.includes('mouse') ? e : e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            const rect = fabBot.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            fabBot.style.transition = 'none';
        };

        const moveDrag = (e) => {
            if (!isDragging) return;
            const touch = e.type.includes('mouse') ? e : e.touches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            
            // If moved more than 5px, consider it a drag
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                hasMoved = true;
                e.preventDefault(); // Prevent scroll while dragging
            }
            
            if (hasMoved) {
                fabBot.style.left = `${initialX + dx}px`;
                fabBot.style.top = `${initialY + dy}px`;
                fabBot.style.bottom = 'auto';
                fabBot.style.right = 'auto';
            }
        };

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            fabBot.style.transition = 'all 0.3s ease';
        };

        fabBot.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', moveDrag, {passive: false});
        document.addEventListener('mouseup', endDrag);

        fabBot.addEventListener('touchstart', startDrag, {passive: true});
        document.addEventListener('touchmove', moveDrag, {passive: false});
        document.addEventListener('touchend', endDrag);

        fabBot.onclick = (e) => {
            if (hasMoved) { e.preventDefault(); return; }
            els['bot-container'].classList.toggle('hidden');
        };
    }
    
    if (els['btn-close-bot']) els['btn-close-bot'].onclick = () => els['bot-container'].classList.add('hidden');
    if (els['btn-send-bot']) els['btn-send-bot'].onclick = () => {
        const msg = els['bot-input'].value.trim(); if (!msg) return;
        addMessage('user', msg); els['bot-input'].value = '';
        setTimeout(() => addMessage('bot', '確認いたします。'), 500);
    };
}
function addMessage(type, text) {
    const div = document.createElement('div'); div.className = `message ${type}`; div.textContent = text;
    if (els['bot-messages']) { els['bot-messages'].appendChild(div); els['bot-messages'].scrollTop = els['bot-messages'].scrollHeight; }
}

window.handleReEditReceipt = () => { const b = document.getElementById('btn-scan-receipt'); if(b) b.click(); };
window.generatePdf = generatePdf;
window.handleDeleteProject = handleDeleteProject;
window.editExistingProject = (id) => showForm('', null); // Placeholder
