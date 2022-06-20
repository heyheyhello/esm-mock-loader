# ESM module mocking via Node loader

Let's mock some ESM modules. This has **ZERO OVERHEAD** when the loader is not
in use. This was last tested on Node 16.14 but uses an experimental API that
does in fact change (actually - I've had it change on me over a few months).

```js
import * as zx from "zx";
import got from "got";

console.log(Object.keys(zx));
console.log(zx.fs.readFileSync('./package.json', 'utf8'));
console.log('Has custom method?',
'customMethod' in zx ? `Yes: ${zx.customMethod()}`: 'No');

(async () => {
    console.log(await got('https://httpbin.org/json').json());
    console.log(await got('https://httpbin.org/specialMockUrl').json()); // Will 404
})();
```

# Run normally, no loader:
```
~/esm-mock via  v16.14.0
❯ node index.js
[
  '$',               'ProcessOutput',
  'ProcessPromise',  'YAML',
  'argv',            'cd',
  'chalk',           'fetch',
  'fs',              'glob',
  'globby',          'nothrow',
  'os',              'path',
  'question',        'quiet',
  'registerGlobals', 'sleep'
]
{
  "type": "module",
  "dependencies": {
    "esm": "^3.2.25",
    "got": "^12.0.1",
    "sinon": "^13.0.1",
    "zx": "^5.2.0"
  }
}

Has custom method? No
{
  slideshow: {
    author: 'Yours Truly',
    date: 'date of publication',
    slides: [ [Object], [Object] ],
    title: 'Sample Slide Show'
  }
}
node:internal/process/promises:265
            triggerUncaughtException(err, true /* fromPromise */);
HTTPError: Response code 404 (NOT FOUND)
...
```

# Run with loader, to install mocks:
```
~/esm-mock via  v16.14.0
❯ node --no-warnings --experimental-loader=./loader.mjs index.js
MATCHED specifier=zx source=/hames/esm-mock/index.js mock=node_modules/zx/index.mjs
MATCHED specifier=got source=/hames/esm-mock/index.js mock=/hames/esm-mock/node_modules/got/dist/source/index.js
[
  '$',              'ProcessOutput',
  'ProcessPromise', 'YAML',
  'argv',           'cd',
  'chalk',          'customMethod',
  'fetch',          'fs',
  'glob',           'globby',
  'nothrow',        'os',
  'path',           'question',
  'quiet',          'registerGlobals',
  'sleep'
]
mockmock
Has custom method? Yes: 200
NETWORK REQ: https://httpbin.org/json
{
  slideshow: {
    author: 'Yours Truly',
    date: 'date of publication',
    slides: [ [Object], [Object] ],
    title: 'Sample Slide Show'
  }
}
MOCK NETWORK REQ: https://httpbin.org/specialMockUrl
{ "mock": "mockmockmock" }
```

The mocks are in the loader for now. They could be anywhere. It's all just
vanilla JS. No frameworks. No magic. You'd probably want to `fs.readFileSync` it
instead of hardcoding it in like I did.
