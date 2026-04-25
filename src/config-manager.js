import { get, set } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

/**
 * PDF Layout Configuration
 */
const geppoFields = [
  { id: "geppo_year", label: "年", x: 10, y: 5, fontSize: 12, width: 10 },
  { id: "geppo_month", label: "月", x: 25, y: 5, fontSize: 12, width: 10 }
];

// Generate 30 rows for Geppo
for (let i = 0; i < 30; i++) {
  const yBase = 15 + (i * 2.5); // Initial estimate
  geppoFields.push({ id: `row_${i}_day`, label: `${i+1}日`, x: 5, y: yBase, fontSize: 9, width: 5 });
  geppoFields.push({ id: `row_${i}_company`, label: `(行${i+1})会社名`, x: 12, y: yBase, fontSize: 9, width: 15 });
  geppoFields.push({ id: `row_${i}_site`, label: `(行${i+1})現場名`, x: 30, y: yBase, fontSize: 9, width: 25 });
  geppoFields.push({ id: `row_${i}_supervisor`, label: `(行${i+1})監督名`, x: 60, y: yBase, fontSize: 9, width: 10 });
  geppoFields.push({ id: `row_${i}_address`, label: `(行${i+1})住所`, x: 75, y: yBase, fontSize: 9, width: 20 });
}

const DEFAULT_CONFIG = {
  "kanryo": {
    "fields": [
      { id: "date", label: "日付", x: 10.6, y: 35.2, fontSize: 9, width: 20, align: "center" },
      { id: "companyName", label: "会社名", x: 0.1, y: 16.9, fontSize: 12, width: 42, align: "center" },
      { id: "officeName", label: "事業所名", x: 4.5, y: 22.8, fontSize: 11, width: 35, align: "center" },
      { id: "supervisorName", label: "監督名", x: 16.6, y: 27.8, fontSize: 11, width: 22, align: "center" },
      { id: "workerName", label: "作業員", x: 69.5, y: 7.6, fontSize: 9, width: 26, align: "center" },
      { id: "orderNumber", label: "注文番号", x: 11.8, y: 39.5, fontSize: 9, width: 23, align: "center" },
      { id: "siteName", label: "現場名", x: 40.3, y: 35.3, fontSize: 9, width: 55 },
      { id: "address", label: "住所", x: 48.8, y: 39.3, fontSize: 9, width: 45, align: "left" },
      { id: "parkingFee", label: "駐車場代", x: 69.4, y: 19.1, fontSize: 9, width: 26, align: "center" },
      { id: "highwayFee", label: "高速代", x: 69.5, y: 21.9, fontSize: 9, width: 26, align: "center" },
      { id: "materialFee", label: "材料代", x: 69.5, y: 24.7, fontSize: 9, width: 26, align: "center" },
      { id: "totalAmount", label: "合計額", x: 11.9, y: 89.2, fontSize: 9, width: 20, align: "center" },
      { id: "taxAmount", label: "消費税額", x: 41.9, y: 89.1, fontSize: 9, width: 16, align: "center" },
      { id: "visitCount_1", label: "○1回目", x: 59.3, y: 10, fontSize: 14, width: 5, isCircle: true },
      { id: "visitCount_2", label: "○2回目", x: 73.2, y: 9.8, fontSize: 14, width: 5, isCircle: true },
      { id: "visitCount_3", label: "○3回目", x: 83.8, y: 12.5, fontSize: 14, width: 5, isCircle: true },
      { id: "status_done", label: "○完了", x: 63.2, y: 12.9, fontSize: 14, width: 5, isCircle: true },
      { id: "status_notYet", label: "○未", x: 86.8, y: 9.8, fontSize: 14, width: 5, isCircle: true },
      { id: "supportSpot", label: "応援印字位置", x: 70.2, y: 16.2, fontSize: 8, width: 25, align: "center" },
      { id: "contentLine_0", label: "工事内容(枠幅)", x: 4.1, y: 48.4, fontSize: 9, lineHeight: 6, width: 45 },
      { id: "dailyLine_0", label: "日報(枠幅)", x: 4.3, y: 76.3, fontSize: 9, lineHeight: 6, width: 91 },
      { id: "receipt", label: "領収書貼り付け位置", x: 57.3, y: 42.1, width: 34, heightRatio: 1.2 }
    ]
  },
  "marusan": {
    "fields": [
      { id: "supervisorName", label: "監督名", x: 52.7, y: 6.7, fontSize: 9, width: 18, align: "center" },
      { id: "date", label: "日付", x: 23.3, y: 16.8, fontSize: 8, width: 20, align: "left" },
      { id: "siteName", label: "現場名", x: 22.6, y: 20.4, fontSize: 9, width: 52 },
      { id: "startTime", label: "開始時間", x: 27.7, y: 24.1, fontSize: 8, width: 10 },
      { id: "endTime", label: "終了時間", x: 53.8, y: 24.1, fontSize: 8, width: 15 },
      { id: "content", label: "作業内容", x: 22.1, y: 27.0, fontSize: 8, width: 52, align: "left" },
      { id: "worker1", label: "作業者1", x: 28.4, y: 68.5, fontSize: 8, width: 15, align: "center" },
      { id: "worker2", label: "作業者2", x: 54.4, y: 68.6, fontSize: 8, width: 15, align: "center" },
      { id: "worker3", label: "作業者3", x: 28.3, y: 71.1, fontSize: 8, width: 15, align: "center" },
      { id: "worker4", label: "作業者4", x: 54.5, y: 71.3, fontSize: 8, width: 15, align: "center" },
      { id: "worker5", label: "作業者5", x: 28.4, y: 73.8, fontSize: 8, width: 15, align: "center" },
      { id: "worker6", label: "作業者6", x: 54.3, y: 73.8, fontSize: 8, width: 15, align: "center" }
    ]
  },
  "geppo": {
    "fields": geppoFields
  }
};

const CONFIG_KEY = 'pdf_layout_config';

export async function getPdfConfig() {
  const timeout = (ms) => new Promise(resolve => setTimeout(() => resolve(null), ms));
  const customConfig = await Promise.race([get(CONFIG_KEY), timeout(500)]) || {};
  
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  
  for (const type in customConfig) {
    if (config[type]) {
      customConfig[type].fields.forEach(cF => {
        const dF = config[type].fields.find(f => f.id === cF.id);
        if (dF) {
          dF.x = cF.x;
          dF.y = cF.y;
          dF.fontSize = cF.fontSize;
          dF.width = cF.width !== undefined ? cF.width : dF.width;
          if (cF.lineHeight) dF.lineHeight = cF.lineHeight;
          if (cF.align) dF.align = cF.align;
          if (cF.heightRatio) dF.heightRatio = cF.heightRatio;
        }
      });
    }
  }
  return config;
}

export async function savePdfConfig(type, fields) {
  const customConfig = await get(CONFIG_KEY) || {};
  customConfig[type] = { fields };
  await set(CONFIG_KEY, customConfig);
}

export async function savePdfConfigAll(configObj) {
  const customConfig = await get(CONFIG_KEY) || {};
  for (const type in configObj) {
    customConfig[type] = { fields: configObj[type].fields };
  }
  await set(CONFIG_KEY, customConfig);
}

export async function resetPdfConfig() {
  await set(CONFIG_KEY, {});
}
