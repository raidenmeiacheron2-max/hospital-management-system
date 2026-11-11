import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import './styles/index.scss'
import registerMock from './mock'
import { hasMenu } from './utils/perm'

// Mock 拦截必须在业务请求发出前注册
registerMock()

Vue.use(ElementUI, { size: 'medium' })
Vue.config.productionTip = false

// B2：演示级页面入口权限控制（配合菜单/路由/API 校验）
Vue.prototype.$can = function (code) {
  return hasMenu(store.state.user.staff, code)
}
Vue.directive('perm', {
  inserted(el, binding) {
    if (binding.value && !hasMenu(store.state.user.staff, binding.value)) {
      el.parentNode && el.parentNode.removeChild(el)
    }
  }
})

// 暴露 store 供 E2E/调试断言使用（演示辅助，无安全影响）
window.__store = store

new Vue({
  router,
  store,
  render: (h) => h(App)
}).$mount('#app')
