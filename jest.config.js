/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        jsx: "react-jsx",
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^react-markdown$": "<rootDir>/__tests__/__mocks__/react-markdown.tsx",
    "^lucide-react$": "<rootDir>/__tests__/__mocks__/lucide-react.tsx",
  },
  testPathIgnorePatterns: ["/node_modules/", "__tests__/setup.ts", "__tests__/__mocks__/"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
};
