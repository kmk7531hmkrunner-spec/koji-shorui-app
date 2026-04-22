// Advanced Storage Engine with LocalStorage Fallback
import * as idb from 'idb-keyval';

const STORAGE_KEY = 'koji_projects_v2';

// Safe wrapper for idb-keyval with localStorage fallback
async function safeGet(key) {
    try {
        return await idb.get(key);
    } catch (e) {
        console.warn("IDB failed, falling back to localStorage", e);
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
    }
}

async function safeSet(key, val) {
    try {
        await idb.set(key, val);
    } catch (e) {
        console.warn("IDB set failed, falling back to localStorage", e);
        localStorage.setItem(key, JSON.stringify(val));
    }
}

async function safeDel(key) {
    try {
        await idb.del(key);
    } catch (e) {
        localStorage.removeItem(key);
    }
}

export async function getAllProjects() {
    try {
        const keys = await idb.keys();
        const projects = [];
        for (const key of keys) {
            if (String(key).startsWith('project_')) {
                const p = await safeGet(key);
                if (p) projects.push(p);
            }
        }
        return projects.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
        // Fallback for list
        const projects = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('project_')) {
                projects.push(JSON.parse(localStorage.getItem(key)));
            }
        }
        return projects.sort((a, b) => b.updatedAt - a.updatedAt);
    }
}

export async function saveProject(project) {
    const id = project.id || `project_${Date.now()}`;
    const data = { ...project, id, updatedAt: Date.now() };
    await safeSet(id, data);
    return data;
}

export async function getProject(id) {
    return await safeGet(id);
}

export async function deleteProject(id) {
    await safeDel(id);
}

export function generateDraftName(date, worker) {
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')} ${worker || '未入力'}`;
}

export function generatePdfName(date, name, typeLabel) {
    const d = new Date(date);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${name}_${typeLabel}`;
}

// Export raw primitives for legacy support if needed
export const get = safeGet;
export const set = safeSet;
