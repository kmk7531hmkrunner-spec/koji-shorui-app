import { getPdfConfig, savePdfConfig, savePdfConfigAll, resetPdfConfig } from './src/config-manager.js';

// We dynamically import pdf-engine only when needed for real preview 
// to prevent loading failures from breaking the entire editor.
let drawProjectToCanvas = null;
async function loadPdfEngine() {
    if (drawProjectToCanvas) return true;
    try {
        const module = await import('./src/pdf-engine.js');
        drawProjectToCanvas = module.drawProjectToCanvas;
        return true;
    } catch (err) {
        logDebug("PDF Engine Failed to load: " + err.message);
        return false;
    }
}

// DOM Elements
const editorTypeSelect = document.getElementById('editor-type-select');
const editorTemplateImg = document.getElementById('editor-template-img');
const editorCanvasArea = document.getElementById('editor-canvas-area');
const fontSizeSlider = document.getElementById('font-size-slider');
const widthSizeSlider = document.getElementById('width-size-slider');
const heightRatioSlider = document.getElementById('height-ratio-slider');
const heightRatioGroup = document.getElementById('height-ratio-group');
const btnSaveLayout = document.getElementById('btn-save-layout');
const btnResetLayout = document.getElementById('btn-reset-layout');
const btnExportConfig = document.getElementById('btn-export-config');
const btnCopyConfig = document.getElementById('btn-copy-config');

const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const inputFont = document.getElementById('input-font');
const inputWidth = document.getElementById('input-width');
const inputHeightRatio = document.getElementById('input-height-ratio');
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

function logDebug(msg) {
    const logEl = document.getElementById('editor-debug-log');
    if (logEl) {
        logEl.style.display = 'block';
        logEl.textContent = "Debug: " + msg + " | " + logEl.textContent;
    }
    console.log("DEBUG:", msg);
}

async function init() {
    logDebug("Init started");
    try {
        currentLayoutConfig = await getPdfConfig();
        logDebug("Config loaded");
        bindEvents();
        logDebug("Events bound");
        renderEditorCanvas(editorTypeSelect.value);
        logDebug("First render done");
    } catch (err) {
        logDebug("INIT ERROR: " + err.message);
        alert("エディタの初期化に失敗しました: " + err.message);
    }
}

function bindEvents() {
    // Helper to add listener safely
    const addSafeListener = (el, type, handler) => {
        if (el) el.addEventListener(type, handler);
        else console.warn(`Element not found for ${type} listener`);
    };

    addSafeListener(editorTypeSelect, 'change', (e) => {
        selectedFieldId = null;
        updateSelectionUI();
        renderEditorCanvas(e.target.value);
    });

    addSafeListener(fontSizeSlider, 'input', (e) => updateSelectedField('fontSize', parseInt(e.target.value)));
    addSafeListener(widthSizeSlider, 'input', (e) => updateSelectedField('width', parseInt(e.target.value)));
    addSafeListener(heightRatioSlider, 'input', (e) => updateSelectedField('heightRatio', parseFloat(e.target.value)));
    
    addSafeListener(inputX, 'input', (e) => updateSelectedField('x', parseFloat(e.target.value)));
    addSafeListener(inputY, 'input', (e) => updateSelectedField('y', parseFloat(e.target.value)));
    addSafeListener(inputFont, 'input', (e) => updateSelectedField('fontSize', parseInt(e.target.value)));
    addSafeListener(inputWidth, 'input', (e) => updateSelectedField('width', parseInt(e.target.value)));
    addSafeListener(inputHeightRatio, 'input', (e) => updateSelectedField('heightRatio', parseFloat(e.target.value)));

    document.querySelectorAll('.btn-step').forEach(btn => {
        addSafeListener(btn, 'click', () => {
            if (!selectedFieldId) return;
            const target = btn.dataset.target;
            const dir = btn.dataset.dir === 'up' ? 1 : -1;
            const step = (target === 'x' || target === 'y' || target === 'heightRatio') ? 0.1 : 1;
            const input = document.getElementById(`input-${target === 'heightRatio' ? 'height-ratio' : target}`);
            const newVal = parseFloat(input.value || 0) + (dir * step);
            input.value = (target === 'x' || target === 'y') ? newVal.toFixed(1) : Math.round(newVal);
            updateSelectedField(target === 'font' ? 'fontSize' : target, parseFloat(input.value));
        });
    });

    addSafeListener(btnSaveLayout, 'click', async () => {
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

    addSafeListener(btnResetLayout, 'click', async () => {
        if (confirm('すべてのレイアウト設定を初期状態に戻しますか？')) {
            await resetPdfConfig();
            window.location.reload();
        }
    });

    addSafeListener(btnExportConfig, 'click', () => {
        const jsonStr = JSON.stringify(currentLayoutConfig, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'layout-config.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    addSafeListener(btnCopyConfig, 'click', async () => {
        const jsonStr = JSON.stringify(currentLayoutConfig, null, 2);
        try {
            await navigator.clipboard.writeText(jsonStr);
            const originalText = btnCopyConfig.textContent;
            btnCopyConfig.textContent = 'コピー済み！';
            setTimeout(() => {
                btnCopyConfig.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Copy failed:', err);
            alert('コピーに失敗しました。');
        }
    });

    addSafeListener(btnShowLabels, 'click', () => setPreviewMode(false));
    addSafeListener(btnShowReal, 'click', () => setPreviewMode(true));

    addSafeListener(btnZoomIn, 'click', () => updateZoom(0.1));
    addSafeListener(btnZoomOut, 'click', () => updateZoom(-0.1));

    addSafeListener(btnAlignLeft, 'click', () => updateSelectedField('align', 'left'));
    addSafeListener(btnAlignCenter, 'click', () => updateSelectedField('align', 'center'));

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
    logDebug("Rendering: " + type);
    const typeConfig = currentLayoutConfig[type];
    if (!typeConfig) {
        logDebug("Type not found in config: " + type);
        return;
    }

    // Set template image (Try root-absolute path first for Vite)
    const v = new Date().getTime();
    let fileName = "";
    if (type === 'kanryo') fileName = "kanrryoutemp.jpg";
    else if (type === 'marusan') fileName = "marusan_report.jpg";
    else fileName = "geppo.jpg";

    const pathsToTry = [
        `/images/${fileName}?v=${v}`,
        `images/${fileName}?v=${v}`,
        `./images/${fileName}?v=${v}`
    ];
    
    let currentPathIndex = 0;
    const tryNextPath = () => {
        if (currentPathIndex < pathsToTry.length) {
            const nextPath = pathsToTry[currentPathIndex++];
            logDebug("Trying image path: " + nextPath);
            editorTemplateImg.src = nextPath;
        } else {
            logDebug("ALL IMAGE PATHS FAILED");
        }
    };

    editorTemplateImg.onerror = () => {
        logDebug("FAILED: " + editorTemplateImg.src);
        tryNextPath();
    };
    
    tryNextPath();

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
        label.style.top = field.y + '%';
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
    
    // Ensure engine is loaded
    const success = await loadPdfEngine();
    if (success && drawProjectToCanvas) {
        await drawProjectToCanvas(dummyProject, bgUrl, currentLayoutConfig, previewCanvas);
    } else {
        logDebug("Cannot show PDF preview: Engine not ready");
    }
    
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

        // Account for Zoom (scale) in coordinate calculation
        let x = ((cX - containerRect.left - offsetX) / (containerRect.width)) * 100;
        let y = ((cY - containerRect.top - offsetY) / (containerRect.height)) * 100;

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
    
    if (selectedFieldName) selectedFieldName.textContent = field.label;
    if (inputX) inputX.value = field.x.toFixed(1);
    if (inputY) inputY.value = field.y.toFixed(1);
    if (inputFont) inputFont.value = field.fontSize || 12;
    if (inputWidth) inputWidth.value = field.width || 30;
    
    if (fontSizeSlider) fontSizeSlider.value = field.fontSize || 12;
    if (widthSizeSlider) widthSizeSlider.value = field.width || 30;
    if (inputHeightRatio) inputHeightRatio.value = field.heightRatio || 1.3;
    if (heightRatioSlider) heightRatioSlider.value = field.heightRatio || 1.3;
    
    if (heightRatioGroup) heightRatioGroup.classList.toggle('hidden', field.id !== 'receipt');
    
    // Update Alignment Buttons
    const currentAlign = field.align || (['date', 'orderNumber'].includes(field.id) ? 'center' : 'left');
    if (btnAlignLeft) btnAlignLeft.classList.toggle('active', currentAlign === 'left');
    if (btnAlignCenter) btnAlignCenter.classList.toggle('active', currentAlign === 'center');
    
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
        if (prop === 'heightRatio') {
            label.style.aspectRatio = `1 / ${value}`;
            heightRatioSlider.value = value;
            inputHeightRatio.value = value;
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
