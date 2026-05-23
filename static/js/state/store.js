export const state = {
    // UI
    currentTab: 0,
    mode: 'selection',

    // Состояния для подсветки и редактирования
    highlightedItemId: null,
    selectedWorkspaceItemId: null,
    editingItemId: null,

    // Фильтрация и сортировка таблицы рабочей области
    workspaceFilter: { polygon: true, satellite: true, aero: true },
    workspaceSort: 'date',       // 'name' или 'date'
    workspaceSortAsc: false,     // true = по возрастанию

    // Переименование
    renamingItemId: null,
    renamingValue: '',

    // выбор
    selectedItem: null, // выбранный объект из списков
    selectedNN: null, // выбранная нейросеть (алгоритм)

//    // Единая таблица объектов первой вкладки
//    workspaceItems: [
//        // Пример структуры элемента:
//        // {
//        //     id: 1,
//        //     name: 'example.kml',
//        //     type: 'polygon',     // 'polygon' | 'satellite' | 'aero'
//        //     format: 'kml',       // 'kml' | 'geotiff' | 'jpg' | 'png'
//        //     dateAdded: new Date().toISOString(),
//        //     sourceFile: null,    // File object (если нужно)
//        //     polygonCoords: null, // массив координат [lat, lng] или GeoJSON
//        //     visibleOnMap: true,
//        //     layerId: null,       // id слоя на карте Leaflet
//        //     associatedKml: null, // для аэро с KML – ссылка на id связанного KML-элемента
//        //     imageThumbnail: null // base64 миниатюра (опционально)
//        // }
//    ],



    workspaceItems: [
//        // Чистый полигон с подсписком спутниковых снимков
//        {
//            id: 1001,
//            name: 'Полигон Приморский',
//            type: 'polygon',
//            format: 'kml',
//            dateAdded: '2026-04-05T10:00:00Z',
//            sourceFile: null,
//            polygonCoords: [
//                [43.15, 131.88],
//                [43.15, 131.92],
//                [43.10, 131.92],
//                [43.10, 131.88]
//            ],
//            visibleOnMap: true,
//            layerId: 'workspace_1001',
//            associatedKml: null,
//            imageThumbnail: null,
//            subItems: [
//                { id: 2001, name: 'Sentinel-2_2025_04_12.tif', cloud: 12, date: '12.04.2025' },
//                { id: 2002, name: 'Landsat_8_2025_03_28.tif', cloud: 8, date: '28.03.2025' }
//            ]
//        },
//        // Чистый полигон без подсписка
//        {
//            id: 1002,
//            name: 'Полигон Островной',
//            type: 'polygon',
//            format: 'manual',
//            dateAdded: '2026-04-06T12:00:00Z',
//            sourceFile: null,
//            polygonCoords: [
//                [43.01, 131.85],
//                [43.02, 131.85],
//                [43.02, 131.86],
//                [43.01, 131.86]
//            ],
//            visibleOnMap: true,
//            layerId: 'workspace_1002',
//            associatedKml: null,
//            imageThumbnail: null,
//            subItems: null   // или просто не указывать
//        },
//
//        // Спутниковые снимки
//        {
//            id: 2001,
//            name: 'Sentinel-2_2025_04_12.tif',
//            type: 'satellite',
//            format: 'geotiff',
//            dateAdded: '2026-04-12T09:00:00Z',
//            sourceFile: null,
//            polygonCoords: [
//                [43.12, 131.89],
//                [43.14, 131.89],
//                [43.14, 131.91],
//                [43.12, 131.91]
//            ],
//            visibleOnMap: true,
//            layerId: 'workspace_2001',
//            associatedKml: null,
//            imageThumbnail: null
//        },
//        {
//            id: 2002,
//            name: 'Landsat_8_2025_03_28.tif',
//            type: 'satellite',
//            format: 'geotiff',
//            dateAdded: '2026-03-28T11:00:00Z',
//            sourceFile: null,
//            polygonCoords: [
//                [43.08, 131.87],
//                [43.10, 131.87],
//                [43.10, 131.89],
//                [43.08, 131.89]
//            ],
//            visibleOnMap: true,
//            layerId: 'workspace_2002',
//            associatedKml: null,
//            imageThumbnail: null
//        },
//        {
//            id: 2003,
//            name: 'Sentinel-2_2025_05_01.tif',
//            type: 'satellite',
//            format: 'geotiff',
//            dateAdded: '2026-05-01T08:00:00Z',
//            sourceFile: null,
//            polygonCoords: [
//                [43.20, 131.95],
//                [43.22, 131.95],
//                [43.22, 131.97],
//                [43.20, 131.97]
//            ],
//            visibleOnMap: true,
//            layerId: 'workspace_2003',
//            associatedKml: null,
//            imageThumbnail: null
//        },
//        // Аэрофото без KML
//        {
//            id: 3001,
//            name: 'Aero_test_01.png',
//            type: 'aero',
//            format: 'png',
//            dateAdded: '2026-04-05T14:00:00Z',
//            sourceFile: null,
//            polygonCoords: null,
//            visibleOnMap: false,
//            layerId: null,
//            associatedKml: null,
//            imageThumbnail: null
//        },
//
//        // Аэрофото с KML
//        {
//            id: 3002,
//            name: 'Aero_winter_2024.jpg',
//            type: 'aero',
//            format: 'jpg',
//            dateAdded: '2026-04-06T15:00:00Z',
//            sourceFile: null,
//            polygonCoords: null,
//            visibleOnMap: true,
//            layerId: null,
//            associatedKml: 3003,
//            imageThumbnail: null
//        },
//        {
//            id: 3003,
//            name: 'Aero_KML_привязка.kml',
//            type: 'polygon',
//            format: 'kml',
//            dateAdded: '2026-04-06T15:01:00Z',
//            sourceFile: null,
//            polygonCoords: [
//                [43.05, 131.83],
//                [43.06, 131.83],
//                [43.06, 131.84],
//                [43.05, 131.84]
//            ],
//            visibleOnMap: true,
//            layerId: 'workspace_3003',
//            associatedKml: null,
//            imageThumbnail: null
//        }
    ],

    coordModalOpen: false,
    coordInputs: [
        { value: '' },
        { value: '' },
        { value: '' }
    ],   // начальные 3 точки

    // нейронные сети
    neuralNetworks: [
        {
            id: 1,
            name: "Многодатный анализ изменений",
            shortDesc: "Анализ серии спутниковых снимков одного полигона за выбранный период.",
            type: "multidate",
            applicableTo: "Полигон с найденными/загруженными спутниковыми снимками",
            detail: "Этот алгоритм позволяет отслеживать изменения растительности и усыхание лесов во времени, сравнивая серию спутниковых снимков, привязанных к одному полигону. Для работы необходимо предварительно найти снимки через «Найти снимки» или загрузить несколько снимков с одинаковым bounding box."
        },
        {
            id: 2,
            name: "Спутниковый анализ (из подсписка)",
            shortDesc: "Анализ спутникового снимка, найденного для конкретного полигона.",
            type: "satellite",
            applicableTo: "Спутниковый снимок, выбранный из подсписка полигона",
            detail: "Применяется к спутниковому снимку, который был найден для полигона через модальное окно поиска. Результат включает тепловую карту зон усыхания и слой точек усыхания, накладываемый на исходный снимок."
        },
        {
            id: 3,
            name: "Спутниковый анализ (загруженный)",
            shortDesc: "Анализ отдельно загруженного спутникового снимка (GeoTIFF).",
            type: "satellite",
            applicableTo: "Отдельный загруженный спутниковый снимок",
            detail: "Анализирует спутниковый снимок, загруженный вручную через вкладку «Загрузить файлы». Выдаёт тепловую карту и слой точек усыхания, как и алгоритм 2."
        },
        {
            id: 4,
            name: "Аэрофото анализ",
            shortDesc: "Анализ аэрофотоснимка без геопривязки.",
            type: "aero",
            applicableTo: "Аэрофотоснимок",
            detail: "Обрабатывает аэрофотоснимок, не имеющий KML-привязки. Результат — тепловая карта, построенная по визуальным признакам."
        },
        {
            id: 5,
            name: "Аэрофото анализ с геопривязкой",
            shortDesc: "Анализ аэрофотоснимка, привязанного к полигону через KML.",
            type: "aero",
            applicableTo: "Аэрофотоснимок с привязанным KML",
            detail: "Расширенный анализ аэрофотоснимка, использующий географическую привязку из KML. Позволяет получить более точную статистику и сопоставить результаты с картой."
        }
    ],
    selectedAlgorithmData: null,   // объект, специфичный для каждого типа анализа

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

    // Модальное окно загрузки файлов
    uploadModalOpen: false,
    uploadModal: {
        satelliteFiles: [],
        polygonFiles: [],
        aeroEntries: [],       // [{ image: File, kml: File|null }]
        activeSection: null    // 'satellite' | 'polygon' | 'aero' | null
    },

    // Модальное окно активации многодатного анализа
    activationModalOpen: false,
    activationShowParams: false,
    activationMethod: null,           // 'found' | 'params' | 'upload'
    activationParams: {
        cloudMax: 30,
        yearFrom: 2023,
        yearTo: 2025,
        season: 'Любой'
    },
    uploadedSnapshots: [],            // File[] для способа 3
    uploadedSnapshotIds: [],

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