// ================================
// 1. 定数定義
// ================================

// スタート地点（あいれふ）
const START_POINT = {
  name: "あいれふ",
  lat: 33.5909,
  lng: 130.3939
};

// 経由地点
const POIS = [
  { id: "ohori", name: "大濠公園", lat: 33.5866, lng: 130.3750 },
  { id: "tower", name: "福岡タワー", lat: 33.5933, lng: 130.3516 },
  { id: "dazaifu", name: "太宰府天満宮", lat: 33.5215, lng: 130.5349 },
  { id: "canal", name: "キャナルシティ博多", lat: 33.5902, lng: 130.4107 },
  { id: "kushida", name: "櫛田神社", lat: 33.5928, lng: 130.4102 },
  { id: "marine", name: "マリンワールド海の中道", lat: 33.6609, lng: 130.3629 },
  { id: "zoo", name: "福岡市動植物園", lat: 33.5704, lng: 130.3902 },
  { id: "museum", name: "福岡市美術館", lat: 33.5863, lng: 130.3745 },
  { id: "uminaka", name: "海の中道海浜公園", lat: 33.6670, lng: 130.3606 },
  { id: "aoba", name: "青葉公園", lat: 33.6669, lng: 130.4546 },
  { id: "airport", name: "福岡空港", lat: 33.5859, lng: 130.4514 },
  { id: "higashi", name: "東区役所", lat: 33.6707, lng: 130.4441 },
  { id: "minami", name: "南区役所", lat: 33.5527, lng: 130.4164 },
  { id: "hakata", name: "博多区役所", lat: 33.5903, lng: 130.4200 },
  { id: "chuo", name: "中央区役所", lat: 33.5900, lng: 130.4017 },
  { id: "jonan", name: "城南区役所", lat: 33.5612, lng: 130.3705 },
  { id: "sawara", name: "早良区役所", lat: 33.5797, lng: 130.3435 },
  { id: "nishi", name: "西区役所", lat: 33.5789, lng: 130.3003 }
];

const COLORS = ["#1a73e8", "#34a853", "#ea4335"];

// ================================
// 2. グローバル変数
// ================================

let map;
let directionsRenderers = [];
let markers = [];

// ================================
// 3. 初期化
// ================================

window.addEventListener("load", init);

function init() {
  initMap();
  buildCheckboxList();
  bindEvents();
}

// ================================
// 4. マップ初期化
// ================================

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: START_POINT,
    zoom: 12
  });

  addStartMarker();
}

// ================================
// 5. チェックボックス生成
// ================================

function buildCheckboxList() {
  const list = document.getElementById("poiList");
  list.innerHTML = "";

  POIS.forEach(poi => {
    const label = document.createElement("label");
    label.className = "checkbox-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = poi.id;

    label.appendChild(cb);
    label.appendChild(document.createTextNode(poi.name));
    list.appendChild(label);
  });
}

// ================================
// 6. UIイベント
// ================================

function bindEvents() {
  document.getElementById("calcBtn").addEventListener("click", calculate);
  document.getElementById("clearBtn").addEventListener("click", clearAll);
}

// ================================
// 7. ルート計算
// ================================

function calculate() {
  clearRoutes();

  const carCount = Number(document.getElementById("carCount").value);
  const selected = getSelectedPois();

  if (selected.length === 0) {
    setStatus("経由地を選択してください");
    return;
  }

  const groups = splitIntoGroups(selected, carCount);
  groups.forEach((group, i) => drawRoute(group, i));

  setStatus("ルート計算完了");
}

// ================================
// 8. ルート描画
// ================================

function drawRoute(pois, index) {
  const service = new google.maps.DirectionsService();
  const renderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: COLORS[index],
      strokeWeight: 5
    }
  });

  directionsRenderers.push(renderer);

  const waypoints = pois.map(p => ({
    location: { lat: p.lat, lng: p.lng },
    stopover: true
  }));

  service.route(
    {
      origin: START_POINT,
      destination: START_POINT,
      waypoints,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING
    },
    (result, status) => {
      if (status === "OK") {
        renderer.setDirections(result);

        renderRouteDetail(result, index);

        const order = result.routes[0].waypoint_order;

        addStartMarker();

        order.forEach((idx, i) => {
          addNumberedMarker(pois[idx], i + 1, COLORS[index]);
        });
      }
    }
  );
}

// ================================
// 9. ルート詳細DOM生成（①）
// ================================

function renderRouteDetail(result, index) {
  const container = document.getElementById("routeDetail");

  const route = result.routes[0];
  const legs = route.legs;

  const section = document.createElement("div");
  section.innerHTML = `<h4 style="color:${COLORS[index]}">🚗 車 ${index + 1}</h4>`;

  const ol = document.createElement("ol");

  legs.forEach(leg => {
    const li = document.createElement("li");
    li.textContent = `${leg.start_address} → ${leg.end_address}
      (${leg.distance.text} / ${leg.duration.text})`;
    ol.appendChild(li);
  });

  section.appendChild(ol);
  container.appendChild(section);
}

// ================================
// 10. マーカー関連（②）
// ================================

function addStartMarker() {
  const marker = new google.maps.Marker({
    position: START_POINT,
    map,
    label: { text: "S", color: "#fff", fontWeight: "bold" },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: "#16a34a",
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2
    }
  });
  markers.push(marker);
}

function addNumberedMarker(point, number, color) {
  const marker = new google.maps.Marker({
    position: { lat: point.lat, lng: point.lng },
    map,
    label: { text: String(number), color: "#fff", fontWeight: "bold" },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2
    }
  });
  markers.push(marker);
}

// ================================
// 11. 補助関数
// ================================

function getSelectedPois() {
  const ids = [...document.querySelectorAll("#poiList input:checked")].map(i => i.value);
  return POIS.filter(p => ids.includes(p.id));
}

function splitIntoGroups(arr, n) {
  const groups = Array.from({ length: n }, () => []);
  arr.forEach((item, i) => groups[i % n].push(item));
  return groups;
}

function clearRoutes() {
  directionsRenderers.forEach(r => r.setMap(null));
  directionsRenderers = [];

  markers.forEach(m => m.setMap(null));
  markers = [];

  document.getElementById("routeDetail").innerHTML = "";
  addStartMarker();
}

function clearAll() {
  document.querySelectorAll("#poiList input").forEach(cb => cb.checked = false);
  clearRoutes();
  setStatus("");
}

function setStatus(msg) {
  document.getElementById("status").textContent = msg;
}
