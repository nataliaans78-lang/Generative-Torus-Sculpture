import { defineConfig } from 'vite'

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  // GitHub Pages project site path: /<repo-name>/
  base: isGitHubActions ? '/Generative-Torus-Sculpture/' : '/',
  build: {
    outDir: 'build'
  }
})
