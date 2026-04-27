// __tests__/controllers/BookingController.test.js

jest.mock('../../src/models/Spot');
jest.mock('../../src/models/Booking');
jest.mock('../../src/services/FraudDetectionService');


const Spot = require('../../src/models/Spot');
const Booking = require('../../src/models/Booking');
const {
    createBooking,
    getSpotAvailability,
    getBookings,
    getBookingById,
} = require('../../src/controllers/BookingController');

// ── Helpers ───────────────────────────────────────────
const mockReq = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    user: { id: 'driver-uuid', role: 'driver' },
    ...overrides,
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// ── Shared spot fixture ───────────────────────────────
const validSpot = {
    id: 'spot-uuid',
    owner_id: 'owner-uuid',
    is_approved: true,
    is_available: true,
    vehicle_types: ['Car', 'Bike'],
    prices_per_hour: [2.0, 1.5],
    slots_per_type: [10, 5],
};

describe('BookingController', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================
    // CREATE BOOKING
    // ============================================
    describe('createBooking()', () => {

        it('should create booking successfully', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Car',
                    vehicleNumber: 'ABC-1234',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(validSpot);
            Booking.countOverlappingByVehicleType.mockResolvedValue(0);
            Booking.create.mockResolvedValue({
                id: 'booking-uuid',
                booking_status: 'pending',
                payment_status: 'unpaid',
                vehicle_number: 'ABC-1234',
            });

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Booking created. Proceed to payment.',
                    booking: expect.objectContaining({ id: 'booking-uuid' }),
                    priceBreakdown: expect.objectContaining({
                        vehicleType: 'Car',
                        pricePerHour: 2.0,
                    }),
                })
            );
        });

        it('should return 400 if required fields missing', async () => {
            const req = mockReq({ body: { spotId: 'spot-uuid' } });
            const res = mockRes();

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('Required fields'),
                })
            );
        });

        it('should return 404 if spot not found', async () => {
            const req = mockReq({
                body: {
                    spotId: 'invalid-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Car',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(null);

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Spot not found.' })
            );
        });

        it('should return 400 if vehicle type not supported', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Truck',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(validSpot);

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'INVALID_VEHICLE_TYPE',
                    error: expect.stringContaining('not supported'),
                })
            );
        });

        it('should return 400 if time slot is full', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Car',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(validSpot);
            Booking.countOverlappingByVehicleType.mockResolvedValue(10);

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'TIME_SLOT_FULL',
                    error: expect.stringContaining('No Car slots available'),
                })
            );
        });

        it('should return 400 if start time is in the past', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() - 3600000).toISOString(),
                    endTime: new Date(Date.now() + 3600000).toISOString(),
                    vehicleType: 'Car',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(validSpot);

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'PAST_TIME' })
            );
        });

        it('should return 400 if end time before start time', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 7200000).toISOString(),
                    endTime: new Date(Date.now() + 3600000).toISOString(),
                    vehicleType: 'Car',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(validSpot);

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'End time must be after start time.',
                })
            );
        });

        it('should return 400 if spot is not approved', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Car',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue({ ...validSpot, is_approved: false });

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'This spot is not approved yet.' })
            );
        });

        it('should return 400 if spot is unavailable', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Car',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue({ ...validSpot, is_available: false });

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'This spot is currently unavailable.' })
            );
        });

        it('should correctly calculate 80/20 price split', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Car',
                    vehicleNumber: 'XYZ-9999',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(validSpot);
            Booking.countOverlappingByVehicleType.mockResolvedValue(0);
            Booking.create.mockResolvedValue({ id: 'booking-uuid' });

            await createBooking(req, res);

            const breakdown = res.json.mock.calls[0][0].priceBreakdown;
            expect(breakdown.pricePerHour).toBe(2.0);
            expect(breakdown.adminFeeXrp).toBeCloseTo(breakdown.totalPriceXrp * 0.20, 4);
            expect(breakdown.sellerAmountXrp).toBeCloseTo(breakdown.totalPriceXrp * 0.80, 4);
        });

        it('should calculate correct price for Bike type', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Bike',
                    vehicleNumber: 'BK-001',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(validSpot);
            Booking.countOverlappingByVehicleType.mockResolvedValue(0);
            Booking.create.mockResolvedValue({ id: 'booking-uuid' });

            await createBooking(req, res);

            const breakdown = res.json.mock.calls[0][0].priceBreakdown;
            expect(breakdown.pricePerHour).toBe(1.5);
            expect(breakdown.adminFeeXrp).toBeCloseTo(breakdown.totalPriceXrp * 0.20, 4);
            expect(breakdown.sellerAmountXrp).toBeCloseTo(breakdown.totalPriceXrp * 0.80, 4);
        });

        it('should return correct slot info in response', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Car',
                    vehicleNumber: 'ABC-123',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(validSpot);
            Booking.countOverlappingByVehicleType.mockResolvedValue(3);
            Booking.create.mockResolvedValue({ id: 'booking-uuid' });

            await createBooking(req, res);

            const slotInfo = res.json.mock.calls[0][0].slotInfo;
            expect(slotInfo.totalSlots).toBe(10);
            expect(slotInfo.bookedSlots).toBe(3);
            expect(slotInfo.remainingSlots).toBe(7);
        });
    });

    // ============================================
    // GET SPOT AVAILABILITY
    // ============================================
    describe('getSpotAvailability()', () => {

        it('should return availability per vehicle type', async () => {
            const req = mockReq({
                params: { spotId: 'spot-uuid' },
                query: {
                    startTime: '2025-06-01T10:00:00Z',
                    endTime: '2025-06-01T12:00:00Z',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue({
                id: 'spot-uuid',
                title: 'Test Parking',
                vehicle_types: ['Car', 'Bike'],
                slots_per_type: [10, 5],
                prices_per_hour: [2.0, 1.5],
            });
            Booking.getAvailabilityByTimeRange.mockResolvedValue([
                { vehicle_type: 'Car', booked_count: '3' },
            ]);

            await getSpotAvailability(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    spotId: 'spot-uuid',
                    availability: expect.arrayContaining([
                        expect.objectContaining({
                            vehicleType: 'Car',
                            totalSlots: 10,
                            bookedSlots: 3,
                            availableSlots: 7,
                            isAvailable: true,
                        }),
                        expect.objectContaining({
                            vehicleType: 'Bike',
                            totalSlots: 5,
                            bookedSlots: 0,
                            availableSlots: 5,
                            isAvailable: true,
                        }),
                    ]),
                })
            );
        });

        it('should show isAvailable false when fully booked', async () => {
            const req = mockReq({
                params: { spotId: 'spot-uuid' },
                query: {
                    startTime: '2025-06-01T10:00:00Z',
                    endTime: '2025-06-01T12:00:00Z',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue({
                id: 'spot-uuid',
                title: 'Test Parking',
                vehicle_types: ['Car'],
                slots_per_type: [5],
                prices_per_hour: [2.0],
            });
            Booking.getAvailabilityByTimeRange.mockResolvedValue([
                { vehicle_type: 'Car', booked_count: '5' },
            ]);

            await getSpotAvailability(req, res);

            const result = res.json.mock.calls[0][0];
            expect(result.availability[0].isAvailable).toBe(false);
            expect(result.availability[0].availableSlots).toBe(0);
        });

        it('should return 400 if startTime or endTime missing', async () => {
            const req = mockReq({
                params: { spotId: 'spot-uuid' },
                query: {},
            });
            const res = mockRes();

            await getSpotAvailability(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if spot not found', async () => {
            const req = mockReq({
                params: { spotId: 'invalid-uuid' },
                query: {
                    startTime: '2025-06-01T10:00:00Z',
                    endTime: '2025-06-01T12:00:00Z',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue(null);

            await getSpotAvailability(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    // ============================================
    // GET BOOKINGS (role-based)
    // ============================================
    describe('getBookings()', () => {

        it('should return driver bookings for driver role', async () => {
            const req = mockReq({ user: { id: 'driver-uuid', role: 'driver' } });
            const res = mockRes();

            Booking.findByDriver.mockResolvedValue([
                { id: 'b1', booking_status: 'pending' },
            ]);

            await getBookings(req, res);

            expect(Booking.findByDriver).toHaveBeenCalledWith('driver-uuid', undefined);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ total: 1 })
            );
        });

        it('should return seller bookings for seller role', async () => {
            const req = mockReq({ user: { id: 'seller-uuid', role: 'seller' } });
            const res = mockRes();

            Booking.findByOwner.mockResolvedValue([
                { id: 'b1' }, { id: 'b2' },
            ]);

            await getBookings(req, res);

            expect(Booking.findByOwner).toHaveBeenCalledWith('seller-uuid', undefined);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ total: 2 })
            );
        });

        it('should return all bookings for admin role', async () => {
            const req = mockReq({ user: { id: 'admin-uuid', role: 'admin' } });
            const res = mockRes();

            Booking.findAll.mockResolvedValue([
                { id: 'b1' }, { id: 'b2' }, { id: 'b3' },
            ]);

            await getBookings(req, res);

            expect(Booking.findAll).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ total: 3 })
            );
        });

        it('should filter by status when query param provided', async () => {
            const req = mockReq({
                user: { id: 'driver-uuid', role: 'driver' },
                query: { status: 'confirmed' },
            });
            const res = mockRes();

            Booking.findByDriver.mockResolvedValue([
                { id: 'b1', booking_status: 'confirmed' },
            ]);

            await getBookings(req, res);

            expect(Booking.findByDriver).toHaveBeenCalledWith('driver-uuid', 'confirmed');
        });

        it('should return 403 for invalid role', async () => {
            const req = mockReq({ user: { id: 'user-uuid', role: 'unknown' } });
            const res = mockRes();

            await getBookings(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Invalid role.' })
            );
        });
    });

    // ============================================
    // GET BOOKING BY ID
    // ============================================
    describe('getBookingById()', () => {

        it('should return booking for the owner driver', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue({
                id: 'booking-uuid',
                driver_id: 'driver-uuid',
                owner_id: 'owner-uuid',
            });

            await getBookingById(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    booking: expect.objectContaining({ id: 'booking-uuid' }),
                })
            );
        });

        it('should return 404 if booking not found', async () => {
            const req = mockReq({ params: { id: 'nonexistent-uuid' } });
            const res = mockRes();

            Booking.findById.mockResolvedValue(null);

            await getBookingById(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Booking not found.' })
            );
        });

        it('should return 403 if driver tries to access others booking', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'other-driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue({
                id: 'booking-uuid',
                driver_id: 'driver-uuid',
                owner_id: 'owner-uuid',
            });

            await getBookingById(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should allow admin to access any booking', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'admin-uuid', role: 'admin' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue({
                id: 'booking-uuid',
                driver_id: 'driver-uuid',
                owner_id: 'owner-uuid',
            });

            await getBookingById(req, res);

            expect(res.status).not.toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ booking: expect.any(Object) })
            );
        });
    });

    // ADD inside describe('BookingController')

    // ============================================
    // CANCEL BOOKING
    // ============================================
    describe('cancelBooking()', () => {
        const { cancelBooking } = require(
            '../../src/controllers/BookingController'
        );

        it('should cancel booking successfully', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue({
                id: 'booking-uuid',
                driver_id: 'driver-uuid',
                owner_id: 'owner-uuid',
            });
            Booking.cancel.mockResolvedValue({
                id: 'booking-uuid',
                booking_status: 'cancelled',
            });

            await cancelBooking(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Booking cancelled.',
                    booking: expect.objectContaining({
                        booking_status: 'cancelled',
                    }),
                })
            );
        });

        it('should return 404 if booking not found', async () => {
            const req = mockReq({
                params: { id: 'nonexistent-uuid' },
                user: { id: 'driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue(null);

            await cancelBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Booking not found.' })
            );
        });

        it('should return 400 if booking cannot be cancelled', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue({
                id: 'booking-uuid',
                driver_id: 'driver-uuid',
                owner_id: 'owner-uuid',
            });
            // cancel returns null when booking is active/completed
            Booking.cancel.mockResolvedValue(null);

            await cancelBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Cannot cancel. Booking may already be active or completed.',
                })
            );
        });

        it('should return 500 on unexpected error', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockRejectedValue(new Error('DB error'));

            await cancelBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    // ============================================
    // FRAUD CHECK
    // ============================================
    describe('fraudCheck()', () => {
        const FraudDetectionService = require(
            '../../src/services/FraudDetectionService'
        );
        const { fraudCheck } = require(
            '../../src/controllers/BookingController'
        );

        it('should run fraud check for own booking', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue({
                id: 'booking-uuid',
                driver_id: 'driver-uuid',
                spot_id: 'spot-uuid',
                start_time: '2025-06-01T10:00:00Z',
                end_time: '2025-06-01T12:00:00Z',
                total_price_xrp: '4.0',
            });
            FraudDetectionService.analyzeBooking.mockResolvedValue({
                riskLevel: 'low',
                flags: [],
            });

            await fraudCheck(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    bookingId: 'booking-uuid',
                    riskLevel: 'low',
                })
            );
        });

        it('should return 404 if booking not found', async () => {
            const req = mockReq({
                params: { id: 'nonexistent-uuid' },
                user: { id: 'driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue(null);

            await fraudCheck(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should return 403 if driver accesses others booking', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'other-driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue({
                id: 'booking-uuid',
                driver_id: 'driver-uuid', // different driver
            });

            await fraudCheck(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should allow admin to run fraud check', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'admin-uuid', role: 'admin' },
            });
            const res = mockRes();

            Booking.findById.mockResolvedValue({
                id: 'booking-uuid',
                driver_id: 'driver-uuid',
                spot_id: 'spot-uuid',
                start_time: '2025-06-01T10:00:00Z',
                end_time: '2025-06-01T12:00:00Z',
                total_price_xrp: '4.0',
            });
            FraudDetectionService.analyzeBooking.mockResolvedValue({
                riskLevel: 'medium',
                flags: ['multiple_bookings'],
            });

            await fraudCheck(req, res);

            expect(res.status).not.toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ riskLevel: 'medium' })
            );
        });

        it('should return 500 on error', async () => {
            const req = mockReq({
                params: { id: 'booking-uuid' },
                user: { id: 'driver-uuid', role: 'driver' },
            });
            const res = mockRes();

            Booking.findById.mockRejectedValue(new Error('DB error'));

            await fraudCheck(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    // ============================================
    // CREATE BOOKING - error handling
    // ============================================
    describe('createBooking() - error handling', () => {

        it('should return 500 on unexpected DB error', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: new Date(Date.now() + 3600000).toISOString(),
                    endTime: new Date(Date.now() + 7200000).toISOString(),
                    vehicleType: 'Car',
                },
            });
            const res = mockRes();

            Spot.findById.mockRejectedValue(new Error('DB connection lost'));

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Failed to create booking.' })
            );
        });

        it('should return 400 for invalid date format', async () => {
            const req = mockReq({
                body: {
                    spotId: 'spot-uuid',
                    startTime: 'not-a-date',
                    endTime: 'also-not-a-date',
                    vehicleType: 'Car',
                },
            });
            const res = mockRes();

            Spot.findById.mockResolvedValue({
                id: 'spot-uuid',
                owner_id: 'owner-uuid',
                is_approved: true,
                is_available: true,
                vehicle_types: ['Car'],
                prices_per_hour: [2.0],
                slots_per_type: [10],
            });

            await createBooking(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('Invalid date format'),
                })
            );
        });
    });


}); // ← end describe('BookingController')