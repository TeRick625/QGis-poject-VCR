import { addWorkspaceLayer, getMapInstance, workspaceLayers } from '../map.js';

export async function fetchWorkspace() {
    try {
        const response = await fetch('/api/workspace');
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
            return result.data;
        }
        console.warn('Неожиданный ответ от /api/workspace:', result);
        return [];
    } catch (err) {
        console.error('Ошибка загрузки workspace:', err);
        return [];
    }
}

export async function saveWorkspaceItem(item) {
    try {
        const payload = {
            name: item.name,
            type: item.type,
            format: item.format,
            polygonCoords: item.polygonCoords || null,
            visibleOnMap: item.visibleOnMap,
            layerId: item.layerId,
            associatedKml: item.associatedKml || null,
            parent_id: item.parent_id || null,
            sourceFile: item.sourceFile || null // 🆕 КРИТИЧЕСКОЕ ДОПОЛНЕНИЕ: Передаем путь к файлу на сервере!
        };

        const response = await fetch('/api/workspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (result.success && result.data) {
            return result.data;
        }
        console.warn('Ошибка при сохранении workspace item:', result);
        return null;
    } catch (err) {
        console.error('Ошибка запроса saveWorkspaceItem:', err);
        return null;
    }
}

export async function updateWorkspaceItem(id, updates) {
    try {
        const response = await fetch(`/api/workspace/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        const result = await response.json();
        return result.success;
    } catch (err) {
        console.error('Ошибка обновления workspace item:', err);
        return false;
    }
}

export async function deleteWorkspaceItem(id) {
    try {
        const response = await fetch(`/api/workspace/${id}`, {
            method: 'DELETE',
        });
        const result = await response.json();
        return result.success;
    } catch (err) {
        console.error('Ошибка удаления workspace item:', err);
        return false;
    }
}

// Установить связь parent-child
export async function linkItems(parentId, childId) {
    if (window.userRole && window.userRole !== 'guest') {
        await fetch(`/api/workspace/${parentId}/link/${childId}`, { method: 'POST' });
    }
}

// Удалить связь parent-child
export async function unlinkItems(parentId, childId) {
    if (window.userRole && window.userRole !== 'guest') {
        await fetch(`/api/workspace/${parentId}/link/${childId}`, { method: 'DELETE' });
    }
}

export async function loadWorkspaceFromServer(state, nextTick) {
    if (!window.userRole || window.userRole === 'guest') return;

    try {
        const items = await fetchWorkspace();
        if (items.length === 0) return;

        const existingIds = new Set(state.workspaceItems.map(i => i.id));

        // Добавляем / обновляем элементы
        for (const item of items) {
            if (existingIds.has(item.id)) {
                const existing = state.workspaceItems.find(i => i.id === item.id);
                Object.assign(existing, item, { sourceFile: null });
                existing.layerId = null;   // заставим пересоздать слой
            } else {
                if (typeof item.polygonCoords === 'string' && item.polygonCoords) {
                    try {
                        item.polygonCoords = JSON.parse(item.polygonCoords);
                    } catch (e) {
                        item.polygonCoords = null;
                    }
                }
                item.layerId = null;
                item.sourceFile = null;
                state.workspaceItems.push(item);
            }
        }

        // Удаляем лишние локальные элементы, которых нет на сервере
        const serverIds = new Set(items.map(i => i.id));
        state.workspaceItems = state.workspaceItems.filter(i => serverIds.has(i.id));

        // Функция добавления слоёв на карту
        const addLayersToMap = () => {
            state.workspaceItems.forEach(item => {
                if (item.polygonCoords && !item.layerId) {
                    const newLayerId = addWorkspaceLayer(item);
                    if (newLayerId) item.layerId = newLayerId;
                }
            });

            const map = getMapInstance();
            if (!map) return;
            const allLayers = Object.values(workspaceLayers).filter(l => l.getBounds);
            if (allLayers.length) {
                map.fitBounds(L.featureGroup(allLayers).getBounds().pad(0.2));
            }
        };

        // Ждём готовность карты
        if (getMapInstance()) {
            addLayersToMap();
        } else {
            const prev = window.onMapReady;
            window.onMapReady = () => {
                if (prev) prev();
                addLayersToMap();
            };
        }
    } catch (err) {
        console.error('Ошибка загрузки workspace:', err);
    }
}