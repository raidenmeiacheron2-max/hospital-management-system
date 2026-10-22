import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import './styles/index.scss'
import registerMock from './mock'

// Mock 拦截必须在业务请求发出前注册
registerMock()

Vue.use(ElementUI, { size: 'medium' })
Vue.config.productionTip = false

// 暴露 store 供 E2E/调试断言使用（演示辅助，无安全影响）
window.__store = store

new Vue({
  router,
  store,
  render: (h) => h(App)
}).$mount('#app')
