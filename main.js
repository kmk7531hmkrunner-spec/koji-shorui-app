import { getAllProjects, saveProject, deleteProject, getProject, generateDraftName, generatePdfName, set } from './src/storage.js';
import { CompanyRules } from './src/rules.js';
import { resizeImage, adaptiveThreshold } from './src/image-utils.js';
import { generateSinglePdf, generateBulkPdf, drawProjectToCanvas } from './src/pdf-engine.js';
import { getPdfConfig, savePdfConfig } from './src/config-manager.js';

console.log("Main script loading...");

// State
let currentTab = 'draft';
let currentProject = null;
let els = {}; // Centralized DOM elements

document.addEventListener('DOMContentLoaded', async () => {
    console.log("App initializing (Production Mode)...");
    try {
        setupElements();
        await init();
    } catch (err) {
        console.error("Critical: Init failed", err);
        // Display FULL error detail to identify the culprit
        document.body.insertAdjacentHTML('afterbegin', `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#111;color:#ff4444;padding:30px;z-index:9999;font-family:monospace;overflow:auto;line-height:1.4;">
                <h2 style="color:white;margin-top:0;">⚠️ 致命的エラーが発生しました</h2>
                <p style="background:#222;padding:10px;border-left:4px solid red;">${err.message}</p>
                <pre style="font-size:12px;color:#aaa;">${err.stack}</pre>
                <hr style="border-color:#333;">
                <button onclick="location.reload()" style="background:#444;color:white;border:none;padding:10px 20px;border-radius:5px;">再読み込み</button>
                <button onclick="indexedDB.deleteDatabase('keyval-store'); location.reload();" style="background:#822;color:white;border:none;padding:10px 20px;border-radius:5px;margin-left:10px;">ストレージをリセット</button>
            </div>
        `);
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
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (projectId) {
        const p = await getProject(projectId);
        if (p) {
            currentProject = p;
            showForm(p.type, p);
            bindEvents();
            return;
        }
    }

    await renderList();
    bindEvents();
    bindBotEvents();
  } catch (err) {
    throw err;
  }
}

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

function bindEvents() {
  if (els['fab-plus']) els['fab-plus'].onclick = () => { els['type-modal'].style.display = 'flex'; };

  const closeBtn = document.getElementById('btn-close-modal');
  if (closeBtn) closeBtn.onclick = () => { els['type-modal'].style.display = 'none'; };

  const btnNewKanryo = document.getElementById('btn-new-kanryo');
  const btnNewMarusan = document.getElementById('btn-new-marusan');
  const btnNewGeppo = document.getElementById('btn-new-geppo');

  if (btnNewKanryo) btnNewKanryo.onclick = () => showForm('kanryo');
  if (btnNewMarusan) btnNewMarusan.onclick = () => showForm('marusan');
  if (btnNewGeppo) btnNewGeppo.onclick = () => showForm('geppo');

  if (els['btn-back']) {
      els['btn-back'].onclick = () => {
        if (confirm('保存していない変更は破棄されます。戻りますか？')) {
          els['form-view'].style.display = 'none';
          els['project-list-view'].style.display = 'block';
          els['page-title'].textContent = 'プロジェクト一覧';
          els['btn-back'].style.display = 'none';
          els['btn-bulk-pdf'].style.display = 'none';
          currentProject = null;
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
    formData: {
      supportName: []
    },
    receiptImage: null
  };

  if (els['project-list-view']) els['project-list-view'].style.display = 'none';
  if (els['form-view']) els['form-view'].style.display = 'block';
  if (els['btn-back']) els['btn-back'].style.display = 'block';
  
  if (project) {
      if (els['page-title']) els['page-title'].textContent = '再編集';
  } else {
      if (els['page-title']) els['page-title'].textContent = type === 'kanryo' ? '完了報告書 作成' : (type === 'marusan' ? '丸産技研報告書 作成' : '月報 作成');
  }

  renderForm();
}

function renderForm() {
  const isGeppo = currentProject.type === 'geppo';
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

  const receiptInput = document.getElementById('field-receipt');
  if (receiptInput) {
    receiptInput.addEventListener('change', handleReceiptUpload);
  }

  document.getElementById('btn-save-draft').onclick = handleSaveDraft;
  document.getElementById('btn-preview-doc').onclick = handleShowPreview;

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

  // Attach Chip Listeners for support names
  const chipGroup = document.getElementById('support-chip-group');
  if (chipGroup) {
      chipGroup.addEventListener('click', (e) => {
          const btn = e.target.closest('.chip-btn');
          if (!btn) return;
          const name = btn.dataset.name;
          if (!currentProject.formData.supportName) currentProject.formData.supportName = [];
          const index = currentProject.formData.supportName.indexOf(name);
          if (index > -1) {
              btn.classList.remove('active');
              currentProject.formData.supportName.splice(index, 1);
          } else {
              btn.classList.add('active');
              currentProject.formData.supportName.push(name);
          }
      });
  }

  syncDataToProject();
}

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
      <input type="text" id="field-siteName" value="${fd.siteName || ''}">
    </div>
    <div class="form-group photo-upload-box">
      <label class="label">📸 領収書の撮影・スキャン</label>
      <input type="file" id="field-receipt" accept="image/*" capture="environment">
      <div id="receipt-preview" class="receipt-preview-container" onclick="handleReEditReceipt()">
        ${currentProject.receiptImage ? `<img src="${currentProject.receiptImage}">` : '<div class="placeholder">タップして撮影・選択</div>'}
      </div>
    </div>
    <div class="form-group">
        <label class="label">工事内容 (10行程度)</label>
        <textarea id="field-content" rows="6">${fd.content || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="label">現場名 (詳細)</label>
      <input type="text" id="field-officeName" value="${fd.officeName || ''}">
    </div>
    <div class="form-group">
      <label class="label">住所</label>
      <input type="text" id="field-address" value="${fd.address || ''}">
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
    <div class="form-group photo-upload-box">
      <label class="label">📸 領収書の撮影・スキャン</label>
      <input type="file" id="field-receipt" accept="image/*" capture="environment">
      <div id="receipt-preview" class="receipt-preview-container" onclick="handleReEditReceipt()">
        ${currentProject.receiptImage ? `<img src="${currentProject.receiptImage}">` : '<div class="placeholder">タップして撮影・選択</div>'}
      </div>
    </div>
    <div class="form-group">
        <label class="label">作業内容</label>
        <textarea id="field-content" rows="4">${fd.content || ''}</textarea>
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
        <textarea id="field-summary" rows="8">${currentProject.formData.summary || ''}</textarea>
    </div>
  `;
}

async function handleReceiptUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    syncDataToProject();
    await saveProject(currentProject);

    const reader = new FileReader();
    reader.onload = async (event) => {
        const previewDiv = document.getElementById('receipt-preview');
        if (previewDiv) previewDiv.innerHTML = '<div class="loading-overlay">エディタを起動中...</div>';

        // Store RAW image for the editor
        await set('temp_receipt_image', event.target.result);

        // Redirect to standalone editor
        window.location.href = `receipt-editor.html?id=${currentProject.id}`;
    };
    reader.readAsDataURL(file);
}

window.handleReEditReceipt = function() {
    if (currentProject && currentProject.receiptImage) {
        window.location.href = `receipt-editor.html?id=${currentProject.id}`;
    }
};

function syncDataToProject() {
    if (!currentProject) return;
    const dateEl = document.getElementById('form-date');
    const workerEl = document.getElementById('form-worker');
    if (dateEl) currentProject.date = dateEl.value;
    if (workerEl) currentProject.workerName = workerEl.value;
    
    if (currentProject.type === 'geppo') {
        const summaryEl = document.getElementById('field-summary');
        if (summaryEl) currentProject.formData.summary = summaryEl.value;
    } else {
        const fields = [
          'officeName', 'supervisorName', 'orderNumber', 'address',
          'visitCount', 'completionStatus',
          'parkingFee', 'highwayFee', 'materialFee', 'totalAmount', 'taxAmount',
          'content', 'dailyReport', 'siteName', 'startTime', 'endTime',
          'worker1', 'worker2', 'worker3', 'worker4', 'worker5', 'worker6'
        ];
        fields.forEach(fid => {
          const el = document.getElementById(`field-${fid}`);
          if (el) currentProject.formData[fid] = el.value;
        });
    }
}

async function handleSaveDraft() {
  syncDataToProject();

  if (!currentProject.date) {
    alert('日付を入力してください');
    return;
  }

  currentProject.displayTitle = generateDraftName(currentProject.date, currentProject.workerName);
  
  await saveProject(currentProject);
  alert('下書きを保存しました');
  
  if (els['form-view']) els['form-view'].style.display = 'none';
  if (els['project-list-view']) els['project-list-view'].style.display = 'block';
  if (els['btn-back']) els['btn-back'].style.display = 'none';
  renderList();
}

async function handleShowPreview() {
    const overlay = els['document-preview-overlay'];
    const container = els['preview-canvas-container'];
    const closeBtn = els['btn-close-preview'];
    const pdfBtn = els['btn-preview-pdf-out'];
    
    if (!overlay || !container) return;

    syncDataToProject();
    
    container.innerHTML = '<div class="loading-text">プレビューを生成中...</div>';
    overlay.classList.remove('hidden');
    
    try {
        let bgUrl = '';
        if (currentProject.type === 'kanryo') bgUrl = '/images/kanrryoutemp.jpg';
        else if (currentProject.type === 'marusan') bgUrl = '/images/marusan_report.jpg';
        else bgUrl = '/images/geppo.jpg';
        
        const config = await getPdfConfig();
        const canvas = await drawProjectToCanvas(currentProject, bgUrl, config);
        
        container.innerHTML = '';
        container.appendChild(canvas);
        
        // Link the PDF button in preview to the actual generator
        pdfBtn.onclick = async () => {
            overlay.classList.add('hidden');
            await generatePdf(currentProject.id);
        };
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="error-text">プレビュー生成に失敗しました</div>';
    }
    
    closeBtn.onclick = () => overlay.classList.add('hidden');
}

async function editExistingProject(id) {
  const p = await getProject(id);
  if (p) {
    showForm(p.type, p);
  }
}

async function handleDeleteProject(id) {
  if (confirm('このプロジェクトを削除しますか？')) {
    await deleteProject(id);
    renderList();
  }
}

async function generatePdf(id) {
  const p = await getProject(id);
  if (!p) return;
  
  try {
      alert('PDF生成を開始します...');
      await generateSinglePdf(p);
  } catch (err) {
      console.error(err);
      alert('PDF生成に失敗しました');
  }
}

// Bot logic
function bindBotEvents() {
  if (els['fab-bot']) els['fab-bot'].onclick = () => els['bot-container'].classList.toggle('hidden');
  if (els['btn-close-bot']) els['btn-close-bot'].onclick = () => els['bot-container'].classList.add('hidden');
  if (els['btn-send-bot']) els['btn-send-bot'].onclick = handleBotSend;
  if (els['bot-input']) els['bot-input'].onkeypress = (e) => { if (e.key === 'Enter') handleBotSend(); };
}

function handleBotSend() {
  const msg = els['bot-input'].value.trim();
  if (!msg) return;
  
  addMessage('user', msg);
  els['bot-input'].value = '';
  
  setTimeout(() => {
    addMessage('bot', '担当者が内容を確認いたします。しばらくお待ちください。');
  }, 500);
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

// --- Document Scanner Logic (CamScanner Style) ---
let cropper = null;
let isFiltered = false;

async function startScanner(file) {
    if (!file) return;
    
    const overlay = els['scanner-overlay'];
    const imgEl = els['scanner-image'];
    
    if (!overlay || !imgEl) return;
    
    // Reset state
    isFiltered = false;
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        imgEl.src = e.target.result;
        overlay.classList.remove('hidden');
        
        // Initialize Cropper
        cropper = new Cropper(imgEl, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    };
    reader.readAsDataURL(file);

    // Bind Scanner Actions
    document.getElementById('btn-scanner-cancel').onclick = () => {
        overlay.classList.add('hidden');
        if (cropper) cropper.destroy();
    };

    document.getElementById('btn-scanner-rotate').onclick = () => {
        if (cropper) cropper.rotate(90);
    };

    document.getElementById('btn-scanner-filter').onclick = () => {
        const canvas = cropper.getCroppedCanvas();
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Apply our pro adaptive threshold
        const processed = adaptiveThreshold(imageData);
        ctx.putImageData(processed, 0, 0);
        
        // Update cropper image with filtered result
        const filteredUrl = canvas.toDataURL('image/jpeg', 0.8);
        cropper.replace(filteredUrl);
        isFiltered = true;
    };

    document.getElementById('btn-scanner-done').onclick = async () => {
        if (!cropper) return;
        
        const canvas = cropper.getCroppedCanvas({
            maxWidth: 1200,
            maxHeight: 1200
        });
        
        // Apply filter if not yet applied
        if (!isFiltered) {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const processed = adaptiveThreshold(imageData);
            ctx.putImageData(processed, 0, 0);
        }

        const finalDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Update Project & UI
        currentProject.receiptImage = finalDataUrl;
        const previewDiv = document.getElementById('receipt-preview');
        if (previewDiv) {
            previewDiv.innerHTML = `<img src="${finalDataUrl}">`;
        }
        
        overlay.classList.add('hidden');
        cropper.destroy();
        cropper = null;
        
        await saveProject(currentProject);
    };
}

// End of main.js
