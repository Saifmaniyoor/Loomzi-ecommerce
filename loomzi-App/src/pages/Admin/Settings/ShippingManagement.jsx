import {useEffect,useState} from 'react';
import {getAdminShipping,updateAdminShipping} from '../../../services/adminSettingsApi';
import './StoreManagement.css';
export default function ShippingManagement(){
 const [charge,setCharge]=useState('50'),[error,setError]=useState(''),[success,setSuccess]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{getAdminShipping().then(d=>setCharge(String(d.shippingCharge))).catch(e=>setError(e.message));},[]);
 const save=async(e)=>{e.preventDefault();setError('');setSuccess('');setSaving(true);try{const n=Number(charge);if(!Number.isFinite(n)||n<0)throw new Error('Enter a valid non-negative shipping charge');const d=await updateAdminShipping(n);setCharge(String(d.shippingCharge));setSuccess('Shipping charge updated successfully')}catch(e){setError(e.message)}finally{setSaving(false)}};
 return <div className="lm-settings"><h1>Shipping Charge</h1><p>Set the flat shipping fee charged once per customer order.</p>{error&&<p className="lm-error" role="alert">{error}</p>}{success&&<p className="lm-success" role="status">{success}</p>}<form className="lm-panel" onSubmit={save}><label>Shipping charge per order (₹)<input type="number" min="0" step="0.01" required value={charge} onChange={e=>setCharge(e.target.value)}/></label><p>Current setting: ₹{charge || '0'} per order. Shipping is not charged per item.</p><button disabled={saving}>{saving?'Saving...':'Save shipping charge'}</button></form></div>;
}
