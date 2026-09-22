/**
 * 從 IP 地址獲取經緯度座標
 * @param {string} ipAddress - IP 地址（例如："8.8.8.8"）
 * @returns {Promise<[number, number]|null>} 返回 [經度, 緯度] 或 null
 *
 * 使用多個免費 API，按順序嘗試：
 * 1. ip-api.com (免費，每分鐘 45 次請求)
 * 2. ipapi.co (免費，每天 1000 次請求)
 * 3. ip-api.io (免費，每分鐘 10 次請求)
 */
async function getCoordinatesFromIP(ipAddress) {
  // 驗證 IP 地址格式
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ipAddress)) {
    console.error('無效的 IP 地址格式:', ipAddress);
    return null;
  }

  // 方法 1: 使用 ip-api.com (推薦，免費且穩定)
  try {
    const response1 = await fetch(
      `http://ip-api.com/json/${ipAddress}?fields=status,message,lon,lat`
    );
    const data1 = await response1.json();
    if (data1.status === 'success' && data1.lon && data1.lat) {
      console.log(`從 ip-api.com 獲取座標:`, [data1.lon, data1.lat]);
      return [data1.lon, data1.lat];
    }
  } catch (error) {
    console.warn('ip-api.com 請求失敗:', error);
  }

  // 方法 2: 使用 ipapi.co (需要 HTTPS，或使用代理)
  try {
    const response2 = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    const data2 = await response2.json();
    if (data2.longitude && data2.latitude) {
      console.log(`從 ipapi.co 獲取座標:`, [data2.longitude, data2.latitude]);
      return [data2.longitude, data2.latitude];
    }
  } catch (error) {
    console.warn('ipapi.co 請求失敗:', error);
  }

  // 方法 3: 使用 ip-api.io
  try {
    const response3 = await fetch(`https://ip-api.io/json/${ipAddress}`);
    const data3 = await response3.json();
    if (data3.longitude && data3.latitude) {
      console.log(`從 ip-api.io 獲取座標:`, [data3.longitude, data3.latitude]);
      return [data3.longitude, data3.latitude];
    }
  } catch (error) {
    console.warn('ip-api.io 請求失敗:', error);
  }

  console.error('無法從任何 API 獲取座標');
  return null;
}

/**
 * 批量從 IP 地址獲取座標
 * @param {string[]} ipAddresses - IP 地址陣列
 * @returns {Promise<Array<{ip: string, coords: [number, number]|null}>>}
 */
async function getCoordinatesFromIPs(ipAddresses) {
  const results = await Promise.all(
    ipAddresses.map(async (ip) => ({
      ip,
      coords: await getCoordinatesFromIP(ip),
    }))
  );
  return results;
}

/**
 * 從 IP 地址陣列創建 flows 資料
 * @param {Array<{srcIP: string, dstIP: string}>} ipPairs - IP 配對陣列
 * @returns {Promise<Array<{src: [number, number], dst: [number, number]}>>}
 */
async function createFlowsFromIPs(ipPairs) {
  const flows = [];
  for (const pair of ipPairs) {
    const srcCoords = await getCoordinatesFromIP(pair.srcIP);
    const dstCoords = await getCoordinatesFromIP(pair.dstIP);
    if (srcCoords && dstCoords) {
      flows.push({ src: srcCoords, dst: dstCoords });
    }
  }
  return flows;
}

export { getCoordinatesFromIP, getCoordinatesFromIPs, createFlowsFromIPs };
// 使用範例：
// 1. 單個 IP 地址
// getCoordinatesFromIP('8.8.8.8').then(coords => {
//   console.log('Google DNS 的座標:', coords);
// });

// 2. 批量獲取
// getCoordinatesFromIPs(['8.8.8.8', '1.1.1.1']).then(results => {
//   console.log('批量結果:', results);
// });

// 3. 從 IP 配對創建 flows
// createFlowsFromIPs([
//   { srcIP: '8.8.8.8', dstIP: '1.1.1.1' },
//   { srcIP: '208.67.222.222', dstIP: '8.8.8.8' }
// ]).then(flows => {
//   console.log('生成的 flows:', flows);
//   // 然後可以用這些 flows 更新地圖
// });
