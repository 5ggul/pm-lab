// Run the existing full suite unchanged, then add the discovery regression suite.
import "./browser-qa.mjs";
import { chromium } from "playwright";
import { checkDiscovery } from "./discovery-browser-qa.mjs";
const browser=await chromium.launch({headless:true});
try { await checkDiscovery({browser,base:process.env.QA_BASE_URL||"http://127.0.0.1:3000"}); }
finally { await browser.close(); }
