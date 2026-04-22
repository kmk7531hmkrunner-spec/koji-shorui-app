import { getAllProjects, saveProject, deleteProject, getProject, generateDraftName, set } from './src/storage.js';
import { resizeImage, adaptiveThreshold } from './src/image-utils.js';
import { generateSinglePdf, drawProjectToCanvas } from './src/pdf-engine.js';
import { getPdfConfig } from './src/config-manager.js';

console.log("Main script loading (Final Production Build)...");

// --- State & Elements ---
let currentTab = 'draft';
let currentProject = null;
let els = {}; 

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
        'btn-back', 'btn-bulk-pdf', 'page-title', 'type-modal', 'fab-bot', 
        'bot-container', 'btn-close-bot', 'bot-messages', 'bot-input', 'btn-send-bot',
        'document-preview-overlay', 'preview-canvas-container', 'btn-close-preview',
        'btn-preview-pdf-out', 'scanner-overlay', 'scanner-image', 'scanner-body',
        'btn-scanner-cancel', 'btn-scanner-done', 'btn-scanner-rotate', 'btn-scanner-filter',
        'editor-container'
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
        return;
    }

    els['project-list'].innerHTML = filtered.map(p => `
        <div class="project-card" onclick="editExistingProject('${p.id}')">
            <div class="project-card-header">
                <span class="project-type-tag ${p.type}">${p.type === 'geppo' ? '月報' : (p.type === 'marusan' ? '丸産報告書' : '完了報告書')}</span>
                <span class="project-date">${p.date || '-'}</span>
            </div>
            <h3 class="project-title">${p.displayTitle || '名称未設定'}</h3>
            <div class="project-card-footer">
                <span class="project-worker">👤 ${p.workerName || '担当者未設定'}</span>
                <div class="card-actions">
                    ${currentTab === 'draft' ? `<button class="btn btn-icon btn-pdf" onclick="event.stopPropagation(); generatePdf('${p.id}')" title="PDF出力">📄</button>` : ''}
                    <button class="btn btn-icon btn-delete" onclick="event.stopPropagation(); handleDeleteProject('${p.id}')" title="削除">🗑</button>
                </div>
            </div>
        </div>
    `).join('');
}

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

    if (els['project-list-view']) els['project-list-view'].style.display = 'none';
    if (els['form-view']) els['form-view'].style.display = 'block';
    if (els['btn-back']) els['btn-back'].style.display = 'block';
    
    if (els['page-title']) {
        els['page-title'].textContent = project ? '再編集' : (type === 'kanryo' ? '完了報告書 作成' : (type === 'marusan' ? '丸産技研報告書 作成' : '月報 作成'));
    }

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

    // Bind Form-Specific Events
    document.getElementById('btn-save-draft').onclick = handleSaveDraft;
    document.getElementById('btn-preview-doc').onclick = handleShowPreview;

    // Chip Listeners
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
        <div class="form-group highlight-box">
            <label class="label">📅 実施日付</label>
            <input type="date" id="form-date" value="${currentProject.date || ''}">
        </div>
        <div class="form-group">
            <label class="label">作業者名</label>
            <input type="text" id="form-worker" value="${currentProject.workerName || ''}" placeholder="あなたの名前">
        </div>
        <div class="form-group">
            <label class="label">応援者名</label>
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
            <label class="label">現場名 (詳細)</label>
            <input type="text" id="field-officeName" value="${fd.officeName || ''}" placeholder="建物名・階数など">
        </div>
        <div class="form-group">
            <label class="label">住所</label>
            <input type="text" id="field-address" value="${fd.address || ''}" placeholder="現場の住所">
        </div>
        <div class="form-group">
            <label class="label">駐車場代 / 高速代</label>
            <div class="grid-2-action">
                <div class="input-with-action">
                    <input type="number" id="field-parkingFee" value="${fd.parkingFee || ''}" placeholder="駐車場代">
                    <button type="button" class="btn btn-sm btn-accent" id="btn-scan-receipt">📸 スキャン</button>
                </div>
                <input type="number" id="field-highwayFee" value="${fd.highwayFee || ''}" placeholder="高速代">
            </div>
        </div>
        <div class="form-group">
            <label class="label">工事内容</label>
            <textarea id="field-content" rows="6" placeholder="作業内容を詳しく入力">${fd.content || ''}</textarea>
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
    const allInputs = document.querySelectorAll('[id^="field-"], [id^="form-"]');
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
    
    location.reload(); // Simple way to reset state and show list
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
            await generateSinglePdf(currentProject);
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
            if (confirm('戻りますか？')) location.href = '/';
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
        renderForm(); // Refresh preview
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
    if (confirm('削除しますか？')) {
        await deleteProject(id);
        await renderList();
    }
}

async function generatePdf(id) {
    const p = await getProject(id);
    if (p) await generateSinglePdf(p);
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
    if (currentProject && currentProject.receiptImage) {
        // Since we have inline scanner now, maybe just trigger it again or similar. 
        // For now, let's just trigger a click on the scan button if needed.
        const btn = document.getElementById('btn-scan-receipt');
        if (btn) btn.click();
    }
};

window.generatePdf = generatePdf;
window.handleDeleteProject = handleDeleteProject;
window.editExistingProject = editExistingProject;
