import { getPdfConfig, savePdfConfig, savePdfConfigAll, resetPdfConfig } from './src/config-manager.js';
import { drawProjectToCanvas } from './src/pdf-engine.js';

// DOM Elements
const editorTypeSelect = document.getElementById('editor-type-select');
const editorTemplateImg = document.getElementById('editor-template-img');
const editorCanvasArea = document.getElementById('editor-canvas-area');
const fontSizeSlider = document.getElementById('font-size-slider');
const widthSizeSlider = document.getElementById('width-size-slider');
const btnSaveLayout = document.getElementById('btn-save-layout');
const btnResetLayout = document.getElementById('btn-reset-layout');
const btnExportConfig = document.getElementById('btn-export-config');

const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const inputFont = document.getElementById('input-font');
const inputWidth = document.getElementById('input-width');
const selectedFieldName = document.getElementById('selected-field-name');
const fieldSettings = document.getElementById('field-settings');
const noSelectionMsg = document.getElementById('no-selection-msg');

const btnShowLabels = document.getElementById('btn-show-labels');
const btnShowReal = document.getElementById('btn-show-real');

const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const zoomValDisplay = document.getElementById('zoom-val');

// State
const btnAlignLeft = document.getElementById('btn-align-left');
const btnAlignCenter = document.getElementById('btn-align-center');

let currentLayoutConfig = null;
let selectedFieldId = null;
let previewCanvas = null;
let isRealPreviewMode = false;
let zoomLevel = 1.0;

async function init() {
    currentLayoutConfig = await getPdfConfig();
    bindEvents();
    renderEditorCanvas(editorTypeSelect.value);
}

function bindEvents() {
    editorTypeSelect.addEventListener('change', (e) => {
        selectedFieldId = null;
        updateSelectionUI();
        renderEditorCanvas(e.target.value);
    });

    fontSizeSlider.addEventListener('input', (e) => updateSelectedField('fontSize', parseInt(e.target.value)));
    widthSizeSlider.addEventListener('input', (e) => updateSelectedField('width', parseInt(e.target.value)));
    
    inputX.addEventListener('input', (e) => updateSelectedField('x', parseFloat(e.target.value)));
    inputY.addEventListener('input', (e) => updateSelectedField('y', parseFloat(e.target.value)));
    inputFont.addEventListener('input', (e) => updateSelectedField('fontSize', parseInt(e.target.value)));
    inputWidth.addEventListener('input', (e) => updateSelectedField('width', parseInt(e.target.value)));

    document.querySelectorAll('.btn-step').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!selectedFieldId) return;
            const target = btn.dataset.target;
            const dir = btn.dataset.dir === 'up' ? 1 : -1;
            const step = (target === 'x' || target === 'y') ? 0.1 : 1;
            const input = document.getElementById(`input-${target}`);
            const newVal = parseFloat(input.value || 0) + (dir * step);
            input.value = (target === 'x' || target === 'y') ? newVal.toFixed(1) : Math.round(newVal);
            updateSelectedField(target === 'font' ? 'fontSize' : target, parseFloat(input.value));
        });
    });

    btnSaveLayout.addEventListener('click', async () => {
        try {
            console.log('Attempting to save layout...', currentLayoutConfig);
            const originalText = btnSaveLayout.textContent;
            btnSaveLayout.disabled = true;
            btnSaveLayout.textContent = '保存中...';

            await savePdfConfigAll(currentLayoutConfig);

            btnSaveLayout.textContent = '保存完了！';
            btnSaveLayout.classList.remove('btn-primary');
            btnSaveLayout.classList.add('btn-success'); // Assuming green class or just style it

            setTimeout(() => {
                btnSaveLayout.disabled = false;
                btnSaveLayout.textContent = originalText;
                btnSaveLayout.classList.remove('btn-success');
                btnSaveLayout.classList.add('btn-primary');
            }, 2000);

            console.log('Layout saved successfully.');
        } catch (err) {
            console.error('Failed to save layout:', err);
            alert('保存に失敗しました: ' + err.message);
            btnSaveLayout.disabled = false;
            btnSaveLayout.textContent = '設定を保存する';
        }
    });

    btnResetLayout.addEventListener('click', async () => {
        if (confirm('すべてのレイアウト設定を初期状態に戻しますか？')) {
            await resetPdfConfig();
            window.location.reload();
        }
    });

    btnExportConfig.addEventListener('click', () => {
        const jsonStr = JSON.stringify(currentLayoutConfig, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'layout-config.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    btnShowLabels.addEventListener('click', () => setPreviewMode(false));
    btnShowReal.addEventListener('click', () => setPreviewMode(true));

    btnZoomIn.addEventListener('click', () => updateZoom(0.1));
    btnZoomOut.addEventListener('click', () => updateZoom(-0.1));

    btnAlignLeft.addEventListener('click', () => updateSelectedField('align', 'left'));
    btnAlignCenter.addEventListener('click', () => updateSelectedField('align', 'center'));

    document.addEventListener('keydown', handleKeyboardMove);
}

function updateZoom(delta) {
    zoomLevel = Math.max(0.1, Math.min(3.0, zoomLevel + delta));
    editorCanvasArea.style.transform = `scale(${zoomLevel})`;
    zoomValDisplay.textContent = Math.round(zoomLevel * 100) + '%';
}

function setPreviewMode(isReal) {
    isRealPreviewMode = isReal;
    btnShowLabels.classList.toggle('active', !isReal);
    btnShowReal.classList.toggle('active', isReal);
    
    editorCanvasArea.classList.toggle('preview-active', isReal);
    
    if (previewCanvas) {
        previewCanvas.style.display = isReal ? 'block' : 'none';
        if (isReal) updateRealPreview();
    }
}

function renderEditorCanvas(type) {
    const typeConfig = currentLayoutConfig[type];
    if (!typeConfig) return;

    // Set template image
    if (type === 'kanryo') editorTemplateImg.src = '/images/kanrryoutemp.jpg?v=1.2';
    else if (type === 'marusan') editorTemplateImg.src = '/images/marusan_report.jpg';
    else editorTemplateImg.src = '/images/geppo.jpg';

    // Remove existing labels
    const oldLabels = editorCanvasArea.querySelectorAll('.draggable-label');
    oldLabels.forEach(l => l.remove());

    // Canvas Preview Setup
    if (previewCanvas) previewCanvas.remove();
    previewCanvas = document.createElement('canvas');
    previewCanvas.className = 'preview-canvas';
    previewCanvas.style.display = isRealPreviewMode ? 'block' : 'none';
    editorCanvasArea.appendChild(previewCanvas);

    // Add labels
    typeConfig.fields.forEach(field => {
        const label = document.createElement('div');
        label.className = 'draggable-label';
        if (selectedFieldId === field.id) label.classList.add('active');
        
        label.textContent = field.label;
        label.dataset.id = field.id;
        label.style.left = field.x + '%';
        label.style.width = (field.width || 30) + '%';
        
        if (field.id === 'receipt') {
            label.style.aspectRatio = `1 / ${field.heightRatio || 1.3}`;
            label.style.background = 'rgba(14, 165, 233, 0.2)';
            label.style.border = '2px dashed var(--accent-gold)';
        } else {
            label.style.fontSize = (field.fontSize || 12) + 'px';
        }

        label.addEventListener('mousedown', (e) => startLabelDrag(e, field, label));
        label.addEventListener('touchstart', (e) => startLabelDrag(e, field, label), { passive: false });

        editorCanvasArea.appendChild(label);
    });

    if (isRealPreviewMode) updateRealPreview();
}

async function updateRealPreview() {
    if (!isRealPreviewMode || !previewCanvas) return;
    const type = editorTypeSelect.value;
    
    const dummyProject = {
        type: type,
        date: '2026-04-19',
        companyName: 'サンプル建設株式会社',
        workerName: '工事 太郎',
        formData: {
            officeName: '東京営業所',
            supervisorName: '佐藤 健二',
            orderNumber: 'ORD-2026-001',
            siteName: '新宿A街区再開発工事',
            address: '東京都新宿区1-2-3',
            visitCount: '1',
            completionStatus: 'done',
            supportName: ['須', '大', '下', '田'],
            parkingFee: '1500',
            highwayFee: '2400',
            materialFee: '5000',
            totalAmount: '8900',
            taxAmount: '890',
            content: '床下配線の交換工事を実施。一部経年劣化により部材を交換。\n明日以降テスト予定。',
            dailyReport: '現場は整理整頓されており問題なし。',
            summary: '今月は順調に進捗しております。'
        },
        receiptImage: 'https://placehold.co/600x900/white/black?text=RECEIPT+SAMPLE'
    };

    const bgUrl = editorTemplateImg.src;
    // drawProjectToCanvas internally handles text rendering.
    // We want the text to be very visible in preview mode, so we could theoretically
    // temporarily modify pdf-engine's font color if needed.
    await drawProjectToCanvas(dummyProject, bgUrl, currentLayoutConfig, previewCanvas);
    
    // To solve "Text not visible" issue: Highlight the text areas on canvas
    // Or we can just ensure the dummy data is rich.
}

function startLabelDrag(e, field, label) {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    selectField(field, label);

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = label.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    function onMove(e) {
        const cX = e.touches ? e.touches[0].clientX : e.clientX;
        const cY = e.touches ? e.touches[0].clientY : e.clientY;
        const containerRect = editorCanvasArea.getBoundingClientRect();

        let x = ((cX - containerRect.left - offsetX) / containerRect.width) * 100;
        let y = ((cY - containerRect.top - offsetY) / containerRect.height) * 100;

        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        label.style.left = x + '%';
        label.style.top = y + '%';
        field.x = x;
        field.y = y;
        
        inputX.value = x.toFixed(1);
        inputY.value = y.toFixed(1);
        
        if (isRealPreviewMode) updateRealPreview();
    }

    function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
}

function selectField(field, label) {
    document.querySelectorAll('.draggable-label').forEach(l => l.classList.remove('active'));
    label.classList.add('active');
    selectedFieldId = field.id;
    
    selectedFieldName.textContent = field.label;
    inputX.value = field.x.toFixed(1);
    inputY.value = field.y.toFixed(1);
    inputFont.value = field.fontSize || 12;
    inputWidth.value = field.width || 30;
    
    fontSizeSlider.value = field.fontSize || 12;
    widthSizeSlider.value = field.width || 30;
    
    // Update Alignment Buttons
    const currentAlign = field.align || (['date', 'orderNumber'].includes(field.id) ? 'center' : 'left');
    btnAlignLeft.classList.toggle('active', currentAlign === 'left');
    btnAlignCenter.classList.toggle('active', currentAlign === 'center');
    
    updateSelectionUI();
}

function updateSelectionUI() {
    if (selectedFieldId) {
        fieldSettings.classList.remove('hidden');
        noSelectionMsg.classList.add('hidden');
    } else {
        fieldSettings.classList.add('hidden');
        noSelectionMsg.classList.remove('hidden');
    }
}

function updateSelectedField(prop, value) {
    if (!selectedFieldId) return;
    const type = editorTypeSelect.value;
    const field = currentLayoutConfig[type].fields.find(f => f.id === selectedFieldId);
    if (!field) return;

    field[prop] = value;
    
    const label = editorCanvasArea.querySelector(`.draggable-label[data-id="${selectedFieldId}"]`);
    if (label) {
        if (prop === 'x') label.style.left = value + '%';
        if (prop === 'y') label.style.top = value + '%';
        if (prop === 'fontSize') {
            label.style.fontSize = value + 'px';
            fontSizeSlider.value = value;
            inputFont.value = value;
        }
        if (prop === 'width') {
            label.style.width = value + '%';
            widthSizeSlider.value = value;
            inputWidth.value = value;
        }
    }
    
    if (prop === 'align') {
        const alignLabel = editorCanvasArea.querySelector(`.draggable-label[data-id="${selectedFieldId}"]`);
        if (alignLabel) alignLabel.style.textAlign = value;
        btnAlignLeft.classList.toggle('active', value === 'left');
        btnAlignCenter.classList.toggle('active', value === 'center');
    }

    if (isRealPreviewMode) updateRealPreview();
}

function handleKeyboardMove(e) {
    if (!selectedFieldId) return;
    const step = e.shiftKey ? 1 : 0.1;
    let changed = false;

    const type = editorTypeSelect.value;
    const field = currentLayoutConfig[type].fields.find(f => f.id === selectedFieldId);
    if (!field) return;

    if (e.key === 'ArrowLeft') { field.x -= step; changed = true; }
    if (e.key === 'ArrowRight') { field.x += step; changed = true; }
    if (e.key === 'ArrowUp') { field.y -= step; changed = true; }
    if (e.key === 'ArrowDown') { field.y += step; changed = true; }

    if (changed) {
        field.x = Math.max(0, Math.min(100, field.x));
        field.y = Math.max(0, Math.min(100, field.y));
        inputX.value = field.x.toFixed(1);
        inputY.value = field.y.toFixed(1);
        updateSelectedField('x', field.x);
        updateSelectedField('y', field.y);
        e.preventDefault();
    }
}

init();
