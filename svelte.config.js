import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { mdsvex } from 'mdsvex';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.md'],

  kit: {
    adapter: adapter({
      pages: 'dist',
      assets: 'dist',
      fallback: 'index.html',
      precompress: false,
      strict: true,
    }),
  },
  compilerOptions: {
    runes: true
  },

  preprocess: [
    vitePreprocess({ typescript: true }),
    mdsvex({ extensions: ['.md'] }),
  ],
};

export default config;
