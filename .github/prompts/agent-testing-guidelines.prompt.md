# Park Chain Backend - Agent Unit Testing Guidelines

This document serves as the master prompt and guideline for any AI agent or team member writing tests for the Park Chain Backend. The team consists of 5 members working concurrently.

## 🎯 Testing Philosophy
- **Strict Unit Testing:** All tests must run completely offline without relying on external services, real databases, or network calls.
- **100% Path Coverage:** Ensure all `if/else` conditions, `try/catch` blocks, and edge cases are explicitly tested.

## 📁 Project Structure & Setup
- **Testing Framework:** `jest`
- **Request Mocking:** `node-mocks-http`
- **Test Directory:** Root `<rootDir>/tests/` mirroring the `src/` folder completely.
    - Example: `src/controllers/AuthController.js` → `tests/controllers/AuthController.test.js`

## 🛠 Testing Rules for Agents

### 1. Controller Testing
Controllers are responsible for HTTP parsing, input validation, invoking services/models, and returning responses.
- **Rule:** Never instantiate a real Express app. Always use `node-mocks-http`.
- **Rule:** Always mock out the Model and Service layers.
- **Code Template:**
  ```javascript
  const httpMocks = require('node-mocks-http');
  const BookingController = require('../../src/controllers/BookingController');
  const Booking = require('../../src/models/Booking');
  
  jest.mock('../../src/models/Booking'); // Mock the model

  test('should return 404 if booking not found', async () => {
    const req = httpMocks.createRequest({ params: { id: 1 } });
    const res = httpMocks.createResponse();
    
    Booking.findById.mockResolvedValue(null);
    await BookingController.getBookingById(req, res);
    
    expect(res.statusCode).toBe(404);
  });
  ```

### 2. Service & Third-Party Testing
Services contain complex business logic (e.g., Google Maps API, XRPL payments).
- **Rule:** Deep mock SDKs (like `xrpl` or `xumm-sdk`) and native APIs (`fetch`).
- **Rule:** Simulate environment variable missing scenarios (`process.env.GOOGLE_MAPS_API_KEY = undefined`).
- **Rule:** Force rejections to ensure `catch (error)` cascades upstream gracefully.

### 3. Model Testing
Models interact directly with the `@neondatabase/serverless` PG client.
- **Rule:** Mock the database driver queries.
- **Code Template:**
  ```javascript
  const db = require('../../src/config/db');
  jest.mock('../../src/config/db');

  test('should insert row', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });
    // Execute Model method, verify db.query was called with correct SQL
  });
  ```

### 4. Middleware Testing
- **Rule:** Mock `req`, `res`, and `next()`. Ensure `next()` is called on success, and `res.status(401/403)` is returned on failure.
- **Rule:** Mock JWT libraries (`jsonwebtoken`) to simulate expired or invalid tokens.

### 🤖 Agent Prompts / Workflow
If an agent is prompted to "write tests for file X", it must:
1. Scan for dependencies inside file X.
2. Setup the test file inside `/tests/` reflecting the exact path.
3. Automatically `jest.mock()` local module dependencies.
4. Provide positive scenarios (200 OK) and negative scenarios (400, 404, 500 exceptions).