import js from '@eslint/js'
import globals from 'globals'
import { defineConfig } from 'eslint/config'
import eslintPluginYml from 'eslint-plugin-yml'

export default defineConfig([
  ...eslintPluginYml.configs['flat/recommended'],
  {
    extends: ['js/recommended'],
    plugins: {
      js,
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
  },
  {
    extends: eslintPluginYml.configs['flat/recommended'],
    files: ['*.yml'],
    languageOptions: {
      parserOptions: {
        parser: 'yaml-eslint-parser',
        defaultYAMLVersion: '1.2',
      },
    },
  },
])
