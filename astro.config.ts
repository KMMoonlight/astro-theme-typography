import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import swup from '@swup/astro'
import robotsTxt from 'astro-robots-txt'
import { defineConfig } from 'astro/config'
import rehypeKatex from 'rehype-katex'
import rehypeMermaid from 'rehype-mermaid'
import remarkMath from 'remark-math'
import UnoCSS from 'unocss/astro'
import devtoolsJson from 'vite-plugin-devtools-json'
import { themeConfig } from './src/.config'

// https://astro.build/config
export default defineConfig({
  site: themeConfig.site.website,
  prefetch: true,
  base: '/',
  vite: {
    plugins: [
      // eslint-disable-next-line ts/ban-ts-comment
      // @ts-ignore
      devtoolsJson(),
    ],
  },
  markdown: {
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['math', 'mermaid'],
    },
    remarkPlugins: [
      remarkMath,
    ],
    rehypePlugins: [
      rehypeKatex,
      [rehypeMermaid, { strategy: 'pre-mermaid' }],
    ],
    shikiConfig: {
      theme: 'dracula',
      wrap: true,
    },
  },
  integrations: [
    UnoCSS({ injectReset: true }),
    mdx({}),
    robotsTxt(),
    sitemap(),
    swup({
      theme: false,
      animationClass: 'transition-swup-',
      cache: true,
      preload: true,
      accessibility: true,
      smoothScrolling: true,
      updateHead: true,
      updateBodyClass: true,
    }),
  ],
})
