import { render } from 'preact';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@/styles/tokens.css';
import '@/styles/global.css';
import { App } from '@/app';

render(<App />, document.getElementById('app')!);
