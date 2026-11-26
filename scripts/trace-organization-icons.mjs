// Convert the supplied chart's sampled white silhouettes to SVG contours.
// Run from the repository root: node scripts/trace-organization-icons.mjs
// No icon is substituted or invented; the source PNG remains the visual reference.
import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import assert from 'node:assert/strict';
const png = await readFile('assets/images/department-organization.png');
assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert.equal(png[24],8,'Source must be 8-bit RGB PNG');
assert.equal(png[25],2,'Source must be RGB PNG');
assert.equal(png[28],0,'Source must be non-interlaced');
const width=png.readUInt32BE(16), height=png.readUInt32BE(20), chunks=[];
for(let offset=8;offset<png.length;) {
  const length=png.readUInt32BE(offset), type=png.toString('ascii',offset+4,offset+8);
  if(type==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));
  offset+=length+12;
}
const raw=inflateSync(Buffer.concat(chunks)), stride=width*3, pixels=Buffer.alloc(height*stride);
assert.equal(raw.length,(stride+1)*height);
const paeth=(a,b,c)=>{
  const p=a+b-c, pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
  return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
};
for(let y=0;y<height;y++) {
  const filter=raw[y*(stride+1)];
  assert.ok(filter<=4);
  for(let x=0;x<stride;x++) {
    const i=y*stride+x,a=x>=3?pixels[i-3]:0,b=y?pixels[i-stride]:0,c=y&&x>=3?pixels[i-stride-3]:0;
    const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
    pixels[i]=(raw[y*(stride+1)+1+x]+predictor)&255;
  }
}
const crops=[['academic-office',88,431,70,64],['clinical-trial-center',253,431,50,53],['core-laboratory',403,431,49,54],['animal-laboratory',541,434,53,49],['cell-therapy-center',665,432,58,50],['ai-center',790,431,62,54],['innovation-ip-center',919,428,56,56]];
const samples=crops.map(([id,x,y,width,height])=>({id,width,height,rows:Array.from({length:height},(_,cy)=>Array.from({length:width},(_,cx)=>{
  const i=((y+cy)*png.readUInt32BE(16)+x+cx)*3;
  return pixels[i]>205&&pixels[i+1]>205&&pixels[i+2]>205?'1':'0';
}).join(''))}));
const symbols = [];
for (const sample of samples) {
  const { id, width, height, rows } = sample;
  const on = (x, y) => rows[y]?.[x] === '1';
  const edges = new Map();
  const edge = (x,y,a,b) => {
    const key = `${x},${y}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push([a,b]);
  };
  for (let y=0;y<height;y++) for(let x=0;x<width;x++) if(on(x,y)) {
    if(!on(x,y-1)) edge(x,y,x+1,y);
    if(!on(x+1,y)) edge(x+1,y,x+1,y+1);
    if(!on(x,y+1)) edge(x+1,y+1,x,y+1);
    if(!on(x-1,y)) edge(x,y+1,x,y);
  }
  const paths=[];
  while(edges.size) {
    const first=edges.keys().next().value.split(',').map(Number), points=[first];
    let current=first;
    do {
      const key=current.join(','), options=edges.get(key);
      current=options.pop();
      if(!options.length)edges.delete(key);
      points.push(current);
    } while(current[0]!==first[0]||current[1]!==first[1]);
    const simple=points.filter((p,i)=>i===0||i===points.length-1||
      (p[0]-points[i-1][0])*(points[i+1][1]-p[1]) !== (p[1]-points[i-1][1])*(points[i+1][0]-p[0]));
    paths.push('M'+simple.map(p=>p.join(' ')).join('L')+'Z');
  }
  const size=Math.max(width,height)+4;
  symbols.push(`<symbol id="${id}" viewBox="${-(size-width)/2} ${-(size-height)/2} ${size} ${size}"><path fill="currentColor" d="${paths.join('')}"/></symbol>`);
}
await writeFile('assets/images/unit-icons.svg', `<svg xmlns="http://www.w3.org/2000/svg"><!-- Traced from 醫學研究部組織架構圖2.png, 2026-11-26; shared by all unit identities. -->${symbols.join('\n')}</svg>\n`);
console.log(`Traced ${symbols.length} supplied icons to assets/images/unit-icons.svg`);
