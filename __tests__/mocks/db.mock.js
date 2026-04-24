// __tests__/mocks/db.mock.js
// Mocks the database so tests don't need real PostgreSQL

const mockQuery = jest.fn();

jest.mock('../../src/config/db', () => ({
  query: mockQuery,
}));

module.exports = { mockQuery };