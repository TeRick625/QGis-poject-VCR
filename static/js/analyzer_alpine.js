import { state } from '/static/js/state/store.js';

document.addEventListener('alpine:init', () => {
    Alpine.data('analyzer', () => ({
        state,

        openFindImagesModal() {
            if (!this.state.selectedItem || this.state.selectedItem.type !== 'area') return;
            this.state.currentModalStep = 1;
            this.state.selectedImageIds = [];
            this.state.isFindModalOpen = true;
        },

        closeFindImagesModal() {
            this.state.isFindModalOpen = false;
        },

        get selectedImages() {
            return this.state.fakeFoundImages.filter(img => this.state.selectedImageIds.includes(img.id));
        },

        init() {
            console.log("✅ Alpine 'analyzer' компонент инициализирован");
            this.$watch('state.currentTab', (newValue) => {
                this.initCurrentTab();
            });
            this.$nextTick(() => {
                this.initCurrentTab();
            });
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

        initTab1() {
            console.log("✅ initTab1() вызван");
            this.renderUploadedFiles();
        },

        initTab2() {
            console.log("✅ initTab2() вызван — подготовка данных вкладки 2");
            this.resetAllSelection();
        },

        initTab3() {
            console.log("✅ initTab3() вызван — статистика");
        },

        initTab4() {
            console.log("✅ initTab4() вызван — результаты и экспорт");
        },

        resetAllSelection() {
            this.state.selectedItem = null;
            this.state.selectedNN = null;
            this.state.selectedAreaId = null;
            this.state.selectedSatelliteId = null;
            this.state.selectedAeroId = null;
            this.state.openAreaId = null;
        },

        selectItem(type, item) {
            this.resetAllSelection();

            this.state.selectedItem = {
                type: type,
                id: item.id,
                name: item.name,
                isSubItem: false
            };


            if (type === 'area') this.state.selectedAreaId = item.id;
            if (type === 'satellite') this.state.selectedSatelliteId = item.id;
            if (type === 'aero') this.selectedAeroId = item.id;
        },

        toggleSubList(areaId) {
            this.resetAllSelection();

            if (this.state.openAreaId === areaId) {
                this.state.openAreaId = null;
            } else {
                this.state.openAreaId = areaId;

                const area = this.state.areas.find(a => a.id === areaId);
                if (area) {
                    this.state.selectedItem = {
                        type: 'area',
                        id: area.id,
                        name: area.name,
                        isSubItem: false
                    };
                    this.state.selectedAreaId = area.id;
                }
            }
        },

        selectSubItem(sub, area) {
            this.resetAllSelection();

            this.state.selectedItem = {
                type: 'satellite_from_area',
                id: sub.id,
                name: sub.name,
                isSubItem: true,
                parentPolygon: area.name
            };
        },

        getFilteredNN() {
            if (!this.state.selectedItem) return this.state.neuralNetworks;

            return this.state.neuralNetworks.filter(nn => {
                if (this.state.selectedItem.type === 'area' && !this.state.selectedItem.isSubItem) {
                    return nn.type === 'universal';
                }
                if (this.state.selectedItem.type === 'satellite' || this.state.selectedItem.type === 'satellite_from_area') {
                    return nn.type !== 'aero';
                }
                if (this.state.selectedItem.type === 'aero') {
                    return nn.type !== 'satellite';
                }
                return true;
            });
        },

        selectNN(nn) {
            if (this.state.selectedNN && this.state.selectedNN.id === nn.id) {
                this.state.selectedNN = null;
                return;
            }

            this.state.selectedNN = {
                id: nn.id,
                name: nn.name
            };
        },

        runAnalysis() {
            if (!this.state.selectedItem || !this.state.selectedNN) return;

            const newResult = {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),

                type: this.state.selectedItem.type === 'aero' ? 'aero' : 'satellite',
                itemName: this.state.selectedItem.name,
                nnName: this.state.selectedNN.name || `NN #${this.state.selectedNN.id}`,
                hasPolygon: this.state.selectedItem.isSubItem || this.state.selectedItem.type === 'area',

                // 🔥 НОВОЕ — СОСТОЯНИЕ UI
                resultViewType: this.determineResultViewType(),
                polygonOpacity: 0.5,
                aeroOverlayOpacity: 0.6,
                uploadedAeroFile: null, // стремный момент ??????
                deepAnalysisEnabled: false,
            };

            this.state.resultViewType = this.determineResultViewType();
            this.state.uploadedAeroFile = null;
            this.state.deepAnalysisEnabled = false;

            this.state.analysisHistory.unshift(newResult);
            this.state.activeResult = newResult;
            this.state.currentResultIndex = 0;
            this.applyResultState();
            this.state.mode = 'result';

            this.switchMode('result');
        },

        applyResultState() {
            if (!this.state.activeResult) return;

            this.state.resultViewType = this.state.activeResult.resultViewType;

            this.state.polygonOpacity = this.state.activeResult.polygonOpacity;
            this.state.aeroOverlayOpacity = this.state.activeResult.aeroOverlayOpacity;

            this.state.uploadedAeroFile = this.state.activeResult.uploadedAeroFile;
            this.state.deepAnalysisEnabled = this.state.activeResult.deepAnalysisEnabled;
        },

        switchMode(newMode) {
            this.state.mode = newMode;

            if (newMode === 'result') {
                if (this.state.analysisHistory.length > 0 && !this.state.activeResult) {
                    this.state.activeResult = this.state.analysisHistory[0];
                }
                this.applyResultState();
                this.renderResultMode();
            } else {
                // Возврат в режим выбора
                this.resetAllSelection();
                this.initTab2();
            }
        },

        renderResultMode() {

            console.log(`Режим результата активирован. Всего записей в истории: ${this.state.analysisHistory.length}`);
        },

        selectHistoryItem(index) {
            this.state.currentResultIndex = index;
            this.state.activeResult = this.state.analysisHistory[index];

            this.applyResultState();
            this.renderResultMode();
        },

        toggleImageSelection(id) {
            if (this.state.selectedImageIds.includes(id)) {
                this.state.selectedImageIds = this.state.selectedImageIds.filter(i => i !== id);
            } else {
                this.state.selectedImageIds.push(id);
            }
        },

        removeFromConfirm(id) {
            this.state.selectedImageIds = this.state.selectedImageIds.filter(i => i !== id);
        },

        showNoImagesFound() {
            this.state.currentModalStep = 4;
        },

        nextModalStep() {
            if (this.state.currentModalStep === 4) {
                this.state.currentModalStep = 1;
                return;
            }
            if (this.state.currentModalStep === 3) {
                this.addSelectedImagesToPolygon();
                this.closeFindImagesModal();
                return;
            }
            this.state.currentModalStep++;
        },

        prevModalStep() {
            if (this.state.currentModalStep === 1 || this.state.currentModalStep === 4) return;
            this.state.currentModalStep--;
        },

        addSelectedImagesToPolygon() {
            console.log('✅ Снимки добавлены в подсписок полигона (заглушка)');

        },

        handleAeroUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.state.uploadedAeroFile = file;
            console.log('📷 Загружено аэрофото:', file.name);
        },

        activateDeepAnalysis() {
            if (!this.state.uploadedAeroFile) return;

            this.state.deepAnalysisEnabled = true;
            this.state.resultViewType = 'satellite_with_aero';

            console.log('🚀 Углубленный анализ активирован');
        },

        handleFiles(files) {
            if (!files || files.length === 0) return;

            Array.from(files).forEach(async (file) => {
                const result = await this.uploadFile(file);
                if (result && result.success) {
                    this.state.uploadedFiles.push(result);
                    this.renderUploadedFiles();
                }
            });
        },

        async uploadFile(file) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success) {
                    return {
                        success: true,
                        name: data.name,
                        path: data.path,
                        date: data.date || new Date().toLocaleDateString('ru-RU')
                    };
                }
                return { success: false };
            } catch (error) {
                console.error('Ошибка загрузки файла:', error);
                return { success: false };
            }
        },

        renderUploadedFiles() {

            console.log(`Загружено файлов: ${this.state.uploadedFiles.length}`);
        },

        removeFile(index) {
            this.state.uploadedFiles.splice(index, 1);
        },

        clearUploadedFiles() {
            if (confirm("Очистить все загруженные снимки?")) {
                this.state.uploadedFiles = [];
            }
        },

        get canRunAnalysis() {
            return !!(this.state.selectedItem && this.state.selectedNN);
        },

        get modalTitleText() {
            if (this.state.currentModalStep === 1) return 'Необходима настройка для скачки спутникового снимка?';
            if (this.state.currentModalStep === 2) return `Найдено ${this.state.fakeFoundImages.length} снимков. Выберите даты для предпросмотра`;
            if (this.state.currentModalStep === 3) return 'Подтвердите выбор снимка / снимков';
            return 'Снимки не найдены';
        },

        determineResultViewType() {
            if (!this.state.selectedItem) return null;
            if (this.state.selectedItem.type === 'satellite_from_area') {
                return 'satellite_with_polygon';
            }
            if (this.state.selectedItem.type === 'satellite') {
                return 'satellite_basic';
            }
            if (this.state.selectedItem.type === 'aero') {
                return 'aero_full';
            }
            return 'satellite_basic';
        },

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

    }));
});