import { mount } from 'svelte'

import App from './src/App.svelte';
import './src/assets/global.scss';

const app = mount(App, {
  target: document.getElementById('app-content')!
});


export default app
