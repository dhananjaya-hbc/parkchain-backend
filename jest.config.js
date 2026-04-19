module.exports = {
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/scripts/**', // Scripts usually not unit tested
    '!src/config/**'   // Exclude configs safely
  ],

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // The testing environment that will be used for testing
  testEnvironment: 'node',

  // A list of paths to directories that Jest should use to search for files in
  roots: [
    '<rootDir>/tests'
  ],

  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/?(*.)+(spec|test).js'
  ]
};