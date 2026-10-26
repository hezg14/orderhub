import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './styles/tokens.css';
import 'element-plus/dist/index.css';
// Dark palette for Element Plus components — keyed off the `html.dark` class
// that useTheme() toggles, so no JS wiring is needed beyond the class flip.
import 'element-plus/theme-chalk/dark/css-vars.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.config.errorHandler = (err, _instance, info) => {
  // Keep a breadcrumb in the console; in production this is where Sentry goes.
  console.error('[orderhub] unhandled component error', info, err);
};

app.mount('#app');
