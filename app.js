// === 設定値 ===
const CITY_HALL = { lat: 33.5900684, lng: 130.4016776 }; // 福岡市役所
const COLORS = ["#1a73e8", "#34a853", "#ea4335"]; // 車1-3の色

// 観光地リスト（表示名）
const POI_NAMES = [
  "大濠公園",
  "福岡タワー",
  "太宰府天満宮",
  "キャナルシティ博多",
  "櫛田神社",
  "マリンワールド海の中道",
  "福岡市動植物園",
  "福岡市美術館",
  "能古島アイランドパーク",
  "海の中道海浜公園",
];

// === 変数 ===
let map;
let placesService;
let directionsServices = [];
let directionsRenderers = [];
let allMarkers = [];

// === 初期化 ===
window.initMap = function () {
  map = new google.maps.Map(document.getElementById("map"), {
    center: CITY_HALL,
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: true,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
      { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
      { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
      { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
      { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
      { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] }
    ],
  });

  // 市役所マーカー
  new google.maps.Marker({
    position: CITY_HALL,
    map,
    label: { text: "市役所", color: "white", fontWeight: "bold" },
    icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: "#000", fillOpacity: 1, strokeWeight: 0, scale: 8 },
  });

  placesService = new google.maps.places.PlacesService(map);

  buildCheckboxList();
  bindUI();
};

function bindUI() {
  document.getElementById("calcBtn").addEventListener("click", onCalculate);
  document.getElementById("clearBtn").addEventListener("click", clearAll);
  document.getElementById("selectAll").addEventListener("click", (e) => { e.preventDefault(); setAllChecked(true); });
  document.getElementById("clearSelection").addEventListener("click", (e) => { e.preventDefault(); setAllChecked(false); });
}

function buildCheckboxList() {
  const list = document.getElementById("poiList");
  list.innerHTML = "";
  POI_NAMES.forEach((name, idx) => {
    const id = `poi_${idx}`;
    const wrap = document.createElement("label");
    wrap.className = "checkbox-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;
    cb.value = name;
    cb.addEventListener("change", refreshTags);

    const mark = document.createElement("span");
    mark.className = "checkmark";

    const txt = document.createElement("span");
    txt.textContent = name;

    wrap.appendChild(cb);
    wrap.appendChild(mark);
    wrap.appendChild(txt);
    list.appendChild(wrap);
  });
}

function setAllChecked(flag) {
  document.querySelectorAll('#poiList input[type="checkbox"]').forEach(cb => { cb.checked = flag; });
  refreshTags();
}

function getSelectedNames() {
  return Array.from(document.querySelectorAll('#poiList input[type="checkbox"]:checked')).map(cb => cb.value);
}

function refreshTags() {
  const selected = getSelectedNames();
  const tagWrap = document.getElementById("selectedTags");
  tagWrap.innerHTML = "";
  selected.forEach(name => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = name;

    const x = document.createElement("button");
    x.className = "tag-close";
    x.textContent = "×";
    x.title = "除外";
    x.addEventListener("click", () => {
      // 対応するチェックをオフ
      const cb = Array.from(document.querySelectorAll('#poiList input[type="checkbox"]')).find(el => el.value === name);
      if (cb) { cb.checked = false; }
      refreshTags();
    });

    tag.appendChild(x);
    tagWrap.appendChild(tag);
  });
}

function setStatus(msg) {
  const el = document.getElementById("status");
  el.textContent = msg;
}

function clearAll() {
  setStatus("");
  directionsRenderers.forEach(r => r.setMap(null));
  directionsRenderers = [];
  directionsServices = [];
  allMarkers.forEach(m => m.setMap(null));
  allMarkers = [];
  document.getElementById("totals").innerHTML = "";
}

async function onCalculate() {
  clearAll();

  const carCount = parseInt(document.getElementById("carCount").value, 10);
  const selected = getSelectedNames();

  if (selected.length === 0) { setStatus("経由地が選択されていません。"); return; }

  setStatus("地点を検索中…");
  const resolved = await resolvePlaces(selected);
  if (resolved.length === 0) { setStatus("場所の特定に失敗しました。"); return; }

  setStatus("クラスタリング中…");
  const clusters = clusterByPolarKMeans(resolved, carCount); // 極座標K-means

  setStatus("ルートを計算中…");
  const totals = [];

  // 各クラスタごとに：市役所→最後の訪問地で終了
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    if (cluster.length === 0) continue;

    const color = COLORS[i];
    const ds = new google.maps.DirectionsService();
    const dr = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: { strokeColor: color, strokeWeight: 5, strokeOpacity: 0.9 },
    });
    directionsServices.push(ds);
    directionsRenderers.push(dr);

    // 1回目：暫定的に destination=CITY_HALL で順序を最適化し、最後の訪問候補を得る
    const waypointsAll = cluster.map(p => ({ location: p.location, stopover: true }));
    let tempResult;
    try {
      tempResult = await ds.route({
        origin: CITY_HALL,
        destination: CITY_HALL,
        waypoints: waypointsAll,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
        language: "ja",
      });
    } catch (e) {
      console.error(e); setStatus(`車${i + 1}の暫定ルート計算に失敗: ${e.message}`); continue;
    }

    const tempRoute = tempResult.routes[0];
    const orderAll = tempRoute.waypoint_order || cluster.map((_, idx) => idx);
    const lastIdx = orderAll.length > 0 ? orderAll[orderAll.length - 1] : 0;
    const destinationLast = cluster[lastIdx].location;

    // 2回目：destination=最後の訪問地、waypoints=その他で最適化
    const waypointsFinal = cluster.filter((_, idx) => idx !== lastIdx).map(p => ({ location: p.location, stopover: true }));

    let result;
    try {
      result = await ds.route({
        origin: CITY_HALL,
        destination: destinationLast,
        waypoints: waypointsFinal,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
        language: "ja",
      });
    } catch (e) {
      console.error(e); setStatus(`車${i + 1}の最終ルート計算に失敗: ${e.message}`); continue;
    }

    dr.setDirections(result);

    const route = result.routes[0];

    // マーカー描画：始点、市役所、途中の訪問地（最適順）、終点（最後の訪問地）
    addMarker(CITY_HALL, `S${i + 1}`, color);

    // 中間経由地表示（waypoint_order は最終リクエストに対しての順）
    const orderedIdxs = (route.waypoint_order || waypointsFinal.map((_, idx) => idx));
    orderedIdxs.forEach((relIdx, j) => {
      const wpLocation = waypointsFinal[relIdx].location;
      addMarker(wpLocation, `${i + 1}-${j + 1}`, color);
    });

    // 終点（最後の訪問地）
    addMarker(destinationLast, `E${i + 1}`, color);

    // 総距離・時間計算
    let totalDist = 0; let totalDur = 0;
    route.legs.forEach(leg => { if (leg.distance) totalDist += leg.distance.value; if (leg.duration) totalDur += leg.duration.value; });
    totals.push({ car: i + 1, distance: totalDist, duration: totalDur });
  }

  // 合計表示
  const toHM = (sec) => { const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); return (h ? `${h}時間` : "") + (m ? `${m}分` : ""); };
  const km = (m) => (m / 1000).toFixed(1) + " km";
  document.getElementById("totals").innerHTML = totals.map(t => `車${t.car}: ${toHM(t.duration)} / ${km(t.distance)}`).join("<br>");
  setStatus("完了");
}

function addMarker(position, label, color) {
  const marker = new google.maps.Marker({
    position,
    map,
    label: { text: label, color: "white", fontWeight: "bold" },
    icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: color, fillOpacity: 1, strokeWeight: 0, scale: 10 },
  });
  allMarkers.push(marker);
  return marker;
}

// === Places → LatLng取得（必要に応じて Geocoder フォールバック） ===
async function resolvePlaces(names) {
  const results = [];
  for (const name of names) {
    const place = await new Promise((resolve) => {
      const request = { query: name, fields: ["place_id", "name", "geometry"] };
      placesService.findPlaceFromQuery(request, (res, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && res && res.length > 0) resolve(res[0]); else resolve(null);
      });
    });
    if (place && place.geometry && place.geometry.location) { results.push({ name: place.name || name, location: place.geometry.location }); continue; }

    // Geocoder へフォールバック
    const geocoder = new google.maps.Geocoder();
    try {
      const resp = await geocoder.geocode({ address: name, region: "jp", language: "ja" });
      if (resp.results && resp.results[0]) results.push({ name, location: resp.results[0].geometry.location });
    } catch (e) { console.warn("Geocode failed for:", name, e); }
  }
  return results;
}

// === 極座標K-means（θ・r正規化） ===
function clusterByPolarKMeans(points, k) {
  if (k <= 1) return [points];
  // 特徴量：v = [cosθ, sinθ, rNorm]
  // rNorm は [0,1] に正規化（選択点の最大距離で割る）。角度成分は単位円（方向）を表す。
  const R = points.map(p => google.maps.geometry.spherical.computeDistanceBetween(CITY_HALL, p.location));
  const rMax = Math.max(...R, 1);
  const feats = points.map((p, idx) => {
    let heading = google.maps.geometry.spherical.computeHeading(CITY_HALL, p.location); if (heading < 0) heading += 360;
    const rad = heading * Math.PI / 180;
    const rNorm = Math.min(R[idx] / rMax, 1);
    return [Math.cos(rad), Math.sin(rad), rNorm];
  });

  // k-means++ 風初期化（簡易版）
  const centroids = [];
  // 1個目：最も距離が大きい点
  let firstIdx = R.indexOf(Math.max(...R));
  centroids.push([...feats[firstIdx]]);
  // 残り：最近心からの距離が最大の点を追加
  while (centroids.length < k) {
    let bestIdx = 0; let bestDist = -1;
    feats.forEach((v, i) => {
      const d = Math.min(...centroids.map(c => euclid3(v, c)));
      if (d > bestDist) { bestDist = d; bestIdx = i; }
    });
    centroids.push([...feats[bestIdx]]);
  }

  // 反復
  const maxIter = 25;
  let labels = new Array(points.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    // 割当
    let changed = false;
    for (let i = 0; i < feats.length; i++) {
      let best = 0; let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = euclid3(feats[i], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true; }
    }
    // 収束判定
    if (!changed && iter > 0) break;
    // 再計算
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = Array.from({ length: k }, () => 0);
    for (let i = 0; i < feats.length; i++) { const l = labels[i]; sums[l][0] += feats[i][0]; sums[l][1] += feats[i][1]; sums[l][2] += feats[i][2]; counts[l]++; }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue; // 空クラスタは現心のまま
      const mean = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]];
      // cos/sin は単位円へ正規化（方向ベクトルの長さを1に）
      const norm = Math.hypot(mean[0], mean[1]) || 1;
      centroids[c] = [mean[0] / norm, mean[1] / norm, mean[2]];
    }
  }

  // ラベルごとに分割
  const clusters = Array.from({ length: k }, () => []);
  points.forEach((p, i) => { clusters[labels[i]].push(p); });

  // 空クラスタがあれば最も大きいクラスタから拝借
  const sizes = clusters.map(c => c.length);
  clusters.forEach((c, ci) => {
    if (c.length === 0) {
      const mi = sizes.indexOf(Math.max(...sizes));
      if (clusters[mi].length > 1) c.push(clusters[mi].pop());
    }
  });

  return clusters;
}

function euclid3(a, b) { const dx = a[0] - b[0]; const dy = a[1] - b[1]; const dz = a[2] - b[2]; return Math.sqrt(dx*dx + dy*dy + dz*dz); }

// Maps APIのグローバル初期化コールバック
window.onload = () => {
  if (typeof google !== "undefined" && google.maps) { window.initMap(); }
  else { document.getElementById("status").textContent = "Google Maps APIの読み込みに失敗しました。APIキーや利用制限をご確認ください。"; }
};
