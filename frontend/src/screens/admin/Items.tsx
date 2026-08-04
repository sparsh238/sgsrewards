import { useEffect, useState } from 'react';
import { apiFetch, apiJson, IMAGE_BASE } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { formatNumber } from '../../lib/format';
import { isAvailable, type Item } from '../../lib/types';
import { htmlToText } from '../../lib/html';
import Modal from '../../components/Modal';

export default function Items() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<null | { mode: 'add' } | { mode: 'edit'; item: Item }>(null);
  const { toast, toastError } = useToast();

  const load = () => apiJson<Item[]>('/api/item').then(setItems).catch((e) => setError((e as Error).message));
  useEffect(() => { load(); }, []);

  // Availability toggle via multipart PUT (the backend update route uses multer).
  const toggle = async (item: Item) => {
    const next = !isAvailable(item);
    setItems((list) => list?.map((i) => (i._id === item._id ? { ...i, isActive: next } : i)) ?? null);
    try {
      const fd = new FormData();
      fd.append('name', item.name);
      fd.append('pointsRequired', String(item.pointsRequired));
      fd.append('discount', String(item.discount ?? 0));
      fd.append('description', item.description ?? '');
      fd.append('isActive', String(next));
      const res = await apiFetch(`/api/item/${item._id}`, { method: 'PUT', body: fd });
      if (!res.ok) throw new Error('Update failed');
      toast(next ? `"${item.name}" is now visible` : `"${item.name}" hidden from dealers`);
    } catch (err) {
      setItems((list) => list?.map((i) => (i._id === item._id ? { ...i, isActive: !next } : i)) ?? null);
      toastError((err as Error).message);
    }
  };

  const remove = async (item: Item) => {
    if (!window.confirm(`Delete "${item.name}"? This removes it and its image permanently. To just take it off the shop, hide it instead.`)) return;
    try {
      await apiJson(`/api/item/${item._id}`, { method: 'DELETE' });
      toast('Reward deleted');
      load();
    } catch (err) { toastError((err as Error).message); }
  };

  return (
    <>
      <div className="admin-head">
        <div><h1>Rewards</h1><p className="page-sub">Hide items to take them off the shop without deleting. No stock is tracked.</p></div>
        <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setModal({ mode: 'add' })}>
          + Add reward
        </button>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {items === null && !error && <div className="skeleton" style={{ height: 200 }} />}

      {items !== null && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th></th><th>Name</th><th>Points</th><th>Discount</th><th>Visible</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id}>
                  <td style={{ width: 56 }}>
                    <div className="cart-thumb" style={{ width: 40, height: 40 }}>
                      {it.images?.[0] && <img src={`${IMAGE_BASE}/${it.images[0]}`} alt="" />}
                    </div>
                  </td>
                  <td className="t-strong">{it.name}</td>
                  <td className="t-num">{formatNumber(it.pointsRequired)}</td>
                  <td className="t-num">{it.discount ? formatNumber(it.discount) : '—'}</td>
                  <td>
                    <button
                      className={`switch${isAvailable(it) ? ' on' : ''}`}
                      role="switch"
                      aria-checked={isAvailable(it)}
                      aria-label={`${it.name} visible to dealers`}
                      onClick={() => toggle(it)}
                    />
                  </td>
                  <td>
                    <div className="t-actions">
                      <button className="mini-btn" onClick={() => setModal({ mode: 'edit', item: it })}>Edit</button>
                      <button className="mini-btn danger" onClick={() => remove(it)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="hint" style={{ textAlign: 'center', padding: 30 }}>No rewards yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ItemModal
          item={modal.mode === 'edit' ? modal.item : undefined}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}

function ItemModal({ item, onClose, onSaved }: { item?: Item; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [pointsRequired, setPointsRequired] = useState(item ? String(item.pointsRequired) : '');
  const [discount, setDiscount] = useState(item?.discount ? String(item.discount) : '');
  // Clean any legacy HTML so editing + saving replaces it with plain text.
  const [description, setDescription] = useState(htmlToText(item?.description));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();

  const save = async () => {
    if (!name.trim() || !(parseFloat(pointsRequired) > 0)) {
      toastError('Name and a positive points value are required.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('pointsRequired', pointsRequired);
      fd.append('discount', discount || '0');
      fd.append('description', description);
      if (item) fd.append('isActive', String(isAvailable(item)));
      if (file) fd.append('image', file);

      const path = item ? `/api/item/${item._id}` : '/api/item';
      const res = await apiFetch(path, { method: item ? 'PUT' : 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Save failed');
      toast(item ? 'Reward updated' : 'Reward added');
      onSaved();
    } catch (err) { toastError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={item ? 'Edit reward' : 'Add reward'} onClose={onClose}>
      <div className="field">
        <label htmlFor="in">Name</label>
        <input id="in" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="ip">Points required</label>
          <input id="ip" className="input" type="number" value={pointsRequired} onChange={(e) => setPointsRequired(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="id">Discount (points)</label>
          <input id="id" className="input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="idesc">Description</label>
        <textarea id="idesc" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="iimg">Image {item ? '(leave empty to keep current)' : ''}</label>
        <input id="iimg" className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}
