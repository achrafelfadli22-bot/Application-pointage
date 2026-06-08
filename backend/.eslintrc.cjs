module.exports = {
  ...require('@pointage360/config/eslint'),
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname
  }
};
