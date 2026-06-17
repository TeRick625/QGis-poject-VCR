// static/js/modules/tab2_selection.js

export function selectItem(type, item, state) {
    // Если кликнули на полигон, который уже раскрыт или имеет снимки - не сбрасываем выделение
    const isPolygonWithImages = item.type === 'polygon' && item.subItems && item.subItems.length > 0;

    // Проверяем, не кликнули ли мы по уже выбранному элементу
    const isAlreadySelected = state.selectedAreaId === item.id && type === 'area';

    if (isAlreadySelected && isPolygonWithImages) {
        // Если кликнули повторно по раскрытому полигону - ничего не делаем
        return;
    }
    state.selectedItem = null;
    state.selectedNN = null;
    state.selectedAreaId = null;
    state.selectedSatelliteId = null;
    state.selectedAeroId = null;
    state.openAreaId = null;

    state.selectedItem = {
        type: type,
        id: item.id,
        name: item.name,
        isSubItem: false
    };

    if (type === 'area') state.selectedAreaId = item.id;
    if (type === 'satellite') state.selectedSatelliteId = item.id;
    if (type === 'aero') state.selectedAeroId = item.id;
}

export function toggleSubList(itemId, state) {
    state.selectedItem = null;
    state.selectedNN = null;
    state.selectedAreaId = null;
    state.selectedSatelliteId = null;
    state.selectedAeroId = null;

    if (state.openAreaId === itemId) {
        state.openAreaId = null;
        return;
    }

    const item = state.workspaceItems.find(i => i.id === itemId);
    if (!item) return;

    // Раскрываем, если есть дети (children_ids) или subItems (для полигонов со спутниками)
    const hasChildren = item.children_ids && item.children_ids.length > 0;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const canShowSub = (item.type === 'aero' && hasChildren) ||
                       (item.type === 'polygon' && !item.associatedKml && (hasChildren || hasSubItems));

    if (canShowSub) {
        state.openAreaId = itemId;
        state.selectedItem = {
            type: item.type === 'polygon' ? 'area' : 'aero',
            id: item.id,
            name: item.name,
            isSubItem: false
        };
        if (item.type === 'polygon') state.selectedAreaId = item.id;
        else state.selectedAeroId = item.id;
    }
}

export function selectSubItem(sub, parentItem, state) {
    state.selectedItem = null;
    state.selectedNN = null;
    state.selectedAreaId = null;
    state.selectedSatelliteId = null;
    state.selectedAeroId = null;

    // sub может быть объектом снимка или ID (для обратной совместимости)
    const subId = typeof sub === 'object' ? sub.id : sub;
    const subObj = state.workspaceItems.find(i => i.id === subId);

    if (!subObj && typeof sub === 'object') {
        // Если sub это объект снимка из subItems полигона
        state.selectedItem = {
            type: 'satellite_from_area',
            id: sub.id,
            name: sub.name,
            isSubItem: true,
            parentPolygon: parentItem.name
        };
        return;
    }

    if (!subObj) return;

    if (parentItem.type === 'polygon') {
        // Выбор спутникового снимка из подсписка полигона
        state.selectedItem = {
            type: 'satellite_from_area',
            id: subObj.id,
            name: subObj.name,
            isSubItem: true,
            parentPolygon: parentItem.name
        };
    } else {
        // Выбор KML из подсписка аэро
        state.selectedItem = {
            type: 'kml',                    // <-- меняем на 'kml'
            id: subObj.id,
            name: parentItem.name,
            isSubItem: true,
            parentPolygon: parentItem.name
        };
        state.selectedAeroId = parentItem.id;
    }
}

export function getFilteredNN(state) {
    if (!state.selectedItem) return state.neuralNetworks;

    const itemType = state.selectedItem.type;
    const isSubItem = state.selectedItem.isSubItem;

    // 1. Многодатный анализ (ID 1) – для чистого полигона или KML-подэлемента
    if ((itemType === 'area' && !isSubItem) || itemType === 'kml') {
        return state.neuralNetworks.filter(nn => nn.id === 1);
    }

    // 2. Спутниковые алгоритмы (ID 2) - для спутникового снимка
    if (itemType === 'satellite' || itemType === 'satellite_from_area') {
        return state.neuralNetworks.filter(nn => nn.id === 2);
    }

    // 3. Аэро алгоритмы (ID 3) - для аэрофотоснимка
    if (itemType === 'aero') {
        // Теперь нам не нужно проверять наличие KML на фронте!
        // Алгоритм один (ID 3), а на бэкенде он сам проверит, есть ли KML, и посчитает статистику.
        return state.neuralNetworks.filter(nn => nn.id === 3);
    }

    return [];
}

export function selectNN(nn, state) {
    if (!nn) return;

    // Сохраняем все необходимые поля, включая code_name для бэкенда
    state.selectedNN = {
        id: nn.id,
        code_name: nn.code_name, // ← ДОБАВЛЯЕМ ЭТО ПОЛЕ
        name: nn.name,
        type: nn.type,
        short_desc: nn.short_desc || '',
        detail: nn.detail || '',
        applicable_to: nn.applicable_to || ''
    };

    // Если у вас есть лог выбора, можно оставить
    console.log(`✅ Выбран алгоритм: ${nn.name} (code: ${nn.code_name})`);
}

export function determineResultViewType(state) {
    if (!state.selectedItem) return null;
    const t = state.selectedItem.type;
    if (t === 'satellite_from_area' || (t === 'aero' && state.selectedItem.isSubItem)) {
        return 'satellite_with_polygon';
    }
    if (t === 'satellite') return 'satellite_basic';
    if (t === 'aero') return 'aero_full';
    return 'satellite_basic';
}

// static/js/modules/tab2_selection.js (или твой файл с логикой запуска)

export async function runAnalysis(state, callbacks) {
    if (!state.selectedItem || !state.selectedNN) return;

    // === 1. ФОРМИРОВАНИЕ ПАРАМЕТРОВ ДЛЯ БЭКЕНДА ===
    let params = {};
    const nnType = state.selectedNN.type;

    if (nnType === 'multidate') {
        // Если пользователь еще не выбрал способ активации, открываем модалку
        if (!state.activationMethod) {
            if (callbacks.openActivationModal) callbacks.openActivationModal();
            return;
        }

        if (state.activationMethod === 'found') {
            // Способ 1: Уже найденные снимки
            params.dates = state.selectedImageIds.map(id => {
                const found = state.foundImages.find(img => img.id === id);
                return found ? found.date : null;
            }).filter(Boolean);
            params.image_ids = state.selectedImageIds;

        } else if (state.activationMethod === 'params') {
            // Способ 2: Задать параметры (воркер сам их найдет через GEE)
            params.date_start = `${state.activationParams.yearFrom}-01-01`;
            params.date_end = `${state.activationParams.yearTo}-12-31`;
            params.max_cloud = state.activationParams.cloudMax;
            params.season = state.activationParams.season;

        } else if (state.activationMethod === 'upload') {
            // Способ 3: Загруженные файлы
            params.uploaded_file_ids = state.uploadedSnapshotIds;
        }

    } else if (nnType === 'satellite') {
        params.file_id = state.selectedItem.id;

    } else if (nnType === 'aero') {
        params.aero_id = state.selectedItem.id;
        // Ищем связанный KML, если он есть
        const aeroItem = state.workspaceItems.find(i => i.id === state.selectedItem.id);
        if (aeroItem && aeroItem.associatedKml) {
            params.kml_id = aeroItem.associatedKml.id;
        }
    }

    // === 2. ОТПРАВКА ЗАПРОСА НА СОЗДАНИЕ ЗАДАЧИ ===
    state.isAnalysisRunning = true;
    if (window.showToast) window.showToast("🚀 Отправка задачи на сервер...", "info");

    try {
        const response = await fetch('/api/analysis/launch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input_item_id: state.selectedItem.id,
                model_code: state.selectedNN.code_name, // Передаем code_name!
                params: params
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка сервера при создании задачи");

        // 👇 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сбрасываем метод, чтобы модалка открылась при следующем запуске
        state.activationMethod = null;

        const analysisId = data.analysis_id;
        if (window.showToast) window.showToast("⏳ Задача в очереди. Ожидание воркера...", "info");

        // === 3. ЗАПУСК ПОЛЛИНГА (ОПРОС СТАТУСА КАЖДЫЕ 2 СЕКУНДЫ) ===
        const pollInterval = setInterval(async () => {
            try {
                const statusRes = await fetch(`/api/analysis/${analysisId}/status`);
                const statusData = await statusRes.json();

                // --- СЦЕНАРИЙ А: АНАЛИЗ УСПЕШНО ЗАВЕРШЕН ---
                if (statusData.status === 'completed') {
                    clearInterval(pollInterval);
                    state.isAnalysisRunning = false;

                    // Восстанавливаем activeResult ПОЛНОСТЬЮ из данных, которые вернул сервер
                    const serverData = statusData.algorithm_data || {};

                    state.activeResult = {
                        id: analysisId,
                        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                        type: state.selectedNN.type,
                        itemName: state.selectedItem.name,
                        nnName: state.selectedNN.name,
                        hasPolygon: state.selectedItem.type === 'area' || state.selectedItem.type === 'polygon',
                        resultViewType: serverData.result_view_type || determineResultViewType(state),
                        polygonOpacity: serverData.polygon_opacity ?? 0.5,
                        aeroOverlayOpacity: serverData.aero_overlay_opacity ?? 0.6,
                        snapshotDates: serverData.snapshot_dates || [],
                        snapshotIndex: serverData.snapshot_index || 0,
                        rangeStart: serverData.range_start || 0,
                        rangeEnd: serverData.range_end || (serverData.snapshot_dates?.length - 1) || 0,
                        deepAnalysisEnabled: serverData.deep_analysis_enabled || false,
                        metrics: serverData.metrics || {},
                        maskUrl: serverData.mask_url || null,
                        algorithmData: serverData
                    };

                    // Добавляем успешный анализ в историю (в начало)
                    state.analysisHistory.unshift(state.activeResult);
                    state.currentResultIndex = 0;

                    if (window.showToast) window.showToast("✅ Анализ успешно завершен!", "success");

                    // Переключаем интерфейс в режим результата
                    if (callbacks.switchMode) callbacks.switchMode('result', state, callbacks);

                // --- СЦЕНАРИЙ Б: АЛГОРИТМ УПАЛ С ОШИБКОЙ ---
                } else if (statusData.status === 'failed') {
                    clearInterval(pollInterval);
                    state.isAnalysisRunning = false;
                    const errorMsg = statusData.error_message || "Неизвестная ошибка алгоритма";
                    console.error("Ошибка анализа:", errorMsg);
                    if (window.showToast) window.showToast(`❌ Ошибка: ${errorMsg}`, "error");
                }
                // Если status === 'running' или 'pending', просто ждем следующего тика setInterval

            } catch (pollError) {
                console.error("Ошибка сети при опросе статуса:", pollError);
            }
        }, 2000); // Опрос каждые 2 секунды

    } catch (error) {
        state.isAnalysisRunning = false;
        // 👇 Сбрасываем и при ошибке, чтобы можно было попробовать снова
        state.activationMethod = null;
        console.error("Критическая ошибка запуска анализа:", error);
        if (window.showToast) window.showToast(error.message, "error");
    }
}

export function getCanRunAnalysis(state) {
    return !!(state.selectedItem && state.selectedNN);
}