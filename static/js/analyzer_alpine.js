document.addEventListener('alpine:init', () => {
    Alpine.data('analyzer', () => ({

        currentTab: 0,
        mode: 'selection',
        uploadedFiles: [],

        areas: [
            {
                id: 1,
                name: 'Полигон Приморский',
                created: '05.04.2026',
                size: '124 га',
                hasSub: false
            },
            {
                id: 2,
                name: 'Тестовая область (модальное окно)',
                created: '06.04.2026',
                hasSub: true,
                subItems: [
                    { id: 101, name: 'Sentinel-2_2025_04_12.tif', cloud: 12, date: '12.04.2025' },
                    { id: 102, name: 'Landsat_8_2025_03_28.tif', cloud: 8, date: '28.03.2025' }
                ]
            }
        ],
        openAreaId: null,

        satellites: [{ id: 1, name: 'Sentinel-2_2025_04_12.tif' }],
        aeroImages: [
            { id: 1, name: 'Aero_2025_04_12.tif' },
            { id: 2, name: 'Aero_test_01.png' },
            { id: 3, name: 'Aero_winter_2024.jpg' }
        ],

        neuralNetworks: [
            { id: 1, name: "Satellite Segmentation", desc: "Сегментация спутниковых снимков", type: "satellite" },
            { id: 2, name: "Aero Photo Analyzer", desc: "Анализ аэрофотоснимков", type: "aero" },
            { id: 3, name: "Universal Classifier", desc: "Универсальная модель", type: "universal" }
        ],

        selectedAreaId: null,
        selectedSatelliteId: null,
        selectedAeroId: null,

        selectedItem: null,
        selectedNN: null,

        analysisHistory: [],
        currentResultIndex: -1,

        isFindModalOpen: false,
        currentModalStep: 1,
        selectedImageIds: [],

        fakeFoundImages: [
            {id:1, date:'2025-03-15', cloud:12, name:'SN-20250315-1432'},
            {id:2, date:'2025-03-12', cloud:8,  name:'SN-20250312-0911'},
            {id:3, date:'2025-03-10', cloud:25, name:'SN-20250310-1845'},
            {id:4, date:'2025-03-08', cloud:5,  name:'SN-20250308-1123'},
            {id:5, date:'2025-03-05', cloud:18, name:'SN-20250305-0741'},
            {id:6, date:'2025-03-03', cloud:9,  name:'SN-20250303-1522'},
            {id:7, date:'2025-03-01', cloud:3,  name:'SN-20250301-2210'},
            {id:8, date:'2025-02-28', cloud:15, name:'SN-20250228-0915'}
        ],

        isAnalyzing: false,

        resultViewType: null, // тип отображения результата

        polygonOpacity: 0.5,
        aeroOverlayOpacity: 0.6,

        uploadedAeroFile: null,
        deepAnalysisEnabled: false,
        activeResult: null,

        openFindImagesModal() {
            if (!this.selectedItem || this.selectedItem.type !== 'area') return;
            this.currentModalStep = 1;
            this.selectedImageIds = [];
            this.isFindModalOpen = true;
        },

        closeFindImagesModal() {
            this.isFindModalOpen = false;
        },

        get selectedImages() {
            return this.fakeFoundImages.filter(img => this.selectedImageIds.includes(img.id));
        },

        init() {
            console.log("✅ Alpine 'analyzer' компонент инициализирован");
            this.$watch('currentTab', (newValue) => {
                this.initCurrentTab();
            });
            this.$nextTick(() => {
                this.initCurrentTab();
            });
            this.$watch('polygonOpacity', (val) => {
                if (this.activeResult) this.activeResult.polygonOpacity = val;
            });

            this.$watch('aeroOverlayOpacity', (val) => {
                if (this.activeResult) this.activeResult.aeroOverlayOpacity = val;
            });

            this.$watch('uploadedAeroFile', (val) => {
                if (this.activeResult) this.activeResult.uploadedAeroFile = val;
            });

            this.$watch('deepAnalysisEnabled', (val) => {
                if (this.activeResult) this.activeResult.deepAnalysisEnabled = val;
            });

            this.$watch('resultViewType', (val) => {
                if (this.activeResult) this.activeResult.resultViewType = val;
            });
        },

        initCurrentTab() {
            if (this.currentTab === 0) {
                this.initTab1();
            } else if (this.currentTab === 1) {
                this.initTab2();
            } else if (this.currentTab === 2) {
                this.initTab3();
            } else if (this.currentTab === 3) {
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
            this.selectedItem = null;
            this.selectedNN = null;
            this.selectedAreaId = null;
            this.selectedSatelliteId = null;
            this.selectedAeroId = null;
            this.openAreaId = null;
        },

        selectItem(type, item) {
            this.resetAllSelection();

            this.selectedItem = {
                type: type,
                id: item.id,
                name: item.name,
                isSubItem: false
            };


            if (type === 'area') this.selectedAreaId = item.id;
            if (type === 'satellite') this.selectedSatelliteId = item.id;
            if (type === 'aero') this.selectedAeroId = item.id;
        },

        toggleSubList(areaId) {
            this.resetAllSelection();

            if (this.openAreaId === areaId) {
                this.openAreaId = null;
            } else {
                this.openAreaId = areaId;

                const area = this.areas.find(a => a.id === areaId);
                if (area) {
                    this.selectedItem = {
                        type: 'area',
                        id: area.id,
                        name: area.name,
                        isSubItem: false
                    };
                    this.selectedAreaId = area.id;
                }
            }
        },

        selectSubItem(sub, area) {
            this.resetAllSelection();

            this.selectedItem = {
                type: 'satellite_from_area',
                id: sub.id,
                name: sub.name,
                isSubItem: true,
                parentPolygon: area.name
            };
        },

        getFilteredNN() {
            if (!this.selectedItem) return this.neuralNetworks;

            return this.neuralNetworks.filter(nn => {
                if (this.selectedItem.type === 'area' && !this.selectedItem.isSubItem) {
                    return nn.type === 'universal';
                }
                if (this.selectedItem.type === 'satellite' || this.selectedItem.type === 'satellite_from_area') {
                    return nn.type !== 'aero';
                }
                if (this.selectedItem.type === 'aero') {
                    return nn.type !== 'satellite';
                }
                return true;
            });
        },

        selectNN(nn) {
            if (this.selectedNN && this.selectedNN.id === nn.id) {
                this.selectedNN = null;
                return;
            }

            this.selectedNN = {
                id: nn.id,
                name: nn.name
            };
        },

        runAnalysis() {
            if (!this.selectedItem || !this.selectedNN) return;

            const newResult = {
                id: Date.now(),
                timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),

                type: this.selectedItem.type === 'aero' ? 'aero' : 'satellite',
                itemName: this.selectedItem.name,
                nnName: this.selectedNN.name || `NN #${this.selectedNN.id}`,
                hasPolygon: this.selectedItem.isSubItem || this.selectedItem.type === 'area',

                // 🔥 НОВОЕ — СОСТОЯНИЕ UI
                resultViewType: this.determineResultViewType(),
                polygonOpacity: 0.5,
                aeroOverlayOpacity: 0.6,
                uploadedAeroFile: null,
                deepAnalysisEnabled: false,
            };

            this.resultViewType = this.determineResultViewType();
            this.uploadedAeroFile = null;
            this.deepAnalysisEnabled = false;

            this.analysisHistory.unshift(newResult);
            this.activeResult = newResult;
            this.currentResultIndex = 0;
            this.applyResultState();
            this.mode = 'result';

            this.switchMode('result');
        },

        applyResultState() {
            if (!this.activeResult) return;

            this.resultViewType = this.activeResult.resultViewType;

            this.polygonOpacity = this.activeResult.polygonOpacity;
            this.aeroOverlayOpacity = this.activeResult.aeroOverlayOpacity;

            this.uploadedAeroFile = this.activeResult.uploadedAeroFile;
            this.deepAnalysisEnabled = this.activeResult.deepAnalysisEnabled;
        },

        switchMode(newMode) {
            this.mode = newMode;

            if (newMode === 'result') {
                if (this.analysisHistory.length > 0 && !this.activeResult) {
                    this.activeResult = this.analysisHistory[0];
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

            console.log(`Режим результата активирован. Всего записей в истории: ${this.analysisHistory.length}`);
        },

        selectHistoryItem(index) {
            this.currentResultIndex = index;
            this.activeResult = this.analysisHistory[index];

            this.applyResultState();
            this.renderResultMode();
        },

        toggleImageSelection(id) {
            if (this.selectedImageIds.includes(id)) {
                this.selectedImageIds = this.selectedImageIds.filter(i => i !== id);
            } else {
                this.selectedImageIds.push(id);
            }
        },

        removeFromConfirm(id) {
            this.selectedImageIds = this.selectedImageIds.filter(i => i !== id);
        },

        showNoImagesFound() {
            this.currentModalStep = 4;
        },

        nextModalStep() {
            if (this.currentModalStep === 4) {
                this.currentModalStep = 1;
                return;
            }
            if (this.currentModalStep === 3) {
                this.addSelectedImagesToPolygon();
                this.closeFindImagesModal();
                return;
            }
            this.currentModalStep++;
        },

        prevModalStep() {
            if (this.currentModalStep === 1 || this.currentModalStep === 4) return;
            this.currentModalStep--;
        },

        addSelectedImagesToPolygon() {
            console.log('✅ Снимки добавлены в подсписок полигона (заглушка)');

        },

        handleAeroUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.uploadedAeroFile = file;
            console.log('📷 Загружено аэрофото:', file.name);
        },

        activateDeepAnalysis() {
            if (!this.uploadedAeroFile) return;

            this.deepAnalysisEnabled = true;
            this.resultViewType = 'satellite_with_aero';

            console.log('🚀 Углубленный анализ активирован');
        },

        handleFiles(files) {
            if (!files || files.length === 0) return;

            Array.from(files).forEach(async (file) => {
                const result = await this.uploadFile(file);
                if (result && result.success) {
                    this.uploadedFiles.push(result);
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

            console.log(`Загружено файлов: ${this.uploadedFiles.length}`);
        },

        removeFile(index) {
            this.uploadedFiles.splice(index, 1);
        },

        clearUploadedFiles() {
            if (confirm("Очистить все загруженные снимки?")) {
                this.uploadedFiles = [];
            }
        },

        get canRunAnalysis() {
            return !!(this.selectedItem && this.selectedNN);
        },

        get modalTitleText() {
            if (this.currentModalStep === 1) return 'Необходима настройка для скачки спутникового снимка?';
            if (this.currentModalStep === 2) return `Найдено ${this.fakeFoundImages.length} снимков. Выберите даты для предпросмотра`;
            if (this.currentModalStep === 3) return 'Подтвердите выбор снимка / снимков';
            return 'Снимки не найдены';
        },

        determineResultViewType() {
            if (!this.selectedItem) return null;
            if (this.selectedItem.type === 'satellite_from_area') {
                return 'satellite_with_polygon';
            }
            if (this.selectedItem.type === 'satellite') {
                return 'satellite_basic';
            }
            if (this.selectedItem.type === 'aero') {
                return 'aero_full';
            }
            return 'satellite_basic';
        },

        get isSatelliteBasic() {
            return this.resultViewType === 'satellite_basic';
        },

        get isSatelliteWithPolygon() {
            return this.resultViewType === 'satellite_with_polygon';
        },

        get isSatelliteWithAero() {
            return this.resultViewType === 'satellite_with_aero';
        },

        get isAeroFull() {
            return this.resultViewType === 'aero_full';
        },

    }));
});