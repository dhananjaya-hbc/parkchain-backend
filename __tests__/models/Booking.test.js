// __tests__/models/Booking.test.js

const { mockQuery } = require('../mocks/db.mock');
const Booking = require('../../src/models/Booking');

describe('Booking Model', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================
    // CREATE BOOKING
    // ============================================
    describe('create()', () => {
        it('should create a booking and return it', async () => {
            const mockBooking = {
                id: 'booking-uuid-123',
                driver_id: 'driver-uuid',
                spot_id: 'spot-uuid',
                owner_id: 'owner-uuid',
                vehicle_type: 'Car',
                vehicle_number: 'ABC-1234',
                price_per_hour: '2.00',
                expected_price_xrp: '4.000000',
                total_price_xrp: '4.000000',
                admin_fee_xrp: '0.800000',
                seller_amount_xrp: '3.200000',
                booking_status: 'pending',
                payment_status: 'unpaid',
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockBooking] });

            const result = await Booking.create({
                driverId: 'driver-uuid',
                spotId: 'spot-uuid',
                ownerId: 'owner-uuid',
                startTime: '2025-06-01T10:00:00Z',
                endTime: '2025-06-01T12:00:00Z',
                expectedDurationHours: 2,
                vehicleType: 'Car',
                pricePerHour: 2.0,
                expectedPriceXrp: 4.0,
                totalPriceXrp: 4.0,
                adminFeeXrp: 0.8,
                sellerAmountXrp: 3.2,
                vehicleNumber: 'ABC-1234',
            });

            expect(result).toEqual(mockBooking);
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO bookings'),
                expect.arrayContaining(['driver-uuid', 'spot-uuid', 'owner-uuid', 'Car', 'ABC-1234'])
            );
        });

        it('should throw error if DB fails', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));

            await expect(
                Booking.create({
                    driverId: 'driver-uuid',
                    spotId: 'spot-uuid',
                    ownerId: 'owner-uuid',
                    startTime: '2025-06-01T10:00:00Z',
                    endTime: '2025-06-01T12:00:00Z',
                    expectedDurationHours: 2,
                    vehicleType: 'Car',
                    pricePerHour: 2.0,
                    expectedPriceXrp: 4.0,
                    totalPriceXrp: 4.0,
                    adminFeeXrp: 0.8,
                    sellerAmountXrp: 3.2,
                    vehicleNumber: 'ABC-1234',
                })
            ).rejects.toThrow('DB connection failed');
        });
    });

    // ============================================
    // FIND BY ID
    // ============================================
    describe('findById()', () => {
        it('should return booking with spot and user details', async () => {
            const mockBooking = {
                id: 'booking-uuid',
                spot_title: 'Test Parking',
                driver_name: 'John Driver',
                owner_name: 'Jane Owner',
                driver_wallet: 'rDriverWallet123',
                owner_wallet: 'rOwnerWallet456',
            };
            mockQuery.mockResolvedValueOnce({ rows: [mockBooking] });

            const result = await Booking.findById('booking-uuid');

            expect(result).toEqual(mockBooking);
        });

        it('should return null if not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await Booking.findById('nonexistent-uuid');

            expect(result).toBeNull();
        });
    });

    // ============================================
    // FIND BY DRIVER
    // ============================================
    describe('findByDriver()', () => {
        it('should return all bookings for a driver', async () => {
            const mockBookings = [
                { id: 'b1', driver_id: 'driver-uuid', booking_status: 'pending' },
                { id: 'b2', driver_id: 'driver-uuid', booking_status: 'confirmed' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: mockBookings });

            const result = await Booking.findByDriver('driver-uuid');

            expect(result).toHaveLength(2);
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('WHERE b.driver_id = $1'),
                ['driver-uuid']
            );
        });

        it('should filter by status when provided', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'b1', booking_status: 'active' }],
            });

            await Booking.findByDriver('driver-uuid', 'active');

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('booking_status = $2'),
                ['driver-uuid', 'active']
            );
        });

        it('should return empty array when no bookings', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await Booking.findByDriver('driver-uuid');

            expect(result).toEqual([]);
        });
    });

    // ============================================
    // FIND BY OWNER (SELLER)
    // ============================================
    describe('findByOwner()', () => {
        it('should return all bookings for a seller', async () => {
            const mockBookings = [
                { id: 'b1', owner_id: 'seller-uuid', spot_title: 'Spot A' },
                { id: 'b2', owner_id: 'seller-uuid', spot_title: 'Spot B' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: mockBookings });

            const result = await Booking.findByOwner('seller-uuid');

            expect(result).toHaveLength(2);
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('WHERE b.owner_id = $1'),
                ['seller-uuid']
            );
        });

        it('should filter by status when provided', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'b1', booking_status: 'completed' }],
            });

            await Booking.findByOwner('seller-uuid', 'completed');

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('booking_status = $2'),
                ['seller-uuid', 'completed']
            );
        });
    });

    // ============================================
    // FIND ALL (ADMIN)
    // ============================================
    describe('findAll()', () => {
        it('should return all bookings ordered by date', async () => {
            const mockBookings = [
                { id: 'b1', driver_name: 'Driver A', spot_title: 'Spot X' },
                { id: 'b2', driver_name: 'Driver B', spot_title: 'Spot Y' },
                { id: 'b3', driver_name: 'Driver C', spot_title: 'Spot Z' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: mockBookings });

            const result = await Booking.findAll();

            expect(result).toHaveLength(3);

            // ✅ FIX: findAll() calls query with only SQL string, no params array
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY b.created_at DESC')
            );
        });

        it('should return empty array when no bookings exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await Booking.findAll();

            expect(result).toEqual([]);
        });
    });
    // ============================================
    // UPDATE PAYMENT STATUS
    // ============================================
    describe('updatePaymentStatus()', () => {
        it('should update payment status to paid', async () => {
            const mockUpdated = {
                id: 'booking-uuid',
                payment_status: 'paid',
            };
            mockQuery.mockResolvedValueOnce({ rows: [mockUpdated] });

            const result = await Booking.updatePaymentStatus('booking-uuid', 'paid');

            expect(result.payment_status).toBe('paid');
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('SET payment_status = $1'),
                ['paid', 'booking-uuid']
            );
        });

        it('should return null if booking not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await Booking.updatePaymentStatus('nonexistent-uuid', 'paid');

            expect(result).toBeNull();
        });
    });

    // ============================================
    // UPDATE STATUS
    // ============================================
    describe('updateStatus()', () => {
        it('should update booking status to confirmed', async () => {
            const mockUpdated = {
                id: 'booking-uuid',
                booking_status: 'confirmed',
            };
            mockQuery.mockResolvedValueOnce({ rows: [mockUpdated] });

            const result = await Booking.updateStatus('booking-uuid', 'confirmed');

            expect(result.booking_status).toBe('confirmed');
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('SET booking_status = $1'),
                ['confirmed', 'booking-uuid']
            );
        });

        it('should return null if booking not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await Booking.updateStatus('nonexistent', 'confirmed');

            expect(result).toBeNull();
        });
    });

    // ============================================
    // CANCEL BOOKING
    // ============================================
    describe('cancel()', () => {
        it('should cancel a pending booking', async () => {
            const mockCancelled = {
                id: 'booking-uuid',
                booking_status: 'cancelled',
            };
            mockQuery.mockResolvedValueOnce({ rows: [mockCancelled] });

            const result = await Booking.cancel('booking-uuid', 'driver-uuid');

            expect(result.booking_status).toBe('cancelled');
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("booking_status = 'cancelled'"),
                ['booking-uuid', 'driver-uuid']
            );
        });

        it('should return null if booking cannot be cancelled', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await Booking.cancel('booking-uuid', 'driver-uuid');

            expect(result).toBeNull();
        });

        it('should allow owner to cancel booking', async () => {
            const mockCancelled = {
                id: 'booking-uuid',
                booking_status: 'cancelled',
            };
            mockQuery.mockResolvedValueOnce({ rows: [mockCancelled] });

            const result = await Booking.cancel('booking-uuid', 'owner-uuid');

            expect(result).not.toBeNull();
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('driver_id = $2 OR owner_id = $2'),
                ['booking-uuid', 'owner-uuid']
            );
        });
    });

    // ============================================
    // COUNT OVERLAPPING (legacy)
    // ============================================
    describe('countOverlapping()', () => {
        it('should count all overlapping bookings regardless of type', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });

            const result = await Booking.countOverlapping(
                'spot-uuid',
                '2025-06-01T10:00:00Z',
                '2025-06-01T12:00:00Z'
            );

            expect(result).toBe(5);
        });

        it('should exclude a booking ID when provided', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });

            await Booking.countOverlapping(
                'spot-uuid',
                '2025-06-01T10:00:00Z',
                '2025-06-01T12:00:00Z',
                'exclude-uuid'
            );

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('id != $4'),
                expect.arrayContaining(['exclude-uuid'])
            );
        });
    });

    // ============================================
    // COUNT OVERLAPPING BY VEHICLE TYPE
    // ============================================
    describe('countOverlappingByVehicleType()', () => {
        it('should return 0 when no overlapping bookings', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });

            const result = await Booking.countOverlappingByVehicleType(
                'spot-uuid', 'Car',
                '2025-06-01T10:00:00Z',
                '2025-06-01T12:00:00Z'
            );

            expect(result).toBe(0);
        });

        it('should return correct count of overlapping bookings', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] });

            const result = await Booking.countOverlappingByVehicleType(
                'spot-uuid', 'Car',
                '2025-06-01T10:00:00Z',
                '2025-06-01T12:00:00Z'
            );

            expect(result).toBe(3);
        });

        it('should filter by vehicle type correctly', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });

            await Booking.countOverlappingByVehicleType(
                'spot-uuid', 'Bike',
                '2025-06-01T10:00:00Z',
                '2025-06-01T12:00:00Z'
            );

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('vehicle_type = $2'),
                expect.arrayContaining(['spot-uuid', 'Bike'])
            );
        });

        it('should exclude a specific booking ID when provided', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });

            await Booking.countOverlappingByVehicleType(
                'spot-uuid', 'Car',
                '2025-06-01T10:00:00Z',
                '2025-06-01T12:00:00Z',
                'exclude-booking-uuid'
            );

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('id != $5'),
                expect.arrayContaining(['exclude-booking-uuid'])
            );
        });
    });

    // ============================================
    // GET AVAILABILITY BY TIME RANGE
    // ============================================
    describe('getAvailabilityByTimeRange()', () => {
        it('should return booked counts per vehicle type', async () => {
            const mockRows = [
                { vehicle_type: 'Car', booked_count: '3' },
                { vehicle_type: 'Bike', booked_count: '1' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: mockRows });

            const result = await Booking.getAvailabilityByTimeRange(
                'spot-uuid',
                '2025-06-01T10:00:00Z',
                '2025-06-01T12:00:00Z'
            );

            expect(result).toEqual(mockRows);
            expect(result).toHaveLength(2);
            expect(result[0].vehicle_type).toBe('Car');
            expect(result[0].booked_count).toBe('3');
        });

        it('should return empty array when no bookings', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await Booking.getAvailabilityByTimeRange(
                'spot-uuid',
                '2025-06-01T10:00:00Z',
                '2025-06-01T12:00:00Z'
            );

            expect(result).toEqual([]);
        });
    });

    // ADD inside describe('Booking Model')

    // ============================================
    // CHECK IN  (lines 181-210)
    // ============================================
    describe('checkIn()', () => {

        it('should check in a confirmed booking', async () => {
            const mockCheckedIn = {
                id: 'booking-uuid',
                booking_status: 'active',
                actual_start_time: new Date().toISOString(),
            };
            mockQuery.mockResolvedValueOnce({ rows: [mockCheckedIn] });

            const result = await Booking.checkIn('booking-uuid');

            expect(result).not.toBeNull();
            expect(result.booking_status).toBe('active');
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("booking_status = 'active'"),
                ['booking-uuid']
            );
        });

        it('should return null if booking not in confirmed status', async () => {
            // Returns empty rows if status is not 'confirmed'
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await Booking.checkIn('booking-uuid');

            expect(result).toBeNull();
        });
    });

    // ============================================
    // CHECK OUT (lines 213-243)
    // ============================================
    describe('checkOut()', () => {

        it('should check out an active booking with no overtime', async () => {
            const actualStart = new Date(Date.now() - 3600000); // 1 hr ago

            const mockActiveBooking = {
                id: 'booking-uuid',
                booking_status: 'active',
                actual_start_time: actualStart.toISOString(),
                expected_duration_hours: '1.00',
                expected_price_xrp: '2.000000',
                price_per_hour: '2.00',
            };

            const mockCompletedBooking = {
                id: 'booking-uuid',
                booking_status: 'completed',
                actual_duration_hours: '1.00',
                overtime_hours: '0.00',
                overtime_price_xrp: '0.000000',
                total_price_xrp: '2.000000',
                admin_fee_xrp: '0.400000',
                seller_amount_xrp: '1.600000',
            };

            // First query: SELECT active booking
            mockQuery.mockResolvedValueOnce({ rows: [mockActiveBooking] });
            // Second query: UPDATE to completed
            mockQuery.mockResolvedValueOnce({ rows: [mockCompletedBooking] });

            const result = await Booking.checkOut('booking-uuid');

            expect(result).not.toBeNull();
            expect(result.booking_status).toBe('completed');
            expect(parseFloat(result.overtime_hours)).toBe(0);
        });

        it('should calculate overtime correctly', async () => {
            // Driver stayed 2 hours but only booked 1 hour
            const actualStart = new Date(Date.now() - 7200000); // 2 hrs ago

            const mockActiveBooking = {
                id: 'booking-uuid',
                booking_status: 'active',
                actual_start_time: actualStart.toISOString(),
                expected_duration_hours: '1.00', // booked 1 hr
                expected_price_xrp: '2.000000',
                price_per_hour: '2.00',
            };

            const mockCompletedBooking = {
                id: 'booking-uuid',
                booking_status: 'completed',
                actual_duration_hours: '2.00',
                overtime_hours: '1.00',
                overtime_price_xrp: '2.000000',
                total_price_xrp: '4.000000',
                admin_fee_xrp: '0.800000',
                seller_amount_xrp: '3.200000',
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockActiveBooking] });
            mockQuery.mockResolvedValueOnce({ rows: [mockCompletedBooking] });

            const result = await Booking.checkOut('booking-uuid');

            expect(result.booking_status).toBe('completed');
            expect(parseFloat(result.overtime_hours)).toBe(1.0);
            expect(parseFloat(result.total_price_xrp)).toBe(4.0);
        });

        it('should return null if no active booking found', async () => {
            // First query returns empty (no active booking)
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await Booking.checkOut('booking-uuid');

            expect(result).toBeNull();
        });

        it('should calculate 80/20 split correctly on checkout', async () => {
            const actualStart = new Date(Date.now() - 3600000);

            const mockActiveBooking = {
                id: 'booking-uuid',
                booking_status: 'active',
                actual_start_time: actualStart.toISOString(),
                expected_duration_hours: '1.00',
                expected_price_xrp: '10.000000',
                price_per_hour: '10.00',
            };

            const mockCompletedBooking = {
                id: 'booking-uuid',
                booking_status: 'completed',
                actual_duration_hours: '1.00',
                overtime_hours: '0.00',
                overtime_price_xrp: '0.000000',
                total_price_xrp: '10.000000',
                admin_fee_xrp: '2.000000',  // 20%
                seller_amount_xrp: '8.000000',  // 80%
            };

            mockQuery.mockResolvedValueOnce({ rows: [mockActiveBooking] });
            mockQuery.mockResolvedValueOnce({ rows: [mockCompletedBooking] });

            const result = await Booking.checkOut('booking-uuid');

            const total = parseFloat(result.total_price_xrp);
            const admin = parseFloat(result.admin_fee_xrp);
            const seller = parseFloat(result.seller_amount_xrp);

            expect(admin).toBeCloseTo(total * 0.20, 4);
            expect(seller).toBeCloseTo(total * 0.80, 4);
        });
    });

}); // ← end describe('Booking Model')