import { createRouter, createWebHistory } from 'vue-router'
import AppManagementPage from '@/pages/AppManagementPage.vue'
import DashboardPage from '@/pages/DashboardPage.vue'
import QATrackingPage from '@/pages/QATrackingPage.vue'
import QAManagementPage from '@/pages/QAManagementPage.vue'
import FeedbackManagementPage from '@/pages/FeedbackManagementPage.vue'
import QADatasetPage from '@/pages/QADatasetPage.vue'
import TagManagementPage from '@/pages/TagManagementPage.vue'
import HitAnalysisPage from '@/pages/HitAnalysisPage.vue'
import EvaluationPage from '@/pages/EvaluationPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', redirect: '/qa-tracking' },
    { path: '/apps', name: 'apps', component: AppManagementPage },
    { path: '/dashboard', name: 'dashboard', component: DashboardPage },
    { path: '/qa-tracking', name: 'qa-tracking', component: QATrackingPage },
    { path: '/qa-management', name: 'qa-management', component: QAManagementPage },
    { path: '/feedbacks', name: 'feedbacks', component: FeedbackManagementPage },
    { path: '/qa-datasets', name: 'qa-datasets', component: QADatasetPage },
    { path: '/tag-management', name: 'tag-management', component: TagManagementPage },
    { path: '/hit-analysis', name: 'hit-analysis', component: HitAnalysisPage },
    { path: '/evaluation', name: 'evaluation', component: EvaluationPage },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/qa-tracking',
    },
  ],
})

export default router
