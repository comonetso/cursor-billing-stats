import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat();

export default [
    js.configs.recommended,
    ...compat.config({
        extends: ['eslint:recommended'],
        parser: '@typescript-eslint/parser',
        parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module'
        },
        plugins: ['@typescript-eslint'],
        rules: {
            '@typescript-eslint/naming-convention': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'curly': 'warn',
            'eqeqeq': 'warn',
            'no-throw-literal': 'warn',
            'semi': 'off'
        },
        ignorePatterns: ['out', '**/*.d.ts', '**/*.test.ts'],
    })
];
