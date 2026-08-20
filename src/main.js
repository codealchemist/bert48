import '@flaticon/flaticon-uicons/css/regular/rounded.css';
import { version } from '../package.json';

const versionEl = document.getElementById('appVersion');
if (versionEl) versionEl.textContent = `/v${version}`;
