import { getAllProjects, saveProject, deleteProject, generateDraftName, generatePdfName } from './src/storage.js';
import { CompanyRules } from './src/rules.js';
import { resizeImage, adaptiveThreshold } from './src/image-utils.js';
import { generateSinglePdf, generateBulkPdf } from './src/pdf-engine.js';
import { getPdfConfig, savePdfConfig } from './src/config-manager.js';

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
  let isDragging = false;
  let startX, startY;
  let startLeft, startTop;

  fabBot.addEventListener('mousedown', dragStart);
  fabBot.addEventListener('touchstart', dragStart, { passive: false });

  function dragStart(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    isDragging = false;
    startX = clientX;
    startY = clientY;

    const rect = fabBot.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    document.addEventListener('mousemove', dragMove);
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
  }

  function dragMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      isDragging = true;
    }

    if (isDragging) {
      if (e.cancelable) e.preventDefault();
      
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;

      // Bound checks
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - fabBot.offsetWidth));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - fabBot.offsetHeight));

      fabBot.style.left = newLeft + 'px';
      fabBot.style.top = newTop + 'px';
      fabBot.style.bottom = 'auto'; // Disable fixed bottom
      fabBot.style.right = 'auto';  // Disable fixed right
    }
  }

  function dragEnd() {
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('touchmove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
    document.removeEventListener('touchend', dragEnd);

    // If movement was minimal (less than 10px), treat as a click
    if (!isDragging) {
      botContainer.classList.toggle('hidden');
    }
  }

  btnCloseBot.addEventListener('click', () => {
    botContainer.classList.add('hidden');
  });

  btnSendBot.addEventListener('click', handleBotSend);
  botInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleBotSend();
  });

  // Bulk PDF
  btnBulkPdf.addEventListener('click', handleBulkPdf);


  // Toggle Controls
  // Bulk PDF
  btnBulkPdf.addEventListener('click', handleBulkPdf);

  // Settings Link (Handled by <a> in HTML, but we can add specific logic if needed)
}


async function handleBulkPdf() {
  const selectedIds = Array.from(document.querySelectorAll('.bulk-select:checked')).map(cb => cb.value);
  if (selectedIds.length === 0) {
    alert('PDFに含めるプロジェクトを選択してください');
    return;
  }

  const projects = await getAllProjects();
  const selectedProjects = projects.filter(p => selectedIds.includes(p.id));

  const config = await getPdfConfig();

  // Load unique templates needed
  const templates = {};
  const types = ['kanryo', 'marusan', 'geppo'];
  const typeMap = { 'kanryo': '/images/kanrryoutemp.jpg?v=1.2', 'marusan': '/images/marusan_report.jpg', 'geppo': '/images/geppo.jpg' };
  
  try {
    const doc = await generateBulkPdf(selectedProjects, typeMap, config);
    
    const filename = `一括生成_${new Date().toISOString().split('T')[0]}`;

    // Update status for all selected projects BEFORE sharing
    for (const p of selectedProjects) {
        p.status = 'sent';
        await saveProject(p);
    }
    
    if (navigator.share) {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], `${filename}.pdf`, { type: 'application/pdf' });
        try {
            await navigator.share({ files: [file], title: filename });
        } catch (shareErr) {
            console.log('Sharing cancelled or failed', shareErr);
        }
    } else {
        doc.save(`${filename}.pdf`);
    }

    alert(`${selectedIds.length}件のPDFを一括生成し、完了済みに移動しました`);
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

  document.getElementById('btn-new-marusan').addEventListener('click', () => {
    typeModal.style.display = 'none';
    showForm('marusan');
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
  const isHistory = project && project.status === 'sent';
  
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
  
  if (isHistory) {
      pageTitle.textContent = '完了報告書 再編集';
  } else {
      pageTitle.textContent = type === 'kanryo' ? '完了報告書 作成' : (type === 'marusan' ? '丸産技研報告書 作成' : '月報 作成');
  }

  renderForm();
}

function renderForm() {
  const isGeppo = currentProject.type === 'geppo';
  
  formView.innerHTML = `
    <div class="form-container">
      <div id="dynamic-form-fields">
        ${currentProject.type === 'geppo' ? renderGeppoFields() : (currentProject.type === 'marusan' ? renderMarusanFields() : renderKanryoFields())}
      </div>

      <div class="form-actions-bottom">
        <button class="btn btn-outline" id="btn-preview-doc">プレビュー反映を確認</button>
        <button class="btn btn-primary" id="btn-save-draft">下書き保存</button>
      </div>
    </div>

    <!-- Document Preview Overlay -->
    <div id="document-preview-overlay" class="modal hidden" style="z-index: 2000;">
        <div class="modal-content" style="width: 95%; max-width: 800px; height: 90vh; display: flex; flex-direction: column; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0;">出力プレビュー</h3>
                <button class="btn btn-danger" id="btn-close-preview" style="padding: 5px 15px;">閉じる</button>
            </div>
            <div id="preview-canvas-container" style="flex: 1; overflow: auto; background: #555; display: flex; justify-content: center; align-items: flex-start; border-radius: 8px;">
                <!-- Canvas will be injected here -->
            </div>
            <p style="font-size: 0.7rem; color: #666; margin-top: 5px;">※ 実際のPDF出力イメージを確認できます</p>
        </div>
    </div>

    <!-- Position Tool Overlay (Hidden/Legacy) -->
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
  document.getElementById('btn-preview-doc').addEventListener('click', handleShowPreview);

  // Attach Chip Listeners
  const chipGroup = document.getElementById('support-chip-group');
  if (chipGroup) {
      if (!Array.isArray(currentProject.formData.supportName)) {
          currentProject.formData.supportName = [];
      }
      chipGroup.addEventListener('click', (e) => {
          const btn = e.target.closest('.chip-btn');
          if (!btn) return;
          const name = btn.dataset.name;
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

  // Ensure current data is synced
  syncDataToProject();
}

async function handleShowPreview() {
    const overlay = document.getElementById('document-preview-overlay');
    const container = document.getElementById('preview-canvas-container');
    const closeBtn = document.getElementById('btn-close-preview');
    
    syncDataToProject();
    
    container.innerHTML = '<div style="color:white; padding: 20px;">生成中...</div>';
    overlay.classList.remove('hidden');
    
    try {
        let bgUrl = '';
        if (currentProject.type === 'kanryo') bgUrl = '/images/kanrryoutemp.jpg?v=1.2';
        else if (currentProject.type === 'marusan') bgUrl = '/images/marusan_report.jpg';
        else bgUrl = '/images/geppo.jpg';
        
        const config = await getPdfConfig();
        const canvas = await drawProjectToCanvas(currentProject, bgUrl, config);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
        
        container.innerHTML = '';
        container.appendChild(canvas);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="color:red; padding: 20px;">プレビュー生成に失敗しました</div>';
    }
    
    closeBtn.onclick = () => overlay.classList.add('hidden');
}

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
  const fd = currentProject.formData || {};
  return `
    <div class="form-group">
      <label class="label">作業者名</label>
      <input type="text" id="form-worker" value="${currentProject.workerName || ''}" placeholder="氏名を入力">
    </div>
    <div class="form-group">
      <label class="label">事業者名</label>
      <input type="text" id="field-officeName" value="${fd.officeName || ''}">
    </div>
    <div class="form-group">
      <label class="label">監督名</label>
      <input type="text" id="field-supervisorName" value="${fd.supervisorName || ''}">
    </div>
    <div class="form-group">
      <label class="label">回数選択</label>
      <select id="field-visitCount">
        <option value="">選択なし</option>
        <option value="1" ${fd.visitCount === '1' ? 'selected' : ''}>1回目</option>
        <option value="2" ${fd.visitCount === '2' ? 'selected' : ''}>2回目</option>
        <option value="3" ${fd.visitCount === '3' ? 'selected' : ''}>3回目</option>
      </select>
    </div>
    <div class="form-group">
      <label class="label">完了・未完選択</label>
      <select id="field-completionStatus">
        <option value="">選択なし</option>
        <option value="done" ${fd.completionStatus === 'done' ? 'selected' : ''}>完了</option>
        <option value="notYet" ${fd.completionStatus === 'notYet' ? 'selected' : ''}>未</option>
      </select>
    </div>
    <div class="form-group">
      <label class="label">応援選択（タップした順に並びます）</label>
      <div id="support-chip-group" class="chip-group">
        ${['湧', '菊', '須', '田', '大', '下', '巻', '木', 'タン', '富'].map(name => {
          const isActive = (fd.supportName || []).includes(name);
          return `<button type="button" class="chip-btn ${isActive ? 'active' : ''}" data-name="${name}">${name}</button>`;
        }).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="label">駐車場代</label>
      <input type="number" id="field-parkingFee" value="${fd.parkingFee || ''}">
    </div>
    <div class="form-group" style="background: rgba(var(--accent-gold-rgb), 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(var(--accent-gold-rgb), 0.2);">
      <label class="label" style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 1.2rem;">📸</span> 領収書の撮影・選択 (白黒加工されます)
      </label>
      <input type="file" id="field-receipt" accept="image/*" capture="environment" style="font-size: 0.8rem;">
      <div id="receipt-preview" style="margin-top: 10px; display: flex; justify-content: center;">
        ${currentProject.receiptImage ? `<img src="${currentProject.receiptImage}" style="width: 100%; max-width: 300px; border-radius: 8px; border: 2px solid var(--accent-gold); box-shadow: var(--shadow-sm);">` : '<div style="font-size: 0.7rem; color: #999; padding: 20px; text-align: center; border: 2px dashed #ddd; border-radius: 8px; width: 100%;">ここに加工後のプレビューが表示されます</div>'}
      </div>
    </div>
    <div class="form-group">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label class="label">高速代</label>
        <a href="https://www.driveplaza.com/dp/SearchTop" target="_blank" class="btn btn-outline" style="font-size: 0.7rem; padding: 2px 8px;">高速代検索</a>
      </div>
      <input type="number" id="field-highwayFee" value="${fd.highwayFee || ''}">
    </div>
    <div class="form-group">
      <label class="label">材料代</label>
      <input type="number" id="field-materialFee" value="${fd.materialFee || ''}">
    </div>
    <div class="form-group">
      <label class="label">日付</label>
      <input type="date" id="form-date" value="${currentProject.date || ''}">
    </div>
    <div class="form-group">
      <label class="label">注文番号</label>
      <input type="text" id="field-orderNumber" value="${fd.orderNumber || ''}">
    </div>
    <div class="form-group">
      <label class="label">現場名</label>
      <input type="text" id="field-siteName" value="${fd.siteName || ''}">
    </div>
    <div class="form-group">
      <label class="label">住所</label>
      <input type="text" id="field-address" value="${fd.address || ''}">
    </div>
    <div class="form-group">
        <label class="label">工事内容 (10行まで)</label>
        <textarea id="field-content" rows="6" placeholder="自動改行されます">${fd.content || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="label">日報 (4行まで)</label>
      <textarea id="field-dailyReport" rows="3" placeholder="現場の状況など">${fd.dailyReport || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="label">合計額</label>
      <input type="number" id="field-totalAmount" value="${fd.totalAmount || ''}">
    </div>
    <div class="form-group">
      <label class="label">消費税額</label>
      <input type="number" id="field-taxAmount" value="${fd.taxAmount || ''}">
    </div>
  `;
}

function renderMarusanFields() {
  const fd = currentProject.formData || {};
  return `
    <div class="form-group">
      <label class="label">監督名</label>
      <input type="text" id="field-supervisorName" value="${fd.supervisorName || ''}">
    </div>
    <div class="form-group">
      <label class="label">日にち</label>
      <input type="date" id="form-date" value="${currentProject.date || ''}">
    </div>
    <div class="form-group">
      <label class="label">現場名</label>
      <input type="text" id="field-siteName" value="${fd.siteName || ''}">
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <div class="form-group">
        <label class="label">開始時間</label>
        <input type="time" id="field-startTime" value="${fd.startTime || ''}">
      </div>
      <div class="form-group">
        <label class="label">終了時間</label>
        <input type="time" id="field-endTime" value="${fd.endTime || ''}">
      </div>
    </div>
    <div class="form-group">
        <label class="label">作業内容 (3行まで)</label>
        <textarea id="field-content" rows="3" placeholder="3行程度で入力">${fd.content || ''}</textarea>
    </div>
    <div class="form-group">
      <label class="label">作業者名</label>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <input type="text" id="field-worker1" placeholder="作業者1" value="${fd.worker1 || ''}">
        <input type="text" id="field-worker2" placeholder="作業者2" value="${fd.worker2 || ''}">
        <input type="text" id="field-worker3" placeholder="作業者3" value="${fd.worker3 || ''}">
        <input type="text" id="field-worker4" placeholder="作業者4" value="${fd.worker4 || ''}">
        <input type="text" id="field-worker5" placeholder="作業者5" value="${fd.worker5 || ''}">
        <input type="text" id="field-worker6" placeholder="作業者6" value="${fd.worker6 || ''}">
      </div>
    </div>
    <div class="form-group" style="background: rgba(var(--accent-gold-rgb), 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(var(--accent-gold-rgb), 0.2);">
      <label class="label">📸 領収書の撮影・選択</label>
      <input type="file" id="field-receipt" accept="image/*" capture="environment">
      <div id="receipt-preview" style="margin-top: 10px; display: flex; justify-content: center;">
        ${currentProject.receiptImage ? `<img src="${currentProject.receiptImage}" style="width: 100%; max-width: 300px; border-radius: 8px; border: 2px solid var(--accent-gold);">` : ''}
      </div>
    </div>
  `;
}

function renderGeppoFields() {
  return `
    <div class="form-group">
      <label class="label">日付</label>
      <input type="date" id="form-date" value="${currentProject.date || ''}">
    </div>
    <div class="form-group">
      <label class="label">氏名</label>
      <input type="text" id="form-worker" value="${currentProject.workerName || ''}" placeholder="氏名を入力">
    </div>
    <div class="form-group">
        <label class="label">今月の概況</label>
        <textarea id="field-summary" rows="5">${currentProject.formData.summary || ''}</textarea>
    </div>
  `;
}



async function handleSaveDraft() {
  const dateEl = document.getElementById('form-date');
  const workerEl = document.getElementById('form-worker');

  const date = dateEl ? dateEl.value : '';
  let worker = workerEl ? workerEl.value : '';

  // For Marusan, if single worker field is missing, use worker1 as the representative name
  if (!worker && currentProject.type === 'marusan') {
    const w1 = document.getElementById('field-worker1');
    if (w1) worker = w1.value;
  }

  if (!date) {
    alert('日付を入力してください');
    return;
  }

  const displayTitle = generateDraftName(date, worker);
  
  currentProject.date = date;
  currentProject.companyName = '';
  currentProject.workerName = worker;
  currentProject.displayTitle = displayTitle;

  // Collect dynamic fields
  if (currentProject.type === 'geppo') {
    currentProject.formData.summary = document.getElementById('field-summary').value;
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
    // supportName is handled via chips directly
  }

  await saveProject(currentProject);
  alert('下書きを保存しました');
  currentProject.status = 'draft'; // Ensure status is draft for subsequent saves
  currentTab = 'draft';
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

  const config = await getPdfConfig();
  
  const typeMap = {
    'kanryo': '完了報告書',
    'marusan': '丸産技研報告書',
    'geppo': '月報'
  };

  const filename = generatePdfName(p.date, p.workerName, typeMap[p.type]);
  
  // Load background
  let bgUrl = '';
  if (p.type === 'kanryo') bgUrl = '/images/kanrryoutemp.jpg?v=1.2';
  else if (p.type === 'marusan') bgUrl = '/images/marusan_report.jpg';
  else bgUrl = '/images/geppo.jpg';

  try {
    const doc = await generateSinglePdf(p, bgUrl, config);
    
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
