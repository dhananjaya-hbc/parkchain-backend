## Plan: Backend Unit Testing Strategy

This phased rollout introduces unit tests incrementally, starting from the most isolated, dependency-free files and moving outward.

**Steps**
1. **Tool Setup** — Install `jest` as the testing framework and `node-mocks-http` to mock request/response objects for controllers. Add `test` and `test:coverage` scripts to package.json.
2. **Phase 1: Utilities** (Independently verifiable) — Add unit tests for pure stateless utility functions.
3. **Phase 2: Middleware** (Independently verifiable) — Unit testing by passing mocked `req`, `res`, and `next()` along with mocked modules like `jsonwebtoken`.
4. **Phase 3: Models and Repositories** (*depends on 1*) — Mock the `@neondatabase/serverless` client responses to test DB interaction code paths without making real connections.
5. **Phase 4: Remote Data Services** (*depends on 1*) — Deeply mock third-party SDKs (`xrpl`, `xumm-sdk`, and `cloudinary`) to guarantee consistent test runs and behavior checks for services.
6. **Phase 5: Controllers** (*depends on 3 and 4*) — Unit test controllers using `node-mocks-http`. Services and Models will be mocked out entirely so we only test HTTP routing logic, status codes, and error returns.

**Relevant files**
- `package.json` — Target to install Jest dependencies and add `"test": "jest --coverage"`.
- `src/utils/geoUtils.js` — Our straightforward stateless entry point.
- `src/middleware/AuthMiddleware.js` — Immediate verification of JWT authorization logic.
- `src/services/XrplService.js` & `src/services/XummService.js` — Target for mocking payment gateway logic.

**Verification**
1. Verify the setup by successfully running the isolated baseline utility mock: `npm test src/utils/`.
2. Generate an HTML coverage report using `npm run test:coverage` to ensure we maintain line metrics as we iterate through each file.

**Decisions**
- The testing strategy focuses strictly on **Unit Testing** in isolation. 
- Integration testing (hitting the actual endpoints or database) will be deferred so we can satisfy the requirement of testing "every function".

**Further Considerations**
1. **Framework Confirmation:** I recommend Jest as it natively includes assertions, coverage reporting, and mocking. Does Jest sound good to you?
2. **File Structure Policy:** Do you prefer tests co-located (e.g., `src/utils/geoUtils.test.js`) or grouped in a completely separate root directory (e.g., `tests/unit/utils/geoUtils.test.js`)?