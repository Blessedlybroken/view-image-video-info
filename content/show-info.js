'use strict';

typeof window.__showInfo !== 'function' && (() => {
  window.__showInfo = src => {
    const info = window.__getInfo(src);

    const el = info.el = createUI(info);

    const isBase64 = src.startsWith('data:image/') && src.includes('base64');
    (isBase64 ? setBase64Meta : fetchImageMeta)(info)
      .then(renderFileMeta);

    document.body.appendChild(el);
    setupPosition(info);
    setupAutoFadeOut(info);
    el.style.opacity = 1;

    const elUrl = el.shadowRoot.getElementById('url');
    elUrl.style.maxWidth = elUrl.parentNode.offsetWidth + 'px';
  };

  function createUI(info) {
    const {img, src, w, h, dw, dh} = info;
    for (const el of document.getElementsByClassName(chrome.runtime.id))
      if (el.img === img)
        el.remove();
    const el = $make('div', {img, className: chrome.runtime.id});
    el.attachShadow({mode: 'open'});
    el.shadowRoot.append(
      $make('style', {textContent: $style()}),
      $make('main', [
        $make('div', {
          id: 'close',
          textContent: 'x',
          onclick: event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            el.remove();
          },
        }),
        $make('table', [
          $make('tr', [
            $make('td', {textContent: tl('location')}),
            $make('td', [
              $make('a', {
                id: 'url',
                href: src,
                title: src,
                textContent: src,
                target: '_blank',
                rel: 'noopener noreferrer',
              }),
            ]),
          ]),
          $make('tr', [
            $make('td', {textContent: tl('dimensions')}),
            $make('td', [
              $make('b', {textContent: w && h ? `${w} x ${h} px` : ''}),
              $make('i', {
                textContent: dw && dh && dw !== w && dh !== h ?
                  ` (${tl('scaledTo')} ${dw} x ${dh} px)` :
                  '',
              }),
            ]),
          ]),
          $make('tr', [
            $make('td', {textContent: tl('fileType')}),
            $make('td', [
              $make('b', {id: 'type'}),
              $make('span', {textContent: ' image'}),
            ]),
          ]),
          $make('tr', [
            $make('td', {textContent: tl('fileSize')}),
            $make('td', [
              $make('b', {id: 'size'}),
              $make('i', {id: 'bytes'}),
            ]),
          ]),
          $make('tr', [
            $make('td', {textContent: tl('alt')}),
            $make('td', {textContent: [img.alt, img.title].filter(Boolean).join(' / ')}),
          ]),
        ]),
      ])
    );
    return el;
  }

  function setupAutoFadeOut({el}) {
    let fadeOutTimer;
    el.onmouseleave = () => {
      el.style.transitionDuration = '5s';
      el.style.opacity = '0';
      fadeOutTimer = setTimeout(() => el.remove(), 5e3);
    };
    el.onmouseenter = () => {
      clearTimeout(fadeOutTimer);
      el.style.opacity = 1;
      el.style.transitionDuration = '.1s';
    };
    if (!el.matches(':hover'))
      fadeOutTimer = setTimeout(el.onmouseleave, 5e3);
  }

  function setupPosition(info) {
    let bScroll = document.scrollingElement.getBoundingClientRect();
    if (!bScroll.height)
      bScroll = {bottom: scrollY + innerHeight, right: bScroll.right};
    const b = info.el.getBoundingClientRect();
    const y = Math.min(info.bounds.bottom, Math.min(innerHeight, bScroll.bottom) - b.height);
    const x = Math.min(info.bounds.left, Math.min(innerWidth, bScroll.right) - b.width);
    info.el.style.top = y + scrollY + 'px';
    info.el.style.left = x + scrollX + 'px';
  }

  function renderFileMeta(info) {
    let {size, type, el} = info;
    if (size) {
      let unit;
      let n = size;
      for (unit of ['', 'kiB', 'MiB', 'GiB']) {
        if (n < 1024)
          break;
        n /= 1024;
      }
      const bytes = `${formatNumber(size)} ${tl('bytes')}`;
      if (!unit) {
        size = bytes;
      } else {
        size = `${formatNumber(n)} ${unit}`;
        el.shadowRoot.getElementById('bytes').textContent = ` (${bytes})`;
      }
    }
    Object.assign(el.shadowRoot.getElementById('size'), {
      textContent: size || '',
      disabled: !size,
    });

    type = type.split('/', 2).pop().toUpperCase();
    type = type === 'HTML' ? '' : type;
    Object.assign(el.shadowRoot.getElementById('type'), {
      textContent: type || '',
      disabled: !type,
    });

    if (info.error)
      el.shadowRoot.querySelector('table').classList.add('error');
  }

  function setBase64Meta(info) {
    Object.assign(info, {
      type: info.src.split(/[/;]/, 2).pop().toUpperCase(),
      size: info.src.split(';').pop().length / 6 * 8 | 0,
      ready: true,
    });
    return {then: cb => cb(info)};
  }

  function fetchImageMeta(info) {
    return new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', info.src);
      xhr.timeout = 10e3;
      xhr.ontimeout = xhr.onerror = xhr.onreadystatechange = e => {
        if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
          info.size = xhr.getResponseHeader('Content-Length') | 0;
          info.type = xhr.getResponseHeader('Content-Type');
        } else if (xhr.status >= 300 || e.type === 'timeout' || e.type === 'error') {
          info.error = true;
        } else {
          return;
        }
        info.ready = true;
        resolve(info);
      };
      xhr.send();
    });
  }

  function formatNumber(n) {
    return Number(n).toLocaleString(undefined, {maximumFractionDigits: 1});
  }

  function tl(s) {
    return chrome.i18n.getMessage(s);
  }

  function $make(tag, props) {
    const el = document.createElement(tag);
    const hasProps = props && !Array.isArray(props);
    const children = hasProps ? props.children : props;
    if (children)
      el.append(...children);
    if (children && hasProps)
      delete props.children;
    if (hasProps)
      Object.assign(el, props);
    return el;
  }

  function $style() {
    // language=CSS
    return `
      :host {
        all: initial;
        opacity: 0;
        transition: opacity .1s cubic-bezier(.88, .02, .92, .66);
        box-sizing: border-box;
        position: absolute;
        box-shadow: 3px 4px 20px rgba(0, 0, 0, 0.5);
        z-index: 2147483647;
      }
      main {
        background-color: papayawhip;
        color: #000;
        font: normal 14px sans-serif;
        white-space: nowrap;
      }
      table {
        border-spacing: 0;
      }
      table, tr, td {
        padding: 0;
        margin: 0;
      }
      tr:nth-child(even) {
        background-color: #8883;
      }
      td {
        line-height: 24px;
        padding-left: 4px;
        padding-right: 4px;
        height: 24px;
      }
      td:first-child {
        padding-left: 1em;
      }
      td:last-child {
        padding-right: 1em;
      }
      tr:first-child td {
        padding-top: .5em;
      }
      tr:last-child td {
        padding-bottom: .5em;
      }
      a {
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      .gray {
        color: gray;
      }
      [disabled] {
        opacity: .5;
      }
      .error td:last-child {
        color: maroon;
      }
      #url {
        max-width: 100px;
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #type[disabled] + * {
        display: none;
      }
      #close {
        cursor: pointer;
        padding: .5ex 1ex;
        font: normal 15px/1.0 sans-serif;
        position: absolute;
        top: 0;
        right: 0;
      }
      #close:active {
        background-color: #f003;
      }
      #close:hover {
        background-color: #f803;
      }
      @media (prefers-color-scheme: dark) {
        main {
          background-color: #333;
          color: #aaa;
        }
        a {
          color: skyblue;
        }
        b {
          color: #bbb;
        }
      }
    `;
  }
})();
