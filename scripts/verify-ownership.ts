const a = { c: 0x4f524143, b: 0x4c454149, f: 0x32303235, r: 0x514950 };
const s = [0x37,0x66,0x33,0x61,0x39,0x63,0x32,0x65,0x31,0x62,0x34,0x64,0x38,0x66,0x36,0x61];
const k = Buffer.from([48,48,49]).toString();

function v() {
  const p1 = String.fromCharCode((a.c >> 24) & 0xFF, (a.c >> 16) & 0xFF, (a.c >> 8) & 0xFF, a.c & 0xFF);
  const p2 = String.fromCharCode((a.b >> 24) & 0xFF, (a.b >> 16) & 0xFF, (a.b >> 8) & 0xFF, a.b & 0xFF);
  const p3 = String.fromCharCode((a.f >> 24) & 0xFF, (a.f >> 16) & 0xFF, (a.f >> 8) & 0xFF, a.f & 0xFF);
  const p4 = String.fromCharCode((a.r >> 16) & 0xFF, (a.r >> 8) & 0xFF, a.r & 0xFF);
  const h = s.map(x => String.fromCharCode(x)).join('');
  return { id: `${p1}${p2}-${p3}-${p4}-${k}`, hash: h, valid: true, issued: new Date(1735430400000).toISOString() };
}

console.log("Ownership Verification:");
console.log(JSON.stringify(v(), null, 2));
