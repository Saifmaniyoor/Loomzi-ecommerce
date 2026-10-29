import {useEffect,useState} from 'react';
import {listAdminCoupons,createAdminCoupon,updateAdminCoupon} from '../../../services/adminSettingsApi';
import '../Settings/StoreManagement.css';
const initial={code:'',discountValue:10,minimumPurchase:500,maximumDiscount:100,expiresAt:'',isActive:true};
const localDate=(d)=>{if(!d)return '';const date=new Date(d);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;};
export default function CouponManagement(){
 const [coupons,setCoupons]=useState([]),[form,setForm]=useState(initial),[editing,setEditing]=useState(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false);
 const refresh=async()=>{const data=await listAdminCoupons();setCoupons(data.coupons||[]);};
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
 const edit=(c)=>{setEditing(c._id);setForm({code:c.code,discountValue:c.discountValue,minimumPurchase:c.minimumPurchase,maximumDiscount:c.maximumDiscount,expiresAt:localDate(c.expiresAt),isActive:c.isActive});setError('');setSuccess('');};
 const reset=()=>{setEditing(null);setForm(initial);};
 const save=async(e)=>{e.preventDefault();setBusy(true);setError('');setSuccess('');try{
  const data={...form,code:form.code.trim().toUpperCase(),discountValue:Number(form.discountValue),minimumPurchase:Number(form.minimumPurchase),maximumDiscount:Number(form.maximumDiscount),expiresAt:new Date(form.expiresAt).toISOString()};
  if(editing) await updateAdminCoupon(editing,data);else await createAdminCoupon(data);
  await refresh();reset();setSuccess(editing?'Coupon updated':'Coupon created');
 }catch(e){setError(e.message)}finally{setBusy(false)}};
 const toggle=async(c)=>{setError('');setSuccess('');try{await updateAdminCoupon(c._id,{isActive:!c.isActive});await refresh();setSuccess('Coupon status updated')}catch(e){setError(e.message)}};
 return <div className="lm-settings"><h1>Coupon Management</h1><p>Create percentage offers for Loomzi checkout.</p>
 {error&&<p className="lm-error" role="alert">{error}</p>}{success&&<p className="lm-success" role="status">{success}</p>}
 <form className="lm-panel" onSubmit={save}><h2>{editing?'Edit coupon':'Add new coupon'}</h2><div className="lm-fields">
 <label>Coupon code<input required value={form.code} maxLength={30} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})} placeholder="LOOMZI10"/></label>
 <label>Discount percentage (%)<input required type="number" min="0.01" max="100" step="0.01" value={form.discountValue} onChange={e=>setForm({...form,discountValue:e.target.value})}/></label>
 <label>Minimum purchase (₹)<input required type="number" min="0" step="0.01" value={form.minimumPurchase} onChange={e=>setForm({...form,minimumPurchase:e.target.value})}/></label>
 <label>Maximum discount (₹)<input required type="number" min="0" step="0.01" value={form.maximumDiscount} onChange={e=>setForm({...form,maximumDiscount:e.target.value})}/></label>
 <label>Expiry date and time<input required type="datetime-local" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})}/></label>
 <label className="lm-check"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/> Active</label>
 </div><div className="lm-actions"><button disabled={busy}>{busy?'Saving...':editing?'Update coupon':'Create coupon'}</button>{editing&&<button type="button" className="secondary" onClick={reset}>Cancel</button>}</div></form>
 <div className="lm-panel"><h2>All coupons</h2><div className="lm-table-scroll"><table><thead><tr><th>Code</th><th>Discount</th><th>Min. order</th><th>Max. off</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>{coupons.map(c=><tr key={c._id}><td><strong>{c.code}</strong></td><td>{c.discountValue}%</td><td>₹{c.minimumPurchase}</td><td>₹{c.maximumDiscount}</td><td>{new Date(c.expiresAt).toLocaleString('en-IN')}</td><td>{c.isActive&&new Date(c.expiresAt)>new Date()?'Active':c.isActive?'Expired':'Inactive'}</td><td><button className="secondary" onClick={()=>edit(c)}>Edit</button> <button className="secondary" onClick={()=>toggle(c)}>{c.isActive?'Disable':'Enable'}</button></td></tr>)}</tbody></table>{!coupons.length&&<p>No coupons yet.</p>}</div></div></div>;
}
