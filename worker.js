self.onmessage = e => {
  const { pois, carCount } = e.data;

  if (carCount <= 1) {
    self.postMessage([pois]);
    return;
  }

  // ------------------------------
  // 距離計算（ユークリッド距離）
  // ※狭い範囲なのでこれで十分
  // ------------------------------
  const dist = (a, b) => {
    const dx = a.lat - b.lat;
    const dy = a.lng - b.lng;
    return dx * dx + dy * dy;
  };

  // ------------------------------
  // 初期クラスタ中心をランダム選択
  // ------------------------------
  let centers = pois
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, carCount)
    .map(p => ({ lat: p.lat, lng: p.lng }));

  let groups = [];

  // ------------------------------
  // K-means 繰り返し
  // ------------------------------
  for (let iter = 0; iter < 10; iter++) {
    groups = Array.from({ length: carCount }, () => []);

    // ① 各POIを最も近い中心へ割り当て
    pois.forEach(p => {
      let min = Infinity;
      let idx = 0;

      centers.forEach((c, i) => {
        const d = dist(p, c);
        if (d < min) {
          min = d;
          idx = i;
        }
      });

      groups[idx].push(p);
    });

    // ② 各クラスタの重心を再計算
    centers = groups.map(g => {
      if (!g.length) return centers[Math.floor(Math.random() * centers.length)];

      const sum = g.reduce(
        (acc, p) => {
          acc.lat += p.lat;
          acc.lng += p.lng;
          return acc;
        },
        { lat: 0, lng: 0 }
      );

      return {
        lat: sum.lat / g.length,
        lng: sum.lng / g.length
      };
    });
  }

  // 結果返却
  self.postMessage(groups);
};
