import js from "@eslint/js";
import globals from "globals";

export default [
    // Don't check build output or installed packages.
    { ignores: ["dist/", "node_modules/"] },

    // ESLint's recommended rules for every file.
    js.configs.recommended,

    // Our browser code is written as ES modules.
    {
        files: ["js/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: { ...globals.browser },
        },
    },
];