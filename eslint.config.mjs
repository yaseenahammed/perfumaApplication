import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    files: ["**/*.js"], 
    ignores: [
      "node_modules/**",
       "dist/**", 
       "build/**",
       "*.min.js",
        "public/assets/js/*.min.js",
         "public/assets/js/lightbox.js"
      ], 
    languageOptions: {
      globals: {
        ...globals.browser, 
        ...globals.node,
         jQuery: "readonly", 
        $: "readonly"
      }
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-console": "off",

    },
  },
];
