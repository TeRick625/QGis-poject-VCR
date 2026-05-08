import { state } from '/static/js/state/store.js';

import { initTab2, resetAllSelection, switchMode } from '/static/js/modules/tab2.js';

import {
    selectItem, toggleSubList, selectSubItem, getFilteredNN,
    selectNN, runAnalysis, getCanRunAnalysis
} from '/static/js/modules/tab2_selection.js';

import {
    openFindImagesModal, closeFindImagesModal, getSelectedImages,
    toggleImageSelection, removeFromConfirm, showNoImagesFound,
    nextModalStep, prevModalStep, addSelectedImagesToPolygon, getModalTitleText
} from '/static/js/modules/tab2_modal_find.js';

import {
    applyResultState, renderResultMode, selectHistoryItem,
    handleAeroUpload, activateDeepAnalysis, determineAlgorithmMode
} from '/static/js/modules/tab2_result.js';

import {
    addWorkspaceItem, removeWorkspaceItem, toggleItemVisibility,
    addPolygonFromCoords,
    getFilteredSortedItems,
    startRenameItem, applyRename, cancelRename
} from '/static/js/modules/tab1_table.js';

import { addWorkspaceLayer, removeWorkspaceLayer, showWorkspaceLayer, hideWorkspaceLayer } from '/static/js/map.js';

import {
    openUploadModal, setUploadFiles, addAeroEntries,
    attachKmlToAeroEntry, removeAeroEntry, processUploadModal
} from '/static/js/modules/tab1_modalupload.js';
document.addEventListener('alpine:init', () => {
    Alpine.data('analyzer', () => ({
        state,

        // ==================== ВКЛАДКА 1 ====================
        // Состояния подсветки и редактирования – прокси к state
        get highlightedItemId() { return this.state.highlightedItemId; },
        set highlightedItemId(v) { this.state.highlightedItemId = v; },
        get selectedWorkspaceItemId() { return this.state.selectedWorkspaceItemId; },
        set selectedWorkspaceItemId(v) { this.state.selectedWorkspaceItemId = v; },
        get editingItemId() { return this.state.editingItemId; },
        set editingItemId(v) { this.state.editingItemId = v; },

        // Инициализация вкладки 1 (пустая, всё реактивно)
        initTab1() {},

        // Модальное окно координат
        openCoordModal() { this.state.coordModalOpen = true; },
        addCoordPoint() { this.state.coordInputs.push({ value: '' }); },
        removeCoordPoint(index) {
            if (this.state.coordInputs.length > 3) this.state.coordInputs.splice(index, 1);
        },
        createPolygonFromCoords() {
            const coords = [];
            let valid = true;
            for (const point of this.state.coordInputs) {
                const parts = point.value.split(',').map(s => s.trim());
                if (parts.length !== 2) { valid = false; break; }
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (isNaN(lat) || isNaN(lng)) { valid = false; break; }
                coords.push([lat, lng]);
            }
            if (!valid || coords.length < 3) {
                alert('Проверьте координаты. Нужно минимум 3 точки в формате "широта, долгота".');
                return;
            }
            const newItem = addPolygonFromCoords(this.state, coords);
            if (newItem) {
                const layerId = addWorkspaceLayer(newItem);
                newItem.layerId = layerId;
                this.state.coordInputs = [{ value: '' }, { value: '' }, { value: '' }];
                this.state.coordModalOpen = false;
            }
        },

        // Удаление и видимость
        toggleItemVisibility(itemId) {
            toggleItemVisibility(this.state, itemId);
        },
        removeWorkspaceItem(itemId) {
            removeWorkspaceItem(this.state, itemId);
        },

        // Подсветка и выделение
        highlightTableRow(itemId, flag) {
            this.state.highlightedItemId = flag ? itemId : null;
        },
        selectTableRow(itemId) {
            this.state.selectedWorkspaceItemId = itemId;
        },
        highlightItemOnMap(item) {
            if (window.highlightLayer) window.highlightLayer(item.layerId);
        },
        unhighlightItemOnMap(item) {
            if (window.unhighlightLayer) window.unhighlightLayer(item.layerId);
        },
        zoomToItem(item) {
            if (window.fitBoundsToLayer) window.fitBoundsToLayer(item.layerId);
        },

        // Редактирование полигона
        startEditItem(item) {
            if (!window.startEditLayer) return;
            // Если уже редактируем этот же – выключаем
            if (this.state.editingItemId === item.id) {
                window.cancelLayerEdit(item.layerId);
                this.state.editingItemId = null;
                return;
            }
            // Выключаем предыдущее редактирование, если есть
            if (this.state.editingItemId) {
                const prev = this.state.workspaceItems.find(i => i.id === this.state.editingItemId);
                if (prev) window.cancelLayerEdit(prev.layerId);
            }
            window.startEditLayer(item.layerId);
            this.state.editingItemId = item.id;
        },

        // Сохранить редактирование (вызывается из панели)
        saveCurrentEdit() {
            const item = this.state.workspaceItems.find(i => i.id === this.state.editingItemId);
            if (item && window.saveLayerEdit) {
                window.saveLayerEdit(item.layerId);
            }
            this.state.editingItemId = null;
        },

        // Отменить редактирование (вызывается из панели)
        cancelCurrentEdit() {
            const item = this.state.workspaceItems.find(i => i.id === this.state.editingItemId);
            if (item && window.cancelLayerEdit) {
                window.cancelLayerEdit(item.layerId);
            }
            this.state.editingItemId = null;
        },

        // Вызывается из map.js при завершении редактирования (EDITSTOP) – на всякий случай
        finishEditLayer(layerId) {
            // Если завершили редактирование не через нашу кнопку, сбросим состояние
            if (this.state.editingItemId && this.state.workspaceItems.find(i => i.layerId === layerId)) {
                this.state.editingItemId = null;
            }
        },


        // Добавление нарисованного полигона (вызывается из map.js)
        addDrawnPolygonToWorkspace(coords, layer) {
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
            this.state.workspaceItems.push(newItem);
            newItem.layerId = 'workspace_' + newItem.id;
            layer._workspaceLayerId = newItem.layerId;
            newItem._leafletLayer = layer;

            if (window.registerWorkspaceLayer) window.registerWorkspaceLayer(newItem.layerId, layer);
            if (window.attachLayerEventsToLayer) window.attachLayerEventsToLayer(layer, newItem.id);
        },

                // ==================== СОРТИРОВКА, ФИЛЬТРАЦИЯ, ПЕРЕИМЕНОВАНИЕ ====================
        get filteredSortedItems() {
            return getFilteredSortedItems(this.state);
        },

        toggleFilter(type) {
            this.state.workspaceFilter[type] = !this.state.workspaceFilter[type];
        },

        setSort(field) {
            if (this.state.workspaceSort === field) {
                this.state.workspaceSortAsc = !this.state.workspaceSortAsc;
            } else {
                this.state.workspaceSort = field;
                this.state.workspaceSortAsc = false; // по умолчанию по убыванию
            }
        },

        // Переименование
        startRenameItem(itemId) {
            startRenameItem(this.state, itemId);
        },
        applyRename() {
            applyRename(this.state);
        },
        cancelRename() {
            cancelRename(this.state);
        },

        // ==================== МОДАЛЬНОЕ ОКНО ЗАГРУЗКИ ====================

        openUploadModal() {
            // Сохраняем ссылку на state для колбэка attachKml
            window.__uploadModalState = this.state;
            openUploadModal(this.state);
        },

        setUploadFiles(type, files) {
            setUploadFiles(type, files, this.state);
        },

        addAeroEntries(files) {
            addAeroEntries(files, this.state);
        },

        attachKmlToAeroEntry(index) {
            attachKmlToAeroEntry(index);
        },

        removeAeroEntry(index) {
            removeAeroEntry(index, this.state);
        },

        async processUploadModal() {
            await processUploadModal(this.state);
            window.__uploadModalState = null;
        },

        // ==================== ВКЛАДКА 2 ====================
        initTab2() { initTab2(this.state); },
        resetAllSelection() { resetAllSelection(this.state); },
        switchMode(newMode) { switchMode(newMode, this.state, this); },
        selectItem(type, item) { selectItem(type, item, this.state); },
        toggleSubList(areaId) { toggleSubList(areaId, this.state); },
        selectSubItem(sub, area) { selectSubItem(sub, area, this.state); },
        getFilteredNN() { return getFilteredNN(this.state); },
        selectNN(nn) { selectNN(nn, this.state); },
        runAnalysis() { runAnalysis(this.state, this); },
        get canRunAnalysis() { return getCanRunAnalysis(this.state); },

        // Модальное окно поиска
        openFindImagesModal() { openFindImagesModal(this.state); },
        closeFindImagesModal() { closeFindImagesModal(this.state); },
        get selectedImages() { return getSelectedImages(this.state); },
        toggleImageSelection(id) { toggleImageSelection(id, this.state); },
        removeFromConfirm(id) { removeFromConfirm(id, this.state); },
        showNoImagesFound() { showNoImagesFound(this.state); },
        nextModalStep() { nextModalStep(this.state, this); },
        prevModalStep() { prevModalStep(this.state); },
        addSelectedImagesToPolygon() { addSelectedImagesToPolygon(this.state); },
        get modalTitleText() { return getModalTitleText(this.state); },

        // Результат
        applyResultState() { applyResultState(this.state); },
        renderResultMode() { renderResultMode(this.state); },
        selectHistoryItem(index) { selectHistoryItem(index, this.state); },
        handleAeroUpload(event) { handleAeroUpload(event, this.state); },
        activateDeepAnalysis() { activateDeepAnalysis(this.state); },

        // ==================== ГЕТТЕРЫ ====================
//        get isSatelliteBasic() { return this.state.resultViewType === 'satellite_basic'; },
//        get isSatelliteWithPolygon() { return this.state.resultViewType === 'satellite_with_polygon'; },
//        get isSatelliteWithAero() { return this.state.resultViewType === 'satellite_with_aero'; },
//        get isAeroFull() { return this.state.resultViewType === 'aero_full'; },
//        determineResultViewType() {
//            if (!this.state.selectedItem) return null;
//            if (this.state.selectedItem.type === 'satellite_from_area') return 'satellite_with_polygon';
//            if (this.state.selectedItem.type === 'satellite') return 'satellite_basic';
//            if (this.state.selectedItem.type === 'aero') return 'aero_full';
//            return 'satellite_basic';
//        },

        get linkedKmlIds() {
            // Собираем id всех полигонов, на которые ссылаются associatedKml у аэро
            const ids = new Set();
            for (const item of this.state.workspaceItems) {
                if (item.associatedKml) ids.add(item.associatedKml);
            }
            return ids;
        },

        get areasFiltered() {
            // Чистые полигоны (не привязанные к аэро) и не являющиеся чьим-то associatedKml
            return this.state.workspaceItems.filter(item =>
                item.type === 'polygon' &&
                !item.associatedKml &&
                !this.linkedKmlIds.has(item.id)
            );
        },

        get satellitesFiltered() {
            // Собираем id всех спутников, которые уже привязаны к полигонам через subItems
            const attachedIds = new Set();
            for (const item of this.state.workspaceItems) {
                if (item.type === 'polygon' && item.subItems) {
                    for (const sub of item.subItems) {
                        attachedIds.add(sub.id);
                    }
                }
            }
            return this.state.workspaceItems.filter(item =>
                item.type === 'satellite' && !attachedIds.has(item.id)
            );
        },

        get aeroImagesFiltered() {
            return this.state.workspaceItems.filter(item => item.type === 'aero');
        },

        getKmlForAero(aeroItem) {
            if (!aeroItem.associatedKml) return [];
            const kml = this.state.workspaceItems.find(i => i.id === aeroItem.associatedKml);
            return kml ? [kml] : [];
        },


        // Режим алгоритма
        get algorithmMode() {
            return determineAlgorithmMode(this.state);
        },

        // Прозрачность слоя точек усыхания (для спутниковых алгоритмов)
        get dryingLayerOpacity() {
            return this.state.dryingLayerOpacity;
        },
        set dryingLayerOpacity(val) {
            this.state.dryingLayerOpacity = val;
            if (this.state.activeResult) {
                this.state.activeResult.dryingLayerOpacity = val;
            }
        },

        initCurrentTab() {
            if (this.state.currentTab === 0) this.initTab1();
            else if (this.state.currentTab === 1) this.initTab2();
            else if (this.state.currentTab === 2) this.initTab3();
            else if (this.state.currentTab === 3) this.initTab4();
        },
        initTab3() { console.log("✅ initTab3() вызван — статистика"); },
        initTab4() { console.log("✅ initTab4() вызван — результаты и экспорт"); },

        init() {
            console.log("✅ Alpine 'analyzer' компонент инициализирован");
            const self = this;

            // Глобальные колбэки для map.js
            window.addDrawnPolygonToWorkspace = (coords, layer) => self.addDrawnPolygonToWorkspace(coords, layer);
            window.updateWorkspacePolygonCoords = (layerId, coords) => {
                const item = self.state.workspaceItems.find(i => i.layerId === layerId);
                if (item) item.polygonCoords = coords;
            };
            window.deleteWorkspacePolygon = (layerId) => {
                self.state.workspaceItems = self.state.workspaceItems.filter(i => i.layerId !== layerId);
            };
            window.finishEditLayer = (layerId) => self.finishEditLayer(layerId);
            window.highlightTableRow = (itemId, flag) => self.highlightTableRow(itemId, flag);
            window.selectTableRow = (itemId) => self.selectTableRow(itemId);

            // Инициализация недостающих полей в state (если ещё не добавлены)
            if (this.state.highlightedItemId === undefined) this.state.highlightedItemId = null;
            if (this.state.selectedWorkspaceItemId === undefined) this.state.selectedWorkspaceItemId = null;
            if (this.state.editingItemId === undefined) this.state.editingItemId = null;
            if (this.state.coordModalOpen === undefined) this.state.coordModalOpen = false;
            if (this.state.coordInputs === undefined) this.state.coordInputs = [{ value: '' }, { value: '' }, { value: '' }];
            if (this.state.dryingLayerOpacity === undefined) this.state.dryingLayerOpacity = 0.8;

            this.$watch('state.currentTab', (v) => this.initCurrentTab());
            this.$nextTick(() => this.initCurrentTab());

            this.$watch('state.polygonOpacity', (val) => {
                if (this.state.activeResult) this.state.activeResult.polygonOpacity = val;
            });
            this.$watch('state.aeroOverlayOpacity', (val) => {
                if (this.state.activeResult) this.state.activeResult.aeroOverlayOpacity = val;
            });
            this.$watch('state.uploadedAeroFile', (val) => {
                if (this.state.activeResult) this.state.activeResult.uploadedAeroFile = val;
            });
            this.$watch('state.deepAnalysisEnabled', (val) => {
                if (this.state.activeResult) this.state.activeResult.deepAnalysisEnabled = val;
            });
            this.$watch('state.resultViewType', (val) => {
                if (this.state.activeResult) this.state.activeResult.resultViewType = val;
            });
            this.$watch('state.activeResult', (newVal) => {
                if (newVal) {
                    this.state.dryingLayerOpacity = newVal.dryingLayerOpacity ?? 0.8;
                }
            });
        },
    }));
});