import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyBrowserRegressionFix} from './browser-regression-assets.mjs';

// Explicit compatibility CLI for the existing PR #195 local QA workflow.
// The RC generator passes its own fixed output root directly, not this env override.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.SSG_BROWSER_FIX_ROOT || path.join(here, '../docs/franchise-ssg-preview'));
console.log(JSON.stringify(applyBrowserRegressionFix(root)));
