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

function getDeliveryFee(storeLat, storeLng, lat, lng) {
  const d = haversineDistanceKm(storeLat, storeLng, lat, lng);
  const distanceKm = Math.round(d * 100) / 100;
  let fee = 140;
  if (distanceKm <= 3) fee = 0;
  else if (distanceKm <= 5) fee = 50;
  else if (distanceKm <= 8) fee = 80;
  else if (distanceKm <= 10) fee = 110;
  else if(distanceKm <= 12) fee = 140;
  else fee = 140;
  return { distanceKm, fee };
}

module.exports = { haversineDistanceKm, getDeliveryFee };