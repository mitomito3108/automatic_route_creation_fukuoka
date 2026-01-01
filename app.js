// ================================
// 1. 定数定義
// ================================

const START_POINT = {
  name: "あいれふ",
  lat: 33.5909,
  lng: 130.3939
};

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
// 2. グローバル
// ================================

let map;
let renderers = [];
let markers = [];
let worker;

// ================================
// 3. 初期化
// ================================

window.onload = () => {
  initMap();
  buildCheckboxList();
  bindEvents();
  worker = new Worker("worker.js");
};

// ================================
// 4. Map
// ================================

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: START_POINT,
    zoom: 12
  });
  addStartMarker();
}

// ================================
// 5. UI生成
// ================================

function buildCheckboxList() {
  const list = document.getElementById("poiList");
  list.innerHTML = "";

  POIS.forEach(p => {
    const label = document.createElement("label");
    label.className = "checkbox-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = p.id;
    cb.onchange = updateSelectedTags;

    label.appendChild(cb);
    label.appendChild(document.createTextNode(p.name));
    list.appendChild(label);
  });
}

function updateSelectedTags() {
  const tags = document.getElementById("selectedTags");
  tags.innerHTML = "";
  getSelectedPois().forEach(p => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = p.name;
    tags.appendChild(span);
  });
}

// ================================
// 6. Events
// ================================

function bindEvents() {
  document.getElementById("calcBtn").onclick = calculate;
  document.getElementById("clearBtn").onclick = clearAll;
}

// ================================
// 7. 計算開始
// ================================

function calculate() {
  clearRoutes();

  const selected = getSelectedPois();
  if (!selected.length) {
    setStatus("経由地を選択してください");
    return;
  }

  const carCount = Number(document.getElementById("carCount").value);

  setStatus("計算中...");
  document.getElementById("calcBtn").disabled = true;

  worker.postMessage({
    pois: selected,
    carCount
  });

  worker.onmessage = e => {
    const groups = e.data;
    groups.forEach((g, i) => drawRoute(g, i));
  };
}

// ================================
// 8. ルート描画
// ================================

function drawRoute(pois, index) {
  const service = new google.maps.DirectionsService();
  const renderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: { strokeColor: COLORS[index], strokeWeight: 5 }
  });

  renderers.push(renderer);

  service.route({
    origin: START_POINT,
    destination: START_POINT,
    waypoints: pois.map(p => ({ location: p, stopover: true })),
    optimizeWaypoints: true,
    travelMode: "DRIVING"
  }, (res, status) => {
    if (status !== "OK") return;

    renderer.setDirections(res);
    renderRouteDetail(res, index, pois);
    addStartMarker();

    res.routes[0].waypoint_order.forEach((i, n) =>
      addNumberedMarker(pois[i], n + 1, COLORS[index])
    );

    finalize();
  });
}

// ================================
// 9. 詳細表示
// ================================

function renderRouteDetail(result, index, pois) {
  const box = document.getElementById("routeDetail");
  const route = result.routes[0];
  const legs = route.legs;
  const order = route.waypoint_order;
  const ordered = order.map(i => pois[i]);
  const points = [START_POINT, ...ordered, START_POINT];

  let dist = 0, time = 0;

  const div = document.createElement("div");
  div.innerHTML = `<h4 style="color:${COLORS[index]}">🚗 車${index + 1}</h4>`;
  const ol = document.createElement("ol");

  legs.forEach((l, i) => {
    dist += l.distance.value;
    time += l.duration.value;
    const li = document.createElement("li");
    li.textContent = `${points[i].name} → ${points[i + 1].name}（${l.distance.text} / ${l.duration.text}）`;
    ol.appendChild(li);
  });

  div.appendChild(ol);
  box.appendChild(div);

  appendTotals(index, dist, time);
}

// ================================
// 10. 合計表示
// ================================

function appendTotals(i, dist, time) {
  const t = document.getElementById("totals");
  const km = (dist / 1000).toFixed(1);
  const min = Math.round(time / 60);
  t.innerHTML += `<div style="color:${COLORS[i]}">車${i + 1}: ${km}km / ${min}分</div>`;
}

// ================================
// 11. Marker
// ================================

function addStartMarker() {
  markers.push(new google.maps.Marker({
    position: START_POINT,
    map,
    label: "S"
  }));
}

function addNumberedMarker(p, n, c) {
  markers.push(new google.maps.Marker({
    position: p,
    map,
    label: { text: String(n), color: "#fff" },
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: c, fillOpacity: 1,strokeWeight: 0 }
  }));
}

// ================================
// 12. Util
// ================================

function getSelectedPois() {
  const ids = [...document.querySelectorAll("#poiList input:checked")].map(i => i.value);
  return POIS.filter(p => ids.includes(p.id));
}

function clearRoutes() {
  renderers.forEach(r => r.setMap(null));
  markers.forEach(m => m.setMap(null));
  renderers = [];
  markers = [];
  document.getElementById("routeDetail").innerHTML = "";
  document.getElementById("totals").innerHTML = "";
}

function clearAll() {
  document.querySelectorAll("input[type=checkbox]").forEach(c => c.checked = false);
  updateSelectedTags();
  clearRoutes();
  setStatus("");
}

function setStatus(t) {
  document.getElementById("status").textContent = t;
}

function finalize() {
  setStatus("ルート計算完了");
  document.getElementById("calcBtn").disabled = false;
}

