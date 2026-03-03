import js from '@eslint/js'
import globals from 'globals'
import yml from 'eslint-plugin-yml'
import yamlParser from 'yaml-eslint-parser'

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['**/*.yml'],
    languageOptions: {
      parser: yamlParser,
    },
    plugins: {
      yml,
    },
    rules: {
      ...yml.configs.recommended.rules,
    },
  },
]
