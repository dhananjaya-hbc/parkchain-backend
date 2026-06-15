const mockRouter = {
    get: jest.fn(),
};

jest.mock('express', () => ({
    Router: jest.fn(() => mockRouter),
}));

jest.mock('../../src/middleware/AuthMiddleware', () => jest.fn((req, res, next) => next()));
jest.mock('../../src/controllers/NavigationController', () => ({
    getRoute: jest.fn(),
}));

const express = require('express');
const authMiddleware = require('../../src/middleware/AuthMiddleware');
const NavigationController = require('../../src/controllers/NavigationController');

describe('NavigationRoutes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should register GET /route with auth middleware and controller handler', () => {
        require('../../src/routes/NavigationRoutes');

        expect(express.Router).toHaveBeenCalled();
        expect(mockRouter.get).toHaveBeenCalledWith(
            '/route',
            authMiddleware,
            NavigationController.getRoute
        );
    });
});