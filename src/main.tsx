import { render } from 'preact';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@/styles/tokens.css';
import '@/styles/global.css';
import { App } from '@/app';
import { initClock } from '@/lib/clock';
import { applyAppearance } from '@/lib/settings';
import { startSyncLoop } from '@/lib/sync';

initClock();
applyAppearance();
startSyncLoop();
render(<App />, document.getElementById('app')!);
