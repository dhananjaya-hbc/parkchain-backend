// src/controllers/ReviewController.js
// ============================================
// REVIEW CONTROLLER
// ============================================

const Review = require('../models/Review');
const Booking = require('../models/Booking');

const ReviewController = {
  // ============================================
  // POST /api/reviews - Create a review
  // ============================================
  async createReview(req, res) {
    try {
      console.log('[ReviewController] createReview called with body:', req.body);
      const { bookingId, rating, comment } = req.body;
      const driverId = req.user.id;

      // Validate required fields
      if (!bookingId || !rating) {
        return res.status(400).json({
          message: 'bookingId and rating are required',
        });
      }

      // Validate rating is between 1 and 5
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          message: 'Rating must be between 1 and 5',
        });
      }

      // Check if booking exists and belongs to the driver
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      if (booking.driver_id !== driverId) {
        return res.status(403).json({
          message: 'You can only review your own bookings',
        });
      }

      // Check if review already exists for this booking
      const existingReview = await Review.findByBooking(bookingId);
      if (existingReview) {
        return res.status(400).json({
          message: 'A review already exists for this booking',
        });
      }

      // Create the review
      const review = await Review.create({
        bookingId,
        driverId,
        spotId: booking.spot_id,
        rating,
        comment: comment || null,
      });

      return res.status(201).json({
        message: 'Review created successfully',
        review,
      });
    } catch (err) {
      console.error('[ReviewController] createReview error:', err.message);
      return res.status(500).json({ message: 'Failed to create review' });
    }
  },

  // ============================================
  // GET /api/reviews - Get all reviews (ADMIN ONLY)
  // ============================================
  async getAllReviews(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;

      const reviews = await Review.findAll({ limit, offset });
      const total = await Review.countAll();

      return res.status(200).json({
        message: 'Reviews retrieved successfully',
        data: reviews,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (err) {
      console.error('[ReviewController] getAllReviews error:', err.message);
      return res.status(500).json({ message: 'Failed to fetch reviews' });
    }
  },

  // ============================================
  // GET /api/reviews/spot/:spotId - Get reviews for a specific spot
  // ============================================

  async getReviewByBooking(req, res) {
    try {
      const { bookingId } = req.params;

      const review = await Review.findByBooking(bookingId);
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      return res.status(200).json({
        message: 'Review retrieved successfully',
        data: review,
      });
    } catch (err) {
      console.error('[ReviewController] getReviewByBooking error:', err.message);
      return res.status(500).json({ message: 'Failed to fetch review' });
    }
  },

  async getReviewsBySpot(req, res) {
    try {
      const { spotId } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;

      const reviews = await Review.findBySpot(spotId, { limit, offset });
      const total = await Review.countBySpot(spotId);
      const averageRating = await Review.getAverageRatingBySpot(spotId);

      return res.status(200).json({
        message: 'Spot reviews retrieved successfully',
        data: reviews,
        stats: {
          averageRating: averageRating.toFixed(2),
          totalReviews: total,
        },
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (err) {
      console.error('[ReviewController] getReviewsBySpot error:', err.message);
      return res.status(500).json({ message: 'Failed to fetch spot reviews' });
    }
  },

  // ============================================
  // GET /api/reviews/seller/me - Get reviews for seller's spots
  // ============================================
  async getSellerReviews(req, res) {
    try {
      const sellerId = (req.user.role === 'admin' && req.query.sellerId) ? req.query.sellerId : req.user.id;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;

      const reviews = await Review.findByOwner(sellerId, { limit, offset });
      const total = await Review.countByOwner(sellerId);

      return res.status(200).json({
        message: 'Your reviews retrieved successfully',
        data: reviews,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (err) {
      console.error('[ReviewController] getSellerReviews error:', err.message);
      return res.status(500).json({ message: 'Failed to fetch your reviews' });
    }
  },

  // ============================================
  // GET /api/reviews/driver/me - Get reviews given by the driver
  // ============================================
  async getDriverReviews(req, res) {
    try {
      const driverId = req.user.id;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;

      const reviews = await Review.findByDriver(driverId, { limit, offset });
      const total = await Review.countByDriver(driverId);

      return res.status(200).json({
        message: 'Your reviews retrieved successfully',
        data: reviews,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (err) {
      console.error('[ReviewController] getDriverReviews error:', err.message);
      return res.status(500).json({ message: 'Failed to fetch your reviews' });
    }
  },

  // ============================================
  // GET /api/reviews/:id - Get a single review
  // ============================================
  async getReviewById(req, res) {
    try {
      const { id } = req.params;

      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      return res.status(200).json({
        message: 'Review retrieved successfully',
        review,
      });
    } catch (err) {
      console.error('[ReviewController] getReviewById error:', err.message);
      return res.status(500).json({ message: 'Failed to fetch review' });
    }
  },

  // ============================================
  // PUT /api/reviews/:id - Update a review
  // ============================================
  async updateReview(req, res) {
    try {
      const { id } = req.params;
      const { rating, comment } = req.body;
      const driverId = req.user.id;

      // Validate rating if provided
      if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({
          message: 'Rating must be between 1 and 5',
        });
      }

      // Check if review exists
      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      // Check if the driver owns the review
      if (review.driver_id !== driverId) {
        return res.status(403).json({
          message: 'You can only update your own reviews',
        });
      }

      // Update the review
      const updatedReview = await Review.update(id, { rating, comment });

      return res.status(200).json({
        message: 'Review updated successfully',
        review: updatedReview,
      });
    } catch (err) {
      console.error('[ReviewController] updateReview error:', err.message);
      return res.status(500).json({ message: 'Failed to update review' });
    }
  },

  // ============================================
  // DELETE /api/reviews/:id - Delete a review
  // ============================================
  async deleteReview(req, res) {
    try {
      const { id } = req.params;
      const driverId = req.user.id;

      // Check if review exists
      const review = await Review.findById(id);
      if (!review) {
        return res.status(404).json({ message: 'Review not found' });
      }

      // Check if the driver owns the review
      if (review.driver_id !== driverId) {
        return res.status(403).json({
          message: 'You can only delete your own reviews',
        });
      }

      // Delete the review
      await Review.delete(id);

      return res.status(200).json({
        message: 'Review deleted successfully',
      });
    } catch (err) {
      console.error('[ReviewController] deleteReview error:', err.message);
      return res.status(500).json({ message: 'Failed to delete review' });
    }
  },
};

module.exports = ReviewController;
