const httpMocks = require('node-mocks-http');
const BookingController = require('../../src/controllers/BookingController');
const Booking = require('../../src/models/Booking');
const { calculateDistance } = require('../../src/utils/geoUtils');

jest.mock('../../src/models/Booking');
jest.mock('../../src/utils/geoUtils');

describe('BookingController (Your Responsibilities)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkIn', () => {
    test('should successfully check in when user is within geofence', async () => {
      const req = httpMocks.createRequest({
        method: 'PUT',
        url: '/api/bookings/1/checkin',
        params: { id: 1 },
        user: { id: 100 }, // Setup authenticated user
        body: { driverLocation: { lat: 40.7128, lng: -74.0060 } }
      });
      const res = httpMocks.createResponse();

      // Mock Booking.findById to return a valid confirmed booking owned by the user
      Booking.findById.mockResolvedValue({
        id: 1,
        driver_id: 100,
        booking_status: 'confirmed',
        spot_latitude: 40.7129,
        spot_longitude: -74.0061
      });

      // Mock geoUtils.calculateDistance to return 10 meters (within the 15m radius)
      calculateDistance.mockReturnValue(10);

      // Mock the successful db update
      Booking.checkIn.mockResolvedValue({ id: 1, status: 'active' });

      await BookingController.checkIn(req, res);

      expect(res.statusCode).toBe(200);
      expect(calculateDistance).toHaveBeenCalled();
      expect(Booking.checkIn).toHaveBeenCalledWith(1);
      expect(res._getJSONData().message).toBe('Checked in successfully. Parking timer started!');
    });

    test('should reject check in (400) if outside the geofence perimeter', async () => {
      const req = httpMocks.createRequest({
          method: 'PUT',
          url: '/api/bookings/1/checkin',
          params: { id: 1 },
          user: { id: 100 },
          body: { driverLocation: { lat: 40.8000, lng: -74.1000 } }
      });
      const res = httpMocks.createResponse();

      Booking.findById.mockResolvedValue({
        id: 1,
        driver_id: 100,
        booking_status: 'confirmed',
        spot_latitude: 40.7129,
        spot_longitude: -74.0061
      });

      // User is 1500 meters away
      calculateDistance.mockReturnValue(1500);

      await BookingController.checkIn(req, res);

      expect(res.statusCode).toBe(400); 
      expect(res._getJSONData().error).toBe('Too far from the spot. Please get closer to check-in.');
    });

    test('should reject check in (403) if the booking does not belong to the user', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            params: { id: 1 },
            user: { id: 999 }, // Different user
            body: { driverLocation: { lat: 40.8000, lng: -74.1000 } }
        });
        const res = httpMocks.createResponse();
  
        Booking.findById.mockResolvedValue({
          id: 1,
          driver_id: 100, // Owned by 100
          booking_status: 'confirmed',
        });
  
        await BookingController.checkIn(req, res);
  
        expect(res.statusCode).toBe(403); 
      });
  });

  describe('checkOut', () => {
    test('should successfully check out an active booking', async () => {
      const req = httpMocks.createRequest({
        method: 'PUT',
        url: '/api/bookings/1/checkout',
        params: { id: 1 },
        user: { id: 100 }
      });
      const res = httpMocks.createResponse();

      Booking.findById.mockResolvedValue({
        id: 1,
        driver_id: 100,
        booking_status: 'active',
      });

      Booking.checkOut.mockResolvedValue({
        id: 1,
        overtime_hours: 0,
        expected_duration_hours: 2,
        actual_duration_hours: 2,
        expected_price_xrp: 10,
        overtime_price_xrp: 0,
        total_price_xrp: 10,
        admin_fee_xrp: 1,
        seller_amount_xrp: 9
      });

      await BookingController.checkOut(req, res);

      expect(res.statusCode).toBe(200);
      expect(Booking.checkOut).toHaveBeenCalledWith(1);
      expect(res._getJSONData().message).toBe('Checked out on time!');
    });

    test('should report overtime when checking out late', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            params: { id: 1 },
            user: { id: 100 }
        });
        const res = httpMocks.createResponse();
  
        Booking.findById.mockResolvedValue({
          id: 1,
          driver_id: 100,
          booking_status: 'active',
        });
  
        Booking.checkOut.mockResolvedValue({
          id: 1,
          overtime_hours: 1.5,
          expected_duration_hours: 2,
          actual_duration_hours: 3.5,
          // other fields omitted for brevity...
        });
  
        await BookingController.checkOut(req, res);
  
        expect(res.statusCode).toBe(200);
        expect(res._getJSONData().message).toMatch('Checked out. You stayed 1.5 hours extra.');
      });
  });
});
