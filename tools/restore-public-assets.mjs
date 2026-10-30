import {access,readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve,isAbsolute,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// The downloadable archive includes each local asset once, in the ready-built
// app. Source commands restore missing public copies before Vite or tests run.
const root=fileURLToPath(new URL('../',import.meta.url));
const {assets}=JSON.parse(await readFile(new URL('./public-assets-manifest.json',import.meta.url),'utf8'));
let restored=0;
for(const asset of assets){
 const destination=resolve(root,'public',asset.path),from=resolve(root,'dist',asset.path);
 const rel=relative(resolve(root,'public'),destination);
 if(isAbsolute(rel)||rel==='..'||rel.startsWith('../')||rel.startsWith('..\\'))throw Error('Invalid bundled asset path');
 try{await access(destination);continue}catch(error){if(error.code!=='ENOENT')throw error}
 const bytes=await readFile(from);
 if(bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Bundled asset is missing or changed: '+asset.path+'. Extract the ZIP again.');
 await mkdir(dirname(destination),{recursive:true});
 await writeFile(destination,bytes,{flag:'wx'});restored++;
}
if(restored)console.log('Restored '+restored+' local source assets from the included app.');
