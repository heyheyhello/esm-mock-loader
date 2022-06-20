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