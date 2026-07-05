module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/*.spec.ts"],
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/$1",
  },
};
