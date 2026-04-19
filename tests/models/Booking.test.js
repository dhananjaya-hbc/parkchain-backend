const Booking = require('../../src/models/Booking');
const db = require('../../src/config/db');

jest.mock('../../src/config/db');

describe('Booking Model (Geofence & Timing Features)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkIn', () => {
    test('should execute UPDATE and return the active booking row', async () => {
      const mockRow = { id: 1, booking_status: 'active' };
      db.query.mockResolvedValue({ rows: [mockRow] });

      const result = await Booking.checkIn(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE bookings'),
        [1]
      );
      expect(result).toEqual(mockRow);
    });

    test('should return null if checking in fails (e.g. not confirmed)', async () => {
      db.query.mockResolvedValue({ rows: [] }); // 0 rows updated

      const result = await Booking.checkIn(99);

      expect(result).toBeNull();
    });
  });

  describe('checkOut', () => {
    test('should execute checkOut logic successfully without overtime', async () => {
      // Mock the initial SELECT query to find the active booking
      const mockActiveBooking = {
        id: 1,
        expected_duration_hours: 2,
        expected_price_xrp: 10,
        actual_start_time: new Date(Date.now() - 3600 * 1000) // Started 1hr ago 
      };

      // Mock the UPDATE query output
      const mockUpdatedBooking = {
        id: 1,
        booking_status: 'completed',
        actual_duration_hours: 1
      };

      // We simulate multiple sequential calls to db.query
      // Call 1: fetch the active booking
      db.query.mockResolvedValueOnce({ rows: [mockActiveBooking] })
      // Call 2: The UPDATE statement setting it to completed
              .mockResolvedValueOnce({ rows: [mockUpdatedBooking] });

      const result = await Booking.checkOut(1);

      expect(result).toEqual(mockUpdatedBooking);
      // We expect db.query to have been called twice (once for select, once for update)
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    test('should return null if the booking was not found or not active', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // DB returns no active records

      const result = await Booking.checkOut(99);

      expect(result).toBeNull();
    });
  });
});