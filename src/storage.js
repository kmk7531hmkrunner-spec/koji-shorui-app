export { get, set, del, keys } from 'idb-keyval';

/**
 * Data Schema:
 * projects: {
 *   id: string (uuid or timestamp),
 *   status: 'draft' | 'sent',
 *   type: 'kanryo' | 'marusan' | 'geppo',
 *   createdAt: number,
 *   updatedAt: number,
 *   companyName: string,
 *   workerName: string,
 *   date: string (YYYY-MM-DD),
 *   formData: object,
 *   receiptImage: Blob | null,
 *   receiptPosition: { x: number, y: number, scale: number } | null
 * }
 */

const STORAGE_KEY = 'koji_projects';

export async function getAllProjects() {
  const allKeys = await keys();
  const projects = [];
  for (const key of allKeys) {
    if (key.startsWith('project_')) {
      const p = await get(key);
      projects.push(p);
    }
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(project) {
  const id = project.id || `project_${Date.now()}`;
  const data = {
    ...project,
    id,
    updatedAt: Date.now()
  };
  await set(id, data);
  return data;
}

export async function getProject(id) {
  return await get(id);
}

export async function deleteProject(id) {
  await del(id);
}

export function generateDraftName(date, worker) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}${dd} ${worker || '作業者名未入力'}`;
}

export function generatePdfName(date, name, typeLabel) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${name}_${typeLabel}`;
}
