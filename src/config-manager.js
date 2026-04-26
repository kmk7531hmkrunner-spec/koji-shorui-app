import { get, set } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

/**
 * PDF Layout Configuration
 */
const geppoFields = [
  { id: "geppo_year", label: "年", x: 10, y: 5, fontSize: 12, width: 10 },
  { id: "geppo_month", label: "月", x: 25, y: 5, fontSize: 12, width: 10 },
  { id: "workerName", label: "氏名", x: 40, y: 5, fontSize: 12, width: 20 }
];

// Generate ONLY THE FIRST row for Geppo as requested
const yBase = 15;
geppoFields.push({ id: `row_0_day`, label: `1日`, x: 5, y: yBase, fontSize: 9, width: 5 });
geppoFields.push({ id: `row_0_company`, label: `(行1)会社名`, x: 12, y: yBase, fontSize: 9, width: 15 });
geppoFields.push({ id: `row_0_site`, label: `(行1)現場名`, x: 30, y: yBase, fontSize: 9, width: 25 });
geppoFields.push({ id: `row_0_supervisor`, label: `(行1)監督名`, x: 60, y: yBase, fontSize: 9, width: 10 });
geppoFields.push({ id: `row_0_address`, label: `(行1)住所`, x: 75, y: yBase, fontSize: 9, width: 20 });

const DEFAULT_CONFIG = {
  "kanryo": {
    "fields": [
      { id: "date", label: "日付", x: 10.60982142857143, y: 35.23806615154384, fontSize: 9, width: 20, align: "center" },
      { id: "companyName", label: "会社名", x: 0.1, y: 16.955977359028395, fontSize: 12, width: 42, align: "center" },
      { id: "officeName", label: "事業所名", x: 4.512723214285751, y: 22.876050860743778, fontSize: 11, width: 35, align: "center" },
      { id: "supervisorName", label: "監督名", x: 16.68080357142857, y: 27.871606144824845, fontSize: 11, width: 22, align: "center" },
      { id: "workerName", label: "作業員", x: 69.51941964285714, y: 7.63309816856529, fontSize: 9, width: 26, align: "center" },
      { id: "orderNumber", label: "注文番号", x: 11.842857142857135, y: 39.590226918730714, fontSize: 9, width: 23, align: "center" },
      { id: "siteName", label: "現場名", x: 40.3828125, y: 35.355287135163756, fontSize: 9, width: 55 },
      { id: "address", label: "住所", x: 48.814285714285795, y: 39.32708568752609, fontSize: 9, width: 45, align: "left" },
      { id: "parkingFee", label: "駐車場代", x: 69.4810267857143, y: 19.163531136426112, fontSize: 9, width: 26, align: "center" },
      { id: "highwayFee", label: "高速代", x: 69.53459821428578, y: 21.954034959126126, fontSize: 9, width: 26, align: "center" },
      { id: "materialFee", label: "材料代", x: 69.5160714285715, y: 24.739596249580064, fontSize: 9, width: 26, align: "center" },
      { id: "totalAmount", label: "合計額", x: 11.967633928571429, y: 89.24498671471763, fontSize: 9, width: 20, align: "center" },
      { id: "taxAmount", label: "消費税額", x: 41.989955357142854, y: 89.15766932372311, fontSize: 9, width: 16, align: "center" },
      { id: "visitCount_1", label: "○1回目", x: 59.39955357142859, y: 10.02549043561474, fontSize: 14, width: 5, isCircle: true },
      { id: "visitCount_2", label: "○2回目", x: 73.24553571428548, y: 9.853505583890703, fontSize: 14, width: 5, isCircle: true },
      { id: "visitCount_3", label: "○3回目", x: 83.84687500000007, y: 12.506085779148721, fontSize: 14, width: 5, isCircle: true },
      { id: "status_done", label: "○完了", x: 63.22991071428572, y: 12.914719685632553, fontSize: 14, width: 5, isCircle: true },
      { id: "status_notYet", label: "○未", x: 86.88995535714241, y: 9.807826609249824, fontSize: 14, width: 5, isCircle: true },
      { id: "supportSpot", label: "応援印字位置", x: 70.23727678571431, y: 16.2636564472986, fontSize: 8, width: 25, align: "center" },
      { id: "contentLine_0", label: "工事内容(枠幅)", x: 4.198660714285714, y: 48.484663388612326, fontSize: 9, lineHeight: 6, width: 45 },
      { id: "dailyLine_0", label: "日報(枠幅)", x: 4.317410714285713, y: 76.39902676399026, fontSize: 9, lineHeight: 6, width: 91 },
      { id: "receipt", label: "領収書貼り付け位置", x: 57.318080357142854, y: 42.190536422698784, width: 34, heightRatio: 1.2 }
    ]
  },
  "marusan": {
    "fields": [
      { id: "supervisorName", label: "監督名", x: 52.762276785714256, y: 6.74604346931482, fontSize: 9, width: 18, align: "center" },
      { id: "date", label: "日付", x: 23.37678571428573, y: 16.810173162517195, fontSize: 8, width: 20, align: "left" },
      { id: "siteName", label: "現場名", x: 22.605803571428567, y: 20.43261606437011, fontSize: 9, width: 52 },
      { id: "startTime", label: "開始時間", x: 27.758482142857126, y: 24.164780541687875, fontSize: 8, width: 10 },
      { id: "endTime", label: "終了時間", x: 53.89955357142857, y: 24.132661547958115, fontSize: 8, width: 15 },
      { id: "content", label: "作業内容", x: 22.197544642857142, y: 27.051955252812952, fontSize: 8, width: 52, align: "left" },
      { id: "worker1", label: "作業者1", x: 28.46205357142857, y: 68.56616454229432, fontSize: 8, width: 15, align: "center" },
      { id: "worker2", label: "作業者2", x: 54.49218749999998, y: 68.62427415774141, fontSize: 8, width: 15, align: "center" },
      { id: "worker3", label: "作業者3", x: 28.369419642857142, y: 71.18796850803001, fontSize: 8, width: 15, align: "center" },
      { id: "worker4", label: "作業者4", x: 54.51383928571423, y: 71.37568685632598, fontSize: 8, width: 15, align: "center" },
      { id: "worker5", label: "作業者5", x: 28.464285714285708, y: 73.84949697317549, fontSize: 8, width: 15, align: "center" },
      { id: "worker6", label: "作業者6", x: 54.393749999999955, y: 73.84801983950791, fontSize: 8, width: 15, align: "center" }
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
