import babel from "@rollup/plugin-babel";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const typescriptPlugin = () => typescript({
  include: ["src/**/*.ts"],
  tsconfig: false,
  compilerOptions: {
    target: "ES2019",
    module: "ESNext",
    moduleResolution: "Node",
    lib: ["DOM", "DOM.Iterable", "ES2019"],
    allowJs: false,
    checkJs: false,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    sourceMap: false
  }
});

const babelPlugin = () => babel({exclude: "node_modules/**",
  "babelHelpers": "bundled",
  "presets": [
    ["@babel/env", {
      "modules": false,
      "targets": {
        "chrome": 65,
        "safari": 13,
        "firefox": 60
      }
    }]
  ]});

export default [
  // Browser bundle for <script src="CETEI.js">, which sets window.CETEI.
  {
    input: "src/CETEI.ts",
    output: {
      file: "dist/CETEI.js",
      format: "iife",
      name: "CETEI",
      sourcemap: false,
    },
    plugins: [typescriptPlugin(), babelPlugin(), terser()]
  },
  // ES modules for `import CETEI from "CETEIcean"` and
  // `import ... from "CETEIcean/utilities.js"`.
  {
    input: {
      CETEI: "src/CETEI.ts",
      utilities: "src/utilities.ts"
    },
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: false,
    },
    plugins: [typescriptPlugin(), babelPlugin()]
  }
]
