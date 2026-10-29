const BASE='http://localhost:5000/api';
async function request(path,options={}) {
 const res=await fetch(BASE+path,{credentials:'include',...options,headers:{'Content-Type':'application/json',...options.headers}});
 const data=await res.json().catch(()=>({}));
 if(!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
 return data;
}
export const listAdminCoupons=()=>request('/admin/coupons');
export const createAdminCoupon=(data)=>request('/admin/coupons',{method:'POST',body:JSON.stringify(data)});
export const updateAdminCoupon=(id,data)=>request(`/admin/coupons/${id}`,{method:'PATCH',body:JSON.stringify(data)});
export const getAdminShipping=()=>request('/admin/settings/shipping');
export const updateAdminShipping=(shippingCharge)=>request('/admin/settings/shipping',{method:'PATCH',body:JSON.stringify({shippingCharge})});
export const getAvailableCoupons=()=>request('/coupons/available');
