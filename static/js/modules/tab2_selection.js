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

    // Многодатный анализ – для чистого полигона без подэлемента
    if (itemType === 'area' && !isSubItem) {
        return state.neuralNetworks.filter(nn => nn.id === 1);
    }

    // KML-подэлемент аэро → многодатный анализ
    if (itemType === 'kml') {
        return state.neuralNetworks.filter(nn => nn.id === 1);
    }

    // Спутниковые алгоритмы
    if (itemType === 'satellite' || itemType === 'satellite_from_area') {
        if (itemType === 'satellite_from_area') {
            return state.neuralNetworks.filter(nn => nn.id === 2);
        }
        return state.neuralNetworks.filter(nn => nn.id === 3);
    }

    // Аэро алгоритмы
    if (itemType === 'aero') {
        const aeroItem = state.workspaceItems.find(i => i.id === state.selectedItem.id);
        const hasKml = aeroItem && aeroItem.associatedKml;

        if (hasKml) {
            // Для аэро с KML показываем и 4, и 5
            return state.neuralNetworks.filter(nn => nn.id === 4 || nn.id === 5);
        } else {
            return state.neuralNetworks.filter(nn => nn.id === 4);
        }
    }

    return [];
}

export function selectNN(nn, state) {
    if (state.selectedNN && state.selectedNN.id === nn.id) {
        state.selectedNN = null;
        return;
    }
    state.selectedNN = {
        id: nn.id,
        name: nn.name,
        type: nn.type
    };
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

export function runAnalysis(state, callbacks) {
    if (!state.selectedItem || !state.selectedNN) return;

    const viewType = determineResultViewType(state);
    // Формируем данные, специфичные для алгоритма
    let algorithmData = null;
    const nnType = state.selectedNN?.type; // нужно сохранить type нейросети при выборе

     if (nnType === 'multidate' && !state.activationMethod) {
        if (callbacks.openActivationModal) {
            callbacks.openActivationModal();
        }
        return;
    }

    // Найдём выбранную нейросеть, чтобы узнать её type
    const selectedNNObj = state.neuralNetworks.find(n => n.id === state.selectedNN?.id);
    if (selectedNNObj) {
        switch (selectedNNObj.type) {
            case 'multidate':
                let snapshotIds = [];
                let snapshotDates = [];
                const polygon = state.workspaceItems.find(i => i.id === state.selectedAreaId);
                if (state.activationMethod === 'found') {
                    const polygon = state.workspaceItems.find(i => i.id === state.selectedAreaId);
                    if (polygon && polygon.subItems && polygon.subItems.length > 0) {
                        // Берём из подсписка полигона
                        snapshotIds = polygon.subItems.map(s => s.id);
                        snapshotDates = polygon.subItems.map(s => s.date);
                    } else {
                        // Используем выбранные в модальном окне «Найти снимки»
                        snapshotIds = state.selectedImageIds;
                        snapshotDates = state.selectedImageIds.map(id => {
                            const found = state.foundImages.find(img => img.id === id);
                            return found ? found.date : '?';
                        });
                    }
                }
                break;
            case 'satellite':
                // Для алгоритмов 2/3 нужен id спутникового снимка
                algorithmData = { fileId: state.selectedItem.id };
                break;
            case 'aero':
                // Для алгоритмов 4/5 нужен id аэрофото + id привязанного KML (если есть)
                algorithmData = {
                    aeroId: state.selectedItem.id,
                    kmlId: state.selectedItem.isSubItem ? state.selectedItem.id : null
                };
                break;
        }
    state.activationMethod = null;
    state.uploadedSnapshots = [];
    }
    state.selectedAlgorithmData = algorithmData;



    const snapshotDates = algorithmData?.snapshotDates || [];
    const lastIdx = snapshotDates.length - 1;

    const newResult = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        type: state.selectedItem.type === 'aero' ? 'aero' :
              (state.selectedNN?.type === 'multidate' ? 'multidate' : 'satellite'),
        itemName: state.selectedItem.name,
        nnName: state.selectedNN.name || `NN #${state.selectedNN.id}`,
        hasPolygon: state.selectedItem.isSubItem || state.selectedItem.type === 'area',
        resultViewType: viewType,
        polygonOpacity: 0.5,
        aeroOverlayOpacity: 0.6,
        uploadedAeroFile: null,
        deepAnalysisEnabled: false,
        snapshotDates: snapshotDates,
        snapshotIndex: 0,
        rangeStart: 0,
        rangeEnd: lastIdx >= 0 ? lastIdx : 0,
    };

    state.analysisHistory.unshift(newResult);
    state.activeResult = newResult;
    state.currentResultIndex = 0;
    state.resultViewType = viewType;
    state.uploadedAeroFile = null;
    state.deepAnalysisEnabled = false;
    state.polygonOpacity = 0.5;
    state.aeroOverlayOpacity = 0.6;
    state.mode = 'result';

    if (callbacks.switchMode) {
        callbacks.switchMode('result', state, callbacks);
    }
}

export function getCanRunAnalysis(state) {
    return !!(state.selectedItem && state.selectedNN);
}