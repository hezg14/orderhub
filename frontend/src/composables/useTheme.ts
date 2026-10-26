import { ref } from 'vue';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'orderhub.theme';

const theme = ref<Theme>(resolveInitial());

/**
 * localStorage wins; otherwise dark. Dark is the product's default identity —
 * the hero deck, sidebar rail and charts were designed on the dark palette
 * first, so a first-time visitor should land there.
 */
function resolveInitial(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

/** Apply the class EP's dark css-vars and our own `html.dark` tokens key off. */
function apply(next: Theme) {
  theme.value = next;
  document.documentElement.classList.toggle('dark', next === 'dark');
  document.documentElement.style.colorScheme = next;
  localStorage.setItem(STORAGE_KEY, next);
}

// Apply once at module load — before the app mounts, so there is no flash.
apply(theme.value);

/**
 * Theme switching is a class flip, not a JS branch: every component reads
 * tokens from CSS variables, so light/dark costs zero per-component code.
 */
export function useTheme() {
  function toggle() {
    // Briefly enable the palette cross-fade, then remove it so ordinary
    // interactions stay snappy.
    const root = document.documentElement;
    root.classList.add('theme-anim');
    window.setTimeout(() => root.classList.remove('theme-anim'), 300);
    apply(theme.value === 'dark' ? 'light' : 'dark');
  }

  return { theme, toggle };
}
