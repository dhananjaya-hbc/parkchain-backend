// __tests__/mocks/xrpl.mock.js

const mockXrplService = {
  getBalance:          jest.fn(),
  verifyDriverPayment: jest.fn(),
  verifyTransaction:   jest.fn(),
  paySeller:           jest.fn(),
  connect:             jest.fn(),
  disconnect:          jest.fn(),
  ensureConnected:     jest.fn(),
};

jest.mock('../../src/services/XrplService', () => mockXrplService);

module.exports = mockXrplService;