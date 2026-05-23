// static/js/modules/api_workspace.js

/**
 * Загрузить все объекты workspace текущего пользователя.
 * @returns {Promise<Array>} массив объектов (или пустой массив при ошибке)
 */
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

/**
 * Создать новый объект workspace на сервере.
 * @param {Object} item — объект в формате workspaceItems
 * @returns {Promise<Object|null>} созданный объект с полями id, layerId и т.д., или null
 */
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

/**
 * Обновить существующий объект (пока не используется, но скоро понадобится).
 */
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

/**
 * Удалить объект по id.
 */
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

/**
 * Загрузить рабочую область с сервера и заполнить state.
 * @param {Object} state - реактивный state Alpine
 * @param {Function} nextTick - $nextTick из Alpine-компонента (для обновления карты)
 */
export async function loadWorkspaceFromServer(state, nextTick) {
    if (!window.userRole || window.userRole === 'guest') return;

    try {
        const items = await fetchWorkspace();
        if (items.length === 0) return;

        // Добавляем новые объекты
        for (const item of items) {
            const exists = state.workspaceItems.find(i => i.id === item.id);
            if (!exists) {
                state.workspaceItems.push({ ...item, kmlData: null, sourceFile: null });
            }
        }

        // Переносим данные KML внутрь аэро и удаляем отдельные KML из массива
        const toRemove = [];
        for (const item of state.workspaceItems) {
            if (item.type === 'aero' && item.associatedKml) {
                const kmlItem = state.workspaceItems.find(i => i.id === item.associatedKml);
                if (kmlItem) {
                    item.kmlData = {
                        id: kmlItem.id,
                        name: kmlItem.name,
                        type: kmlItem.type,
                        format: kmlItem.format,
                        dateAdded: kmlItem.dateAdded,
                        polygonCoords: kmlItem.polygonCoords,
                        visibleOnMap: kmlItem.visibleOnMap,
                        layerId: kmlItem.layerId,
                    };
                    toRemove.push(kmlItem.id);
                }
            }
        }
        // Удаляем перенесённые KML
        state.workspaceItems = state.workspaceItems.filter(i => !toRemove.includes(i.id));

        // Добавляем слои на карту
        nextTick(() => {
            state.workspaceItems.forEach(item => {
                if (item.polygonCoords && !item.layerId && window.addWorkspaceLayer) {
                    const layerId = window.addWorkspaceLayer(item);
                    if (layerId) item.layerId = layerId;
                }
                // Для дочерних KML тоже можно добавить слой, если нужно
                if (item.kmlData && item.kmlData.polygonCoords && !item.kmlData.layerId && window.addWorkspaceLayer) {
                    const layerId = window.addWorkspaceLayer(item.kmlData);
                    if (layerId) item.kmlData.layerId = layerId;
                }
            });
        });
    } catch (err) {
        console.error('Ошибка загрузки workspace:', err);
    }
}