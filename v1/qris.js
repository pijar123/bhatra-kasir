// QRIS dinamis dari QRIS statis Warung Jajan BHATRA (nominal otomatis)
const QRIS_STATIC = '00020101021126570011ID.DANA.WWW011893600915303551278202090355127820303UMI51440014ID.CO.QRIS.WWW0215ID10266044379170303UMI5204581253033605802ID5919WARUNG JAJAN BHATRA6012Kab. Kebumen6105544736304D7F3';
function qrisCrc(s){let c=0xFFFF;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?((c<<1)^0x1021)&0xFFFF:(c<<1)&0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')}
function qrisTlv(s){const out=[];let i=0;while(i<s.length){const t=s.substr(i,2),l=parseInt(s.substr(i+2,2),10);out.push([t,s.substr(i+4,l)]);i+=4+l}return out}
function qrisDynamic(amount){
  let f=qrisTlv(QRIS_STATIC).filter(([t])=>t!=='63'&&t!=='54').map(([t,v])=>t==='01'?[t,'12']:[t,v]);
  f.splice(f.findIndex(([t])=>t==='58'),0,['54',String(Math.round(amount))]);
  const s=f.map(([t,v])=>t+String(v.length).padStart(2,'0')+v).join('')+'6304';
  return s+qrisCrc(s);
}
if (typeof module!=='undefined') module.exports={qrisDynamic,qrisCrc,QRIS_STATIC};
