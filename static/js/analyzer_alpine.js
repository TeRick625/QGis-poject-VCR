import { state } from '/static/js/state/store.js';
import { initTab1, handleFiles, removeFile, clearUploadedFiles } from '/static/js/modules/tab1.js';
import { initTab2, resetAllSelection, switchMode } from '/static/js/modules/tab2.js';
import {
    selectItem,
    toggleSubList,
    selectSubItem,
    getFilteredNN,
    selectNN,
    runAnalysis,
    getCanRunAnalysis
} from '/static/js/modules/tab2_selection.js';
// Модальное окно
import {
    openFindImagesModal,
    closeFindImagesModal,
    getSelectedImages,
    toggleImageSelection,
    removeFromConfirm,
    showNoImagesFound,
    nextModalStep,
    prevModalStep,
    addSelectedImagesToPolygon,
    getModalTitleText
} from '/static/js/modules/tab2_modal_find.js';
// Результат
import {
    applyResultState,
    renderResultMode,
    selectHistoryItem,
    handleAeroUpload,
    activateDeepAnalysis
} from '/static/js/modules/tab2_result.js';


document.addEventListener('alpine:init', () => {
    Alpine.data('analyzer', () => ({
        state,

        // ==================== ВКЛАДКА 1 ====================
        initTab1() {
            initTab1(this.state);
        },

        handleFiles(files) {
            handleFiles(files, this.state);
        },

        removeFile(index) {
            removeFile(index, this.state);
        },

        clearUploadedFiles() {
            clearUploadedFiles(this.state);
        },

        // ==================== ВКЛАДКА 2 — ОБЩЕЕ ====================
        initTab2() {
            initTab2(this.state);
        },

        resetAllSelection() {
            resetAllSelection(this.state);
        },

        switchMode(newMode) {
            switchMode(newMode, this.state, this);
        },

        // ==================== ВКЛАДКА 2 — ВЫБОР ====================
        selectItem(type, item) {
            selectItem(type, item, this.state);
        },

        toggleSubList(areaId) {
            toggleSubList(areaId, this.state);
        },

        selectSubItem(sub, area) {
            selectSubItem(sub, area, this.state);
        },

        getFilteredNN() {
            return getFilteredNN(this.state);
        },

        selectNN(nn) {
            selectNN(nn, this.state);
        },

        runAnalysis() {
            runAnalysis(this.state, this);
        },

        get canRunAnalysis() {
            return getCanRunAnalysis(this.state);
        },

        // ==================== МОДАЛЬНОЕ ОКНО ====================
        openFindImagesModal() {
            openFindImagesModal(this.state);
        },

        closeFindImagesModal() {
            closeFindImagesModal(this.state);
        },

        get selectedImages() {
            return getSelectedImages(this.state);
        },

        toggleImageSelection(id) {
            toggleImageSelection(id, this.state);
        },

        removeFromConfirm(id) {
            removeFromConfirm(id, this.state);
        },

        showNoImagesFound() {
            showNoImagesFound(this.state);
        },

        nextModalStep() {
            nextModalStep(this.state, this);
        },

        prevModalStep() {
            prevModalStep(this.state);
        },

        addSelectedImagesToPolygon() {
            addSelectedImagesToPolygon(this.state);
        },

        get modalTitleText() {
            return getModalTitleText(this.state);
        },

        // ==================== РЕЗУЛЬТАТ ====================
        applyResultState() {
            applyResultState(this.state);
        },

        renderResultMode() {
            renderResultMode(this.state);
        },

        selectHistoryItem(index) {
            selectHistoryItem(index, this.state);
        },

        handleAeroUpload(event) {
            handleAeroUpload(event, this.state);
        },

        activateDeepAnalysis() {
            activateDeepAnalysis(this.state);
        },

        // ==================== ГЕТТЕРЫ (остаются здесь — зависят от this) ====================
        get isSatelliteBasic() {
            return this.state.resultViewType === 'satellite_basic';
        },

        get isSatelliteWithPolygon() {
            return this.state.resultViewType === 'satellite_with_polygon';
        },

        get isSatelliteWithAero() {
            return this.state.resultViewType === 'satellite_with_aero';
        },

        get isAeroFull() {
            return this.state.resultViewType === 'aero_full';
        },

        // ==================== ИНИЦИАЛИЗАЦИЯ ====================
        determineResultViewType() {
            if (!this.state.selectedItem) return null;
            if (this.state.selectedItem.type === 'satellite_from_area') return 'satellite_with_polygon';
            if (this.state.selectedItem.type === 'satellite') return 'satellite_basic';
            if (this.state.selectedItem.type === 'aero') return 'aero_full';
            return 'satellite_basic';
        },

        initCurrentTab() {
            if (this.state.currentTab === 0) {
                this.initTab1();
            } else if (this.state.currentTab === 1) {
                this.initTab2();
            } else if (this.state.currentTab === 2) {
                this.initTab3();
            } else if (this.state.currentTab === 3) {
                this.initTab4();
            }
        },

        initTab3() {
            console.log("✅ initTab3() вызван — статистика");
        },

        initTab4() {
            console.log("✅ initTab4() вызван — результаты и экспорт");
        },

        init() {
            console.log("✅ Alpine 'analyzer' компонент инициализирован");

            this.$watch('state.currentTab', (newValue) => {
                this.initCurrentTab();
            });

            this.$nextTick(() => {
                this.initCurrentTab();
            });

            // Синхронизация UI-контролов с активным результатом
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
        },
    }));
});