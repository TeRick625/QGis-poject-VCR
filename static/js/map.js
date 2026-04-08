// static/js/map.js
let mapInstance = null;
let currentPolygonLayer = null;

function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error("Элемент #map не найден");
        return;
    }

    // Если карта уже создана — просто обновляем размер
    if (mapInstance) {
        mapInstance.invalidateSize();
        return;
    }

    mapInstance = L.map('map', {
        center: [43.1155, 131.8855],   // Владивосток
        zoom: 8,
        zoomControl: true
    });

    // Тайловый слой без attribution
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '',
        maxZoom: 19
    }).addTo(mapInstance);

    // Полностью скрываем attribution control Leaflet
    mapInstance.attributionControl.setPrefix(false);
    mapInstance.attributionControl._container.style.display = 'none';

    // Leaflet.draw контрол
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                shapeOptions: {
                    color: '#ef4444',
                    weight: 4,
                    opacity: 0.9
                }
            },
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false
        },
        edit: {
            featureGroup: new L.FeatureGroup()
        }
    });

    mapInstance.addControl(drawControl);

    // События рисования
    mapInstance.on(L.Draw.Event.CREATED, function (e) {
        if (currentPolygonLayer) mapInstance.removeLayer(currentPolygonLayer);
        currentPolygonLayer = e.layer;
        mapInstance.addLayer(currentPolygonLayer);
        savePolygonToBackend(currentPolygonLayer.toGeoJSON());
    });

    mapInstance.on(L.Draw.Event.EDITED, function () {
        if (currentPolygonLayer) {
            savePolygonToBackend(currentPolygonLayer.toGeoJSON());
        }
    });

    mapInstance.on(L.Draw.Event.DELETED, function () {
        currentPolygonLayer = null;
    });

    console.log("✅ Карта успешно инициализирована (Владивосток)");
}

async function savePolygonToBackend(geojson) {
    try {
        const res = await fetch('/api/polygon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ geojson: geojson })
        });
        const data = await res.json();
        if (data.success) {
            console.log("✅ Полигон сохранён на сервере");
        }
    } catch (err) {
        console.error("Ошибка сохранения полигона:", err);
    }
}

// Экспорт для вызова из HTML
window.initMap = initMap;