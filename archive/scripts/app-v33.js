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

console.log("Main script loading (Intelligent Workflow Build v32)...");

// --- Global State & Setup ---
window.els = {};
const els = window.els;
let currentTab = 'draft'; // 'draft' or 'sent'
let searchQuery = '';
let isSelectionMode = false;
let selectedIds = new Set();
let currentProject = null;
const HEALING_MESSAGES = [
    "ねえ、自分。今日一日、本当によくやったね。あの泥臭い時間も、孤独な葛藤も、全部、僕がなりたかった『誇れる自分』への大切な階段なんだよ。",
    "無駄な時間なんて一秒もなかった。今日費やしたエネルギーは、確実に僕の理想の未来を形作っている。それを、僕だけはちゃんと信じてあげよう。",
    "周りに流されず、腐らずに今日を終える僕。そんな僕のことが、今は少しだけ誇らしいよ。理想の人生は、今日この瞬間の積み重ねの先にあるんだ。",
    "疲れたね。でも、この疲れは、僕が自分の人生を一生懸命に生きた証。一歩ずつ、僕が望む景色に近づいている。大丈夫、間違ってないよ。",
    "誰かに認められる必要なんてない。僕が今日、僕自身の理想のために時間を使った。その事実だけで、今日という日は満点なんだ。",
    "『ただの仕事』で終わらせなかった自分を、今はそっと抱きしめてあげたい。今日費やしたすべての時間が、僕という人間をより深く、強くしてくれた。",
    "ふぅ。今日も一日、僕の命を燃やしたね。この静かな達成感こそが、僕が本当に求めていた『自由』への鍵なんだ。",
    "明日がどうなるかなんて分からない。でも、今日一日を誠実に生き抜いた今の僕は、間違いなく理想の人生のど真ん中にいる。"
];

const STATIONERY_STYLES = [
    { bg: '#fdfcf0', accent: '#e5e7eb', name: '生成り' },
    { bg: '#fff5f5', accent: '#fed7d7', name: '淡桜' },
    { bg: '#f0f9ff', accent: '#bae6fd', name: '薄空' },
    { bg: '#f0fdf4', accent: '#bbf7d0', name: '若竹' },
    { bg: '#f8fafc', accent: '#e2e8f0', name: '薄墨' }
];

// Tab Switcher Helper
window.switchTab = (tabName) => {
    // RESET SEARCH & MODALS ON NAVIGATION
    if (els['search-input']) {
        els['search-input'].value = '';
        searchQuery = '';
    }
    // Close any overlays
    if (els['healing-modal']) els['healing-modal'].classList.remove('show');
    if (els['report-modal']) els['report-modal'].classList.add('hidden');
    if (els['type-modal']) els['type-modal'].style.display = 'none';

    currentTab = tabName;
    if (els.tabsList) {
        els.tabsList.forEach(t => {
            if (t.dataset.tab === tabName) t.classList.add('active');
            else t.classList.remove('active');
        });
    }
    // FAB visibility sync
    if (els['fab-plus']) {
        els['fab-plus'].style.display = (currentTab === 'draft') ? 'flex' : 'none';
    }
    renderList();
};
let longPressTimeout = null;
let isLongPressAction = false;
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
        'form-page-title', 'bot-container', 'fab-bot', 'btn-close-bot', 'btn-send-bot', 'bot-input', 'bot-messages',
        'calendar-view', 'calendar-header', 'calendar-grid', 'calendar-day-list', 'global-nav', 'search-input',
        'healing-modal', 'healing-text', 'btn-close-healing', 'report-modal', 'report-text', 'btn-report-send', 'btn-report-cancel'
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
        bindReportEvents();
        if (window.logBoot) window.logBoot("Report events bound");
    } catch (e) {
        if (window.logBoot) window.logBoot("EVENT BINDING FAILED: " + e.message);
        throw e;
    }
    
    // 2. Load and render list in background
    try {
        if (window.logBoot) window.logBoot("Attempting to switch to draft tab...");
        window.switchTab('draft');
        if (window.logBoot) window.logBoot("Initial tab switch complete");
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
    // Hide all view containers first to ensure a clean slate
    document.querySelectorAll('.view-container').forEach(el => {
        el.classList.add('hidden');
    });

    const projects = await getAllProjects();
    
    if (searchQuery) {
        // GLOBAL SEARCH MODE
        document.querySelectorAll('.view-container').forEach(el => el.classList.add('hidden'));
        if (els['project-list-view']) els['project-list-view'].classList.remove('hidden');
        
        const listContainer = els['project-list'];
        if (!listContainer) return;

        const filtered = filterBySearch(projects, searchQuery);
        const geppoLabels = generateGeppoLabels(projects);

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="empty-state" style="padding:40px; text-align:center;"><p>条件に合う書類は見つかりません</p></div>`;
        } else {
            listContainer.innerHTML = `<div style="padding:12px; font-weight:bold; color:#0ea5e9; border-bottom:1px solid #f1f5f9; margin-bottom:10px; background:#f8fafc; border-radius:8px;">🔍 "${searchQuery}" の検索結果 (${filtered.length}件)</div>` + 
                filtered.map(p => renderProjectCardHtml(p, geppoLabels)).join('');
            bindCardEvents(listContainer);
        }
        updateSelectionUI();
        return;
    }

    if (currentTab === 'sent') {
        if (els['calendar-view']) els['calendar-view'].classList.remove('hidden');
        if (typeof renderCalendar === 'function') renderCalendar(projects);
        return;
    }

    if (els['project-list-view']) els['project-list-view'].classList.remove('hidden');
    
    const listContainer = els['project-list'];
    if (!listContainer) return;

    // SORT BY OLDEST FIRST (Ascending ID)
    let filtered = projects.filter(p => p.status === 'draft').sort((a, b) => a.id.localeCompare(b.id));

    // Calculate Geppo labels
    const geppoLabels = generateGeppoLabels(projects);

    // Filter by search query
    filtered = filterBySearch(filtered, searchQuery);

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="empty-state" style="padding:40px; text-align:center; color:#94a3b8;"><p>下書きはありません</p></div>`;
        updateSelectionUI();
        return;
    }

    listContainer.innerHTML = filtered.map(p => renderProjectCardHtml(p, geppoLabels)).join('');
    bindCardEvents(listContainer);
    updateSelectionUI();
}

function filterBySearch(list, query) {
    if (!query) return list;
    const normalize = (val) => String(val || "").normalize("NFKC").toLowerCase();
    const q = normalize(query);
    return list.filter(p => {
        if (p.type === 'geppo') return false; // Exclude Monthly Reports from search
        const fd = p.formData || {};
        // Search ONLY in: companyName, siteName, supervisorName, address
        const searchText = `${fd.companyName || ''} ${fd.siteName || ''} ${fd.supervisorName || ''} ${fd.address || ''}`;
        return normalize(searchText).includes(q);
    });
}

function generateGeppoLabels(allProjects) {
    const geppoCounts = {}; 
    const sortedGeppo = [...allProjects].filter(p => p.type === 'geppo').sort((a,b) => a.id.localeCompare(b.id));
    const labels = {}; 
    sortedGeppo.forEach(p => {
        const ym = p.date ? p.date.substring(0, 7).replace('-', '年') + '月' : '時期未定';
        geppoCounts[ym] = (geppoCounts[ym] || 0) + 1;
        labels[p.id] = geppoCounts[ym] > 1 ? `${ym} (${geppoCounts[ym]}枚目)` : ym;
    });
    return labels;
}

function renderProjectCardHtml(p, geppoLabels) {
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
    } else if (p.type === 'geppo') {
        mainInfoHtml = `
            <div class="info-row"><strong>年月:</strong> ${geppoLabels[p.id] || ''}</div>
            <div class="info-row"><strong>作業者:</strong> ${p.workerName || fd.workerName || '(未入力)'}</div>
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
}

function bindCardEvents(container) {
    container.querySelectorAll('.project-card').forEach(card => {
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
                if (e.target.closest('.card-action-btn')) return; 
                window.handleCardPreview(id);
            }
        };
        card.addEventListener('touchstart', start, {passive: true});
        card.addEventListener('touchend', end, {passive: true});
        card.addEventListener('mousedown', start);
        card.addEventListener('mouseup', end);
        card.addEventListener('click', click);
    });
}

function enterSelectionMode(firstId) { isSelectionMode = true; selectedIds.add(firstId); renderList(); }
function toggleSelection(id) { if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); if (selectedIds.size === 0) exitSelectionMode(); else renderList(); }
function exitSelectionMode() { isSelectionMode = false; selectedIds.clear(); renderList(); }

// --- Calendar Logic ---

function renderCalendar(allProjects) {
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

    let dayProjects = sentProjects.filter(p => p.date === selectedCalendarDate);
    
    // Apply search filter even in calendar day list
    dayProjects = filterBySearch(dayProjects, searchQuery);

    if (dayProjects.length === 0) {
        listContainer.innerHTML = `<p class="empty-state">${selectedCalendarDate} ${searchQuery ? 'の条件に合う' : ''}書類はありません</p>`;
        return;
    }

    // Reuse unified card generator
    const allSentProjects = sentProjects; // For labels
    const geppoLabels = generateGeppoLabels(allSentProjects);
    
    listContainer.innerHTML = `<h4>${selectedCalendarDate} の書類 (${dayProjects.length}件)</h4>` + 
        dayProjects.map(p => renderProjectCardHtml(p, geppoLabels)).join('');
    
    bindCardEvents(listContainer);
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
    
    // Hide ALL standardized view containers and global nav for a clean transition
    document.querySelectorAll('.view-container').forEach(v => v.classList.add('hidden'));
    if (els['global-nav']) els['global-nav'].classList.add('hidden');
    currentProject = project || {
        id: `project_${Date.now()}`,
        status: 'draft',
        type: type,
        date: new Date().toISOString().split('T')[0],
        workerName: '',
        formData: { supportName: [] },
        receiptImage: null
    };
    
    els['form-view'].classList.remove('hidden');
    if (els['form-page-title']) {
        const typeName = type === 'kanryo' ? '完了報告書' : (type === 'marusan' ? '丸産報告書' : '月報');
        els['form-page-title'].textContent = `${typeName} - ${project ? '編集' : '作成'}`;
    }
    
    window.scrollTo(0, 0);
    renderForm();
}

window.closeForm = () => {
    if (confirm('作業中の内容は破棄されますが、戻りますか？')) {
        // Force reset UI state
        if (els['form-view']) els['form-view'].classList.add('hidden');
        if (els['global-nav']) els['global-nav'].classList.remove('hidden');
        
        // Always go back to draft tab to ensure visibility of the work
        window.switchTab('draft');
    }
};

function renderForm() {
    const container = els['editor-container'];
    if (!container) return;
    
    // Unified header for ALL independent form pages
    const typeName = currentProject.type === 'kanryo' ? '完了報告書' : (currentProject.type === 'marusan' ? '丸産報告書' : '月報');
    
    container.innerHTML = `
        <div class="independent-form-page">
            <div class="independent-form-header">
                <button class="btn-back-to-list" onclick="window.closeForm()">✕ 戻る</button>
                <div class="form-title-center">${typeName} ${currentProject.status === 'sent' ? '再編集' : '作成'}</div>
            </div>
            
            <div class="form-scroll-content">
                <div id="dynamic-form-fields">
                    ${currentProject.type === 'kanryo' ? renderKanryoFields() : (currentProject.type === 'marusan' ? renderMarusanFields() : renderGeppoFields())}
                </div>
            </div>

            <!-- FIXED ACTION BAR: Always visible, never overlaps inputs -->
            <div class="form-fixed-actions">
                <button class="btn btn-outline" id="btn-preview-doc" style="flex:1; height: 50px; font-weight:bold;">プレビュー</button>
                <button class="btn btn-primary" id="btn-save-draft" style="flex:1; height: 50px; font-weight:bold;">下書き保存</button>
            </div>
        </div>
    `;
    const previewBtn = document.getElementById('btn-preview-doc');
    if (previewBtn) previewBtn.onclick = handleShowPreview;
    
    const saveBtn = document.getElementById('btn-save-draft');
    if (saveBtn) saveBtn.onclick = handleSaveDraft;
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
    let html = `
        <div class="geppo-top-meta" style="margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
            <div class="form-group">
                <label class="label">① 氏名</label>
                <input type="text" id="field-workerName" value="${fd.workerName || ''}" placeholder="例：山田 太郎">
            </div>
            <div style="display:flex; gap:10px;">
                <div class="form-group" style="flex:1;">
                    <label class="label">② 年</label>
                    <input type="number" id="field-geppo_year" value="${fd.geppo_year || new Date().getFullYear()}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label class="label">③ 月</label>
                    <input type="number" id="field-geppo_month" value="${fd.geppo_month || (new Date().getMonth() + 1)}">
                </div>
            </div>
        </div>

        <div class="geppo-rows-list">
    `;

    for (let i = 0; i < 31; i++) {
        html += `
            <div class="geppo-row-card" style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:15px; margin-bottom:15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; margin-bottom:10px; padding-bottom:5px;">
                    <span style="font-weight:bold; color:#2563eb;">${i + 1}行目</span>
                    ${i < 30 ? `<button type="button" class="btn-copy-next" onclick="window.copyRowToNext(${i})" style="font-size:0.7rem; color:#2563eb; background:none; border:none; text-decoration:underline;">↓次へコピー</button>` : ''}
                </div>
                
                <div style="display:flex; gap:10px; margin-bottom:12px;">
                    <div style="width:70px;">
                        <label style="font-size:0.75rem; color:#64748b; font-weight:bold; display:block; margin-bottom:4px;">日</label>
                        <input type="number" id="field-row_${i}_day" value="${fd[`row_${i}_day`] || ''}">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:0.75rem; color:#64748b; font-weight:bold; display:block; margin-bottom:4px;">会社名</label>
                        <input type="text" id="field-row_${i}_company" value="${fd[`row_${i}_company`] || ''}">
                    </div>
                </div>
                <div class="geppo-field-unit" style="margin-bottom:12px;">
                    <label style="font-size:0.75rem; color:#64748b; font-weight:bold; display:block; margin-bottom:4px;">現場名</label>
                    <input type="text" id="field-row_${i}_site" value="${fd[`row_${i}_site`] || ''}">
                </div>
                <div class="geppo-field-unit" style="margin-bottom:12px;">
                    <label style="font-size:0.75rem; color:#64748b; font-weight:bold; display:block; margin-bottom:4px;">監督名</label>
                    <input type="text" id="field-row_${i}_supervisor" value="${fd[`row_${i}_supervisor`] || ''}">
                </div>
                <div class="geppo-field-unit">
                    <label style="font-size:0.75rem; color:#64748b; font-weight:bold; display:block; margin-bottom:4px;">住所</label>
                    <input type="text" id="field-row_${i}_address" value="${fd[`row_${i}_address`] || ''}">
                </div>
            </div>
        `;
    }

    html += `</div>`;
    return html;
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
    console.log('Starting save process for project:', currentProject.id);
    syncDataToProject();
    currentProject.displayTitle = generateDraftName(currentProject.date, currentProject.workerName);
    
    // If it was 'sent', move it back to 'draft'
    if (currentProject.status === 'sent') {
        currentProject.status = 'draft';
    }
    
    try {
        await saveProject(currentProject);
        alert('保存しました');
        
        // Hide form and switch tab to DRAFT to ensure user sees their saved data
        if(els['form-view']) els['form-view'].classList.add('hidden');
        if(els['global-nav']) els['global-nav'].classList.remove('hidden');
        
        window.switchTab('draft');
    } catch (err) {
        console.error('Save failed:', err);
        alert('保存に失敗しました: ' + err.message);
    }
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
            const savedName = localStorage.getItem('last_user_name') || 'ユーザー';
            const typeNames = { 'kanryo': '完了報告書', 'marusan': '丸産報告書', 'geppo': '月報' };
            await generatePdf(currentProject.id, savedName, typeNames[currentProject.type] || '書類'); 
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

    if (els['btn-back']) els['btn-back'].onclick = () => window.closeForm();

    if (els.tabsList) {
        els.tabsList.forEach(tab => { 
            tab.onclick = () => window.switchTab(tab.dataset.tab); 
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
    const bulkDeleteBtn = document.getElementById('btn-bulk-delete-exec');
    const actionBar = els['bulk-action-bar'];
    if (!bulkBtn) return;
    
    // Ensure the entire action bar is visible during selection mode
    if (actionBar) {
        if (isSelectionMode && selectedIds.size > 0) actionBar.classList.remove('hidden');
        else actionBar.classList.add('hidden');
    }

    if (currentTab === 'sent') {
        if (isSelectionMode && selectedIds.size > 0) {
            // In Sent tab, we only need Delete button (PDF is for drafts usually)
            bulkBtn.classList.add('hidden'); 
            if (bulkDeleteBtn) {
                bulkDeleteBtn.textContent = `🗑 ${selectedIds.size}件をまとめて削除`;
                bulkDeleteBtn.classList.remove('hidden');
                bulkDeleteBtn.onclick = handleBulkDelete;
            }
        } else {
            bulkBtn.classList.add('hidden');
            if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');
        }
        if (els['fab-plus']) els['fab-plus'].classList.add('hidden');
    } else {
        bulkBtn.classList.remove('btn-danger', 'hidden');
        bulkBtn.onclick = handleBulkPdf;
        if (isSelectionMode && selectedIds.size > 0) {
            bulkBtn.textContent = `📄 ${selectedIds.size}件をまとめてPDF`;
            if (bulkDeleteBtn) {
                bulkDeleteBtn.classList.remove('hidden');
                bulkDeleteBtn.onclick = handleBulkDelete;
            }
            if (els['fab-plus']) els['fab-plus'].classList.add('hidden');
        } else {
            bulkBtn.textContent = `📄 複数選択（まとめてPDF）`;
            if (bulkDeleteBtn) bulkDeleteBtn.classList.add('hidden');
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
    if (selectedIds.size === 0) return;

    const modal = document.getElementById('pdf-filename-modal');
    const nameInput = document.getElementById('pdf-user-name');
    const typeSelect = document.getElementById('pdf-doc-type');
    
    nameInput.value = localStorage.getItem('last_user_name') || '';
    modal.classList.remove('hidden');

    document.getElementById('btn-pdf-cancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-pdf-exec').onclick = async () => {
        const name = nameInput.value.trim();
        if (!name) { alert('氏名を入力してください'); return; }
        
        localStorage.setItem('last_user_name', name);
        modal.classList.add('hidden');
        
        const ids = Array.from(selectedIds);
        const projects = [];
        for (const id of ids) {
            const p = await getProject(id);
            if (p) projects.push(p);
        }
        const config = await getPdfConfig();
        const templates = { 'kanryo': '/images/kanrryoutemp.jpg', 'marusan': '/images/marusan_report.jpg', 'geppo': '/images/geppo.jpg' };
        
        const doc = await generateBulkPdf(projects, templates, config);
        
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        
        let filename = '';
        if (typeSelect.value === '月報') {
            filename = `${y}_${m}_${name}月報.pdf`;
        } else {
            filename = `${y}_${m}_${d}_${name}_${typeSelect.value}.pdf`;
        }
        doc.save(filename);
        
        // Move to 'sent'
        for (const p of projects) {
            if (p.status === 'draft') {
                p.status = 'sent';
                await saveProject(p);
            }
        }

        exitSelectionMode();
        renderList();
        console.log("Triggering healing dialog after Bulk PDF...");
        showHealingDialog("一括出力が完了しました。選択したすべての書類のステータスを「完了」に更新しました。");
    };
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

        let autoApplyDone = false;
        const cropper = new Cropper(els['scanner-image'], { 
            viewMode: 1, 
            autoCropArea: 0.8,
            ready() {
                // Auto-apply B&W ONLY ONCE on start
                if (!autoApplyDone) {
                    autoApplyDone = true;
                    applyFilter();
                }
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
    let filename = '';
    if (p.type === 'geppo') {
        filename = `${y}_${m}_${userName}月報.pdf`;
    } else {
        filename = `${y}_${m}_${d}_${userName}_${docTypeName}.pdf`;
    }
    
    doc.save(filename);
    
    // Automatically move to 'sent' after individual PDF output
    if (p.status === 'draft') {
        p.status = 'sent';
        await saveProject(p);
        await renderList(); 
    }

    console.log("Triggering healing dialog after Single PDF...");
    showHealingDialog();
}

function showHealingDialog(customMsg = null) {
    const modal = document.getElementById('healing-modal');
    if (!modal) return;
    
    // 1. Randomize Style
    const style = STATIONERY_STYLES[Math.floor(Math.random() * STATIONERY_STYLES.length)];
    const paper = modal.querySelector('.healing-letter-paper');
    if (paper) {
        paper.style.backgroundColor = style.bg;
        paper.style.backgroundImage = `radial-gradient(${style.accent} 0.5px, transparent 0.5px)`;
    }
    
    // 2. Randomize Photo
    const photoIdx = Math.floor(Math.random() * 4) + 1;
    const img = document.getElementById('healing-img');
    if (img) img.src = `healing_${photoIdx}.png`;
    
    const photoFrame = modal.querySelector('.photo-frame');
    if (photoFrame) {
        const rotate = (Math.random() * 6 - 3).toFixed(1); // -3 to 3 deg
        photoFrame.style.transform = `rotate(${rotate}deg)`;
    }

    // 3. Randomize Message
    const textEl = document.getElementById('healing-text');
    const msg = customMsg || HEALING_MESSAGES[Math.floor(Math.random() * HEALING_MESSAGES.length)];
    if (textEl) textEl.innerHTML = msg.replace(/\n/g, '<br>');
    
    modal.classList.add('show');
    
    const closeBtn = document.getElementById('btn-close-healing');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.remove('show');
        };
    }
}

function bindReportEvents() {
    const btnReport = document.getElementById('btn-report-issue');
    if (btnReport) {
        btnReport.onclick = () => {
            if (els['report-modal']) els['report-modal'].classList.remove('hidden');
        };
    }
    if (els['btn-report-cancel']) {
        els['btn-report-cancel'].onclick = () => {
            if (els['report-modal']) els['report-modal'].classList.add('hidden');
        };
    }
    if (els['btn-report-send']) {
        els['btn-report-send'].onclick = () => {
            const text = els['report-text'].value.trim();
            if (!text) { alert('内容を入力してください'); return; }
            if (confirm('この内容で作成者へ報告を送信しますか？')) {
                console.log("Reporting to kmk7531.hmk.runner@gmail.com:", text);
                alert('ありがとうございます。報告を受領しました。\n(※現在はシミュレーション送信です。実稼働にはバックエンド連携が必要です)');
                els['report-text'].value = '';
                els['report-modal'].classList.add('hidden');
            }
        };
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
        if (els['bot-container']) els['bot-container'].classList.toggle('hidden');
    };

        if (els['btn-close-bot']) els['btn-close-bot'].onclick = () => els['bot-container'].classList.add('hidden');
        if (els['btn-send-bot']) els['btn-send-bot'].onclick = () => {
            const input = els['bot-input'];
            const text = input.value.trim();
            if (!text) return;
            addMessage('user', text);
            input.value = '';

            const MANUAL = {
                "使い方": "1. 右下の「＋」ボタンで書類（完了、丸産、月報）を作成します。\n2. 「下書き」タブに保存されます。\n3. 「PDF」ボタンで保存・出力すると「完了」タブ（カレンダー）に移動します。",
                "PDF": "・個別：カードの「PDF」ボタンから出力できます。\n・一括：長押しで複数選択し、下の「まとめてPDF」ボタンを押すと、選択した順番で1つのPDFになります。",
                "削除": "・個別：カードの「削除」ボタンから行えます。\n・一括：長押しで複数選択し、下の「まとめて削除」ボタンで実行できます（確認画面が出ます）。",
                "編集": "・下書き：カードの「編集」で修正できます。\n・完了：カレンダーで書類をタップし、詳細プレビューから「再編集」ボタンを押すと下書きに戻ります。",
                "検索": "画面上の検索窓に現場名、監督名、会社名、住所などを入力すると、全データから瞬時に探し出せます。※月報は検索対象外です。"
            };

            let found = false;
            for (let key in MANUAL) {
                if (text.includes(key)) {
                    setTimeout(() => addMessage('bot', MANUAL[key]), 500);
                    found = true;
                    break;
                }
            }
            if (!found) {
                setTimeout(() => addMessage('bot', "申し訳ありません。「使い方」「PDF」「削除」「編集」「検索」などのキーワードでお尋ねください。"), 500);
            }
        };
    }
}

function addMessage(type, text) {
    const div = document.createElement('div'); div.className = `message ${type}`; div.textContent = text;
    if (els['bot-messages']) { els['bot-messages'].appendChild(div); els['bot-messages'].scrollTop = els['bot-messages'].scrollHeight; }
}

function handleReEditReceipt() {
    const btn = document.getElementById('btn-scan-receipt');
    if (btn) btn.click();
}

window.copyRowToNext = (idx) => {
    const day = document.getElementById(`field-row_${idx}_day`)?.value || '';
    const company = document.getElementById(`field-row_${idx}_company`)?.value || '';
    const supervisor = document.getElementById(`field-row_${idx}_supervisor`)?.value || '';
    const site = document.getElementById(`field-row_${idx}_site`)?.value || '';
    const address = document.getElementById(`field-row_${idx}_address`)?.value || '';
    
    const nextIdx = idx + 1;
    if (nextIdx >= 31) return;

    const nextC = document.getElementById(`field-row_${nextIdx}_company`);
    const nextS = document.getElementById(`field-row_${nextIdx}_supervisor`);
    const nextSt = document.getElementById(`field-row_${nextIdx}_site`);
    const nextAd = document.getElementById(`field-row_${nextIdx}_address`);
    const nextD = document.getElementById(`field-row_${nextIdx}_day`);

    if (nextC) nextC.value = company;
    if (nextS) nextS.value = supervisor;
    if (nextSt) nextSt.value = site;
    if (nextAd) nextAd.value = address;
    if (nextD && day) nextD.value = parseInt(day) + 1;
};

window.copyFirstGeppoRow = () => {
    const company = document.getElementById('field-row_0_company')?.value || '';
    const supervisor = document.getElementById('field-row_0_supervisor')?.value || '';
    const site = document.getElementById('field-row_0_site')?.value || '';
    const address = document.getElementById('field-row_0_address')?.value || '';
    
    if (!company && !supervisor && !site && !address) {
        alert('1行目にコピーしたい内容を入力してください');
        return;
    }

    if (!confirm('1行目の内容をすべての行に反映しますか？')) return;

    for (let i = 1; i < 31; i++) {
        const c = document.getElementById(`field-row_${i}_company`);
        const s = document.getElementById(`field-row_${i}_supervisor`);
        const st = document.getElementById(`field-row_${i}_site`);
        const ad = document.getElementById(`field-row_${i}_address`);
        
        if (c) c.value = company;
        if (s) s.value = supervisor;
        if (st) st.value = site;
        if (ad) ad.value = address;
    }
};

// Note: Global functions are already bound to window at their definition points (L325, L352, L374, etc.)
