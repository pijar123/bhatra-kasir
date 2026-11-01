// QRIS dinamis (nominal otomatis) dari QRIS statis milik toko
function qrisCrc(s){let c=0xFFFF;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?((c<<1)^0x1021)&0xFFFF:(c<<1)&0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')}
function qrisTlv(s){const out=[];let i=0;while(i<s.length){const t=s.substr(i,2),l=parseInt(s.substr(i+2,2),10);if(isNaN(l))throw new Error('bukan QRIS');out.push([t,s.substr(i+4,l)]);i+=4+l}return out}
function qrisDynamic(stat,amount){
  let f=qrisTlv(stat).filter(([t])=>t!=='63'&&t!=='54').map(([t,v])=>t==='01'?[t,'12']:[t,v]);
  f.splice(f.findIndex(([t])=>t==='58'),0,['54',String(Math.round(amount))]);
  const s=f.map(([t,v])=>t+String(v.length).padStart(2,'0')+v).join('')+'6304';
  return s+qrisCrc(s);
}
// Periksa QRIS statis hasil scan: format TLV benar, CRC cocok, ambil nama merchant (tag 59)
function qrisCheck(s){
  s=String(s||'').trim();
  if(!/^000201/.test(s)||s.length<60)return{ok:false,msg:'Ini bukan kode QRIS. Foto ulang QRIS dari aplikasi DANA/GoPay/bank kamu.'};
  if(qrisCrc(s.slice(0,-4))!==s.slice(-4).toUpperCase())return{ok:false,msg:'Kode QRIS rusak atau terpotong. Coba foto lebih jelas.'};
  const f=qrisTlv(s),m=f.find(([t])=>t==='59'),k=f.find(([t])=>t==='01');
  if(k&&k[1]==='12')return{ok:false,msg:'Ini QRIS sekali bayar (dinamis). Pakai QRIS statis toko yang ditempel di meja.'};
  return{ok:true,merchant:m?m[1]:'',payload:s};
}
if(typeof module!=='undefined')module.exports={qrisDynamic,qrisCrc,qrisCheck};
