import { get, set } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

/**
 * MASTER CONFIG VERSION - Incrementing this forces all users to adopt the new hardcoded layout.
 */
const CURRENT_MASTER_VERSION = "20260426_V15";

/**
 * PDF Layout Configuration - HARDCODED FROM layout-config (6).json
 */
const DEFAULT_CONFIG = {
  "kanryo": {
    "fields": [
      { "id": "date", "label": "日付", "x": 10.60982142857143, "y": 35.23806615154384, "fontSize": 9, "width": 20, "align": "center" },
      { "id": "companyName", "label": "会社名", "x": 0.1, "y": 16.955977359028395, "fontSize": 12, "width": 42, "align": "center" },
      { "id": "officeName", "label": "事業所名", "x": 4.512723214285751, "y": 22.876050860743778, "fontSize": 11, "width": 35, "align": "center" },
      { "id": "supervisorName", "label": "監督名", "x": 16.68080357142857, "y": 27.871606144824845, "fontSize": 11, "width": 22, "align": "center" },
      { "id": "workerName", "label": "作業員", "x": 69.51941964285714, "y": 7.63309816856529, "fontSize": 9, "width": 26, "align": "center" },
      { "id": "orderNumber", "label": "注文番号", "x": 11.842857142857135, "y": 39.590226918730714, "fontSize": 9, "width": 23, "align": "center" },
      { "id": "siteName", "label": "現場名", "x": 40.3828125, "y": 35.355287135163756, "fontSize": 9, "width": 55 },
      { "id": "address", "label": "住所", "x": 48.814285714285795, "y": 39.32708568752609, "fontSize": 9, "width": 45, "align": "left" },
      { "id": "parkingFee", "label": "駐車場代", "x": 69.4810267857143, "y": 19.163531136426112, "fontSize": 9, "width": 26, "align": "center" },
      { "id": "highwayFee", "label": "高速代", "x": 69.53459821428578, "y": 21.954034959126126, "fontSize": 9, "width": 26, "align": "center" },
      { "id": "materialFee", "label": "材料代", "x": 69.5160714285715, "y": 24.739596249580064, "fontSize": 9, "width": 26, "align": "center" },
      { "id": "totalAmount", "label": "合計額", "x": 11.967633928571429, "y": 89.24498671471763, "fontSize": 9, "width": 20, "align": "center" },
      { "id": "taxAmount", "label": "消費税額", "x": 41.989955357142854, "y": 89.15766932372311, "fontSize": 9, "width": 16, "align": "center" },
      { "id": "visitCount_1", "label": "○1回目", "x": 59.39955357142859, "y": 10.02549043561474, "fontSize": 14, "width": 5, "isCircle": true },
      { "id": "visitCount_2", "label": "○2回目", "x": 73.24553571428548, "y": 9.853505583890703, "fontSize": 14, "width": 5, "isCircle": true },
      { "id": "visitCount_3", "label": "○3回目", "x": 83.84687500000007, "y": 12.506085779148721, "fontSize": 14, "width": 5, "isCircle": true },
      { "id": "status_done", "label": "○完了", "x": 63.22991071428572, "y": 12.914719685632553, "fontSize": 14, "width": 5, "isCircle": true },
      { "id": "status_notYet", "label": "○未", "x": 86.88995535714241, "y": 9.807826609249824, "fontSize": 14, "width": 5, "isCircle": true },
      { "id": "supportSpot", "label": "応援印字位置", "x": 70.23727678571431, "y": 16.2636564472986, "fontSize": 8, "width": 25, "align": "center" },
      { "id": "contentLine_0", "label": "工事内容(枠幅)", "x": 4.198660714285714, "y": 48.484663388612326, "fontSize": 9, "lineHeight": 6, "width": 45 },
      { "id": "dailyLine_0", "label": "日報(枠幅)", "x": 4.317410714285713, "y": 76.39902676399026, "fontSize": 9, "lineHeight": 6, "width": 91 },
      { "id": "receipt", "label": "領収書貼り付け位置", "x": 57.318080357142854, "y": 42.190536422698784, "width": 34, "heightRatio": 1.2 }
    ]
  },
  "marusan": {
    "fields": [
      { "id": "supervisorName", "label": "監督名", "x": 52.762276785714256, "y": 6.74604346931482, "fontSize": 9, "width": 18, "align": "center" },
      { "id": "date", "label": "日付", "x": 23.37678571428573, "y": 16.810173162517195, "fontSize": 8, "width": 20, "align": "left" },
      { "id": "siteName", "label": "現場名", "x": 22.605803571428567, "y": 20.43261606437011, "fontSize": 9, "width": 52 },
      { "id": "startTime", "label": "開始時間", "x": 27.758482142857126, "y": 24.164780541687875, "fontSize": 8, "width": 10 },
      { "id": "endTime", "label": "終了時間", "x": 53.89955357142857, "y": 24.132661547958115, "fontSize": 8, "width": 15 },
      { "id": "content", "label": "作業内容", "x": 22.197544642857142, "y": 27.051955252812952, "fontSize": 8, "width": 52, "align": "left" },
      { "id": "worker1", "label": "作業者1", "x": 28.46205357142857, "y": 68.56616454229432, "fontSize": 8, "width": 15, "align": "center" },
      { "id": "worker2", "label": "作業者2", "x": 54.49218749999998, "y": 68.62427415774141, "fontSize": 8, "width": 15, "align": "center" },
      { "id": "worker3", "label": "作業者3", "x": 28.369419642857142, "y": 71.18796850803001, "fontSize": 8, "width": 15, "align": "center" },
      { "id": "worker4", "label": "作業者4", "x": 54.51383928571423, "y": 71.37568685632598, "fontSize": 8, "width": 15, "align": "center" },
      { "id": "worker5", "label": "作業者5", "x": 28.464285714285708, "y": 73.84949697317549, "fontSize": 8, "width": 15, "align": "center" },
      { "id": "worker6", "label": "作業者6", "x": 54.393749999999955, "y": 73.84801983950791, "fontSize": 8, "width": 15, "align": "center" }
    ]
  },
  "geppo": {
    "fields": [
      { "id": "geppo_year", "label": "年", "x": 33.88526785714278, "y": 6.189996902404377, "fontSize": 7, "width": 7, "align": "center" },
      { "id": "geppo_month", "label": "月", "x": 43.57790178571427, "y": 6.244437679580434, "fontSize": 7, "width": 2, "align": "center" },
      { "id": "workerName", "label": "氏名", "x": 21.356473214285696, "y": 6.053275440339241, "fontSize": 7, "width": 10 },
      { "id": "row_0_day", "label": "1日", "x": 5.799999999999997, "y": 14.8, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_0_company", "label": "(行1)会社名", "x": 14.299999999999992, "y": 15.1, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_0_site", "label": "(行1)現場名", "x": 31.800000000000026, "y": 15.1, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_0_supervisor", "label": "(行1)監督名", "x": 55.399999999999935, "y": 15.1, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_0_address", "label": "(行1)住所", "x": 63.914285714285775, "y": 15.04178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_1_day", "label": "2日", "x": 5.799999999999997, "y": 17.35, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_1_company", "label": "(行2)会社名", "x": 14.299999999999992, "y": 17.65, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_1_site", "label": "(行2)現場名", "x": 31.800000000000026, "y": 17.65, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_1_supervisor", "label": "(行2)監督名", "x": 55.399999999999935, "y": 17.65, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_1_address", "label": "(行2)住所", "x": 63.914285714285775, "y": 17.59178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_2_day", "label": "3日", "x": 5.799999999999997, "y": 19.9, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_2_company", "label": "(行3)会社名", "x": 14.299999999999992, "y": 20.2, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_2_site", "label": "(行3)現場名", "x": 31.800000000000026, "y": 20.2, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_2_supervisor", "label": "(行3)監督名", "x": 55.399999999999935, "y": 20.2, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_2_address", "label": "(行3)住所", "x": 63.914285714285775, "y": 20.141789769389348, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_3_day", "label": "4日", "x": 5.799999999999997, "y": 22.45, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_3_company", "label": "(行4)会社名", "x": 14.299999999999992, "y": 22.75, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_3_site", "label": "(行4)現場名", "x": 31.800000000000026, "y": 22.75, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_3_supervisor", "label": "(行4)監督名", "x": 55.399999999999935, "y": 22.75, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_3_address", "label": "(行4)住所", "x": 63.914285714285775, "y": 22.69178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_4_day", "label": "5日", "x": 5.799999999999997, "y": 25, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_4_company", "label": "(行5)会社名", "x": 14.299999999999992, "y": 25.299999999999997, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_4_site", "label": "(行5)現場名", "x": 31.800000000000026, "y": 25.299999999999997, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_4_supervisor", "label": "(行5)監督名", "x": 55.399999999999935, "y": 25.299999999999997, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_4_address", "label": "(行5)住所", "x": 63.914285714285775, "y": 25.24178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_5_day", "label": "6日", "x": 5.799999999999997, "y": 27.55, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_5_company", "label": "(行6)会社名", "x": 14.299999999999992, "y": 27.85, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_5_site", "label": "(行6)現場名", "x": 31.800000000000026, "y": 27.85, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_5_supervisor", "label": "(行6)監督名", "x": 55.399999999999935, "y": 27.85, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_5_address", "label": "(行6)住所", "x": 63.914285714285775, "y": 27.79178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_6_day", "label": "7日", "x": 5.799999999999997, "y": 30.1, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_6_company", "label": "(行7)会社名", "x": 14.299999999999992, "y": 30.4, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_6_site", "label": "(行7)現場名", "x": 31.800000000000026, "y": 30.4, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_6_supervisor", "label": "(行7)監督名", "x": 55.399999999999935, "y": 30.4, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_6_address", "label": "(行7)住所", "x": 63.914285714285775, "y": 30.34178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_7_day", "label": "8日", "x": 5.799999999999997, "y": 32.65, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_7_company", "label": "(行8)会社名", "x": 14.299999999999992, "y": 32.949999999999996, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_7_site", "label": "(行8)現場名", "x": 31.800000000000026, "y": 32.949999999999996, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_7_supervisor", "label": "(行8)監督名", "x": 55.399999999999935, "y": 32.949999999999996, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_7_address", "label": "(行8)住所", "x": 63.914285714285775, "y": 32.89178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_8_day", "label": "9日", "x": 5.799999999999997, "y": 35.2, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_8_company", "label": "(行9)会社名", "x": 14.299999999999992, "y": 35.5, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_8_site", "label": "(行9)現場名", "x": 31.800000000000026, "y": 35.5, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_8_supervisor", "label": "(行9)監督名", "x": 55.399999999999935, "y": 35.5, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_8_address", "label": "(行9)住所", "x": 63.914285714285775, "y": 35.441789769389345, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_9_day", "label": "10日", "x": 5.799999999999997, "y": 37.75, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_9_company", "label": "(行10)会社名", "x": 14.299999999999992, "y": 38.05, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_9_site", "label": "(行10)現場名", "x": 31.800000000000026, "y": 38.05, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_9_supervisor", "label": "(行10)監督名", "x": 55.399999999999935, "y": 38.05, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_9_address", "label": "(行10)住所", "x": 63.914285714285775, "y": 37.99178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_10_day", "label": "11日", "x": 5.799999999999997, "y": 40.3, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_10_company", "label": "(行11)会社名", "x": 14.299999999999992, "y": 40.6, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_10_site", "label": "(行11)現場名", "x": 31.800000000000026, "y": 40.6, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_10_supervisor", "label": "(行11)監督名", "x": 55.399999999999935, "y": 40.6, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_10_address", "label": "(行11)住所", "x": 63.914285714285775, "y": 40.541789769389354, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_11_day", "label": "12日", "x": 5.799999999999997, "y": 42.849999999999994, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_11_company", "label": "(行12)会社名", "x": 14.299999999999992, "y": 43.15, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_11_site", "label": "(行12)現場名", "x": 31.800000000000026, "y": 43.15, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_11_supervisor", "label": "(行12)監督名", "x": 55.399999999999935, "y": 43.15, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_11_address", "label": "(行12)住所", "x": 63.914285714285775, "y": 43.09178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_12_day", "label": "13日", "x": 5.799999999999997, "y": 45.4, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_12_company", "label": "(行13)会社名", "x": 14.299999999999992, "y": 45.699999999999996, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_12_site", "label": "(行13)現場名", "x": 31.800000000000026, "y": 45.699999999999996, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_12_supervisor", "label": "(行13)監督名", "x": 55.399999999999935, "y": 45.699999999999996, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_12_address", "label": "(行13)住所", "x": 63.914285714285775, "y": 45.64178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_13_day", "label": "14日", "x": 5.799999999999997, "y": 47.95, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_13_company", "label": "(行14)会社名", "x": 14.299999999999992, "y": 48.25, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_13_site", "label": "(行14)現場名", "x": 31.800000000000026, "y": 48.25, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_13_supervisor", "label": "(行14)監督名", "x": 55.399999999999935, "y": 48.25, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_13_address", "label": "(行14)住所", "x": 63.914285714285775, "y": 48.191789769389345, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_14_day", "label": "15日", "x": 5.799999999999997, "y": 50.5, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_14_company", "label": "(行15)会社名", "x": 14.299999999999992, "y": 50.8, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_14_site", "label": "(行15)現場名", "x": 31.800000000000026, "y": 50.8, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_14_supervisor", "label": "(行15)監督名", "x": 55.399999999999935, "y": 50.8, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_14_address", "label": "(行15)住所", "x": 63.914285714285775, "y": 50.74178976938934, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_15_day", "label": "16日", "x": 5.799999999999997, "y": 53.05, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_15_company", "label": "(行16)会社名", "x": 14.299999999999992, "y": 53.35, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_15_site", "label": "(行16)現場名", "x": 31.800000000000026, "y": 53.35, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_15_supervisor", "label": "(行16)監督名", "x": 55.399999999999935, "y": 53.35, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_15_address", "label": "(行16)住所", "x": 63.914285714285775, "y": 53.291789769389354, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_16_day", "label": "17日", "x": 5.799999999999997, "y": 55.599999999999994, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_16_company", "label": "(行17)会社名", "x": 14.299999999999992, "y": 55.9, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_16_site", "label": "(行17)現場名", "x": 31.800000000000026, "y": 55.9, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_16_supervisor", "label": "(行17)監督名", "x": 55.399999999999935, "y": 55.9, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_16_address", "label": "(行17)住所", "x": 63.914285714285775, "y": 55.84178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_17_day", "label": "18日", "x": 5.799999999999997, "y": 58.14999999999999, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_17_company", "label": "(行18)会社名", "x": 14.299999999999992, "y": 58.449999999999996, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_17_site", "label": "(行18)現場名", "x": 31.800000000000026, "y": 58.449999999999996, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_17_supervisor", "label": "(行18)監督名", "x": 55.399999999999935, "y": 58.449999999999996, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_17_address", "label": "(行18)住所", "x": 63.914285714285775, "y": 58.39178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_18_day", "label": "19日", "x": 5.799999999999997, "y": 60.7, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_18_company", "label": "(行19)会社名", "x": 14.299999999999992, "y": 61, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_18_site", "label": "(行19)現場名", "x": 31.800000000000026, "y": 61, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_18_supervisor", "label": "(行19)監督名", "x": 55.399999999999935, "y": 61, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_18_address", "label": "(行19)住所", "x": 63.914285714285775, "y": 60.941789769389345, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_19_day", "label": "20日", "x": 5.799999999999997, "y": 63.25, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_19_company", "label": "(行20)会社名", "x": 14.299999999999992, "y": 63.55, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_19_site", "label": "(行20)現場名", "x": 31.800000000000026, "y": 63.55, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_19_supervisor", "label": "(行20)監督名", "x": 55.399999999999935, "y": 63.55, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_19_address", "label": "(行20)住所", "x": 63.914285714285775, "y": 63.49178976938934, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_20_day", "label": "21日", "x": 5.799999999999997, "y": 65.8, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_20_company", "label": "(行21)会社名", "x": 14.299999999999992, "y": 66.1, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_20_site", "label": "(行21)現場名", "x": 31.800000000000026, "y": 66.1, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_20_supervisor", "label": "(行21)監督名", "x": 55.399999999999935, "y": 66.1, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_20_address", "label": "(行21)住所", "x": 63.914285714285775, "y": 66.04178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_21_day", "label": "22日", "x": 5.799999999999997, "y": 68.35, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_21_company", "label": "(行22)会社名", "x": 14.299999999999992, "y": 68.64999999999999, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_21_site", "label": "(行22)現場名", "x": 31.800000000000026, "y": 68.64999999999999, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_21_supervisor", "label": "(行22)監督名", "x": 55.399999999999935, "y": 68.64999999999999, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_21_address", "label": "(行22)住所", "x": 63.914285714285775, "y": 68.59178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_22_day", "label": "23日", "x": 5.799999999999997, "y": 70.89999999999999, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_22_company", "label": "(行23)会社名", "x": 14.299999999999992, "y": 71.19999999999999, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_22_site", "label": "(行23)現場名", "x": 31.800000000000026, "y": 71.19999999999999, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_22_supervisor", "label": "(行23)監督名", "x": 55.399999999999935, "y": 71.19999999999999, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_22_address", "label": "(行23)住所", "x": 63.914285714285775, "y": 71.14178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_23_day", "label": "24日", "x": 5.799999999999997, "y": 73.45, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_23_company", "label": "(行24)会社名", "x": 14.299999999999992, "y": 73.75, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_23_site", "label": "(行24)現場名", "x": 31.800000000000026, "y": 73.75, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_23_supervisor", "label": "(行24)監督名", "x": 55.399999999999935, "y": 73.75, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_23_address", "label": "(行24)住所", "x": 63.914285714285775, "y": 73.69178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_24_day", "label": "25日", "x": 5.799999999999997, "y": 76, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_24_company", "label": "(行25)会社名", "x": 14.299999999999992, "y": 76.3, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_24_site", "label": "(行25)現場名", "x": 31.800000000000026, "y": 76.3, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_24_supervisor", "label": "(行25)監督名", "x": 55.399999999999935, "y": 76.3, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_24_address", "label": "(行25)住所", "x": 63.914285714285775, "y": 76.24178976938934, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_25_day", "label": "26日", "x": 5.799999999999997, "y": 78.55, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_25_company", "label": "(行26)会社名", "x": 14.299999999999992, "y": 78.85, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_25_site", "label": "(行26)現場名", "x": 31.800000000000026, "y": 78.85, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_25_supervisor", "label": "(行26)監督名", "x": 55.399999999999935, "y": 78.85, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_25_address", "label": "(行26)住所", "x": 63.914285714285775, "y": 78.79178976938934, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_26_day", "label": "27日", "x": 5.799999999999997, "y": 81.1, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_26_company", "label": "(行27)会社名", "x": 14.299999999999992, "y": 81.39999999999999, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_26_site", "label": "(行27)現場名", "x": 31.800000000000026, "y": 81.39999999999999, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_26_supervisor", "label": "(行27)監督名", "x": 55.399999999999935, "y": 81.39999999999999, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_26_address", "label": "(行27)住所", "x": 63.914285714285775, "y": 81.34178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_27_day", "label": "28日", "x": 5.799999999999997, "y": 83.64999999999999, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_27_company", "label": "(行28)会社名", "x": 14.299999999999992, "y": 83.94999999999999, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_27_site", "label": "(行28)現場名", "x": 31.800000000000026, "y": 83.94999999999999, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_27_supervisor", "label": "(行28)監督名", "x": 55.399999999999935, "y": 83.94999999999999, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_27_address", "label": "(行28)住所", "x": 63.914285714285775, "y": 83.89178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_28_day", "label": "29日", "x": 5.799999999999997, "y": 86.19999999999999, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_28_company", "label": "(行29)会社名", "x": 14.299999999999992, "y": 86.49999999999999, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_28_site", "label": " (行29)現場名", "x": 31.800000000000026, "y": 86.49999999999999, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_28_supervisor", "label": "(行29)監督名", "x": 55.399999999999935, "y": 86.49999999999999, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_28_address", "label": "(行29)住所", "x": 63.914285714285775, "y": 86.44178976938935, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_29_day", "label": "30日", "x": 5.799999999999997, "y": 88.74999999999999, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_29_company", "label": "(行30)会社名", "x": 14.299999999999992, "y": 89.04999999999998, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_29_site", "label": "(行30)現場名", "x": 31.800000000000026, "y": 89.04999999999998, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_29_supervisor", "label": "(行30)監督名", "x": 55.399999999999935, "y": 89.04999999999998, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_29_address", "label": "(行30)住所", "x": 63.914285714285775, "y": 88.99178976938934, "fontSize": 7, "width": 33, "align": "center" },
      { "id": "row_30_day", "label": "31日", "x": 5.799999999999997, "y": 91.3, "fontSize": 7, "width": 5, "align": "center" },
      { "id": "row_30_company", "label": "(行31)会社名", "x": 14.299999999999992, "y": 91.6, "fontSize": 7, "width": 17, "align": "center" },
      { "id": "row_30_site", "label": "(行31)現場名", "x": 31.800000000000026, "y": 91.6, "fontSize": 7, "width": 23, "align": "center" },
      { "id": "row_30_supervisor", "label": "(行31)監督名", "x": 55.399999999999935, "y": 91.6, "fontSize": 7, "width": 8, "align": "center" },
      { "id": "row_30_address", "label": "(行31)住所", "x": 63.914285714285775, "y": 91.54178976938935, "fontSize": 7, "width": 33, "align": "center" }
    ]
  }
};

const CONFIG_KEY = 'pdf_layout_config';
const CONFIG_VERSION_KEY = 'pdf_layout_version';

export async function getPdfConfig() {
    // 1. Check version in database
    const storedVersion = await get(CONFIG_VERSION_KEY);
    
    // 2. If version mismatch, force update stored config to DEFAULT_CONFIG
    if (storedVersion !== CURRENT_MASTER_VERSION) {
        console.log("PDF Config version mismatch. Resetting to master settings...");
        await set(CONFIG_KEY, JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
        await set(CONFIG_VERSION_KEY, CURRENT_MASTER_VERSION);
    }

    const timeout = (ms) => new Promise(resolve => setTimeout(() => resolve(null), ms));
    const customConfig = await Promise.race([get(CONFIG_KEY), timeout(500)]) || {};
    
    // Return the config from database (which is now guaranteed to be at least as recent as our hardcoded one)
    return customConfig;
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
    await set(CONFIG_KEY, JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
    await set(CONFIG_VERSION_KEY, CURRENT_MASTER_VERSION);
}
