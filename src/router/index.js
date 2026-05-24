import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(''),
  routes: [
    {
      path: '/',
      name: 'RibbonHost',
      component: () => import('../components/RibbonHost.vue')
    },
    {
      path: '/create-ref-source',
      name: '创建引用源',
      component: () => import('../components/CreateRefSourceDialog.vue')
    },
    {
      path: '/insert-ref',
      name: '插入页码引用',
      component: () => import('../components/InsertRefDialog.vue')
    },
    {
      path: '/taskpane',
      name: '引用源管理',
      component: () => import('../components/RefManager.vue')
    }
  ]
})

export default router
