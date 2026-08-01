module.exports = {
  preset: 'ts-jest',
  rootDir: '..',
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }] },
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '\\.(?:interface|type)\\.ts$'],
};
