import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default [
  // UMD ビルド
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/maplibre-gl-kmz-layer.js',
      format: 'umd',
      name: 'MaplibreGLKMZLayer',
      sourcemap: true,
      globals: {
        'maplibre-gl': 'maplibregl'
      }
    },
    external: ['maplibre-gl'],
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        outputToFilesystem: true
      }),
      production && terser()
    ]
  },
  // ESM ビルド
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/maplibre-gl-kmz-layer.esm.js',
      format: 'es',
      sourcemap: true
    },
    external: ['maplibre-gl'],
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        outputToFilesystem: false
      }),
      production && terser()
    ]
  }
];