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
let projects = []; // Global projects array
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
window.switchTab = async (tabName) => {
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
    window.updateSelectionUI();
    await renderList();
};
let longPressTimeout = null;
let isLongPressAction = false;
let currentCalendarDate = new Date();
let selectedCalendarDate = null; // YYYY-MM-DD

// --- Harden Boot Logic ---
async function bootApp() {
    if (window.logBoot) window.logBoot("🚀 Starting Application Boot (v35)...");
    try {
        if (window.logBoot) window.logBoot("Stage 1: Setup Elements");
        setupElements();
        
        if (window.logBoot) window.logBoot("Stage 2: Binding Events");
        bindGlobalEvents();
        bindBotEvents();
        bindReportEvents();
        
        if (window.logBoot) window.logBoot("Stage 3: Loading Data");
        projects = await getAllProjects();
        if (window.logBoot) window.logBoot(`Loaded ${projects.length} projects`);
        
        if (window.logBoot) window.logBoot("Stage 4: Rendering Initial View");
        window.updateSelectionUI();
        window.switchTab('draft'); // This handles renderList() internally
        
        if (window.logBoot) window.logBoot("✅ App Boot Successful");
    } catch (err) {
        if (window.logBoot) window.logBoot("❌ BOOT CRASH: " + err.message);
        console.error("Critical: App boot failed", err);
    }
}

// Ensure single entry point
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApp);
} else {
    bootApp();
}

function setupElements() {
    if (window.logBoot) window.logBoot("Setting up elements...");
    const ids = [
        'project-list-view', 'form-view', 'project-list', 'tabs', 'fab-plus', 
        'btn-back', 'type-modal', 'project-detail-view', 'detail-summary-text',
        'bulk-action-bar', 'selected-count', 'btn-bulk-pdf-exec', 'btn-cancel-select',
        'editor-container', 'scanner-overlay', 'scanner-image',
        'btn-scanner-cancel', 'btn-scanner-done', 'btn-scanner-rotate', 'btn-scanner-filter',
        'document-preview-overlay', 'preview-canvas-container', 'btn-close-preview',
        'form-page-title', 'bot-container', 'fab-bot', 'btn-close-bot', 'btn-send-bot', 'bot-input', 'bot-messages',
        'calendar-view', 'calendar-header', 'calendar-grid', 'calendar-day-list', 'global-nav', 'search-input',
        'healing-modal', 'healing-text', 'btn-close-healing', 'report-modal', 'report-text', 'btn-report-send', 'btn-report-cancel', 'btn-report-issue'
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


// --- List View Logic ---

async function renderList() {
    if (window.logBoot) window.logBoot("Refreshing and rendering list...");
    
    // Hide all view containers first to ensure a clean slate
    document.querySelectorAll('.view-container').forEach(el => {
        el.classList.add('hidden');
    });

    projects = await getAllProjects();
    
    if (searchQuery) {
        // GLOBAL SEARCH MODE
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
        if (typeof renderCalendar === 'function') await renderCalendar();
        return;
    }

    if (els['project-list-view']) els['project-list-view'].classList.remove('hidden');
    const listContainer = els['project-list'];
    if (!listContainer) return;

    // SORT BY DATE (Oldest First)
    let filtered = projects.filter(p => p.status === 'draft').sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    // Calculate Geppo labels
    const geppoLabels = generateGeppoLabels(projects);

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="empty-state" style="padding:40px; text-align:center; color:#94a3b8;"><p>下書きはありません</p></div>`;
        updateSelectionUI();
        return;
    }

    let listHtml = filtered.map(p => renderProjectCardHtml(p, geppoLabels)).join('');

    // Append "複数選択" button under the list (Normal Mode)
    if (!isSelectionMode && filtered.length > 0) {
        listHtml += `
            <div class="selection-trigger-container" style="padding: 25px 15px; display: flex; justify-content: center; width: 100%;">
                <button class="btn btn-primary" onclick="window.enterSelectionMode()" 
                    style="background: #0ea5e9; color: white; padding: 14px 40px; border-radius: 16px; font-weight: bold; font-size: 1.1rem; width: 100%; max-width: 320px; box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3); border: none;">
                    複数選択モード
                </button>
            </div>
        `;
    }

    listContainer.innerHTML = listHtml;
    bindCardEvents(listContainer);
    window.updateSelectionUI();
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
    const sortedGeppo = [...allProjects].filter(p => p.type === 'geppo').sort((a,b) => (a.date || "").localeCompare(b.date || ""));
    const labels = {}; 
    sortedGeppo.forEach(p => {
        const fd = p.formData || {};
        const ym = (fd.geppo_year && fd.geppo_month) ? `${fd.geppo_year}年${fd.geppo_month}月` : (p.date ? p.date.substring(0, 7).replace('-', '年') + '月' : '時期未定');
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
        const address = fd.address || '';
        const mapUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
        mainInfoHtml = `
            <div class="info-row"><strong>年月:</strong> ${geppoLabels[p.id] || ''}</div>
            ${address ? `<div class="info-row"><strong>住所:</strong> ${address} <a href="${mapUrl}" target="_blank" style="text-decoration:none; margin-left:5px; font-size:1.1rem;">📍</a></div>` : ''}
        `;
    } else {
        const address = fd.address || '';
        const mapUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
        mainInfoHtml = `
            <div class="info-row"><strong>会社名:</strong> ${fd.companyName || '(未入力)'}</div>
            <div class="info-row"><strong>監督名:</strong> ${fd.supervisorName || '(未入力)'}</div>
            ${address ? `<div class="info-row"><strong>住所:</strong> ${address} <a href="${mapUrl}" target="_blank" style="text-decoration:none; margin-left:5px; font-size:1.1rem;">📍</a></div>` : ''}
        `;
    }

    return `
        <div class="project-card fade-in ${isSelected ? 'selected' : ''}" data-id="${p.id}">
            <div class="card-selection-indicator">✓</div>
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
    // Card event binding is now handled by Global Click Listener in bindGlobalEvents
}

window.updateSelectionUI = () => {
    const container = document.getElementById('selection-bar-container');
    if (!container) return;
    
    if (!isSelectionMode) {
        document.body.classList.remove('selection-mode');
        container.innerHTML = ''; 
    } else {
        document.body.classList.add('selection-mode');
        container.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(15px); padding: 18px; border-radius: 24px; box-shadow: 0 10px 50px rgba(0,0,0,0.25); display: flex; gap: 12px; align-items: center; width: 92%; max-width: 480px; border: 1px solid rgba(0,0,0,0.1); animation: slideUp 0.3s ease-out; pointer-events: auto;">
                <button class="btn btn-outline" onclick="window.exitSelectionMode()" style="padding: 12px 18px; border-radius: 12px;">✕</button>
                <div style="font-size: 1rem; font-weight: bold; color: var(--accent-gold); min-width: 40px; text-align: center;">
                    <span id="dock-count" style="font-size: 1.2rem;">${selectedIds.size}</span>件
                </div>
                <button class="btn btn-primary" onclick="window.handleBulkPdf()" style="flex: 1.5; font-weight: bold; padding: 12px 5px; font-size: 0.9rem; background: #0ea5e9; border:none;">まとめてPDF</button>
                <button class="btn btn-danger" onclick="window.handleBulkDelete()" style="flex: 1; font-weight: bold; padding: 12px 5px; font-size: 0.9rem;">まとめて削除</button>
            </div>
        `;
    }
};

window.toggleSelection = (id) => { 
    if (selectedIds.has(id)) selectedIds.delete(id); 
    else selectedIds.add(id); 
    window.updateSelectionUI();
    
    // Visually update ONLY the clicked card for maximum performance
    const card = document.querySelector(`.project-card[data-id="${id}"]`);
    if (card) {
        if (selectedIds.has(id)) card.classList.add('selected');
        else card.classList.remove('selected');
    }
};

window.enterSelectionMode = async (firstId) => {
    isSelectionMode = true;
    window.isSelectionMode = true; 
    if (firstId) selectedIds.add(firstId);
    window.updateSelectionUI();
    await renderList();
};

window.exitSelectionMode = async () => {
    isSelectionMode = false;
    window.isSelectionMode = false;
    selectedIds.clear();
    window.updateSelectionUI();
    await renderList();
};

async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}件の書類をすべて削除しますか？\nこの操作は取り消せません。`)) return;
    await Promise.all(Array.from(selectedIds).map(id => deleteProject(id)));
    await exitSelectionMode();
    alert('削除が完了しました');
}
window.handleBulkDelete = handleBulkDelete;

async function handleBulkPdf() {
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
        const selectedProjects = [];
        for (const id of ids) {
            const p = await getProject(id);
            if (p) selectedProjects.push(p);
        }
        const config = await getPdfConfig();
        const templates = { 'kanryo': '/images/kanrryoutemp.jpg', 'marusan': '/images/marusan_report.jpg', 'geppo': '/images/geppo.jpg' };
        const doc = await generateBulkPdf(selectedProjects, templates, config);
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        let filename = typeSelect.value === '月報' ? `${y}_${m}_${name}月報.pdf` : `${y}_${m}_${d}_${name}_${typeSelect.value}.pdf`;
        doc.save(filename);
        for (const p of selectedProjects) { if (p.status === 'draft') { p.status = 'sent'; await saveProject(p); } }
        exitSelectionMode();
        renderList();
        if (window.showHealingDialog) window.showHealingDialog("一括出力が完了しました。ステータスを「完了」に更新しました。");
    };
}
window.handleBulkPdf = handleBulkPdf;

// --- Calendar Logic ---

async function renderCalendar() {
    projects = await getAllProjects();
    const sentProjects = projects.filter(p => p.status === 'sent');
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

async function renderCalendarDayList() {
    const listContainer = document.getElementById('calendar-day-list');
    if (!selectedCalendarDate) {
        listContainer.innerHTML = '<p class="empty-state">日付を選択してください</p>';
        return;
    }
    
    projects = await getAllProjects();
    const sentProjects = projects.filter(p => p.status === 'sent');
    let dayProjects = sentProjects.filter(p => p.date === selectedCalendarDate);
    
    // Sort by input date
    dayProjects = dayProjects.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    if (dayProjects.length === 0) {
        listContainer.innerHTML = `<p class="empty-state">${selectedCalendarDate} ${searchQuery ? 'の条件に合う' : ''}書類はありません</p>`;
        return;
    }

    // Reuse unified card generator
    const allSentProjects = sentProjects; // For labels
    const geppoLabels = generateGeppoLabels(allSentProjects);
    
    listContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:10px; background:rgba(69, 26, 3, 0.05); border-radius:12px;">
            <h4 style="margin:0;">${selectedCalendarDate} (${dayProjects.length}件)</h4>
            ${isSelectionMode ? 
                `<button class="btn btn-sm btn-danger" onclick="window.confirmDeleteSelected()">選択した${selectedIds.size}件を削除</button>` :
                `<div style="font-size: 0.75rem; color: #9a3412; opacity: 0.8; font-weight: bold;">※長押しでまとめて削除</div>`
            }
        </div>
    ` + dayProjects.map(p => renderProjectCardHtml(p, geppoLabels)).join('');
    
    bindCardEvents(listContainer);
}

window.enterSelectionModeFromCalendar = async () => {
    isSelectionMode = true;
    await renderCalendarDayList(); // FIX: Call specific calendar renderer, NOT renderList()
    const bar = document.getElementById('bulk-action-bar');
    if (bar) bar.classList.remove('hidden');
    window.updateBulkBar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.updateBulkBar = () => {
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.textContent = selectedIds.size;
    
    const dockCountEl = document.getElementById('dock-count');
    if (dockCountEl) dockCountEl.textContent = selectedIds.size;
};

window.confirmDeleteSelected = async () => {
    if (selectedIds.size === 0) {
        alert("削除する書類を選択してください");
        return;
    }
    if (confirm(`選択した ${selectedIds.size} 件の書類を完全に削除しますか？`)) {
        await Promise.all(Array.from(selectedIds).map(id => deleteProject(id)));
        await exitSelectionMode();
        alert('選択した書類をすべて削除しました');
    }
};

// --- Preview & Action Logic ---

window.showTypeModal = () => {
    const modal = document.getElementById('type-modal');
    if (modal) modal.style.display = 'flex';
};

window.openReportModal = () => {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.classList.add('active');
        modal.classList.remove('hidden');
    }
};

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
        modal.classList.remove('hidden');
        
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

    // GLOBAL CLICK LISTENER (Event Delegation)
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.project-card');
        const actionBtn = e.target.closest('.card-action-btn');
        const selectionTrigger = e.target.closest('.selection-trigger-container button');

        if (selectionTrigger) {
            window.enterSelectionMode();
            return;
        }

        if (card) {
            const id = card.dataset.id;
            if (isSelectionMode) {
                window.toggleSelection(id);
            } else if (!actionBtn) {
                window.handleCardPreview(id);
            }
            return;
        }

        // Global Click Listener for Deselection (Tap background to exit selection mode)
        if (isSelectionMode) {
            if (e.target.closest('#selection-bar-container') || e.target.closest('.modal-content') || e.target.closest('.scanner-overlay')) return;
            // Removed auto-exit on background click to prevent accidental closure on mobile
        }
    });

    // Search Input binding
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.oninput = async (e) => {
            searchQuery = e.target.value;
            await renderList();
        };
    }
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

// Redundant bulk functions removed to resolve SyntaxError

async function startScanner(file) {
    if (!file) return;
    // CRITICAL: Sync data before UI re-render to prevent losing form input
    syncDataToProject();
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
    const btnReport = document.getElementById('btn-report-issue-bot');
    if (btnReport) {
        const handleReport = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (els['report-modal']) els['report-modal'].classList.remove('hidden');
        };
        btnReport.onclick = handleReport;
        btnReport.addEventListener('touchstart', handleReport, {passive: false});
    }
    if (els['btn-report-cancel']) {
        els['btn-report-cancel'].onclick = () => {
            if (els['report-modal']) els['report-modal'].classList.add('hidden');
        };
    }
    if (els['btn-report-send']) {
        // Redundant onclick removed. Using native <a> tag in index.html for stability.
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
        if (els['bot-container']) {
            els['bot-container'].classList.toggle('hidden');
            if (!els['bot-container'].classList.contains('hidden')) {
                // Initial greeting
                if (els['bot-messages'].children.length === 0) {
                    addMessage('bot', `お疲れ様です！(INTERACTIVE版)<br>当社のルールや使い方をご案内します。ボタンを押してくださいね。<br><br>
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                            <button onclick="window.botAction('1')" style="padding: 10px; background: white; border: 1px solid var(--accent-gold); border-radius: 8px; color: #431407; font-weight: bold; cursor: pointer;">(1) 使い方</button>
                            <button onclick="window.botAction('2')" style="padding: 10px; background: white; border: 1px solid var(--accent-gold); border-radius: 8px; color: #431407; font-weight: bold; cursor: pointer;">(2) 会社ルール</button>
                            <button onclick="window.botAction('3')" style="padding: 10px; background: white; border: 1px solid var(--accent-gold); border-radius: 8px; color: #431407; font-weight: bold; cursor: pointer;">(3) 駐車場原本リスト</button>
                            <button onclick="window.botAction('4')" style="padding: 12px; background: var(--accent-gold); border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(217,119,6,0.3);">📮 不具合報告・改善要望</button>
                        </div>`);
                }
            }
        }
    };

        if (els['btn-close-bot']) els['btn-close-bot'].onclick = () => els['bot-container'].classList.add('hidden');
        if (els['btn-send-bot']) els['btn-send-bot'].onclick = () => {
            const input = els['bot-input'];
            const text = input.value.trim();
            if (!text) return;
            addMessage('user', text);
            input.value = '';

            const lowerText = text.toLowerCase();
            const normalizedText = lowerText.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
            
            if (normalizedText.includes('不具合') || normalizedText.includes('要望') || normalizedText === '4') {
                window.openReportModal();
                setTimeout(() => addMessage('bot', "不具合報告・要望フォームを開きました。ご協力ありがとうございます！"), 500);
                return;
            }

            const MANUAL = {
                "使い方": "はい、ご案内しますね。使い方はとってもシンプルですよ。\n1. 右下の「＋」ボタンから新しい書類（完了報告・丸産日報・月報）を作成できます。\n2. 作成したものは「下書き」に並びます。PDFにすると「完了」タブへお引越ししますよ。\n3. カレンダーから過去の書類を選んで「再編集」することもできますから、安心してくださいね。",
                "pdf": "PDFの作成ですね。カードの「PDF」ボタンからひとつずつ作れるほか、長押しでいくつか選んでから下の「まとめてPDF」を押すと、一冊の書類にまとめることもできますよ。",
                "削除": "書類の整理ですね。カードの「削除」ボタン、または長押しで選んでから「まとめて削除」が使えます。間違えて消さないように、確認のメッセージも出ますのでご安心ください。",
                "編集": "下書きのものはそのまま「編集」から直せます。一度完了したものは、カレンダーから選んで「再編集」ボタンを押すと、また下書きに戻って修正できるようになりますよ。",
                "検索": "画面の上の検索窓から、現場の名前や監督さんの名前で探せます。たくさんの記録の中から、すぐに見つけ出せますよ。",
                "会社ルール": "会社ルールの何について聞きたいですか？\n(1) 丸産（山田/佐藤監督の書き方）\n(2) 駐車場（原本が必要な会社）\n(3) 旭化成（担当者リスト）\n番号かキーワードで話しかけてみてくださいね。",
                "1": "丸産技研さんの大切なルールをお伝えしますね。\n・山田監督はフルネーム（正裕さん/拓実さん）で書き分けてくださいね。\n・佐藤監督は「ユタカ」さんか「ユウスケ」さんか、しっかり明記しましょう。\n・駐車場代は「材料費」の欄に記入する決まりになっていますよ。",
                "丸産": "丸産技研さんの大切なルールをお伝えしますね。\n・山田監督はフルネーム（正裕さん/拓実さん）で書き分けてくださいね。\n・佐藤監督は「ユタカ」さんか「ユウスケ」さんか、しっかり明記しましょう。\n・駐車場代は「材料費」の欄に記入する決まりになっていますよ。",
                "2": "駐車場の領収書についてですね。\n・原本が必要：埼玉美工、たまハウス、サートンホーム、東光建設、タカマツビルド、本橋工務店、サンキホーム、アイネックスの皆様です。\n・コピーでOK：OTO、ユウキ建設、フォンテ、AHC、旭化成の皆様です。\n原本は紛失に気をつけて、早めに事務の方へ届けてあげてくださいね。",
                "駐車場": "駐車場の領収書についてですね。\n・原本が必要：埼玉美工、たまハウス、サートンホーム、東光建設、タカマツビルド、本橋工務店、サンキホーム、アイネックスの皆様です。\n・コピーでOK：OTO、ユウキ建設、フォンテ、AHC、旭化成の皆様です。\n原本は紛失に気をつけて、早めに事務の方へ届けてあげてくださいね。",
                "3": "旭化成グループの担当者様リストですね。\n・神奈川：後平様、磯前様、栗林様、阿部様...\n・中央：近藤様、笠松様、中山様、川口様...\n詳細はPDFのマスターナレッジにも詳しく載っていますので、迷ったら確認してみてくださいね。",
                "旭化成": "旭化成グループの担当者様リストですね。\n・神奈川：後平様、磯前様、栗林様、阿部様...\n・中央：近藤様、笠松様、中山様、川口様...\n詳細はPDFのマスターナレッジにも詳しく載っていますので、迷ったら確認してみてくださいね。",
                "必須": "報告書の共通ルールをお伝えしますね。\n1. 今日中に必ず送信しましょう。\n2. 高速代は漏れなく記入してくださいね。\n3. 材料（アルテコなど）は具体的に書きましょう。\n4. アクシアさんの現場は、金額と人工が必須ですよ。\n5. 注文番号も忘れずに記入しましょうね。",
                "アクシア": "アクシアさんなどの現場ルールですね。注文書に金額が書いてある場合は、報告書の左下にもその金額を写してあげてください。右上の管理番号も忘れずに記入しましょうね。",
                "ユウキ": "ユウキ建設さんの現場では、邸名を必ずフルネームで記入する決まりですよ。略さずに丁寧に書きましょうね。",
                "シナネン": "シナネン（旧ミライフ）さんは、「シナネンアクシア」と「シナネン」を間違えないようにお気をつけくださいね。"
            };

            let found = false;
            for (let key in MANUAL) {
                const lowerKey = key.toLowerCase();
                // Match exactly the number if it's a numeric key, otherwise check includes
                if ((lowerText === lowerKey) || (lowerKey.length > 1 && lowerText.includes(lowerKey))) {
                    setTimeout(() => addMessage('bot', MANUAL[key]), 500);
                    found = true;
                    break;
                }
            }
            if (!found) {
                setTimeout(() => addMessage('bot', "お疲れ様です。使い方のことや、社内のルール（丸産、駐車場、旭化成など）についてお答えできますよ。キーワードでお尋ねくださいね。"), 500);
            }
        };
    }
}

window.botAction = (cmd) => {
    const input = els['bot-input'];
    if (input) { 
        input.value = cmd; 
        if (els['btn-send-bot']) els['btn-send-bot'].click(); 
    }
};

function addMessage(type, text) {
    const div = document.createElement('div'); 
    div.className = `message ${type}`; 
    // Convert newlines to <br> if not HTML
    const formattedText = text.includes('<') ? text : text.replace(/\n/g, '<br>');
    div.innerHTML = formattedText;
    if (els['bot-messages']) { 
        els['bot-messages'].appendChild(div); 
        els['bot-messages'].scrollTop = els['bot-messages'].scrollHeight; 
    }
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

// End of app-v35.js
