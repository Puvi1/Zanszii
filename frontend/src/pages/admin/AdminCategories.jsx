import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Download, FileSpreadsheet, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { exportRowsToExcel, exportRowsToPdf } from "@/utils/exportData";

const blank = { name: "", description: "", image_url: "", active: true };
const columns = [
  { label: "Category", value: (x) => x.name },
  { label: "Description", value: (x) => x.description || "" },
  { label: "Status", value: (x) => x.active ? "Active" : "Inactive" },
];

export default function AdminCategories() {
  const [items, setItems] = useState([]); const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false); const [editing, setEditing] = useState(null); const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  const load = async () => { setLoading(true); setError(""); try { const { data } = await api.get("/categories?include_inactive=true"); setItems(data); } catch (e) { setError(formatApiError(e)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const filtered = items.filter((x) => `${x.name} ${x.description || ""}`.toLowerCase().includes(query.toLowerCase()));
  const openCreate = () => { setEditing(null); setForm(blank); setModal(true); };
  const openEdit = (item) => { setEditing(item); setForm({ name:item.name, description:item.description || "", image_url:item.image_url || "", active:item.active !== false }); setModal(true); };
  const save = async (e) => { e.preventDefault(); setSaving(true); setError(""); try { editing ? await api.patch(`/categories/${editing.category_id}`, form) : await api.post("/categories", form); setModal(false); await load(); } catch (err) { setError(formatApiError(err)); } finally { setSaving(false); } };
  const remove = async (item) => { if (!window.confirm(`Delete “${item.name}”?`)) return; try { await api.delete(`/categories/${item.category_id}`); await load(); } catch (e) { setError(formatApiError(e)); } };

  return <div className="admin-page"><div className="page-heading-row"><div><span className="eyebrow">Catalogue setup</span><h1>Categories</h1><p>Simple groups make products easier to find.</p></div><button className="btn btn-primary" onClick={openCreate}><Plus size={18}/> Add category</button></div>
    {error && <div className="alert alert-error">{error}</div>}
    <div className="panel toolbar-panel"><div className="search-field"><Search size={18}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search categories…"/></div><div className="toolbar-actions"><button className="btn btn-ghost" onClick={()=>exportRowsToPdf({rows:filtered,columns,fileName:"zanszii-categories",title:"Zanszii Categories"})}><Download size={17}/> PDF</button><button className="btn btn-ghost" onClick={()=>exportRowsToExcel({rows:filtered,columns,fileName:"zanszii-categories",sheetName:"Categories"})}><FileSpreadsheet size={17}/> Excel</button><button className="icon-btn bordered" onClick={load}><RefreshCw size={18}/></button></div></div>
    <div className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>Category</th><th>Description</th><th>Status</th><th className="actions-col">Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan="4" className="empty-cell">Loading…</td></tr> : filtered.length ? filtered.map(item=><tr key={item.category_id}><td><strong>{item.name}</strong></td><td className="muted-cell">{item.description || "No description"}</td><td><span className={`status-chip ${item.active ? "status-active" : "status-inactive"}`}>{item.active ? "Active" : "Inactive"}</span></td><td><div className="row-actions"><button onClick={()=>openEdit(item)}><Pencil size={17}/></button><button className="danger" onClick={()=>remove(item)}><Trash2 size={17}/></button></div></td></tr>) : <tr><td colSpan="4" className="empty-cell">No categories found.</td></tr>}</tbody></table></div></div>
    {modal && <div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><div><h2>{editing ? "Edit category" : "New category"}</h2><p>Use a short, clear category name.</p></div><button className="icon-btn" onClick={()=>setModal(false)}><X/></button></div><form onSubmit={save} className="modal-form"><label>Name<input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label>Description<textarea rows="4" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></label><label>Image URL<input value={form.image_url} onChange={(e)=>setForm({...form,image_url:e.target.value})} placeholder="https://…"/></label><label className="switch-row"><input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form,active:e.target.checked})}/><span>Active and visible</span></label><div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save category"}</button></div></form></div></div>}
  </div>;
}

