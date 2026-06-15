// __tests__/mocks/xumm.mock.js

const mockXummService = {
  createSignInPayload:    jest.fn(),
  verifyPayload:          jest.fn(),
  createPaymentPayload:   jest.fn(),
  getPayloadDetails:      jest.fn(),
};

jest.mock('../../src/services/XummService', () => mockXummService);

module.exports = mockXummService;