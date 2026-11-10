module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: { '\\.(css)$': '<rootDir>/src/styleMock.cjs' },
};
