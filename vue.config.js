const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: './',
  lintOnSave: false,
  productionSourceMap: false,
  // 沙箱环境不允许 spawn 子进程（thread-loader 会 EPERM），全程进程内运行
  parallel: false,
  devServer: {
    port: 8080,
    open: false,
    historyApiFallback: true,
    client: {
      overlay: { warnings: false, errors: true }
    }
  },
  css: {
    loaderOptions: {
      scss: {
        additionalData: '@import "~@/styles/variables.scss";'
      }
    }
  }
})
