import { getAllProjects, saveProject, deleteProject, generateDraftName, generatePdfName } from './src/storage.js';
import { CompanyRules } from './src/rules.js';
import { resizeImage, adaptiveThreshold } from './src/image-utils.js';
import { generateSinglePdf, generateBulkPdf } from './src/pdf-engine.js';

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
  renderList();
  bindEvents();
  bindBotEvents();
}

async function renderList() {
  projectListView.style.display = 'block';
  formView.style.display = 'none';
  tabsContainer.style.display = 'flex';
  fabPlus.style.display = 'flex';
  btnBack.style.display = 'none';
  btnBulkPdf.style.display = currentTab === 'draft' ? 'block' : 'none';
  pageTitle.textContent = 'プロジェクト一覧';

  projectList.innerHTML = '<div class="loading">読み込み中...</div>';
  const projects = await getAllProjects();
  const filtered = projects.filter(p => p.status === currentTab);

  if (filtered.length === 0) {
    projectList.innerHTML = `<div class="empty-state">${currentTab === 'draft' ? '下書きはありません' : '完了済みのプロジェクトはありません'}</div>`;
    return;
  }

  projectList.innerHTML = filtered.map(p => `
    <div class="project-card" data-id="${p.id}">
      <div class="card-header">
        <div style="display: flex; align-items: center; gap: 10px;">
           <input type="checkbox" class="bulk-select" value="${p.id}" style="width: 20px; height: 20px;">
           <span class="card-date">${p.date}</span>
        </div>
        <span class="card-status status-${p.status}">${p.status === 'draft' ? '下書き' : '完了済み'}</span>
      </div>
      <div class="card-title">${p.displayTitle || '無題のプロジェクト'}</div>
      <div class="card-actions">
        <button class="btn btn-outline btn-edit" data-id="${p.id}">編集</button>
        <button class="btn btn-primary btn-pdf" data-id="${p.id}">PDF作成</button>
        <button class="btn btn-danger btn-delete" data-id="${p.id}">削除</button>
      </div>
    </div>
  `).join('');
}

function bindBotEvents() {
  fabBot.addEventListener('click', () => {
    botContainer.classList.toggle('hidden');
  });

  btnCloseBot.addEventListener('click', () => {
    botContainer.classList.add('hidden');
  });

  btnSendBot.addEventListener('click', handleBotSend);
  botInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleBotSend();
  });

  // Bulk PDF
  btnBulkPdf.addEventListener('click', handleBulkPdf);
}

async function handleBulkPdf() {
  const selectedIds = Array.from(document.querySelectorAll('.bulk-select:checked')).map(cb => cb.value);
  if (selectedIds.length === 0) {
    alert('PDFに含めるプロジェクトを選択してください');
    return;
  }

  const projects = await getAllProjects();
  const selectedProjects = projects.filter(p => selectedIds.includes(p.id));

  // Load unique templates needed
  const templates = {};
  const types = ['kanryo', 'marusan', 'geppo'];
  const typeMap = { 'kanryo': '/images/kanryo_report.jpg.jpg', 'marusan': '/images/marusan_report.jpg.jpg', 'geppo': '/images/geppo.jpg.jpg' };
  
  try {
    const doc = await generateBulkPdf(selectedProjects, typeMap);
    
    const filename = `一括生成_${new Date().toISOString().split('T')[0]}`;
    
    if (navigator.share) {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], `${filename}.pdf`, { type: 'application/pdf' });
        await navigator.share({ files: [file], title: filename });
    } else {
        doc.save(`${filename}.pdf`);
    }

    alert(`${selectedIds.length}件のPDFを生成しました`);
    renderList();
  } catch (err) {
    console.error(err);
    alert('PDF一括生成中にエラーが発生しました');
  }
}

function handleBotSend() {
  const query = botInput.value.trim();
  if (!query) return;

  // Add User Message
  appendMessage(query, 'user');
  botInput.value = '';

  // Bot logic
  setTimeout(() => {
    const response = findBotResponse(query);
    appendMessage(response, 'bot');
  }, 500);
}

function appendMessage(text, side) {
  const msg = document.createElement('div');
  msg.className = `message ${side}`;
  msg.textContent = text;
  botMessages.appendChild(msg);
  botMessages.scrollTop = botMessages.scrollHeight;
}

function findBotResponse(query) {
  const found = CompanyRules.rules.find(r => 
    r.keywords.some(k => query.includes(k))
  );
  return found ? found.answer : "すみません、その件については詳しくありません。「現場名の書き方」や「領収書」について聞いてみてください。";
}
function bindEvents() {
  // Tab Switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderList();
    });
  });

  // FAB Plus
  fabPlus.addEventListener('click', () => {
    typeModal.style.display = 'flex';
  });

  // Modal Buttons
  document.getElementById('btn-new-kanryo').addEventListener('click', () => {
    typeModal.style.display = 'none';
    showForm('kanryo');
  });

  document.getElementById('btn-new-geppo').addEventListener('click', () => {
    typeModal.style.display = 'none';
    showForm('geppo');
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    typeModal.style.display = 'none';
  });

  // Back Button
  btnBack.addEventListener('click', () => {
    if (confirm('保存されていない変更は破棄されます。戻りますか？')) {
      renderList();
    }
  });

  // Card Actions
  projectList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    if (btn.classList.contains('btn-delete')) {
      if (confirm('このプロジェクトを削除しますか？')) {
        await deleteProject(id);
        renderList();
      }
    } else if (btn.classList.contains('btn-edit')) {
      editExistingProject(id);
    } else if (btn.classList.contains('btn-pdf')) {
      generatePdf(id);
    }
  });
}

function showForm(type, project = null) {
  currentProject = project || {
    type,
    status: 'draft',
    date: new Date().toISOString().split('T')[0],
    companyName: '',
    workerName: '',
    formData: {}
  };

  projectListView.style.display = 'none';
  tabsContainer.style.display = 'none';
  formView.style.display = 'block';
  fabPlus.style.display = 'none';
  btnBack.style.display = 'block';
  pageTitle.textContent = type === 'kanryo' ? '完了報告書 作成' : '月報 作成';

  renderForm();
}

function renderForm() {
  const isGeppo = currentProject.type === 'geppo';
  
  formView.innerHTML = `
    <div class="form-container">
      <div class="form-group">
        <label class="label">日付</label>
        <input type="date" id="form-date" value="${currentProject.date}">
      </div>
      <div class="form-group">
        <label class="label">会社名（現場名）</label>
        <input type="text" id="form-company" value="${currentProject.companyName}" placeholder="例：〇〇様邸">
      </div>
      <div class="form-group">
        <label class="label">作業者名</label>
        <input type="text" id="form-worker" value="${currentProject.workerName}" placeholder="氏名を入力">
      </div>
      
      <hr style="margin: 2rem 0; border: 0; border-top: 1px solid var(--border-color);">
      
      <div id="dynamic-form-fields">
        ${isGeppo ? renderGeppoFields() : renderKanryoFields()}
      </div>

      <div class="form-actions-bottom">
        <button class="btn btn-outline" id="btn-set-position">貼り付け位置を指定</button>
        <button class="btn btn-primary" id="btn-save-draft">下書き保存</button>
      </div>
    </div>

    <!-- Position Tool Overlay -->
    <div id="position-overlay" class="modal hidden">
        <div class="position-tool-content">
            <p style="margin: 0; padding: 10px; background: rgba(0,0,0,0.7); font-size: 0.8rem;">
                領収書を貼る位置をタップしてください
            </p>
            <div id="position-canvas-container" style="position: relative; flex: 1; overflow: auto; background: #000; width: 100%;">
                <img id="position-template" src="" style="width: 100%; display: block;">
                <div id="position-marker" style="position: absolute; border: 2px dashed var(--accent-gold); background: rgba(197, 160, 89, 0.3); pointer-events: none; display: none;">
                    領収書
                </div>
            </div>
            <div style="padding: 1rem; display: flex; gap: 1rem; width: 100%;">
                <button class="btn btn-primary" style="flex: 1;" id="btn-confirm-position">確定</button>
            </div>
        </div>
    </div>
  `;

  const receiptInput = document.getElementById('field-receipt');
  if (receiptInput) {
    receiptInput.addEventListener('change', handleReceiptUpload);
  }

  document.getElementById('btn-save-draft').addEventListener('click', handleSaveDraft);
  document.getElementById('btn-set-position').addEventListener('click', showPositionTool);
}

function showPositionTool() {
  const overlay = document.getElementById('position-overlay');
  const templateImg = document.getElementById('position-template');
  const marker = document.getElementById('position-marker');
  const container = document.getElementById('position-canvas-container');

  // Set template image
  if (currentProject.type === 'kanryo') templateImg.src = '/images/kanryo_report.jpg.jpg';
  else if (currentProject.type === 'marusan') templateImg.src = '/images/marusan_report.jpg.jpg';
  else templateImg.src = '/images/geppo.jpg.jpg';

  overlay.classList.remove('hidden');

  // Initialize marker if exists
  const pos = currentProject.receiptPosition;
  if (pos) {
      marker.style.display = 'block';
      marker.style.left = pos.x + '%';
      marker.style.top = pos.y + '%';
      marker.style.width = (pos.scale * 15) + '%'; 
      marker.style.height = (pos.scale * 10) + '%';
  }

  // Handle Tap to position
  templateImg.onclick = (e) => {
    const rect = templateImg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    marker.style.display = 'block';
    marker.style.left = x + '%';
    marker.style.top = y + '%';
    marker.style.width = '20%'; // Default size
    marker.style.height = '15%';

    currentProject.receiptPosition = { x, y, scale: 0.5 };
  };

  document.getElementById('btn-confirm-position').onclick = () => {
    overlay.classList.add('hidden');
  };
}

async function handleReceiptUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const previewDiv = document.getElementById('receipt-preview');
  previewDiv.innerHTML = '処理中...';

  try {
    const resizedCanvas = await resizeImage(file);
    const ctx = resizedCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, resizedCanvas.width, resizedCanvas.height);
    const processedData = adaptiveThreshold(imgData);
    ctx.putImageData(processedData, 0, 0);

    const processedImageUrl = resizedCanvas.toDataURL('image/jpeg', 0.8);
    
    // Store in current project
    currentProject.receiptImage = processedImageUrl;
    
    previewDiv.innerHTML = `<img src="${processedImageUrl}" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">`;
  } catch (err) {
    console.error(err);
    previewDiv.innerHTML = 'エラーが発生しました';
  }
}

function renderKanryoFields() {
  return `
    <div class="form-group">
      <label class="label">工事内容</label>
      <textarea id="field-content" rows="3">${currentProject.formData.content || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="label">領収書添付</label>
      <input type="file" id="field-receipt" accept="image/*" capture="environment">
      <div id="receipt-preview" style="margin-top: 10px;"></div>
    </div>
  `;
}

function renderGeppoFields() {
  return `
    <div class="form-group">
        <label class="label">今月の概況</label>
        <textarea id="field-summary" rows="5">${currentProject.formData.summary || ''}</textarea>
    </div>
  `;
}

async function handleSaveDraft() {
  const date = document.getElementById('form-date').value;
  const company = document.getElementById('form-company').value;
  const worker = document.getElementById('form-worker').value;

  if (!date || !company) {
    alert('日付と会社名を入力してください');
    return;
  }

  const displayTitle = generateDraftName(date, company);
  
  currentProject.date = date;
  currentProject.companyName = company;
  currentProject.workerName = worker;
  currentProject.displayTitle = displayTitle;

  // Collect dynamic fields
  if (currentProject.type === 'geppo') {
    currentProject.formData.summary = document.getElementById('field-summary').value;
  } else {
    currentProject.formData.content = document.getElementById('field-content').value;
  }

  await saveProject(currentProject);
  alert('下書きを保存しました');
  renderList();
}

async function editExistingProject(id) {
  const projects = await getAllProjects();
  const p = projects.find(item => item.id === id);
  if (p) {
    showForm(p.type, p);
  }
}

async function generatePdf(id) {
  const projects = await getAllProjects();
  const p = projects.find(item => item.id === id);
  if (!p) return;

  const typeMap = {
    'kanryo': '完了報告書',
    'marusan': '丸産技研報告書',
    'geppo': '月報'
  };

  const filename = generatePdfName(p.date, p.workerName, typeMap[p.type]);
  
  // Load background
  let bgUrl = '';
  if (p.type === 'kanryo') bgUrl = '/images/kanryo_report.jpg.jpg';
  else if (p.type === 'marusan') bgUrl = '/images/marusan_report.jpg.jpg';
  else bgUrl = '/images/geppo.jpg.jpg';

  try {
    const doc = await generateSinglePdf(p, bgUrl);
    
    // PDF generated successfully. Move to 'sent'
    p.status = 'sent';
    await saveProject(p);
    
    // Download PDF (or Share if mobile)
    if (navigator.share) {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], `${filename}.pdf`, { type: 'application/pdf' });
        await navigator.share({
            files: [file],
            title: filename,
            text: '工事書類を送付します。'
        });
    } else {
        doc.save(`${filename}.pdf`);
    }
    
    renderList();
  } catch (err) {
    console.error(err);
    alert('PDF生成中にエラーが発生しました');
  }
}

init();
