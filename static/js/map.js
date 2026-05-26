// static/js/map.js


let mapInstance = null;
let editableFeatureGroup = null;
export const workspaceLayers = {};

export function getMapInstance() {
    return mapInstance;
}

function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error("Элемент #map не найден");
        return;
    }

    if (mapInstance) {
        mapInstance.invalidateSize();
        return;
    }

    mapInstance = L.map('map', {
        center: [43.1155, 131.8855],
        zoom: 8,
        zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        maxZoom: 19
    }).addTo(mapInstance);

    mapInstance.attributionControl.setPrefix(false);
    mapInstance.attributionControl._container.style.display = 'none';

    // Группа для редактируемых полигонов
    editableFeatureGroup = new L.FeatureGroup();
    mapInstance.addLayer(editableFeatureGroup);

    const drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                shapeOptions: { color: '#3b82f6', weight: 3, opacity: 0.9, fillOpacity: 0.2 }
            },
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false
        },
        edit: {
            featureGroup: editableFeatureGroup
        }
    });
    mapInstance.addControl(drawControl);

    // Событие рисования
    mapInstance.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        editableFeatureGroup.addLayer(layer);
        // Сразу выключаем встроенное редактирование, чтобы не мешали кнопки Finish/Cancel
        if (layer.editing) layer.editing.disable();
        const coords = layer.getLatLngs()[0].map(ll => [ll.lat, ll.lng]);
        if (window.addDrawnPolygonToWorkspace) {
            window.addDrawnPolygonToWorkspace(coords, layer);
        }
    });

    // Редактирование: обновление координат
    mapInstance.on(L.Draw.Event.EDITED, function (e) {
        e.layers.eachLayer(function (layer) {
            const layerId = layer._workspaceLayerId;
            if (layerId && window.updateWorkspacePolygonCoords) {
                const coords = layer.getLatLngs()[0].map(ll => [ll.lat, ll.lng]);
                window.updateWorkspacePolygonCoords(layerId, coords);
            }
        });
    });

    // Завершение редактирования – сброс состояния
    mapInstance.on(L.Draw.Event.EDITSTOP, function (e) {
        e.layers.eachLayer(function (layer) {
            const layerId = layer._workspaceLayerId;
            if (layerId && window.finishEditLayer) {
                window.finishEditLayer(layerId);
            }
        });
    });

    // Удаление полигона через инструмент
    mapInstance.on(L.Draw.Event.DELETED, function (e) {
        e.layers.eachLayer(function (layer) {
            const layerId = layer._workspaceLayerId;
            if (layerId && window.deleteWorkspacePolygon) {
                window.deleteWorkspacePolygon(layerId);
            }
        });
    });

    // Сигнал для отложенных операций, ожидающих карту
    if (typeof window.onMapReady === 'function') {
        window.onMapReady();
    }
    console.log("✅ Карта успешно инициализирована (Владивосток)");
}

// ====================== Функции для workspaceItems ======================

export function addWorkspaceLayer(item) {
    if (!item.polygonCoords || !mapInstance) return null;

    let polygon;
    if (item.type === 'satellite') {
        // Для спутников рисуем прямоугольник по границам
        // Координаты должны быть в формате [[bottom, left], [top, left], [top, right], [bottom, right]]
        // Leaflet ожидает [lat, lng] порядок для L.rectangle
        const bounds = item.polygonCoords;
        if (Array.isArray(bounds) && bounds.length === 4) {
            // Проверяем формат координат - если это GeoJSON bbox [left, bottom, right, top]
            if (bounds.every(c => Array.isArray(c) && c.length === 2)) {
                // Проверяем порядок координат: если первая координата > 90, это [lng, lat] -> конвертируем
                const firstPoint = bounds[0];
                let normalizedBounds = bounds;
                if (Math.abs(firstPoint[0]) > 90 && Math.abs(firstPoint[1]) <= 90) {
                    // Конвертируем из [lng, lat] в [lat, lng]
                    normalizedBounds = bounds.map(c => [c[1], c[0]]);
                }
                polygon = L.rectangle(normalizedBounds, {
                    color: '#22c55e',
                    weight: 2,
                    fillOpacity: 0.1,
                    interactive: false
                });
                polygon.addTo(mapInstance);
            } else {
                console.warn('Некорректный формат координат для спутника:', bounds);
                return null;
            }
        } else {
            console.warn('Координаты спутника не являются массивом из 4 точек:', bounds);
            return null;
        }
    } else if (item.type === 'polygon') {
        // Для полигонов проверяем формат координат
        let coords = item.polygonCoords;
        
        // Нормализуем координаты для L.polygon
        // L.polygon ожидает [[lat, lng], [lat, lng], ...] или [[[lat, lng], ...]] для полигонов с дырками
        if (Array.isArray(coords) && coords.length > 0) {
            // Проверяем, это простой массив точек или массив с ring
            const firstPoint = Array.isArray(coords[0]) ? coords[0] : null;
            if (firstPoint && firstPoint.length >= 2) {
                // Это уже массив точек в формате [lat, lng] или [lng, lat]
                // Проверяем порядок: если первая координата > 90, это скорее всего [lng, lat]
                if (Math.abs(firstPoint[0]) > 90 && Math.abs(firstPoint[1]) <= 90) {
                    // Конвертируем из [lng, lat] в [lat, lng]
                    coords = coords.map(c => [c[1], c[0]]);
                }
            }
        }
        
        polygon = L.polygon(coords, {
            color: '#3b82f6',
            weight: 3,
            fillOpacity: 0.2,
            interactive: true
        });
        if (!item.associatedKml && (item.format === 'manual' || item.format === 'kml')) {
            editableFeatureGroup.addLayer(polygon);
        } else {
            polygon.addTo(mapInstance);
        }
    } else {
        return null;
    }

    const layerId = 'workspace_' + item.id;
    polygon._workspaceLayerId = layerId;
    workspaceLayers[layerId] = polygon;
    attachLayerEvents(polygon, item.id);
    return layerId;
}

export function removeWorkspaceLayer(layerId) {
    const layer = workspaceLayers[layerId];
    if (!layer) return;
    if (editableFeatureGroup && editableFeatureGroup.hasLayer(layer)) {
        editableFeatureGroup.removeLayer(layer);
    }
    if (mapInstance.hasLayer(layer)) {
        mapInstance.removeLayer(layer);
    }
    delete workspaceLayers[layerId];
}

export function showWorkspaceLayer(layerId) {
    const layer = workspaceLayers[layerId];
    if (!layer) return;
    if (editableFeatureGroup && !editableFeatureGroup.hasLayer(layer)) {
        editableFeatureGroup.addLayer(layer);
    }
    if (!mapInstance.hasLayer(layer)) {
        mapInstance.addLayer(layer);
    }
}

export function hideWorkspaceLayer(layerId) {
    const layer = workspaceLayers[layerId];
    if (!layer) return;
    if (editableFeatureGroup && editableFeatureGroup.hasLayer(layer)) {
        editableFeatureGroup.removeLayer(layer);
    }
    if (mapInstance.hasLayer(layer)) {
        mapInstance.removeLayer(layer);
    }
}

// Подсветка / снятие подсветки
export function highlightLayer(layerId) {
    const layer = workspaceLayers[layerId];
    if (!layer || !layer.setStyle) return;
    if (!layer._originalStyle) {
        layer._originalStyle = {
            color: layer.options.color,
            weight: layer.options.weight,
            fillOpacity: layer.options.fillOpacity,
            opacity: layer.options.opacity
        };
    }
    layer.setStyle({ color: '#ff0', weight: 4, opacity: 1, fillOpacity: 0.3 });
}

export function unhighlightLayer(layerId) {
    const layer = workspaceLayers[layerId];
    if (!layer || !layer._originalStyle) return;
    layer.setStyle(layer._originalStyle);
    delete layer._originalStyle;
}

// Хранилище оригинальных координат для отмены
let editOriginalCoords = {};

export function startEditLayer(layerId) {
    const layer = workspaceLayers[layerId];
    if (!layer || !layer.editing) return;

    // Отключаем редактирование всех остальных слоёв
    Object.values(workspaceLayers).forEach(l => {
        if (l !== layer && l.editing && l.editing._enabled) {
            l.editing.disable();
        }
    });

    // Запоминаем координаты до редактирования
    const latlngs = layer.getLatLngs()[0];
    editOriginalCoords[layerId] = latlngs.map(ll => [ll.lat, ll.lng]);

    layer.editing.enable();
    mapInstance.fitBounds(layer.getBounds().pad(0.2));
}

export function saveLayerEdit(layerId) {
    const layer = workspaceLayers[layerId];
    if (!layer || !layer.editing || !layer.editing._enabled) return;

    const latlngs = layer.getLatLngs()[0];
    const coords = latlngs.map(ll => [ll.lat, ll.lng]);
    if (window.updateWorkspacePolygonCoords) {
        window.updateWorkspacePolygonCoords(layerId, coords);
    }

    layer.editing.disable();
    delete editOriginalCoords[layerId];
}

export function cancelLayerEdit(layerId) {
    const layer = workspaceLayers[layerId];
    const original = editOriginalCoords[layerId];
    if (!layer || !original) return;

    // Выключаем редактор
    if (layer.editing && layer.editing._enabled) {
        layer.editing.disable();
    }

    // Удаляем старый слой с карты и из всех групп
    if (editableFeatureGroup && editableFeatureGroup.hasLayer(layer)) {
        editableFeatureGroup.removeLayer(layer);
    }
    if (mapInstance.hasLayer(layer)) {
        mapInstance.removeLayer(layer);
    }

    // Создаём новый полигон с исходными координатами
    const newLayer = L.polygon(original.map(c => [c[0], c[1]]), {
        color: '#3b82f6',
        weight: 3,
        fillOpacity: 0.2,
        interactive: true
    });

    // Переносим идентификатор и регистрируем заново
    newLayer._workspaceLayerId = layerId;
    workspaceLayers[layerId] = newLayer;

    if (editableFeatureGroup) {
        editableFeatureGroup.addLayer(newLayer);
    } else {
        newLayer.addTo(mapInstance);
    }

    // Назначаем события (подсветка, клик) для нового слоя
    const item = window.findItemByLayerId ? window.findItemByLayerId(layerId) : null;
    if (item) {
        attachLayerEvents(newLayer, item.id);
    } else {
        // Попробуем получить id из layerId (формат workspace_<id>)
        const itemId = layerId.replace('workspace_', '');
        attachLayerEvents(newLayer, isNaN(itemId) ? null : Number(itemId));
    }

    // Синхронизируем координаты в state
    if (window.updateWorkspacePolygonCoords) {
        window.updateWorkspacePolygonCoords(layerId, original);
    }

    delete editOriginalCoords[layerId];
}

export function fitBoundsToLayer(layerId) {
    const layer = workspaceLayers[layerId];
    if (layer) {
        mapInstance.fitBounds(layer.getBounds().pad(0.2));
    }
}

// Регистрация готового слоя (для нарисованных полигонов)
export function registerWorkspaceLayer(layerId, layer) {
    workspaceLayers[layerId] = layer;
}

// Назначение событий слою (подсветка, клик)
function attachLayerEvents(layer, itemId) {
    layer.on('mouseover', () => {
        if (window.highlightTableRow) window.highlightTableRow(itemId, true);
    });
    layer.on('mouseout', () => {
        if (window.highlightTableRow) window.highlightTableRow(itemId, false);
    });
    layer.on('click', () => {
        if (window.selectTableRow) window.selectTableRow(itemId);
    });
}

export function attachLayerEventsToLayer(layer, itemId) {
    attachLayerEvents(layer, itemId);
}

// Сохранение полигона на сервер (вспомогательная)
async function savePolygonToBackend(geojson) {
    try {
        const res = await fetch('/api/polygon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ geojson: geojson })
        });
        const data = await res.json();
        if (data.success) console.log("✅ Полигон сохранён на сервере");
    } catch (err) {
        console.error("Ошибка сохранения полигона:", err);
    }
}

// Глобальные ссылки для вызова из Alpine и HTML
window.initMap = initMap;
window.addWorkspaceLayer = addWorkspaceLayer;
window.removeWorkspaceLayer = removeWorkspaceLayer;
window.showWorkspaceLayer = showWorkspaceLayer;
window.hideWorkspaceLayer = hideWorkspaceLayer;
window.highlightLayer = highlightLayer;
window.unhighlightLayer = unhighlightLayer;
window.startEditLayer = startEditLayer;
window.saveLayerEdit = saveLayerEdit;
window.cancelLayerEdit = cancelLayerEdit;
window.fitBoundsToLayer = fitBoundsToLayer;
window.registerWorkspaceLayer = registerWorkspaceLayer;
window.attachLayerEventsToLayer = attachLayerEventsToLayer;
window._workspaceLayers = workspaceLayers;