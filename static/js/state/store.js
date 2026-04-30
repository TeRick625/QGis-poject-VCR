export const state = {
    // UI
    currentTab: 0,
    mode: 'selection',

    // выбор
    selectedItem: null, // выбранный объект из списков
    selectedNN: null, // выбранная нейросеть (алгоритм)

    // полигоны
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

    // спутниковые снимки
    satellites: [{ id: 1, name: 'Sentinel-2_2025_04_12.tif' }],

    // аэрофотоснимки
    aeroImages: [
        { id: 1, name: 'Aero_2025_04_12.tif' },
        { id: 2, name: 'Aero_test_01.png' },
        { id: 3, name: 'Aero_winter_2024.jpg' }
    ],

    // нейронные сети
    neuralNetworks: [
        { id: 1, name: "Satellite Segmentation", desc: "Сегментация спутниковых снимков", type: "satellite" },
        { id: 2, name: "Aero Photo Analyzer", desc: "Анализ аэрофотоснимков", type: "aero" },
        { id: 3, name: "Universal Classifier", desc: "Универсальная модель", type: "universal" }
    ],

    // модальное окно
    isFindModalOpen: false,
    currentModalStep: 1,
    selectedImageIds: [],

    // найденные для полигона снимки
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

    // анализ
    analysisHistory: [],
    activeResult: null,
    currentResultIndex: -1,


    uploadedFiles: [],
    uploadedAeroFile: null,
    deepAnalysisEnabled: false,
    resultViewType: null,
    polygonOpacity: 0.5,
    aeroOverlayOpacity: 0.6,
    openAreaId: null,

    selectedAreaId: null,
    selectedSatelliteId: null,
    selectedAeroId: null,
};