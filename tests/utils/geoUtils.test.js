const { calculateDistance } = require('../../src/utils/geoUtils');

describe('GeoUtils - calculateDistance', () => {
  test('should return 0 when the coordinates are exactly the same', () => {
    const lat = 6.9271; // Colombo, Sri Lanka
    const lon = 79.8612;
    const distance = calculateDistance(lat, lon, lat, lon);
    expect(distance).toBe(0);
  });

  test('should calculate the distance between two points on the equator correctly', () => {
    // 1 degree of longitude at the equator is approximately 111.32 km (111320 meters)
    const lat1 = 0;
    const lon1 = 0;
    const lat2 = 0;
    const lon2 = 1;
    
    const distance = calculateDistance(lat1, lon1, lat2, lon2);
    
    // We use toBeCloseTo due to floating point math precision and Earth radius approximation
    expect(distance).toBeCloseTo(111194.9, -1); // Within 10 meters 
  });

  test('should accurately calculate distance between two distinct real-world locations', () => {
    // Coordinates roughly for New York (Lat: 51.5074, Lon: -0.1278) and Paris (Lat: 48.8566, Lon: 2.3522)
    const londonLat = 51.5074;
    const londonLon = -0.1278;
    const parisLat = 48.8566;
    const parisLon = 2.3522;

    const distance = calculateDistance(londonLat, londonLon, parisLat, parisLon);

    // Distance between London and Paris is approximately 343 km (343,000 meters)
    expect(distance).toBeGreaterThan(340000);
    expect(distance).toBeLessThan(345000);
  });

  test('should handle negative coordinates properly (Southern/Western hemispheres)', () => {
    // Coordinates for Sydney, Australia and Auckland, New Zealand
    const sydLat = -33.8688;
    const sydLon = 151.2093;
    const aklLat = -36.8485;
    const aklLon = 174.7633;

    const distance = calculateDistance(sydLat, sydLon, aklLat, aklLon);

    // Distance between Sydney and Auckland is roughly 2155 km
    expect(distance).toBeGreaterThan(2150000);
    expect(distance).toBeLessThan(2165000);
  });
});
