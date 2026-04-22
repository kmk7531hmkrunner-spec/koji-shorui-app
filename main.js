import { getAllProjects, saveProject, deleteProject, getProject, generateDraftName, set } from './src/storage.js';
import { resizeImage, adaptiveThreshold } from './src/image-utils.js';
import { generateSinglePdf, generateBulkPdf, drawProjectToCanvas } from './src/pdf-engine.js';
import { getPdfConfig } from './src/config-manager.js';

console.log("Main script loading (Professional Workflow Build)...");

// --- State ---
let currentTab = 'draft';
let currentProject = null;
let els = {}; 
let isSelectionMode = false;
let selectedIds = new Set();
let longPressTimer = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        setupElements();
        await init();
    } catch (err) {
        console.error("Critical: Init failed", err);
        showErrorOverlay(err);
    }
});

function setupElements() {
    const ids = [
        'project-list-view', 'form-view', 'project-list', 'tabs', 'fab-plus', 
        'btn-back', 'page-title', 'type-modal', 'fab-bot', 
        'bot-container', 'btn-close-bot', 'bot-messages', 'bot-input', 'btn-send-bot',
        'document-preview-overlay', 'preview-canvas-container', 'btn-close-preview',
        'btn-preview-pdf-out', 'scanner-overlay', 'scanner-image', 
        'btn-scanner-cancel', 'btn-scanner-done', 'btn-scanner-rotate', 'btn-scanner-filter',
        'editor-container', 'project-detail-view', 'detail-summary-text', 'bulk-action-bar',
        'selected-count', 'btn-bulk-pdf-exec', 'btn-cancel-select', 'btn-select-mode'
    ];
    ids.forEach(id => {
        els[id] = document.getElementById(id);
    });
    els.tabsList = document.querySelectorAll('.tab');
}

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (projectId) {
        const p = await getProject(projectId);
        if (p) {
            currentProject = p;
            showForm(p.type, p);
            bindGlobalEvents();
            return;
        }
    }

    await renderList();
    bindGlobalEvents();
    bindBotEvents();
}

// --- Core UI Functions ---

async function renderList() {
    if (!els['project-list']) return;
    els['project-list'].innerHTML = '<div class="loading">読み込み中...</div>';

    const projects = await getAllProjects();
    const filtered = projects.filter(p => p.status === currentTab);

    if (filtered.length === 0) {
        els['project-list'].innerHTML = `<div class="empty-state">
            <div class="empty-icon">📁</div>
            <p>${currentTab === 'draft' ? '下書き中の書類はありません' : '完了済みの書類はありません'}</p>
        </div>`;
        updateSelectionUI();
        return;
    }

    els['project-list'].innerHTML = filtered.map(p => {
        const fd = p.formData || {};
        const dateStr = p.date ? p.date.split('-').slice(1).join('/') : '--/--'; // MM/DD
        const isSelected = selectedIds.has(p.id);
        
        return `
            <div class="project-card ${isSelectionMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" 
                 data-id="${p.id}"
                 onmousedown="handleMouseDown('${p.id}')"
                 onmouseup="handleMouseUp('${p.id}')"
                 ontouchstart="handleMouseDown('${p.id}')"
                 ontouchend="handleMouseUp('${p.id}')"
                 onclick="handleProjectTap('${p.id}')">
                <div class="project-card-header">
                    <span class="project-type-tag ${p.type}">${p.type === 'geppo' ? '月報' : (p.type === 'marusan' ? '丸産報告書' : '完了報告書')}</span>
                    <span class="project-date">📅 ${dateStr}</span>
                </div>
                <div class="project-main-info">
                    <div class="info-row"><strong>会社名:</strong> ${fd.companyName || '(未入力)'}</div>
                    <div class="info-row"><strong>監督名:</strong> ${fd.supervisorName || '(未入力)'}</div>
                </div>
                <div class="project-card-footer">
                    <span class="project-worker">👤 ${p.workerName || '担当者未設定'}</span>
                </div>
            </div>
        `;
    }).join('');

    updateSelectionUI();
}

// Selection Mode Logic
window.handleMouseDown = (id) => {
    if (isSelectionMode) return;
    longPressTimer = setTimeout(() => {
        enterSelectionMode(id);
    }, 800);
};

window.handleMouseUp = (id) => {
    clearTimeout(longPressTimer);
};

window.handleProjectTap = (id) => {
    if (isSelectionMode) {
        toggleSelection(id);
    } else {
        showProjectDetail(id);
    }
};

function enterSelectionMode(firstId) {
    isSelectionMode = true;
    selectedIds.add(firstId);
    renderList();
}

function toggleSelection(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    if (selectedIds.size === 0) {
        exitSelectionMode();
    } else {
        renderList();
    }
}

function exitSelectionMode() {
    isSelectionMode = false;
    selectedIds.clear();
    renderList();
}

function updateSelectionUI() {
    if (isSelectionMode) {
        els['bulk-action-bar'].classList.remove('hidden');
        els['selected-count'].textContent = `${selectedIds.size} 件選択中`;
        els['fab-plus'].classList.add('hidden');
    } else {
        els['bulk-action-bar'].classList.add('hidden');
        els['fab-plus'].classList.remove('hidden');
    }
}

// --- Detail View Logic ---

async function showProjectDetail(id) {
    const p = await getProject(id);
    if (!p) return;
    
    currentProject = p;
    const dateStr = p.date || '未設定';
    const fd = p.formData || {};
    
    els['detail-title'].textContent = p.type === 'kanryo' ? '完了報告書' : (p.type === 'marusan' ? '丸産報告書' : '月報');
    els['detail-summary-text'].innerHTML = `
        <div><strong>日付:</strong> ${dateStr}</div>
        <div><strong>会社名:</strong> ${fd.companyName || '-'}</div>
        <div><strong>監督名:</strong> ${fd.supervisorName || '-'}</div>
        <div><strong>作業者:</strong> ${p.workerName || '-'}</div>
    `;
    
    els['project-detail-view'].classList.remove('hidden');
    
    // Bind Detail Actions
    document.getElementById('btn-detail-pdf').onclick = () => {
        els['project-detail-view'].classList.add('hidden');
        generatePdf(id);
    };
    document.getElementById('btn-detail-edit').onclick = () => {
        els['project-detail-view'].classList.add('hidden');
        showForm(p.type, p);
    };
    document.getElementById('btn-detail-delete').onclick = () => {
        if (confirm('本当にこの書類を削除しますか？\nこの操作は取り消せません。')) {
            els['project-detail-view'].classList.add('hidden');
            handleDeleteProject(id);
        }
    };
    document.getElementById('btn-close-detail').onclick = () => {
        els['project-detail-view'].classList.add('hidden');
    };
}

// --- Form View Logic ---

function showForm(type, project = null) {
    if (els['type-modal']) els['type-modal'].style.display = 'none';
    
    currentProject = project || {
        id: `project_${Date.now()}`,
        status: 'draft',
        type: type,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        companyName: '',
        workerName: '',
        date: new Date().toISOString().split('T')[0],
        formData: { supportName: [] },
        receiptImage: null
    };

    els['project-list-view'].classList.add('hidden');
    els['form-view'].classList.remove('hidden');
    
    els['form-page-title'].textContent = project ? '再編集' : '新規作成';

    renderForm();
}

function renderForm() {
    const container = els['editor-container'];
    if (!container) return;
    
    container.innerHTML = `
        <div class="form-container">
            <div id="dynamic-form-fields">
                ${currentProject.type === 'geppo' ? renderGeppoFields() : (currentProject.type === 'marusan' ? renderMarusanFields() : renderKanryoFields())}
            </div>
            <div class="form-actions-bottom">
                <button class="btn btn-outline" id="btn-preview-doc">プレビューを確認</button>
                <button class="btn btn-primary" id="btn-save-draft">下書き保存</button>
            </div>
        </div>
    `;

    document.getElementById('btn-save-draft').onclick = handleSaveDraft;
    document.getElementById('btn-preview-doc').onclick = handleShowPreview;

    // Attach Chip Listeners
    const chipGroup = document.getElementById('support-chip-group');
    if (chipGroup) {
        chipGroup.onclick = (e) => {
            const btn = e.target.closest('.chip-btn');
            if (!btn) return;
            const name = btn.dataset.name;
            if (!currentProject.formData.supportName) currentProject.formData.supportName = [];
            const idx = currentProject.formData.supportName.indexOf(name);
            if (idx > -1) {
                btn.classList.remove('active');
                currentProject.formData.supportName.splice(idx, 1);
            } else {
                btn.classList.add('active');
                currentProject.formData.supportName.push(name);
            }
        };
    }

    // Scanner Trigger
    const btnScan = document.getElementById('btn-scan-receipt');
    if (btnScan) {
        btnScan.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment';
            input.onchange = (e) => startScanner(e.target.files[0]);
            input.click();
        };
    }
}

// --- Field Renderers ---

function renderKanryoFields() {
    const fd = currentProject.formData || {};
    return `
        <div class="form-section">
            <div class="form-group highlight-box">
                <label class="label">📅 実施日付</label>
                <input type="date" id="form-date" value="${currentProject.date || ''}">
            </div>
            <div class="form-group">
                <label class="label">会社名</label>
                <input type="text" id="field-companyName" value="${fd.companyName || ''}" placeholder="会社名">
            </div>
            <div class="form-group">
                <label class="label">注文番号</label>
                <input type="text" id="field-orderNumber" value="${fd.orderNumber || ''}" placeholder="注文番号">
            </div>
            <div class="form-group">
                <label class="label">作業者</label>
                <input type="text" id="form-worker" value="${currentProject.workerName || ''}" placeholder="作業者の名前">
            </div>
            <div class="form-group">
                <label class="label">応援者</label>
                <div id="support-chip-group" class="chip-group">
                    ${['湧', '菊', '須', '田', '大', '下', '巻', '木', 'タン', '富'].map(name => {
                        const isActive = (fd.supportName || []).includes(name);
                        return `<button type="button" class="chip-btn ${isActive ? 'active' : ''}" data-name="${name}">${name}</button>`;
                    }).join('')}
                </div>
            </div>
            <div class="form-group">
                <label class="label">現場名</label>
                <input type="text" id="field-siteName" value="${fd.siteName || ''}" placeholder="現場の名称">
            </div>
            <div class="form-group">
                <label class="label">現場名(詳細)</label>
                <input type="text" id="field-officeName" value="${fd.officeName || ''}" placeholder="建物名・階数など">
            </div>
            <div class="form-group">
                <label class="label">監督名</label>
                <input type="text" id="field-supervisorName" value="${fd.supervisorName || ''}" placeholder="監督名">
            </div>
            <div class="form-group">
                <label class="label">住所</label>
                <input type="text" id="field-address" value="${fd.address || ''}" placeholder="現場の住所">
            </div>
        </div>

        <div class="form-section">
            <h3 class="section-title">進捗・記録</h3>
            <div class="form-group">
                <label class="label">訪問回数</label>
                <select id="field-visitCount">
                    <option value="1" ${fd.visitCount === '1' ? 'selected' : ''}>1回目</option>
                    <option value="2" ${fd.visitCount === '2' ? 'selected' : ''}>2回目</option>
                    <option value="3" ${fd.visitCount === '3' ? 'selected' : ''}>3回目</option>
                </select>
            </div>
            <div class="form-group">
                <label class="label">状況</label>
                <select id="field-completionStatus">
                    <option value="done" ${fd.completionStatus === 'done' ? 'selected' : ''}>完了</option>
                    <option value="notYet" ${fd.completionStatus === 'notYet' ? 'selected' : ''}>未</option>
                </select>
            </div>
            <div class="form-group">
                <label class="label">駐車場代</label>
                <div class="flex-row" style="display:flex; gap:8px;">
                    <input type="number" id="field-parkingFee" value="${fd.parkingFee || ''}" placeholder="駐車場代" style="flex:1;">
                    <button type="button" class="btn btn-sm btn-accent" id="btn-scan-receipt">📸 スキャン</button>
                </div>
            </div>
            <div class="form-group">
                <label class="label">高速代</label>
                <input type="number" id="field-highwayFee" value="${fd.highwayFee || ''}" placeholder="高速代">
            </div>
            <div class="form-group">
                <label class="label">材料代</label>
                <input type="number" id="field-materialFee" value="${fd.materialFee || ''}" placeholder="材料代">
            </div>
            <div class="form-group">
                <label class="label">合計額</label>
                <input type="number" id="field-totalAmount" value="${fd.totalAmount || ''}" placeholder="合計額">
            </div>
            <div class="form-group">
                <label class="label">消費税額</label>
                <input type="number" id="field-taxAmount" value="${fd.taxAmount || ''}" placeholder="消費税額">
            </div>
            <div class="form-group">
                <label class="label">工事内容</label>
                <textarea id="field-content" rows="4">${fd.content || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="label">日報</label>
                <textarea id="field-dailyReport" rows="4">${fd.dailyReport || ''}</textarea>
            </div>
        </div>

        <div class="form-group photo-upload-box">
            <label class="label">📸 領収書の確認</label>
            <div id="receipt-preview" class="receipt-preview-container" onclick="handleReEditReceipt()">
                ${currentProject.receiptImage ? `<img src="${currentProject.receiptImage}">` : '<div class="placeholder">スキャンした領収書がここに表示されます</div>'}
            </div>
        </div>
    `;
}

function renderMarusanFields() {
    const fd = currentProject.formData || {};
    return `
        <div class="form-group highlight-box">
            <label class="label">📅 実施日付</label>
            <input type="date" id="form-date" value="${currentProject.date || ''}">
        </div>
        <div class="form-group">
            <label class="label">現場名</label>
            <input type="text" id="field-siteName" value="${fd.siteName || ''}">
        </div>
        <div class="form-group">
            <label class="label">工事内容</label>
            <textarea id="field-content" rows="5">${fd.content || ''}</textarea>
        </div>
        <div class="form-group">
            <label class="label">作業員</label>
            <div class="grid-2">
                <input type="text" id="field-worker1" placeholder="作業員1" value="${fd.worker1 || ''}">
                <input type="text" id="field-worker2" placeholder="作業員2" value="${fd.worker2 || ''}">
            </div>
        </div>
    `;
}

function renderGeppoFields() {
    const fd = currentProject.formData || {};
    return `
        <div class="form-group highlight-box">
            <label class="label">📅 対象年月</label>
            <input type="date" id="form-date" value="${currentProject.date || ''}">
        </div>
        <div class="form-group">
            <label class="label">氏名</label>
            <input type="text" id="form-worker" value="${currentProject.workerName || ''}">
        </div>
        <div class="form-group">
            <label class="label">今月のまとめ</label>
            <textarea id="field-summary" rows="10">${fd.summary || ''}</textarea>
        </div>
    `;
}

// --- Event Handlers & Sync ---

function syncDataToProject() {
    if (!currentProject) return;

    const dateEl = document.getElementById('form-date');
    const workerEl = document.getElementById('form-worker');
    if (dateEl) currentProject.date = dateEl.value;
    if (workerEl) currentProject.workerName = workerEl.value;

    const fd = currentProject.formData || {};
    const allInputs = document.querySelectorAll('[id^="field-"], [id^="form-"], select[id^="field-"]');
    allInputs.forEach(el => {
        if (el.id === 'form-date' || el.id === 'form-worker') return;
        const key = el.id.replace('field-', '').replace('form-', '');
        fd[key] = el.value;
    });
    currentProject.formData = fd;
}

async function handleSaveDraft() {
    syncDataToProject();
    if (!currentProject.date) return alert('日付を入力してください');
    
    currentProject.displayTitle = generateDraftName(currentProject.date, currentProject.workerName);
    await saveProject(currentProject);
    alert('下書きを保存しました');
    
    // Switch back to list
    els['form-view'].classList.add('hidden');
    els['project-list-view'].classList.remove('hidden');
    renderList();
}

async function handleShowPreview() {
    const overlay = els['document-preview-overlay'];
    const container = els['preview-canvas-container'];
    if (!overlay || !container) return;

    syncDataToProject();
    container.innerHTML = '<div class="loading-text">プレビューを生成中...</div>';
    overlay.classList.remove('hidden');

    try {
        let bgUrl = '';
        if (currentProject.type === 'kanryo') bgUrl = './images/kanrryoutemp.jpg';
        else if (currentProject.type === 'marusan') bgUrl = './images/marusan_report.jpg';
        else bgUrl = './images/geppo.jpg';

        const config = await getPdfConfig();
        const canvas = await drawProjectToCanvas(currentProject, bgUrl, config);
        container.innerHTML = '';
        container.appendChild(canvas);

        els['btn-preview-pdf-out'].onclick = async () => {
            overlay.classList.add('hidden');
            await generateSinglePdf(currentProject, bgUrl, config);
        };
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="error-text">プレビュー生成に失敗しました</div>';
    }
    
    els['btn-close-preview'].onclick = () => overlay.classList.add('hidden');
}

function bindGlobalEvents() {
    if (els['fab-plus']) els['fab-plus'].onclick = () => els['type-modal'].style.display = 'flex';
    
    const closeModBtn = document.getElementById('btn-close-modal');
    if (closeModBtn) closeModBtn.onclick = () => els['type-modal'].style.display = 'none';

    ['kanryo', 'marusan', 'geppo'].forEach(type => {
        const btn = document.getElementById(`btn-new-${type}`);
        if (btn) btn.onclick = () => showForm(type);
    });

    if (els['btn-back']) {
        els['btn-back'].onclick = () => {
            if (confirm('戻りますか？')) {
                els['form-view'].classList.add('hidden');
                els['project-list-view'].classList.remove('hidden');
                renderList();
            }
        };
    }

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

    // Selection Events
    if (els['btn-select-mode']) els['btn-select-mode'].onclick = () => {
        isSelectionMode = !isSelectionMode;
        if (!isSelectionMode) selectedIds.clear();
        renderList();
    };

    if (els['btn-cancel-select']) els['btn-cancel-select'].onclick = () => exitSelectionMode();

    if (els['btn-bulk-pdf-exec']) els['btn-bulk-pdf-exec'].onclick = handleBulkPdf;
}

async function handleBulkPdf() {
    if (selectedIds.size === 0) return;
    
    try {
        alert(`${selectedIds.size} 件の一括PDF生成を開始します...`);
        const projects = [];
        for (const id of selectedIds) {
            const p = await getProject(id);
            if (p) projects.push(p);
        }

        const config = await getPdfConfig();
        const templates = {
            'kanryo': './images/kanrryoutemp.jpg',
            'marusan': './images/marusan_report.jpg',
            'geppo': './images/geppo.jpg'
        };

        const doc = await generateBulkPdf(projects, templates, config);
        doc.save(`bulk_export_${Date.now()}.pdf`);
        
        exitSelectionMode();
        alert('一括PDFの書き出しが完了しました');
    } catch (err) {
        console.error(err);
        alert('一括生成に失敗しました');
    }
}

// --- Scanner Logic ---
let cropper = null;
let isFiltered = false;

async function startScanner(file) {
    if (!file) return;
    const overlay = els['scanner-overlay'];
    const imgEl = els['scanner-image'];
    
    isFiltered = false;
    if (cropper) cropper.destroy();

    const reader = new FileReader();
    reader.onload = (e) => {
        imgEl.src = e.target.result;
        overlay.classList.remove('hidden');
        cropper = new Cropper(imgEl, { viewMode: 1, autoCropArea: 0.8 });
    };
    reader.readAsDataURL(file);

    els['btn-scanner-cancel'].onclick = () => { overlay.classList.add('hidden'); if(cropper) cropper.destroy(); };
    els['btn-scanner-rotate'].onclick = () => cropper && cropper.rotate(90);
    els['btn-scanner-filter'].onclick = () => {
        const canvas = cropper.getCroppedCanvas();
        const ctx = canvas.getContext('2d');
        const processed = adaptiveThreshold(ctx.getImageData(0,0,canvas.width,canvas.height));
        ctx.putImageData(processed, 0, 0);
        cropper.replace(canvas.toDataURL('image/jpeg', 0.8));
        isFiltered = true;
    };
    els['btn-scanner-done'].onclick = async () => {
        const canvas = cropper.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200 });
        if (!isFiltered) {
            const ctx = canvas.getContext('2d');
            const processed = adaptiveThreshold(ctx.getImageData(0,0,canvas.width,canvas.height));
            ctx.putImageData(processed, 0, 0);
        }
        currentProject.receiptImage = canvas.toDataURL('image/jpeg', 0.8);
        renderForm(); 
        overlay.classList.add('hidden');
        cropper.destroy();
        await saveProject(currentProject);
    };
}

// --- Helper Functions ---
async function editExistingProject(id) {
    const p = await getProject(id);
    if (p) showForm(p.type, p);
}

async function handleDeleteProject(id) {
    await deleteProject(id);
    await renderList();
}

async function generatePdf(id) {
    const p = await getProject(id);
    if (!p) return;
    
    let bgUrl = '';
    if (p.type === 'kanryo') bgUrl = './images/kanrryoutemp.jpg';
    else if (p.type === 'marusan') bgUrl = './images/marusan_report.jpg';
    else bgUrl = './images/geppo.jpg';
    
    const config = await getPdfConfig();
    const doc = await generateSinglePdf(p, bgUrl, config);
    doc.save(`${p.displayTitle || 'document'}.pdf`);
}

function bindBotEvents() {
    if (els['fab-bot']) els['fab-bot'].onclick = () => els['bot-container'].classList.toggle('hidden');
    if (els['btn-close-bot']) els['btn-close-bot'].onclick = () => els['bot-container'].classList.add('hidden');
    if (els['btn-send-bot']) els['btn-send-bot'].onclick = handleBotSend;
}

function handleBotSend() {
    const msg = els['bot-input'].value.trim();
    if (!msg) return;
    addMessage('user', msg);
    els['bot-input'].value = '';
    setTimeout(() => addMessage('bot', '確認いたします。'), 500);
}

function addMessage(type, text) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.textContent = text;
    if (els['bot-messages']) {
        els['bot-messages'].appendChild(div);
        els['bot-messages'].scrollTop = els['bot-messages'].scrollHeight;
    }
}

function showErrorOverlay(err) {
    document.body.insertAdjacentHTML('afterbegin', `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#111;color:#ff4444;padding:30px;z-index:9999;overflow:auto;">
            <h2>⚠️ 致命的エラー</h2>
            <pre>${err.stack}</pre>
            <button onclick="location.reload()">再試行</button>
        </div>
    `);
}

window.handleReEditReceipt = function() {
    const btn = document.getElementById('btn-scan-receipt');
    if (btn) btn.click();
};

window.generatePdf = generatePdf;
window.handleDeleteProject = handleDeleteProject;
window.editExistingProject = editExistingProject;
