module.exports = {
  "extends": "google",
  "parser": "typescript-eslint-parser",
  "parserOptions": {
      "ecmaVersion": 2017,
      "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "off",
    "valid-jsdoc": "off",
    "indent": [
      "error",
      2
    ],
    "max-len": 1,
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single"
    ],
    "semi": [
      "error",
      "always"
    ]
  }
};
