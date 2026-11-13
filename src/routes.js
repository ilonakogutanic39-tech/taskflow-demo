
import HomePage from './pages/HomePage.vue'
import TasksPage from './pages/TasksPage.vue'
import AboutPage from './pages/AboutPage.vue'
import HelpPage from './pages/HelpPage.vue'
import SettingsPage from './pages/SettingsPage.vue'

const routes = [
  { path: '/', component: HomePage },
  { path: '/tasks/', component: TasksPage },
  { path: '/about/', component: AboutPage },
  { path: '/help/', component: HelpPage },
  { path: '/settings/', component: SettingsPage },
]

export default routes
