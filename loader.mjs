// Tiny ESM mock loader
// Usage: `node --experimental-loader=./loader.mjs yourscript.js`

// Based on ideas from:
// - https://github.com/antfu/esbuild-node-loader/blob/a51e86a73badb95268f50c15926a1d4e31f13f4d/loader.mjs
// - https://github.com/davidmarkclements/mockalicious/blob/main/loader.mjs

import { createRequire } from 'module'
// Because `import.meta.resolve` needs `--experimental-import-meta-resolve` and
// it's async (oof). I don't want to deal with that.
const { resolve: nodeResolve } = createRequire(import.meta.url);

// Here's our mocks. Note these URLs are resolved meaning the absolute path with
// extension. The matching is done using String#endsWith()
/** @type {{ [sourceURL: string]: { [importURL: string]: string } }} */
const mockMap = {
  'node_modules/fetch-blob/a.js': {
    'node_modules/fetch-blob/b.js': `
      console.log('This is a mock module');
      export default 12345;
    `,
  },
  // XXX: Can't use `[import.meta.resolve('zx')]:` it's a promise. See above.
  [nodeResolve('./index.js')]: {
    // Hardcoded string shown as an example but DON'T DO THIS!
    'node_modules/zx/index.mjs': `
      import * as zx from 'zx';
      zx.fs.readFileSync = () => 'mockmock';
      // XXX: You might run into "Object is not extensible" since imports are
      // immutable in JS by specification. You can do this instead:
      // zx.customMethod = () => 200;
      export * from 'zx';
      export const customMethod = () => 200;
    `,
    // Use Node's resolver because no one knows the actual path. For "got" it
    // could be 'node_modules/got/dist/index.js' or something.
    [nodeResolve('got')]: `
      import got from 'got';
      export default function gotMock(url, ...args) {
        if (url === 'https://httpbin.org/specialMockUrl') {
          console.log('MOCK NETWORK REQ:', url);
          return { json: () => Promise.resolve('{ "mock": "mockmockmock" }') };
        }
        // Pass thru everything else
        console.log('NETWORK REQ:', url);
        return got(url, ...args);
      }
    `,
  }
};

// This doesn't load the source - that's done in load() - but resolve() has the
// context of the import, meanwhile load() is stateless, so we pass the state
// over to load() by using a custom "protocol import" like "node:fs" does.
export function resolve(specifier, context, defaultResolve) {
  // XXX: OH NO. defaultResolve() chokes on this... oof.
  if (context.parentURL?.startsWith('mock:')) delete context.parentURL;
  let { parentURL: sourceURL = null } = context;
  const resolvedImportURL = defaultResolve(specifier, context, defaultResolve);
  // Usually the initial argument script passed to `node <file>` on CLI
  if (!sourceURL) return resolvedImportURL;
  const matchedSourceURL = Object.keys(mockMap).find(urlTail => sourceURL.endsWith(urlTail));
  const mockedImports = mockMap[matchedSourceURL];
  if (mockedImports) {
    // Could simplify to `===` if always using `import.meta.resolve()` in mocks
    const matchedImportURL = Object.keys(mockedImports).find(urlTail => resolvedImportURL.url.endsWith(urlTail));
    if (matchedImportURL) {
      console.log(`MATCHED specifier=${specifier} source=${matchedSourceURL} mock=${matchedImportURL}`)
      // TODO: Hacky serialization but it's a URL so commas will be safely encoded
      return { url: `mock:${matchedSourceURL},${matchedImportURL}`, format: 'module' };
    } else {
      // Fall through
      console.log(`SKIP specifier=${specifier} source=${matchedSourceURL}`)
    }
  }
  // Let Node.js handle all other format / sources.
  return resolvedImportURL;
}

export function load(url, context, defaultLoad) {
  if (url.startsWith('mock:')) {
    // TODO: Hacky deserialization
    const [sourceURL, importURL] = url.substring('mock:'.length).split(',');
    const code = mockMap[sourceURL]?.[importURL];
    if (!code) throw new Error(`Mock URL isn't defined: "${url}"`);
    // TODO: Dedent the code maybe (JS engine doesn't care though)
    return { source: code, format: 'module' };
  }
  // Let Node.js handle all other format / sources.
  return defaultLoad(url, context, defaultLoad)
}
