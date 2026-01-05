// Haversine distance and delivery fee bands for server-side
function toRad(v) {
  return (v * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get delivery fee based on distance from store coords
 * Rules:
 * <=5km => 0
 * <=8km => 40
 * <=12km => 60
 * >12km => 100
 */
function getDeliveryFee(storeLat, storeLng, lat, lng) {
  const d = haversineDistanceKm(storeLat, storeLng, lat, lng);
  const distanceKm = Math.round(d * 100) / 100;
  let fee = 100;
  if (distanceKm <= 5) fee = 0;
  else if (distanceKm <= 8) fee = 40;
  else if (distanceKm <= 12) fee = 60;
  else fee = 100;
  return { distanceKm, fee };
}

module.exports = { haversineDistanceKm, getDeliveryFee };
