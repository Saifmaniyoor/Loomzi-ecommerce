import {useEffect,useState} from 'react';
import {getAvailableCoupons} from '../../services/adminSettingsApi';
// Use this component in Checkout, passing the existing apply-coupon callback.
export default function AvailableCoupons({onSelect,refreshKey}){
 const [coupons,setCoupons]=useState([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;getAvailableCoupons().then(d=>{if(active)setCoupons(d.coupons||[])}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[refreshKey]);
 return <section style={{margin:'16px 0'}}><h3 style={{fontSize:17,marginBottom:10}}>Available coupons</h3>{error&&<p role="alert">{error}</p>}{!error&&!coupons.length&&<p>No coupons available right now.</p>}{coupons.map(c=><div key={c.code} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid #eaded7'}}><div><strong>{c.code}</strong> — {c.discountValue}% off (up to ₹{c.maximumDiscount})<div style={{fontSize:13,color:'#796c63'}}>Minimum ₹{c.minimumPurchase} · Expires {new Date(c.expiresAt).toLocaleDateString('en-IN')}</div></div><button type="button" disabled={!c.eligible} onClick={()=>onSelect(c.code)}>{c.eligible?'Apply':'Not eligible'}</button></div>)}</section>;
}
