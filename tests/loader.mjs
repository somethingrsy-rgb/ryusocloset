// Offline test loader: resolve extensionless local TS imports and JSON modules.
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
export async function resolve(specifier,context,next){
 if(specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context)
 return next(specifier,context)
}
export async function load(url,context,next){
 if(url.endsWith('.ts')){let source=stripTypeScriptTypes(await readFile(new URL(url),'utf8'));source=source.replace(/(from\s+['"][^'"]+\.json['"])/g,'$1 with { type: "json" }');return {format:'module',source,shortCircuit:true}}
 return next(url,context)
}
