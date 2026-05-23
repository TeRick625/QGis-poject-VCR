// static/js/modules/tab1_table.js

import {
    saveWorkspaceItem, updateWorkspaceItem, deleteWorkspaceItem
} from './api_workspace.js';

/** Определить тип файла по расширению */
export function detectFileType(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.kml')) return { type: 'polygon', format: 'kml' };
    if (name.endsWith('.tif') || name.endsWith('.tiff')) return { type: 'satellite', format: 'geotiff' };
    if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png'))
        return { type: 'aero', format: name.split('.').pop() };
    return { type: 'unknown', format: 'unknown' };
}

/* ========== Заглушки парсинга координат ========== */
/**
 * Парсинг KML и получение координат первого найденного полигона
 * @param {File} file
 * @returns {Promise<Array>} массив координат [[lat,lng],...]
 */
async function parseKmlCoordinates(file) {
    const text = await file.text();
    const parser = new DOMParser();
    const kml = parser.parseFromString(text, 'application/xml');
    // Ищем все координаты внутри <coordinates>
    const coordNodes = kml.getElementsByTagName('coordinates');
    if (coordNodes.length === 0) {
        console.warn('KML не содержит тегов <coordinates>');
        return null;
    }
    // Берём первый полигон (можно улучшить для нескольких)
    const coordText = coordNodes[0].textContent.trim();
    // Формат: "lon,lat,alt lon,lat,alt ..."
    const points = coordText.split(/\s+/).filter(p => p.includes(','));
    const coords = points.map(p => {
        const [lng, lat] = p.split(',').map(Number);
        return [lat, lng]; // Leaflet ожидает [lat, lng]
    });
    return coords.length >= 3 ? coords : null;
}

/**
 * Извлечение bounding box для GeoTIFF (пока вариативная заглушка)
 * В будущем можно заменить на вызов сервера с rasterio
 * @param {File} file
 * @returns {Promise<Array>}
 */
async function extractSatelliteBounds(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/geotiff/bounds', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            return data.coordinates;
        } else {
            console.error('Ошибка сервера при чтении GeoTIFF:', data.error);
            return null;
        }
    } catch (err) {
        console.error('Ошибка запроса к серверу:', err);
        return null;
    }
}

/* ========== Добавление объектов ========== */

/** Добавить элемент в таблицу из файла (drag&drop или input) */
export async function addWorkspaceItem(state, file) {
    const { type, format } = detectFileType(file);
    if (type === 'unknown') { console.warn('Неподдерживаемый формат:', file.name); return null; }
    let polygonCoords = null;
    if (type === 'polygon' && format === 'kml') polygonCoords = await parseKmlCoordinates(file);
    else if (type === 'satellite' && format === 'geotiff') polygonCoords = await extractSatelliteBounds(file);

    const newItem = {
        id: Date.now() + Math.random(),
        name: file.name, type, format,
        dateAdded: new Date().toISOString(),
        sourceFile: file,
        polygonCoords,
        visibleOnMap: !!polygonCoords,
        layerId: null, associatedKml: null, imageThumbnail: null
    };
    state.workspaceItems.push(newItem);

    // Сохраняем на сервер и ждём ответа, чтобы получить реальный id
    if (window.userRole && window.userRole !== 'guest') {
        const savedItem = await saveWorkspaceItem(newItem);
        if (savedItem && savedItem.id) {
            newItem.id = savedItem.id;   // обновляем id на реальный из БД
        }
    }
    return newItem;
}

export async function detachKmlFromAero(state, aeroId) {
    const aero = state.workspaceItems.find(i => i.id === aeroId);
    if (!aero || !aero.associatedKml) return;

    const kmlId = aero.associatedKml;
    // Убираем связь
    aero.associatedKml = null;

    // Возвращаем KML в общий список как самостоятельный полигон
    // Предполагаем, что он уже есть в workspaceItems (он был скрыт фильтром)
    const kmlItem = state.workspaceItems.find(i => i.id === kmlId);
    if (kmlItem) {
        // Уже есть, ничего не делаем
    } else {
        // Если вдруг отсутствовал, но такого быть не должно
    }

    // Обновляем на сервере
    if (window.userRole && window.userRole !== 'guest') {
        await updateWorkspaceItem(aeroId, { associatedKml: null });
        // Снимаем метку дочернего объекта, если нужно (на сервере KML остаётся)
    }
}

/** Добавить полигон по координатам */
export async function addPolygonFromCoords(state, coords, name = null) {
    if (!coords || coords.length < 3) return null;
    const newItem = {
        id: Date.now() + Math.random(),
        name: name || 'Полигон (коорд.)',
        type: 'polygon', format: 'manual',
        dateAdded: new Date().toISOString(),
        sourceFile: null,
        polygonCoords: coords,
        visibleOnMap: true,
        layerId: null, associatedKml: null, imageThumbnail: null
    };
    state.workspaceItems.push(newItem);

    // Сохраняем на сервер и ждём реального id
    if (window.userRole && window.userRole !== 'guest') {
        const savedItem = await saveWorkspaceItem(newItem);
        if (savedItem && savedItem.id) {
            newItem.id = savedItem.id;
        }
    }
    return newItem;
}

/** Добавить нарисованный на карте полигон */
export async function addDrawnPolygonToWorkspace(state, coords, layer) {
    const newItem = {
        id: Date.now() + Math.random(),
        name: 'Нарисованный полигон',
        type: 'polygon', format: 'manual',
        dateAdded: new Date().toISOString(),
        sourceFile: null,
        polygonCoords: coords,
        visibleOnMap: true,
        layerId: null, associatedKml: null, imageThumbnail: null
    };
    state.workspaceItems.push(newItem);
    newItem.layerId = 'workspace_' + newItem.id;
    layer._workspaceLayerId = newItem.layerId;
    newItem._leafletLayer = layer;

    if (window.registerWorkspaceLayer) window.registerWorkspaceLayer(newItem.layerId, layer);
    if (window.attachLayerEventsToLayer) window.attachLayerEventsToLayer(layer, newItem.id);

    // Сохраняем на сервер и ждём реального id
    if (window.userRole && window.userRole !== 'guest') {
        const savedItem = await saveWorkspaceItem(newItem);
        if (savedItem && savedItem.id) {
            newItem.id = savedItem.id;
        }
    }
    return newItem;
}

/* ========== Удаление и видимость ========== */

export function removeWorkspaceItem(state, itemId) {
    if (state.editingItemId === itemId) {
        const item = state.workspaceItems.find(i => i.id === itemId);
        if (item && window.cancelLayerEdit) {
            window.cancelLayerEdit(item.layerId);
        }
        state.editingItemId = null;
    }

    const index = state.workspaceItems.findIndex(item => item.id === itemId);
    if (index === -1) return;
    const item = state.workspaceItems[index];

    // Если у удаляемого аэро есть привязанный KML, удаляем и его
    if (item.associatedKml) {
        const kmlItem = state.workspaceItems.find(i => i.id === item.associatedKml);
        if (kmlItem) {
            if (kmlItem.layerId && window.removeWorkspaceLayer) {
                window.removeWorkspaceLayer(kmlItem.layerId);
            }
            const kmlIdx = state.workspaceItems.indexOf(kmlItem);
            if (kmlIdx !== -1) state.workspaceItems.splice(kmlIdx, 1);
            // Удаляем с сервера
            if (window.userRole && window.userRole !== 'guest') {
                deleteWorkspaceItem(kmlItem.id);
            }
        }
    }

    // Удаляем слой и сам объект
    if (item.layerId && window.removeWorkspaceLayer) {
        window.removeWorkspaceLayer(item.layerId);
    }
    state.workspaceItems.splice(index, 1);

    // Удаляем с сервера основной объект
    if (window.userRole && window.userRole !== 'guest') {
        deleteWorkspaceItem(itemId);
    }
}

export function toggleItemVisibility(state, itemId) {
    const item = state.workspaceItems.find(i => i.id === itemId);
    if (!item || !item.polygonCoords) return;
    item.visibleOnMap = !item.visibleOnMap;
    if (item.visibleOnMap) {
        if (!item.layerId && window.addWorkspaceLayer) {
            const layerId = window.addWorkspaceLayer(item);
            if (layerId) item.layerId = layerId;
        } else if (item.layerId && window.showWorkspaceLayer) {
            window.showWorkspaceLayer(item.layerId);
        }
    } else {
        if (item.layerId && window.hideWorkspaceLayer) window.hideWorkspaceLayer(item.layerId);
    }
    if (window.userRole && window.userRole !== 'guest') {
        updateWorkspaceItem(itemId, { visibleOnMap: item.visibleOnMap });
    }
}

/* ========== Подсветка и выделение ========== */

export function highlightTableRow(state, itemId, flag) {
    state.highlightedItemId = flag ? itemId : null;
}

export function selectTableRow(state, itemId) {
    state.selectedWorkspaceItemId = itemId;
}

export function highlightItemOnMap(item) {
    if (window.highlightLayer) window.highlightLayer(item.layerId);
}

export function unhighlightItemOnMap(item) {
    if (window.unhighlightLayer) window.unhighlightLayer(item.layerId);
}

export function zoomToItem(item) {
    if (window.fitBoundsToLayer) window.fitBoundsToLayer(item.layerId);
}

/* ========== Редактирование ========== */

export function startEditItem(state, item) {
    if (!window.startEditLayer) return;
    if (state.editingItemId === item.id) {
        window.cancelLayerEdit(item.layerId);
        state.editingItemId = null;
        return;
    }
    // Отключаем все другие редактирования
    if (state.editingItemId) {
        const prev = state.workspaceItems.find(i => i.id === state.editingItemId);
        if (prev) window.cancelLayerEdit(prev.layerId);
    }
    window.startEditLayer(item.layerId);
    state.editingItemId = item.id;
}

export function finishEditLayer(state, layerId) {
    if (state.editingItemId && state.workspaceItems.find(i => i.layerId === layerId)) {
        state.editingItemId = null;
    }
}

/* ========== Сортировка и фильтрация ========== */

/**
 * Возвращает отфильтрованный и отсортированный массив элементов
 * @param {Object} state
 * @returns {Array}
 */
export function getFilteredSortedItems(state) {
    let items = state.workspaceItems.filter(item => {
        return state.workspaceFilter[item.type] === true;
    });

    // Сортировка
    items.sort((a, b) => {
        let valA, valB;
        if (state.workspaceSort === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            return state.workspaceSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else { // по дате добавления
            valA = new Date(a.dateAdded);
            valB = new Date(b.dateAdded);
            return state.workspaceSortAsc ? valA - valB : valB - valA;
        }
    });

    return items;
}

/* ========== Переименование ========== */

/**
 * Начать переименование элемента (только для manual и kml полигонов, а также аэро без привязки)
 * @param {Object} state
 * @param {number} itemId
 */
export function startRenameItem(state, itemId) {
    const item = state.workspaceItems.find(i => i.id === itemId);
    if (!item) return;
    // Разрешаем переименование только для объектов, не загруженных из файлов
    // (format: manual, kml, или jpg/png без associatedKml)
    if (item.format === 'geotiff') return; // спутниковые снимки не переименовываем
    state.renamingItemId = itemId;
    state.renamingValue = item.name;
}

/**
 * Применить переименование
 * @param {Object} state
 */
export function applyRename(state) {
    const item = state.workspaceItems.find(i => i.id === state.renamingItemId);
    if (item && state.renamingValue.trim()) {
        item.name = state.renamingValue.trim();
    }
    state.renamingItemId = null;
    state.renamingValue = '';
}

/**
 * Отменить переименование
 * @param {Object} state
 */
export function cancelRename(state) {
    state.renamingItemId = null;
    state.renamingValue = '';
}

// Удалить аэро, оставив связанный KML как самостоятельный полигон
export async function removeAeroItem(state, aeroId) {
    const aero = state.workspaceItems.find(i => i.id === aeroId);
    if (!aero || aero.type !== 'aero' || !aero.associatedKml) {
        // если нет KML, просто удаляем обычным способом
        removeWorkspaceItem(state, aeroId);
        return;
    }

    // Отвязываем KML
    const kmlId = aero.associatedKml;
    aero.associatedKml = null;

    // Обновляем сервер (убираем связь у аэро перед удалением, но мы удалим аэро, поэтому можно просто удалить аэро, а KML останется)
    // Удаляем аэро с сервера
    if (window.userRole && window.userRole !== 'guest') {
        await deleteWorkspaceItem(aeroId);
    }

    // Удаляем аэро из локального массива и карты
    const index = state.workspaceItems.findIndex(i => i.id === aeroId);
    if (index !== -1) {
        if (aero.layerId && window.removeWorkspaceLayer) {
            window.removeWorkspaceLayer(aero.layerId);
        }
        state.workspaceItems.splice(index, 1);
    }

    // Теперь KML должен стать видимым в таблице (фильтр linkedKmlIds больше не будет его скрывать)
    // Никаких дополнительных действий не требуется, перерисовка произойдёт автоматически
}

// Удалить KML, оставив аэро без привязки
export async function removeKmlFromAero(state, aeroId) {
    const aero = state.workspaceItems.find(i => i.id === aeroId);
    if (!aero || !aero.associatedKml) return;

    const kmlId = aero.associatedKml;
    aero.associatedKml = null;

    // Удаляем KML с сервера
    if (window.userRole && window.userRole !== 'guest') {
        await deleteWorkspaceItem(kmlId);
    }

    // Удаляем KML из локального массива и карты
    const kmlItem = state.workspaceItems.find(i => i.id === kmlId);
    if (kmlItem) {
        if (kmlItem.layerId && window.removeWorkspaceLayer) {
            window.removeWorkspaceLayer(kmlItem.layerId);
        }
        const kmlIdx = state.workspaceItems.indexOf(kmlItem);
        if (kmlIdx !== -1) state.workspaceItems.splice(kmlIdx, 1);
    }

    // Обновляем аэро на сервере (убираем associatedKml)
    if (window.userRole && window.userRole !== 'guest') {
        await updateWorkspaceItem(aeroId, { associatedKml: null });
    }
}