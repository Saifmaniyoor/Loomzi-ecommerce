import { useEffect, useState } from 'react';
import { listAdminCoupons, createAdminCoupon, updateAdminCoupon, deleteAdminCoupon } from '../../../services/adminSettingsApi';
import '../Settings/StoreManagement.css';
import './CouponManagement-extra.css';

const initial = { code: '', discountValue: '', minimumPurchase: '', maximumDiscount: '', expiresAt: '', isActive: true };
const localDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export default function CouponManagement() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const refresh = async () => {
    const data = await listAdminCoupons();
    setCoupons(data.coupons || []);
  };

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  const edit = (c) => {
    setEditing(c._id);
    setForm({ code: c.code, discountValue: c.discountValue, minimumPurchase: c.minimumPurchase, maximumDiscount: c.maximumDiscount, expiresAt: localDate(c.expiresAt), isActive: c.isActive });
    setError('');
    setSuccess('');
  };

  const reset = () => { setEditing(null); setForm(initial); };

  const save = async (e) => {
    e.preventDefault();
    if (busy || deletingId) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const data = { ...form, code: form.code.trim().toUpperCase(), discountValue: Number(form.discountValue), minimumPurchase: Number(form.minimumPurchase), maximumDiscount: Number(form.maximumDiscount), expiresAt: new Date(form.expiresAt).toISOString() };
      const wasEditing = Boolean(editing);
      if (wasEditing) await updateAdminCoupon(editing, data);
      else await createAdminCoupon(data);
      await refresh();
      reset();
      setSuccess(wasEditing ? 'Coupon updated' : 'Coupon created');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const toggle = async (c) => {
    if (busy || deletingId) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await updateAdminCoupon(c._id, { isActive: !c.isActive });
      await refresh();
      setSuccess('Coupon status updated');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleDelete = async (c) => {
    if (busy || deletingId) return;
    if (!window.confirm(`Are you sure you want to delete coupon "${c.code}"?`)) return;
    setDeletingId(c._id);
    setError('');
    setSuccess('');
    try {
      await deleteAdminCoupon(c._id);
      await refresh();
      if (editing === c._id) reset();
      setSuccess(`Coupon "${c.code}" deleted successfully`);
    } catch (e) { setError(e.message || 'Failed to delete coupon'); }
    finally { setDeletingId(null); }
  };

  const isBusy = busy || Boolean(deletingId);

  return (
    <div className="lm-settings">
      <h1>Coupon Management</h1>
      <p>Create percentage offers for Loomzi checkout.</p>
      {error && <p className="lm-error" role="alert">{error}</p>}
      {success && <p className="lm-success" role="status">{success}</p>}
      <form className="lm-panel" onSubmit={save}>
        <h2>{editing ? 'Edit coupon' : 'Add new coupon'}</h2>
        <div className="lm-fields">
          <label>Coupon code<input required value={form.code} maxLength={30} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LOOMZI10" /></label>
          <label>Discount percentage (%)<input required type="number" min="0.01" max="100" step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} placeholder="e.g. 10" /></label>
          <label>Minimum purchase (₹)<input required type="number" min="0" step="0.01" value={form.minimumPurchase} onChange={(e) => setForm({ ...form, minimumPurchase: e.target.value })} placeholder="e.g. 500" /></label>
          <label>Maximum discount (₹)<input required type="number" min="0" step="0.01" value={form.maximumDiscount} onChange={(e) => setForm({ ...form, maximumDiscount: e.target.value })} placeholder="e.g. 100" /></label>
          <label>Expiry date and time<input required type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
          <label className="lm-check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
        </div>
        <div className="lm-actions">
          <button disabled={isBusy}>{busy ? 'Saving...' : editing ? 'Update coupon' : 'Create coupon'}</button>
          {editing && <button type="button" className="secondary" disabled={isBusy} onClick={reset}>Cancel</button>}
        </div>
      </form>
      <div className="lm-panel">
        <h2>All coupons</h2>
        <div className="lm-table-scroll">
          <table>
            <thead><tr><th>Code</th><th>Discount</th><th>Min. order</th><th>Max. off</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{coupons.map((c) => (
              <tr key={c._id}>
                <td><strong>{c.code}</strong></td>
                <td>{c.discountValue}%</td>
                <td>₹{c.minimumPurchase}</td>
                <td>₹{c.maximumDiscount}</td>
                <td>{new Date(c.expiresAt).toLocaleString('en-IN')}</td>
                <td>{c.isActive && new Date(c.expiresAt) > new Date() ? 'Active' : c.isActive ? 'Expired' : 'Inactive'}</td>
                <td><div className="lm-coupon-actions">
                  <button type="button" className="secondary" disabled={isBusy} onClick={() => edit(c)}>Edit</button>
                  <button type="button" className="secondary" disabled={isBusy} onClick={() => toggle(c)}>{c.isActive ? 'Disable' : 'Enable'}</button>
                  <button type="button" className="lm-delete-btn" disabled={isBusy} onClick={() => handleDelete(c)}>{deletingId === c._id ? 'Deleting...' : 'Delete'}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
          {!coupons.length && <p>No coupons yet.</p>}
        </div>
      </div>
    </div>
  );
}
