const { calculateDistance } = require('../../src/utils/geoUtils');

describe('geoUtils', () => {
    describe('calculateDistance()', () => {
        it('should return 0 for identical coordinates', () => {
            const distance = calculateDistance(6.9271, 79.8612, 6.9271, 79.8612);
            expect(distance).toBeCloseTo(0, 5);
        });

        it('should return a positive distance for different coordinates', () => {
            const distance = calculateDistance(6.9271, 79.8612, 6.9350, 79.8500);
            expect(distance).toBeGreaterThan(0);
        });

        it('should be symmetric', () => {
            const distanceA = calculateDistance(6.9271, 79.8612, 6.9350, 79.8500);
            const distanceB = calculateDistance(6.9350, 79.8500, 6.9271, 79.8612);

            expect(distanceA).toBeCloseTo(distanceB, 8);
        });
    });
});