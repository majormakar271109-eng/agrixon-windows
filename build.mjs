import * as esbuild from 'esbuild';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const marker={name:'server-only',setup(build){build.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'empty'}));build.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'',loader:'js'}));}};
const config={bundle:true,platform:'node',format:'esm',target:'node20',tsconfigRaw:{compilerOptions:{paths:{'@/*':[path.join(root,'source/crop-rotation/src/*')]}}},plugins:[marker]};
await esbuild.build({...config,entryPoints:[path.join(root,'source/AppName-live/server.ts')],outfile:path.join(root,'server.mjs')});
await esbuild.build({...config,entryPoints:[path.join(root,'source/AppName-live/server-tests.ts')],outfile:path.join(root,'server-tests.mjs')});
await esbuild.build({entryPoints:[path.join(root,'source/AppName-live/client.ts')],outfile:path.join(root,'public/app.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',minify:true});
console.log('Build complete.');
