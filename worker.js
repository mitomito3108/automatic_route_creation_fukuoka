self.onmessage = e => {
  const { pois, carCount } = e.data;

  // K-means簡易版（緯度経度）
  const groups = Array.from({ length: carCount }, () => []);

  pois.forEach((p, i) => {
    groups[i % carCount].push(p);
  });

  self.postMessage(groups);
};
