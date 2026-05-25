import { state } from '/static/js/state/store.js';

import { initTab2, resetAllSelection, switchMode } from '/static/js/modules/tab2.js';

import {
    selectItem, toggleSubList, selectSubItem, getFilteredNN,
    selectNN, runAnalysis, getCanRunAnalysis
} from '/static/js/modules/tab2_selection.js';

import {
    openFindImagesModal, closeFindImagesModal, getSelectedImages,
    toggleImageSelection, removeFromConfirm, showNoImagesFound,
    nextModalStep, prevModalStep, getModalTitleText,
    setPreviewImage, triggerSearchImages, confirmSelectedImages
} from '/static/js/modules/tab2_modal_find.js';

import {
    applyResultState, renderResultMode, selectHistoryItem,
    determineAlgorithmMode
} from '/static/js/modules/tab2_result.js';

import {
    addWorkspaceItem, removeWorkspaceItem, toggleItemVisibility,
    addPolygonFromCoords,
    getFilteredSortedItems,
    startRenameItem, applyRename, cancelRename,
    removeAeroItem, removeKmlFromAero, addDrawnPolygonToWorkspace
} from '/static/js/modules/tab1_table.js';

import { addWorkspaceLayer, removeWorkspaceLayer, showWorkspaceLayer, hideWorkspaceLayer } from '/static/js/map.js';

import {
    openUploadModal, setUploadFiles, addAeroEntries,
    attachKmlToAeroEntry, removeAeroEntry, processUploadModal
} from '/static/js/modules/tab1_modalupload.js';

import {
    loadWorkspaceFromServer
} from '/static/js/modules/api_workspace.js';

document.addEventListener('alpine:init', () => {
    Alpine.data('analyzer', () => ({
        state,
        // ==================== ВКЛАДКА 1 ====================
        get highlightedItemId() { return this.state.highlightedItemId; },
        set highlightedItemId(v) { this.state.highlightedItemId = v; },
        get selectedWorkspaceItemId() { return this.state.selectedWorkspaceItemId; },
        set selectedWorkspaceItemId(v) { this.state.selectedWorkspaceItemId = v; },
        get editingItemId() { return this.state.editingItemId; },
        set editingItemId(v) { this.state.editingItemId = v; },

        initTab1() {},

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

        toggleItemVisibility(itemId) {
            toggleItemVisibility(this.state, itemId);
        },
        removeWorkspaceItem(itemId) {
            removeWorkspaceItem(this.state, itemId);
        },

        removeAeroItem(itemId) {
            removeAeroItem(this.state, itemId);
        },
        removeKmlFromAero(aeroId) {
            removeKmlFromAero(this.state, aeroId);
        },

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

        startEditItem(item) {
            if (!window.startEditLayer) return;
            if (this.state.editingItemId === item.id) {
                window.cancelLayerEdit(item.layerId);
                this.state.editingItemId = null;
                return;
            }
            if (this.state.editingItemId) {
                const prev = this.state.workspaceItems.find(i => i.id === this.state.editingItemId);
                if (prev) window.cancelLayerEdit(prev.layerId);
            }
            window.startEditLayer(item.layerId);
            this.state.editingItemId = item.id;
        },

        saveCurrentEdit() {
            const item = this.state.workspaceItems.find(i => i.id === this.state.editingItemId);
            if (item && window.saveLayerEdit) {
                window.saveLayerEdit(item.layerId);
            }
            this.state.editingItemId = null;
        },

        cancelCurrentEdit() {
            const item = this.state.workspaceItems.find(i => i.id === this.state.editingItemId);
            if (item && window.cancelLayerEdit) {
                window.cancelLayerEdit(item.layerId);
            }
            this.state.editingItemId = null;
        },

        finishEditLayer(layerId) {
            if (this.state.editingItemId && this.state.workspaceItems.find(i => i.layerId === layerId)) {
                this.state.editingItemId = null;
            }
        },

        addDrawnPolygonToWorkspace(coords, layer) {
            addDrawnPolygonToWorkspace(this.state, coords, layer);
        },

        // ==================== СОРТИРОВКА, ФИЛЬТРАЦИЯ, ПЕРЕИМЕНОВАНИЕ ====================

        get filteredSortedItems() {
            return getFilteredSortedItems(this.state);
        },

        get flattenedItems() {
            const result = [];
            const visited = new Set();


            // Собираем все id, которые являются чьими-то детьми
            const allChildIds = new Set();
            for (const item of this.state.workspaceItems) {
                if (item.children_ids) {
                    item.children_ids.forEach(id => allChildIds.add(id));
                }
            }

            const addItem = (item, depth = 0, parentId = null) => {
                if (visited.has(item.id)) return;
                visited.add(item.id);
                result.push(item);
                const childIds = item.children_ids || [];
                for (const childId of childIds) {
                    const child = this.state.workspaceItems.find(i => i.id === childId);
                    if (child) {
                        result.push({
                            ...child,
                            isChild: true,
                            parentId: parentId || item.id,
                            depth: depth + 1
                        });
                    }
                }
            };

            // Добавляем только те элементы, которые НЕ являются чьими-то детьми
            for (const item of getFilteredSortedItems(this.state)) {
                if (!allChildIds.has(item.id)) {
                    addItem(item);
                }
            }
            return result;
        },

        toggleFilter(type) {
            this.state.workspaceFilter[type] = !this.state.workspaceFilter[type];
        },

        setSort(field) {
            if (this.state.workspaceSort === field) {
                this.state.workspaceSortAsc = !this.state.workspaceSortAsc;
            } else {
                this.state.workspaceSort = field;
                this.state.workspaceSortAsc = false;
            }
        },

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
            window.__uploadModalState = this.state;
            openUploadModal(this.state);
        },

        openUploadModalFor(type) {
            this.openUploadModal();
            this.state.uploadModal.activeSection = type;
            this.$nextTick(() => {
                const section = document.getElementById('upload-' + type);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
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

        openFindImagesModal() { openFindImagesModal(this.state); },
        closeFindImagesModal() { closeFindImagesModal(this.state); },
        get selectedImages() { return getSelectedImages(this.state); },
        toggleImageSelection(id) { toggleImageSelection(id, this.state); },
        setPreviewImage(url) { setPreviewImage(url, this.state); },
        removeFromConfirm(id) { removeFromConfirm(id, this.state); },
        showNoImagesFound() { showNoImagesFound(this.state); },

        async nextModalStep() { await nextModalStep(this.state, this); },
        prevModalStep() { prevModalStep(this.state); },
        get modalTitleText() { return getModalTitleText(this.state); },
        get modalTitleText() { return getModalTitleText(this.state); },

        addSelectedImagesToPolygon() { addSelectedImagesToPolygon(this.state); },

        // ==================== АКТИВАЦИЯ МНОГОДАТНОГО АНАЛИЗА ====================

        openActivationModal() {
            this.state.activationModalOpen = true;
            this.state.activationMethod = null;
            this.state.activationShowParams = false;
            this.state.uploadedSnapshots = [];
        },

        startMultidateWithFound() {
            const polygon = this.state.workspaceItems.find(i => i.id === this.state.selectedAreaId);
            if (polygon && polygon.subItems && polygon.subItems.length > 0) {
                this.state.activationMethod = 'found';
                this.state.activationModalOpen = false;
                this.runAnalysis();
                return;
            }
            if (this.state.selectedImageIds.length === 0) {
                alert('Сначала найдите и выберите снимки через «Найти снимки».');
                return;
            }
            this.state.activationMethod = 'found';
            this.state.activationModalOpen = false;
            this.runAnalysis();
        },

        startMultidateWithParams() {
            this.state.activationShowParams = true;
        },

        submitParamsAndRun() {
            this.state.activationMethod = 'params';
            this.state.activationModalOpen = false;
            this.state.activationShowParams = false;
            this.runAnalysis();
        },

        cancelParamsForm() {
            this.state.activationShowParams = false;
        },

        handleMultidateUpload(event) { /* без изменений */ },
        async startMultidateWithUpload() { /* без изменений */ },

        applyResultState() { applyResultState(this.state); },
        renderResultMode() { renderResultMode(this.state); },
        selectHistoryItem(index) { selectHistoryItem(index, this.state); },

        // ==================== ГЕТТЕРЫ ====================

        get multidateSnapshotIndex() {
            return this.state.activeResult?.snapshotIndex ?? 0;
        },
        set multidateSnapshotIndex(val) {
            const v = Number(val);
            if (this.state.activeResult) {
                this.state.activeResult.snapshotIndex = v;
            }
        },

        get multidateRangeStart() {
            return this.state.activeResult?.rangeStart ?? 0;
        },
        set multidateRangeStart(val) {
            const v = Number(val);
            if (this.state.activeResult) {
                this.state.activeResult.rangeStart = v;
                if (v > this.state.activeResult.rangeEnd) {
                    this.state.activeResult.rangeEnd = v;
                }
            }
        },

        get multidateRangeEnd() {
            return this.state.activeResult?.rangeEnd ?? 0;
        },
        set multidateRangeEnd(val) {
            const v = Number(val);
            if (this.state.activeResult) {
                this.state.activeResult.rangeEnd = v;
                if (v < this.state.activeResult.rangeStart) {
                    this.state.activeResult.rangeStart = v;
                }
            }
        },

        get areasFiltered() {
            const childIdsSet = new Set();
            for (const item of this.state.workspaceItems) {
                if (item.children_ids) {
                    item.children_ids.forEach(id => childIdsSet.add(id));
                }
            }
            return this.state.workspaceItems.filter(item =>
                item.type === 'polygon' && !childIdsSet.has(item.id)
            );
        },

        get satellitesFiltered() {
            const childIdsSet = new Set();
            for (const item of this.state.workspaceItems) {
                if (item.children_ids) {
                    item.children_ids.forEach(id => childIdsSet.add(id));
                }
            }
            return this.state.workspaceItems.filter(item =>
                item.type === 'satellite' && !childIdsSet.has(item.id)
            );
        },

        get aeroImagesFiltered() {
            return this.state.workspaceItems.filter(item => item.type === 'aero');
        },

        get algorithmMode() {
            return determineAlgorithmMode(this.state);
        },

        get dryingLayerOpacity() {
            return this.state.dryingLayerOpacity;
        },
        set dryingLayerOpacity(val) {
            this.state.dryingLayerOpacity = val;
            if (this.state.activeResult) {
                this.state.activeResult.dryingLayerOpacity = val;
            }
        },

        // ==================== АКТИВАЦИЯ API МЕТОДОВ ====================
        loadWorkspaceFromServer() {
            loadWorkspaceFromServer(this.state, this.$nextTick.bind(this));
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

            window.addDrawnPolygonToWorkspace = (coords, layer) => self.addDrawnPolygonToWorkspace(coords, layer);
            window.updateWorkspacePolygonCoords = async (layerId, coords) => {
                const item = self.state.workspaceItems.find(i => i.layerId === layerId);
                if (item) {
                    item.polygonCoords = coords;
                    if (window.userRole && window.userRole !== 'guest') {
                        const { updateWorkspaceItem } = await import('/static/js/modules/api_workspace.js');
                        await updateWorkspaceItem(item.id, { polygonCoords: coords });
                    }
                }
            };
            window.deleteWorkspacePolygon = (layerId) => {
                self.state.workspaceItems = self.state.workspaceItems.filter(i => i.layerId !== layerId);
            };
            window.finishEditLayer = (layerId) => self.finishEditLayer(layerId);
            window.highlightTableRow = (itemId, flag) => self.highlightTableRow(itemId, flag);
            window.selectTableRow = (itemId) => self.selectTableRow(itemId);

            if (this.state.highlightedItemId === undefined) this.state.highlightedItemId = null;
            if (this.state.selectedWorkspaceItemId === undefined) this.state.selectedWorkspaceItemId = null;
            if (this.state.editingItemId === undefined) this.state.editingItemId = null;
            if (this.state.coordModalOpen === undefined) this.state.coordModalOpen = false;
            if (this.state.coordInputs === undefined) this.state.coordInputs = [{ value: '' }, { value: '' }, { value: '' }];
            if (this.state.dryingLayerOpacity === undefined) this.state.dryingLayerOpacity = 0.8;


            // Инициализация стейта для модального окна поиска
            if (this.state.foundImages === undefined) this.state.foundImages = [];
            if (this.state.findModalParams === undefined) {
                this.state.findModalParams = { cloudMax: 30, dateStart: '2024-01-01', dateEnd: '2024-12-31' };
            }
            if (this.state.isSearching === undefined) this.state.isSearching = false;
            if (this.state.isConfirming === undefined) this.state.isConfirming = false;
            if (this.state.previewThumbnailUrl === undefined) this.state.previewThumbnailUrl = null;


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

            this.loadWorkspaceFromServer();
        },
    }));
});