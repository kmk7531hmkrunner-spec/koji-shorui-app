import { getAllProjects, saveProject, deleteProject, getProject, generateDraftName, generatePdfName, set } from './src/storage.js';
import { CompanyRules } from './src/rules.js';
import { resizeImage, adaptiveThreshold } from './src/image-utils.js';
import { generateSinglePdf, generateBulkPdf, drawProjectToCanvas } from './src/pdf-engine.js';
import { getPdfConfig, savePdfConfig } from './src/config-manager.js';

console.log("Main script loading...");

// DOM Elements
const projectListView = document.getElementById('project-list-view');
const formView = document.getElementById('form-view');
const projectList = document.getElementById('project-list');
const tabsContainer = document.getElementById('tabs');
const tabs = document.querySelectorAll('.tab');
const fabPlus = document.getElementById('fab-plus');
const btnBack = document.getElementById('btn-back');
const btnBulkPdf = document.getElementById('btn-bulk-pdf');
const pageTitle = document.getElementById('page-title');
const typeModal = document.getElementById('type-modal');
const fabBot = document.getElementById('fab-bot');
const botContainer = document.getElementById('bot-container');
const btnCloseBot = document.getElementById('btn-close-bot');
const botMessages = document.getElementById('bot-messages');
const botInput = document.getElementById('bot-input');
const btnSendBot = document.getElementById('btn-send-bot');

let currentTab = 'draft';
let currentProject = null;

async function init() {
  console.log("Initializing app...");
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (projectId) {
        const projects = await getAllProjects();
        const p = projects.find(item => item.id === projectId);
        if (p) {
            currentProject = p;
            showForm(p.type, p);
            return;
        }
    }

    await renderList();
    bindEvents();
    bindBotEvents();
  } catch (err) {
    console.error("Initialization failed:", err);
  }
}

async function renderList() {
  const container = document.getElementById('project-list');
  container.innerHTML = '<div class="loading">読み込み中...</div>';

  const projects = await getAllProjects();
  const filtered = projects.filter(p => p.status === currentTab);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📁</div>
      <p>${currentTab === 'draft' ? '下書き中の書類はありません' : '完了済みの書類はありません'}</p>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(p => `
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
  fabPlus.addEventListener('click', () => {
    typeModal.style.display = 'flex';
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    typeModal.style.display = 'none';
  });

  document.getElementById('btn-new-kanryo').addEventListener('click', () => showForm('kanryo'));
  document.getElementById('btn-new-marusan').addEventListener('click', () => showForm('marusan'));
  document.getElementById('btn-new-geppo').addEventListener('click', () => showForm('geppo'));

  btnBack.addEventListener('click', () => {
    if (confirm('保存していない変更は破棄されます。戻りますか？')) {
      formView.style.display = 'none';
      projectListView.style.display = 'block';
      pageTitle.textContent = 'プロジェクト一覧';
      btnBack.style.display = 'none';
      btnBulkPdf.style.display = 'none';
      currentProject = null;
      renderList();
    }
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderList();
    });
  });
}

function showForm(type, project = null) {
  typeModal.style.display = 'none';
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

  projectListView.style.display = 'none';
  formView.style.display = 'block';
  btnBack.style.display = 'block';
  
  if (project) {
      pageTitle.textContent = '再編集';
  } else {
      pageTitle.textContent = type === 'kanryo' ? '完了報告書 作成' : (type === 'marusan' ? '丸産技研報告書 作成' : '月報 作成');
  }

  renderForm();
}

function renderForm() {
  const isGeppo = currentProject.type === 'geppo';
  const container = document.getElementById('editor-container');
  
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
    <div class="form-group grid-2">
      <div><label class="label">駐車場代</label><input type="number" id="field-parkingFee" value="${fd.parkingFee || ''}"></div>
      <div><label class="label">高速代</label><input type="number" id="field-highwayFee" value="${fd.highwayFee || ''}"></div>
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
  
  formView.style.display = 'none';
  projectListView.style.display = 'block';
  btnBack.style.display = 'none';
  renderList();
}

async function handleShowPreview() {
    const overlay = document.getElementById('document-preview-overlay');
    const container = document.getElementById('preview-canvas-container');
    const closeBtn = document.getElementById('btn-close-preview');
    
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
  if (fabBot) fabBot.onclick = () => botContainer.classList.toggle('hidden');
  if (btnCloseBot) btnCloseBot.onclick = () => botContainer.classList.add('hidden');
  if (btnSendBot) btnSendBot.onclick = handleBotSend;
  if (botInput) botInput.onkeypress = (e) => { if (e.key === 'Enter') handleBotSend(); };
}

function handleBotSend() {
  const msg = botInput.value.trim();
  if (!msg) return;
  
  addMessage('user', msg);
  botInput.value = '';
  
  setTimeout(() => {
    addMessage('bot', '担当者が内容を確認いたします。しばらくお待ちください。');
  }, 500);
}

function addMessage(type, text) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.textContent = text;
  botMessages.appendChild(div);
  botMessages.scrollTop = botMessages.scrollHeight;
}

init();
