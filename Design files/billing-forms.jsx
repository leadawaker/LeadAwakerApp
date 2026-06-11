// billing-forms.jsx — New Invoice + Add Expense forms (full-pane takeover bodies).
// Shared form primitives (F*). Depends on billing-components.jsx, billing-data.js.

// ─── Form primitives ───────────────────────────────────────────────
function FLabel({ children, req, hint }) {
  return (
    <div className="row" style={{ gap: 7, marginBottom: 7, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700, whiteSpace: 'nowrap' }}>{children}{req && <span style={{ color: 'var(--stage-lost)' }}> *</span>}</span>
      {hint && <span style={{ fontSize: 11, color: 'var(--mute-2)', textTransform: 'none', letterSpacing: 0, fontWeight: 400, whiteSpace: 'nowrap' }}>{hint}</span>}
    </div>
  );
}
const fInputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 'var(--r-surface)', border: 'none',
  background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', color: 'var(--ink)',
  fontFamily: 'var(--sans)', fontSize: 13.5, outline: 'none',
};
function FInput({ value, onChange, placeholder, mono, type = 'text', right }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange && onChange(e.target.value)}
    style={{ ...fInputStyle, fontFamily: mono ? 'var(--mono)' : 'var(--sans)', textAlign: right ? 'right' : 'left' }} />;
}
function FSelect({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={(e) => onChange && onChange(e.target.value)}
        style={{ ...fInputStyle, appearance: 'none', cursor: 'pointer', paddingRight: 34, color: value ? 'var(--ink)' : 'var(--mute-2)' }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: 'var(--mute-2)', pointerEvents: 'none', display: 'flex' }}><BIChevR size={13} /></span>
    </div>
  );
}
function FTextarea({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value} placeholder={placeholder} rows={rows} onChange={(e) => onChange && onChange(e.target.value)}
    style={{ ...fInputStyle, resize: 'vertical', lineHeight: 1.5, minHeight: rows * 22 }} />;
}
// pill segmented (EN/NL/PT, Weekly…, quick dates)
function FSeg({ options, value, onChange, size = 'md' }) {
  return (
    <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
      {options.map(o => {
        const k = o.value ?? o, label = o.label ?? o;
        const on = k === value;
        return (
          <button key={k} type="button" onClick={() => onChange(k)} style={{
            padding: size === 'sm' ? '6px 12px' : '8px 15px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--wine-tint)' : 'var(--surface)', boxShadow: on ? 'inset 0 0 0 1.5px var(--wine)' : 'var(--sh-raised-crisp)',
            color: on ? 'var(--wine)' : 'var(--mute)', fontSize: 12.5, fontWeight: on ? 700 : 500, transition: 'all 120ms',
          }}>{label}</button>
        );
      })}
    </div>
  );
}
// big card choices (deal type / payment account)
function FCardChoice({ options, value, onChange, cols = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
            textAlign: 'left', padding: '13px 15px', borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer',
            background: on ? 'var(--wine-tint)' : 'var(--surface)', boxShadow: on ? 'inset 0 0 0 1.5px var(--wine)' : 'var(--sh-raised-crisp)',
            transition: 'all 120ms',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: on ? 'var(--wine)' : 'var(--ink)' }}>{o.label}</div>
            {o.sub && <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 3, lineHeight: 1.35 }}>{o.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}
function FToggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: 46, height: 26, borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', flexShrink: 0, position: 'relative',
      background: on ? 'var(--good)' : 'var(--bg)', boxShadow: on ? 'none' : 'var(--sh-inset-crisp)', transition: 'background 160ms',
    }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', transition: 'left 160ms' }} />
    </button>
  );
}
function FSection({ children }) {
  return <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)', fontWeight: 700, margin: '8px 0 14px' }}>{children}</div>;
}
function FRow({ children, gap = 16 }) { return <div style={{ display: 'flex', gap, flexWrap: 'wrap' }}>{children}</div>; }
function FCol({ children, flex = 1, w }) { return <div style={{ flex: w ? `0 0 ${w}px` : `1 1 ${flex === 1 ? '0' : flex}`, minWidth: 0 }}>{children}</div>; }

// ─── Form pane chrome (header with X + footer with Cancel/Submit) ──
function FormHead({ title, subtitle, onClose }) {
  return (
    <div style={{ flexShrink: 0, padding: '20px 28px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: 28, color: 'var(--ink)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 4 }}>{subtitle}</div>}
      </div>
      <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 'var(--r-pill)', flexShrink: 0, border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIX size={16} /></button>
    </div>
  );
}
function FormFoot({ onCancel, submitLabel, onSubmit, note }) {
  return (
    <div style={{ flexShrink: 0, padding: '14px 28px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg)' }}>
      {note && <span style={{ fontSize: 11.5, color: 'var(--mute-2)' }}>{note}</span>}
      <div style={{ flex: 1 }} />
      <button onClick={onCancel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--mute)', fontSize: 13, fontWeight: 600, padding: '10px 16px' }}>Cancel</button>
      <button onClick={onSubmit} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 'var(--r-surface)', border: 'none', cursor: 'pointer',
        background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-crisp), inset 0 1px 0 rgba(255,255,255,0.12)',
        color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
      }}><BICheck size={14} />{submitLabel}</button>
    </div>
  );
}

const CLIENT_OPTS = Object.entries(LA_BILLING.clients).map(([value, c]) => ({ value, label: c.name }));

// ═══ NEW INVOICE ═══════════════════════════════════════════════════
function InvoiceForm({ onClose }) {
  const [f, setF] = React.useState({
    title: '', account: '', invNo: 'INV-2026-001', currency: 'EUR', issued: '2026-05-31', due: '',
    items: [{ desc: '', qty: 1, unit: 0 }], tax: 0, discount: 0, notes: '', payRegion: 'EU', payInfo: '',
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const setItem = (i, k, v) => setF(s => ({ ...s, items: s.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }));
  const addItem = () => setF(s => ({ ...s, items: [...s.items, { desc: '', qty: 1, unit: 0 }] }));
  const delItem = (i) => setF(s => ({ ...s, items: s.items.filter((_, j) => j !== i) }));
  const cur = f.currency === 'USD' ? '$' : f.currency === 'BRL' ? 'R$' : '€';
  const sub = f.items.reduce((a, it) => a + (+it.qty || 0) * (+it.unit || 0), 0);
  const disc = +f.discount || 0;
  const taxAmt = (sub - disc) * ((+f.tax || 0) / 100);
  const total = sub - disc + taxAmt;
  const m = (n) => cur + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [more, setMore] = React.useState(false);
  const PAY = { EU: 'N26 · IBAN DE35 1001 1001 2939 5454 81\nAccount holder: Gabriel Barbosa Fronza\nBIC: NTSBDEB1XXX', BR: 'Banco 380 (PicPay)\nAgência 0001 · Conta 12345-6\nPIX: gabriel@leadawaker.com' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <FormHead title="New Invoice" subtitle="Fill in the details below" onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 30px' }}>
        <div style={{ maxWidth: 920 }}>
          <FRow>
            <FCol flex="2"><FLabel>Title</FLabel><FInput value={f.title} onChange={v=>set('title',v)} placeholder="Invoice title" /></FCol>
            <FCol><FLabel>Account</FLabel><FSelect value={f.account} onChange={v=>set('account',v)} options={CLIENT_OPTS} placeholder="Select account" /></FCol>
            <FCol w={140}><FLabel>Invoice #</FLabel><FInput mono value={f.invNo} onChange={v=>set('invNo',v)} /></FCol>
          </FRow>
          <div style={{ height: 18 }} />
          <FRow>
            <FCol><FLabel>Currency</FLabel><FSelect value={f.currency} onChange={v=>set('currency',v)} options={[{value:'EUR',label:'EUR — €'},{value:'USD',label:'USD — $'},{value:'BRL',label:'BRL — R$'}]} /></FCol>
            <FCol><FLabel>Issued</FLabel><FInput type="date" value={f.issued} onChange={v=>set('issued',v)} /></FCol>
            <FCol><div className="row" style={{ justifyContent: 'space-between' }}><FLabel>Due date</FLabel>
              <div className="row" style={{ gap: 5, marginBottom: 7 }}>{[7,15,30,45].map(d => (
                <button key={d} type="button" onClick={()=>{ const dt=new Date(f.issued); dt.setDate(dt.getDate()+d); set('due', dt.toISOString().slice(0,10)); }}
                  style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', color: 'var(--mute)', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600 }}>{d}</button>
              ))}</div></div>
              <FInput type="date" value={f.due} onChange={v=>set('due',v)} /></FCol>
          </FRow>

          {/* line items */}
          <div style={{ height: 24 }} />
          <FLabel>Line items</FLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className="row" style={{ gap: 12, padding: '0 4px' }}>
              <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Description</span>
              <span style={{ width: 60, fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Qty</span>
              <span style={{ width: 90, fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Unit</span>
              <span style={{ width: 100, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Amount</span>
              <span style={{ width: 28 }} />
            </div>
            {f.items.map((it, i) => (
              <div key={i} className="row" style={{ gap: 12 }}>
                <div style={{ flex: 1 }}><FInput value={it.desc} onChange={v=>setItem(i,'desc',v)} placeholder="Description" /></div>
                <div style={{ width: 60 }}><FInput right mono value={it.qty} onChange={v=>setItem(i,'qty',v)} /></div>
                <div style={{ width: 90 }}><FInput right mono value={it.unit} onChange={v=>setItem(i,'unit',v)} /></div>
                <span style={{ width: 100, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>{m((+it.qty||0)*(+it.unit||0))}</span>
                <button type="button" onClick={()=>delItem(i)} disabled={f.items.length===1} style={{ width: 28, height: 28, borderRadius: 'var(--r-button)', border: 'none', cursor: f.items.length===1?'default':'pointer', background: 'transparent', color: f.items.length===1?'var(--mute-2)':'var(--mute)', opacity: f.items.length===1?0.4:1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BITrash size={14} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} className="row" style={{ gap: 7, marginTop: 11, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--wine)', fontSize: 12.5, fontWeight: 600, padding: '4px' }}><BIPlus size={14} />Add line item</button>

          {/* tax/discount + summary */}
          <div style={{ height: 22 }} />
          <FRow gap={24}>
            <FCol>
              <FLabel>Tax %</FLabel><FInput mono value={f.tax} onChange={v=>set('tax',v)} />
              <div style={{ height: 14 }} />
              <FLabel>Discount ({cur})</FLabel><FInput mono value={f.discount} onChange={v=>set('discount',v)} />
            </FCol>
            <FCol>
              <div className="neu-inset" style={{ borderRadius: 'var(--r-surface)', padding: '16px 18px' }}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--mute)', marginBottom: 8 }}><span>Subtotal</span><span style={{ fontFamily: 'var(--mono)' }}>{m(sub)}</span></div>
                {disc > 0 && <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--mute)', marginBottom: 8 }}><span>Discount</span><span style={{ fontFamily: 'var(--mono)' }}>−{m(disc)}</span></div>}
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--mute)', marginBottom: 10 }}><span>Tax ({f.tax||0}%)</span><span style={{ fontFamily: 'var(--mono)' }}>{m(taxAmt)}</span></div>
                <div className="rule" style={{ marginBottom: 10 }} />
                <div className="row" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Total</span><span className="serif" style={{ fontSize: 24, color: 'var(--ink)' }}>{m(total)}</span></div>
              </div>
            </FCol>
          </FRow>

          {/* more fields */}
          <button type="button" onClick={()=>setMore(o=>!o)} className="row" style={{ gap: 7, marginTop: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ display: 'flex', transform: more?'rotate(90deg)':'none', transition: 'transform 160ms' }}><BIChevR size={13} /></span>More fields
          </button>
          {more && (
            <div style={{ marginTop: 16 }}>
              <FLabel>Notes</FLabel><FTextarea value={f.notes} onChange={v=>set('notes',v)} placeholder="Additional notes for the client…" />
              <div style={{ height: 18 }} />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <FLabel>Payment info</FLabel>
                <div className="row" style={{ gap: 6, marginBottom: 7 }}>
                  {['EU','BR'].map(r => { const on=f.payRegion===r; return (
                    <button key={r} type="button" onClick={()=>{ set('payRegion',r); set('payInfo', PAY[r]); }} style={{ padding: '4px 11px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', background: on?'var(--wine-tint)':'var(--surface)', boxShadow: on?'inset 0 0 0 1.5px var(--wine)':'var(--sh-raised-crisp)', color: on?'var(--wine)':'var(--mute)', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700 }}>{r}</button>
                  ); })}
                </div>
              </div>
              <FTextarea value={f.payInfo} onChange={v=>set('payInfo',v)} placeholder="Bank details, payment instructions…" rows={4} />
              <div style={{ fontSize: 11, color: 'var(--mute-2)', marginTop: 6 }}>Presets auto-fill your bank details. You can edit them freely.</div>
            </div>
          )}
        </div>
      </div>
      <FormFoot onCancel={onClose} onSubmit={onClose} submitLabel="Create invoice" />
    </div>
  );
}

// ═══ ADD EXPENSE ═══════════════════════════════════════════════════
function ExpenseForm({ onClose }) {
  const [f, setF] = React.useState({ date: '', supplier: '', country: '', invNo: '', desc: '', currency: 'EUR', vat: '21', excl: '', vatAmt: '', total: '', ded: false, notes: '' });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const [drag, setDrag] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [file, setFile] = React.useState(null);

  // auto-calc VAT amount + total from excl + vat%
  React.useEffect(() => {
    const e = parseFloat(f.excl), v = parseFloat(f.vat);
    if (!isNaN(e) && !isNaN(v)) { const va = Math.round(e * v) / 100; set('vatAmt', va.toFixed(2)); set('total', (e + va).toFixed(2)); }
  }, [f.excl, f.vat]);

  const fakeProcess = () => { setProcessing(true); setTimeout(() => {
    setProcessing(false);
    setF({ date: '2026-03-23', supplier: 'Anthropic, PBC', country: 'NL', invNo: 'K760GGPT-0011', desc: 'Claude Max plan — 5x', currency: 'EUR', vat: '21', excl: '90.00', vatAmt: '18.90', total: '108.90', ded: true, notes: 'Anthropic charges NL VAT.' });
  }, 1400); };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <FormHead title="Add Expense" subtitle='Upload a PDF, then click "Process with AI" — or fill in manually' onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 30px' }}>
        <div style={{ maxWidth: 900 }}>
          {/* PDF drop */}
          <FLabel>PDF invoice</FLabel>
          <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);setFile('invoice.pdf');}}
            onClick={()=>setFile('invoice.pdf')} style={{
            borderRadius: 'var(--r-card)', padding: '30px 20px', textAlign: 'center', cursor: 'pointer',
            background: drag ? 'var(--wine-tint)' : 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)',
            border: `1.5px dashed ${drag ? 'var(--wine)' : 'var(--line)'}`, transition: 'all 140ms',
          }}>
            {file ? (
              <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
                <span style={{ width: 38, height: 46, borderRadius: 'var(--r-button)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BIInvoice size={19} /></span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{file}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', marginTop: 2 }}>Ready to process</div>
                </div>
              </div>
            ) : (
              <><div style={{ color: 'var(--mute-2)', display: 'flex', justifyContent: 'center', marginBottom: 10 }}><BIUpload size={24} /></div>
              <div style={{ fontSize: 13, color: 'var(--mute)' }}>Drop PDF here, or click to upload</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', marginTop: 4 }}>max 10 MB</div></>
            )}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            <button type="button" onClick={fakeProcess} disabled={!file || processing} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 'var(--r-surface)', border: 'none', cursor: file && !processing ? 'pointer' : 'default',
              background: file && !processing ? 'var(--wine-grad)' : 'var(--surface)',
              boxShadow: file && !processing ? 'var(--sh-raised-crisp), inset 0 1px 0 rgba(255,255,255,0.12)' : 'var(--sh-raised-crisp)',
              color: file && !processing ? 'var(--paper)' : 'var(--mute-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700,
            }}>{processing ? 'Processing…' : '✦ Process with AI'}</button>
            {processing && <span style={{ fontSize: 12, color: 'var(--mute)' }}>Reading supplier, amounts &amp; VAT…</span>}
          </div>

          <div style={{ height: 26 }} />
          <FRow><FCol w={200}><FLabel req>Date</FLabel><FInput type="date" value={f.date} onChange={v=>set('date',v)} /></FCol></FRow>
          <div style={{ height: 16 }} />
          <FRow>
            <FCol flex="2"><FLabel req>Supplier</FLabel><FInput value={f.supplier} onChange={v=>set('supplier',v)} placeholder="Anthropic PBC" /></FCol>
            <FCol><FLabel>Country</FLabel><FInput value={f.country} onChange={v=>set('country',v)} placeholder="US" /></FCol>
          </FRow>
          <div style={{ height: 16 }} />
          <FRow><FCol><FLabel>Invoice number</FLabel><FInput mono value={f.invNo} onChange={v=>set('invNo',v)} placeholder="INV-2026-001" /></FCol></FRow>
          <div style={{ height: 16 }} />
          <FRow><FCol><FLabel>Description</FLabel><FInput value={f.desc} onChange={v=>set('desc',v)} placeholder="Brief description of item / service" /></FCol></FRow>

          <div style={{ height: 26 }} />
          <FSection>Amounts</FSection>
          <FRow>
            <FCol><FLabel>Currency</FLabel><FSelect value={f.currency} onChange={v=>set('currency',v)} options={[{value:'EUR',label:'EUR — €'},{value:'USD',label:'USD — $'},{value:'BRL',label:'BRL — R$'}]} /></FCol>
            <FCol><FLabel>VAT %</FLabel><FInput mono value={f.vat} onChange={v=>set('vat',v)} /></FCol>
          </FRow>
          <div style={{ height: 16 }} />
          <FRow>
            <FCol><FLabel>Excl. VAT</FLabel><FInput mono value={f.excl} onChange={v=>set('excl',v)} placeholder="0.00" /></FCol>
            <FCol><FLabel>VAT amount</FLabel><FInput mono value={f.vatAmt} onChange={v=>set('vatAmt',v)} placeholder="0.00" /></FCol>
          </FRow>
          <div style={{ height: 16 }} />
          <FRow><FCol><FLabel>Total amount</FLabel><FInput mono value={f.total} onChange={v=>set('total',v)} placeholder="0.00" /></FCol></FRow>

          <div style={{ height: 26 }} />
          <FSection>Tax</FSection>
          <div className="row" style={{ justifyContent: 'space-between', gap: 14, padding: '14px 16px', borderRadius: 'var(--r-surface)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>NL BTW Deductible</div>
              <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 2 }}>VAT reclaimable as voorbelasting on BTW return</div>
            </div>
            <FToggle on={f.ded} onChange={v=>set('ded',v)} />
          </div>
          <div style={{ height: 22 }} />
          <FLabel>Notes</FLabel><FTextarea value={f.notes} onChange={v=>set('notes',v)} placeholder="e.g. US company — no EU VAT charged. Pre-start expense for Q1 2026." rows={3} />
        </div>
      </div>
      <FormFoot onCancel={onClose} onSubmit={onClose} submitLabel="Save expense" />
    </div>
  );
}

Object.assign(window, {
  FLabel, FInput, FSelect, FTextarea, FSeg, FCardChoice, FToggle, FSection, FRow, FCol, fInputStyle,
  FormHead, FormFoot, CLIENT_OPTS, InvoiceForm, ExpenseForm,
});
