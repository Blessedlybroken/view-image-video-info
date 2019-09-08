import {ignoreLastError} from './bg.js';

chrome.runtime.onInstalled.addListener(() => {
  const opts = {
    type: 'normal',
    title: chrome.i18n.getMessage('contextMenu'),
  };

  chrome.contextMenus.create({
    ...opts,
    id: 'info',
    contexts: ['image', 'video'],
    documentUrlPatterns: ['*://*/*', 'file://*/*'],
  }, ignoreLastError);

  for (const [id, {pages, links}] of Object.entries({
    'imgur.com': {
      pages: ['/', '/t/*'],
      links: ['/gallery/*', '/t/*'],
    },
    '*.facebook.com': {
      pages: ['/*'],
      links: ['/*/photos/*?type=*'],
    },
    '500px.com': {
      pages: ['/*'],
      links: ['/photo/*'],
    },
  })) {
    chrome.contextMenus.create({
      ...opts,
      id: 'link:' + id,
      contexts: ['link'],
      documentUrlPatterns: pages.map(expandUrl, id),
      targetUrlPatterns: links.map(expandUrl, id),
    }, ignoreLastError);
  }

  function expandUrl(s) {
    return s.includes('://') ? s : `*://${this}${s}`;
  }
});
