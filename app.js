// ================================
// 1. 定数定義
// ================================

let START_POINT = {
  name: "あいれふ",
  lat: 33.592120,
  lng: 130.390984
};

const END_POINT = {
  name: "福岡市保健環境研究所",
  lat: 33.594422,
  lng: 130.364309
};

const POIS = [
  { id: "株式会社BMLフードサイエンス福岡", name: "株式会社BMLフード・サイエンス", lat: 33.574426, lng: 130.44855 },
  { id: "株式会社QCL", name: "株式会社QCL", lat: 33.625788, lng: 130.436202 },
  { id: "株式会社シーアールシー", name: "株式会社　シー・アール・シー", lat: 33.628696, lng: 130.438564 },
  { id: "株式会社中部衛生検査センター", name: "株式会社中部衛生検査センター", lat: 33.577054, lng: 130.439889 },
  { id: "株式会社保健科学研究所", name: "株式会社　保健科学研究所", lat: 33.578562, lng: 130.436188 },
  { id: "貝塚病院", name: "貝塚病院", lat: 33.635334, lng: 130.424973 },
  { id: "輝栄会病院", name: "輝栄会病院", lat: 33.648537, lng: 130.436996 },
  { id: "九州医療センター", name: "九州医療センター", lat: 33.592358, lng: 130.362518 },
  { id: "九州がんセンター", name: "九州がんセンター", lat: 33.541073, lng: 130.420471 },
  { id: "九州大学病院", name: "九州大学病院", lat: 33.609234, lng: 130.415726 },
  { id: "公立学校共済組合九州中央病院", name: "公立学校共済組合九州中央病院", lat: 33.564079, lng: 130.424728 },
  { id: "済生会福岡総合病院", name: "済生会福岡総合病院", lat: 33.589699, lng: 130.403229 },
  { id: "さくら病院", name: "さくら病院", lat: 33.545528, lng: 130.369781 },
  { id: "昭和病院", name: "昭和病院", lat: 33.580364, lng: 130.256409 },
  { id: "千鳥橋病院", name: "千鳥橋病院", lat: 33.607758, lng: 130.412308 },
  { id: "那珂川病院", name: "那珂川病院", lat: 33.539406, lng: 130.427597 },
  { id: "白十字病院", name: "白十字病院", lat: 33.570805, lng: 130.315674 },
  { id: "白十字リハビリテーション病院", name: "白十字リハビリテーション病院", lat: 33.574097, lng: 130.316071 },
  { id: "原三信病院", name: "原三信病院", lat: 33.601639, lng: 130.405167 },
  { id: "浜の町病院", name: "浜の町病院", lat: 33.596153, lng: 130.39418 },
  { id: "福岡記念病院", name: "福岡記念病院", lat: 33.585087, lng: 130.362473 },
  { id: "福岡山王病院", name: "福岡山王病院", lat: 33.591473, lng: 130.34993 },
  { id: "福岡市医師会臨床検査センター", name: "福岡市医師会臨床検査センター", lat: 33.592375, lng: 130.356109 },
  { id: "福岡市立こども病院", name: "福岡市立こども病院", lat: 33.662792, lng: 130.417313 },
  { id: "福岡市民病院", name: "福岡市民病院", lat: 33.604118, lng: 130.42189 },
  { id: "福岡赤十字病院", name: "福岡赤十字病院", lat: 33.572178, lng: 130.413971 },
  { id: "福岡大学病院", name: "福岡大学病院", lat: 33.546318, lng: 130.358902 },
  { id: "福岡病院", name: "福岡病院", lat: 33.535946, lng: 130.408524 },
  { id: "福岡和白病院", name: "福岡和白病院", lat: 33.69215, lng: 130.434174 }
];

const COLORS = ["#1a73e8", "#34a853", "#ea4335"];

// ★追加：対応時間（分）
const SERVICE_TIME = {};

// ================================
// 2. グローバル
// ================================

let map;
let renderers = [];
let markers = [];
let worker;
let startMarker = null;
let autocomplete;

// ================================
// 3. 初期化
// ================================

window.onload = () => {
  initMap();
  initPlaceSearch();
  buildCheckboxList();
  bindEvents();
  worker = new Worker("worker.js");
  updateStartInfo();
};

// ================================
// 5. UI生成（★完全改修）
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

    const text = document.createElement("span");
    text.className = "checkbox-text";
    text.textContent = p.name;

    // ★対応時間UI
    const timeBox = document.createElement("div");
    timeBox.style.display = "none";
    timeBox.style.marginTop = "6px";

    timeBox.innerHTML = `
      <label><input type="radio" name="time_${p.id}" value="10">10分</label>
      <label><input type="radio" name="time_${p.id}" value="15">15分</label>
      <label><input type="radio" name="time_${p.id}" value="30">30分</label>
      <input type="number" placeholder="自由(分)" style="width:60px;" />
    `;

    cb.onchange = () => {
      timeBox.style.display = cb.checked ? "block" : "none";

      if (!cb.checked) delete SERVICE_TIME[p.id];

      updateSelectedTags();
    };

    timeBox.addEventListener("change", () => {
      const radio = timeBox.querySelector("input[type=radio]:checked");
      const free = timeBox.querySelector("input[type=number]").value;

      SERVICE_TIME[p.id] = Number(free || (radio ? radio.value : 0));
    });

    label.appendChild(cb);
    label.appendChild(text);
    label.appendChild(timeBox);

    list.appendChild(label);
  });
}

// ================================
// 9. 詳細表示（★完全改修）
// ================================

function renderRouteDetail(result, index, pois) {
  const box = document.getElementById("routeDetail");
  const route = result.routes[0];
  const legs = route.legs;
  const order = route.waypoint_order;
  const ordered = order.map(i => pois[i]);
  const points = [START_POINT, ...ordered, END_POINT];

  let dist = 0, time = 0;
  let serviceTimeTotal = 0;

  const div = document.createElement("div");
  div.innerHTML = `<h4 style="color:${COLORS[index]}">🚗 車${index + 1}</h4>`;
  
  const ol = document.createElement("ol");

  legs.forEach((l, i) => {
    dist += l.distance.value;
    time += l.duration.value;

    const next = points[i + 1];

    let serviceMin = 0;
    if (next.id && SERVICE_TIME[next.id]) {
      serviceMin = SERVICE_TIME[next.id];
      serviceTimeTotal += serviceMin * 60;
    }

    const li = document.createElement("li");
    li.textContent =
      `${points[i].name} → ${next.name}（${l.distance.text} / ${l.duration.text}` +
      (serviceMin ? ` + 対応${serviceMin}分` : "") +
      `）`;

    ol.appendChild(li);
  });

  div.appendChild(ol);
  box.appendChild(div);

  appendTotals(index, dist, time, serviceTimeTotal);
}

// ================================
// 10. 合計表示（★改修）
// ================================

function appendTotals(i, dist, time, serviceTime = 0) {
  const t = document.getElementById("totals");

  const totalMin = Math.round((time + serviceTime) / 60);

  t.innerHTML += `
    <div style="color:${COLORS[i]}">
      車${i + 1}: ${(dist / 1000).toFixed(1)}km / ${totalMin}分
      ${serviceTime ? `(対応${Math.round(serviceTime / 60)}分含む)` : ""}
    </div>
  `;
}

// ================================
// 11. Marker
// ================================

function addStartMarker() {
  if (startMarker) startMarker.setMap(null);

  startMarker = new google.maps.Marker({
    position: START_POINT,
    map,
    label: "S"
  });
}

function addEndMarker() {
  markers.push(new google.maps.Marker({
    position: END_POINT,
    map,
    label: "G"
  }));
}

function addNumberedMarker(p, n, c) {
  markers.push(new google.maps.Marker({
    position: p,
    map,
    label: { text: String(n), color: "#fff" },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: c,
      fillOpacity: 1,
      strokeWeight: 0
    }
  }));
}

// ================================
// 12. Util
// ================================

function updateStartInfo() {
  document.getElementById("startInfo").textContent =
    `スタート地点: ${START_POINT.name}`;
}

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



