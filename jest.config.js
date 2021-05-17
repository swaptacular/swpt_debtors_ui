module.exports = {
  transform: {
    '^.+\\.svelte$': [
      'svelte-jester',
      {
        preprocess: "./tests/svelte.config.js"
      }
    ],
    '^.+\\.[jt]s$': [
      'babel-jest',
      {
        configFile: "./tests/babel.config.js"
      }
    ],
  },
  moduleNameMapper: {
    // This rule removes the ".js" extension from relative paths. It
    // allows jest to correctly locate .ts files that are specified as
    // .js files in the import statement (because Typescript warns on
    // importing files with .ts extension).
    "^(\\.{1,2}/.+)\\.js$": "$1",
  },
  moduleFileExtensions: ['ts', 'js', 'svelte'],
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  setupFiles: ["<rootDir>/public/config.js"],
}
