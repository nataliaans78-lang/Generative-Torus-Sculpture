const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'

module.exports = {
  // GitHub Pages project site path: /<repo-name>/
  base: isGitHubActions ? '/Generative-Torus-Sculpture/' : '/',
  build: {
    outDir: 'build'
  }
}
