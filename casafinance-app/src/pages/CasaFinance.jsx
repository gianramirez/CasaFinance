import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBills, useBillPayments, useDebtAccounts } from '../hooks/useData';
import { supabase } from '../lib/supabase';

// ─── Color Tokens ───
const C = {
  primary: '#0F6E56', primaryLight: '#e8f5f0',
  accent: '#BA7517', accentLight: '#fdf3e3',
  danger: '#E24B4A', dangerLight: '#fdeaea',
  success: '#1D9E75', successLight: '#e6f7f0',
  bg: '#F5F5F0', card: '#FFFFFF', cardBorder: '#e8e5df',
  text: '#1a1a1a', textSec: '#6b6b6b', textMut: '#9a9a9a',
  gray: '#d1d1d1', grayLight: '#f0eeea',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CAT_ICONS = { Debt: '💳', Utility: '⚡', Phone: '📱', Home: '🏠', Subscription: '📺', Mortgage: '🏡' };
const fmt = (n) => parseFloat(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const today = new Date();
const curMonth = today.getMonth();
const curYear = today.getFullYear();
const curDay = today.getDate();

const MILESTONES = [
  { date: 'May 2026', event: '401k loan arrives — United + Citi paid off', icon: '🎯' },
  { date: 'Jan 2027', event: 'Macy\'s eliminated', icon: '🔥' },
  { date: 'Jun 2027', event: 'Home Depot eliminated', icon: '💪' },
  { date: 'Jun 2028', event: 'Members 1st eliminated', icon: '⭐' },
  { date: 'Mar 2030', event: 'Chase Freedom eliminated — DEBT FREE', icon: '🏆' },
  { date: 'Apr 2031', event: '401k loan fully repaid', icon: '🎉' },
];

function getUrgency(dueDay, isPaid) {
  if (isPaid) return 'paid';
  const diff = dueDay - curDay;
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'dueSoon';
  if (diff <= 7) return 'comingUp';
  return 'upcoming';
}

const URG = {
  overdue: { border: C.danger, label: 'Overdue' },
  dueSoon: { border: C.danger, label: 'Due soon' },
  comingUp: { border: C.accent, label: 'Coming up' },
  upcoming: { border: C.gray, label: 'Upcoming' },
  paid: { border: C.success, label: 'Paid' },
};

// ─── Sub-components ───

function PayModal({ bill, onConfirm, onClose }) {
  const [account, setAccount] = useState(bill.account || 'chase');
  const [note, setNote] = useState('');
  const [paidDate, setPaidDate] = useState(today.toISOString().split('T')[0]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '28px 24px 36px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: C.text }}>Mark as Paid</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.textMut }}>✕</button>
        </div>
        <div style={{ background: C.primaryLight, borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.primary }}>{bill.name}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.primary, marginTop: 4 }}>{fmt(bill.amount)}</div>
        </div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Date paid</label>
        <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 15, marginBottom: 16, boxSizing: 'border-box' }} />
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Payment account</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[['chase', 'Chase'], ['huntington', 'Huntington']].map(([v, l]) => (
            <button key={v} onClick={() => setAccount(v)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${account === v ? C.primary : C.cardBorder}`, background: account === v ? C.primaryLight : C.card, color: account === v ? C.primary : C.textSec, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. paid early" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 15, marginBottom: 24, boxSizing: 'border-box' }} />
        <button onClick={() => onConfirm({ billId: bill.id, paidDate, accountUsed: account, amountPaid: bill.amount, note })} style={{ width: '100%', padding: '14px', borderRadius: 12, background: C.primary, color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 14px ${C.primary}44` }}>
          Confirm Payment
        </button>
      </div>
    </div>
  );
}

function DebtModal({ debt, onConfirm, onClose }) {
  const [newBal, setNewBal] = useState(debt.current_balance.toString());
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '28px 24px 36px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: C.text }}>Update Balance</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.textMut }}>✕</button>
        </div>
        <div style={{ fontSize: 15, color: C.textSec, marginBottom: 4 }}>{debt.name}</div>
        <div style={{ fontSize: 13, color: C.textMut, marginBottom: 16 }}>Current: {fmt(debt.current_balance)}</div>
        <input type="number" value={newBal} onChange={e => setNewBal(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 18, fontWeight: 700, marginBottom: 24, boxSizing: 'border-box' }} />
        <button onClick={() => { const b = parseFloat(newBal); if (!isNaN(b)) onConfirm(debt.id, b); }} style={{ width: '100%', padding: '14px', borderRadius: 12, background: C.primary, color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          Update Balance
        </button>
      </div>
    </div>
  );
}

function Celebration({ cardName, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,110,86,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, flexDirection: 'column', gap: 16 }} onClick={onClose}>
      <div style={{ fontSize: 72 }}>🎉</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', textAlign: 'center' }}>{cardName}</div>
      <div style={{ fontSize: 20, color: '#ffffffcc' }}>ELIMINATED!</div>
      <div style={{ fontSize: 16, color: '#ffffff99', marginTop: 12 }}>Tap to continue</div>
    </div>
  );
}

function EditBillModal({ bill, onConfirm, onClose }) {
  const [amount, setAmount] = useState(bill.amount.toString());
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '28px 24px 36px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: C.text }}>Edit Bill Amount</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.textMut }}>✕</button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.primary, marginBottom: 4 }}>{bill.name}</div>
        <div style={{ fontSize: 13, color: C.textMut, marginBottom: 16 }}>Current: {fmt(bill.amount)}</div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>New amount</label>
        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 18, fontWeight: 700, marginBottom: 24, boxSizing: 'border-box' }} />
        <button onClick={() => { const a = parseFloat(amount); if (!isNaN(a) && a >= 0) onConfirm(bill.id, { amount: a }); }} style={{ width: '100%', padding: '14px', borderRadius: 12, background: C.primary, color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 14px ${C.primary}44` }}>
          Save
        </button>
      </div>
    </div>
  );
}

function BillCard({ bill, payment, onPay, onUndo, onEdit }) {
  const isPaid = !!payment;
  const urg = URG[getUrgency(bill.due_day, isPaid)];

  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.cardBorder}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `4px solid ${urg.border}`, opacity: !bill.is_active ? 0.5 : 1 }}>
      <div style={{ fontSize: 22 }}>{CAT_ICONS[bill.category] || '📄'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bill.name}</div>
        <div style={{ fontSize: 12, color: C.textMut, marginTop: 2 }}>{!bill.is_active ? 'Skipped' : `Due ${MONTHS[curMonth]} ${bill.due_day}`}</div>
        {isPaid && <div style={{ fontSize: 11, color: C.success, marginTop: 2 }}>Paid {payment.paid_date} • {payment.account_used}</div>}
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <button onClick={() => onEdit(bill)} style={{ fontSize: 16, fontWeight: 700, color: isPaid ? C.success : C.text, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{fmt(bill.amount)}</button>
        {bill.is_active && !isPaid && (
          <button onClick={() => onPay(bill)} style={{ padding: '6px 14px', borderRadius: 8, background: C.primary, color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Pay</button>
        )}
        {isPaid && (
          <button onClick={() => onUndo(bill.id)} style={{ padding: '4px 10px', borderRadius: 6, background: 'none', border: `1px solid ${C.gray}`, color: C.textMut, fontSize: 11, cursor: 'pointer' }}>Undo</button>
        )}
      </div>
    </div>
  );
}

function DebtCard({ debt, onUpdate }) {
  const pct = debt.original_balance > 0 ? ((debt.original_balance - debt.current_balance) / debt.original_balance * 100) : 0;
  const interest = (debt.current_balance * (debt.apr / 100)) / 12;
  const phases = { 0: 'Day 1 — Payoff', 1: 'Phase 1', 2: 'Phase 2', 3: 'Phase 3', 4: 'Phase 4' };

  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.cardBorder}`, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      {debt.is_eliminated && <div style={{ position: 'absolute', inset: 0, background: 'rgba(29,158,117,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}><span style={{ fontSize: 48, opacity: 0.3 }}>✓</span></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: debt.is_eliminated ? C.success : C.text }}>{debt.name}</div>
          <div style={{ fontSize: 12, color: C.textMut }}>{debt.issuer}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, background: debt.apr > 25 ? C.dangerLight : C.accentLight, color: debt.apr > 25 ? C.danger : C.accent, padding: '3px 8px', borderRadius: 6 }}>{debt.apr}%</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: debt.is_eliminated ? C.success : C.text, marginBottom: 6 }}>{debt.is_eliminated ? '$0.00' : fmt(debt.current_balance)}</div>
      <div style={{ height: 8, borderRadius: 4, background: C.grayLight, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, background: debt.is_eliminated ? C.success : `linear-gradient(90deg, ${C.primary}, ${C.success})`, width: `${Math.min(pct, 100)}%`, transition: 'width 0.6s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMut }}>
        <span>{pct.toFixed(1)}% paid</span>
        <span style={{ padding: '2px 8px', borderRadius: 4, background: C.grayLight, fontWeight: 600 }}>{phases[debt.attack_phase]}</span>
      </div>
      {!debt.is_eliminated && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 12, color: C.danger }}>~{fmt(interest)}/mo interest</span>
          <button onClick={() => onUpdate(debt)} style={{ padding: '6px 14px', borderRadius: 8, background: C.primaryLight, color: C.primary, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Update</button>
        </div>
      )}
    </div>
  );
}

// ─── Main ───
export default function CasaFinance() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const { bills, loading: billsLoading, updateBill } = useBills();
  const { payments, markPaid, undoPayment } = useBillPayments(curMonth, curYear);
  const { debts, updateBalance, loading: debtsLoading } = useDebtAccounts();
  const [payModal, setPayModal] = useState(null);
  const [debtModal, setDebtModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', text: '¡Hola! I\'m your CasaFinance assistant. I know your bills, debts, and paycheck schedule. Ask me anything!' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages]);

  const handlePay = async (data) => {
    await markPaid(data);
    setPayModal(null);
  };

  const handleEditBill = async (id, updates) => {
    await updateBill(id, updates);
    setEditModal(null);
  };

  const handleDebtUpdate = async (id, newBal) => {
    const { isEliminated } = await updateBalance(id, newBal);
    if (isEliminated) {
      const d = debts.find(x => x.id === id);
      if (d) setCelebration(d.name);
    }
    setDebtModal(null);
  };

  const activeBills = bills.filter(b => b.is_active);
  const pc1 = bills.filter(b => b.paycheck === 1);
  const pc2 = bills.filter(b => b.paycheck === 2);
  const totalDebt = debts.reduce((s, d) => s + parseFloat(d.current_balance || 0), 0);
  const paidCount = activeBills.filter(b => payments[b.id]).length;
  const pc1Total = pc1.filter(b => b.is_active).reduce((s, b) => s + parseFloat(b.amount), 0);
  const pc1Paid = pc1.filter(b => b.is_active && payments[b.id]).reduce((s, b) => s + parseFloat(b.amount), 0);

  // AI chat via serverless function
  const sendAi = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const msg = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text: msg }]);
    setAiLoading(true);

    const context = `Bills paid: ${paidCount}/${activeBills.length}. PC1 remaining: ${fmt(pc1Total - pc1Paid)}. Total debt: ${fmt(totalDebt)}. Debts: ${debts.map(d => `${d.name}: ${fmt(d.current_balance)} at ${d.apr}%${d.is_eliminated ? ' ELIMINATED' : ''}`).join('; ')}`;

    try {
      const resp = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          messages: aiMessages.filter((_, i) => i > 0).concat([{ role: 'user', content: msg }]).map(m => ({ role: m.role, content: m.text || m.content })),
          context,
        }),
      });
      const data = await resp.json();
      setAiMessages(prev => [...prev, { role: 'assistant', text: data.reply || 'Something went wrong. Try again!' }]);
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', text: 'Connection issue — try again in a moment. 💪' }]);
    }
    setAiLoading(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Home', emoji: '🏠' },
    { id: 'bills', label: 'Bills', emoji: '📋' },
    { id: 'debt', label: 'Debt', emoji: '📉' },
    { id: 'ai', label: 'AI', emoji: '🤖' },
  ];

  // ─── DASHBOARD ───
  const Dashboard = () => (
    <div style={{ padding: '20px 16px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 14, color: C.textMut, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>CasaFinance</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 2 }}>{MONTHS[curMonth]} {curYear}</div>
          <div style={{ fontSize: 14, color: C.textSec, marginTop: 4 }}>Hola — {paidCount} of {activeBills.length} bills paid</div>
        </div>
        <button onClick={signOut} style={{ background: 'none', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, color: C.textMut, cursor: 'pointer' }}>Sign out</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ background: C.primary, borderRadius: 14, padding: '16px 14px', color: '#fff' }}>
          <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>Total debt</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{fmt(totalDebt)}</div>
        </div>
        <div style={{ background: C.card, borderRadius: 14, padding: '16px 14px', border: `1px solid ${C.cardBorder}` }}>
          <div style={{ fontSize: 11, color: C.textMut, fontWeight: 600 }}>Bills paid</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.primary, marginTop: 4 }}>{paidCount}/{activeBills.length}</div>
        </div>
      </div>

      {/* PC1 summary */}
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.cardBorder}`, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Paycheck 1 — 1st</div>
        <div style={{ fontSize: 12, color: C.textMut, marginBottom: 10 }}>~$3,075 • All bills + cards</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.textSec }}>
          <span>Total: {fmt(pc1Total)}</span>
          <span style={{ fontWeight: 700, color: pc1Total - pc1Paid > 0 ? C.accent : C.success }}>Left: {fmt(pc1Total - pc1Paid)}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: C.grayLight, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg,${C.primary},${C.success})`, width: `${pc1Total > 0 ? (pc1Paid / pc1Total * 100) : 0}%`, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* PC2 summary */}
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.cardBorder}`, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Paycheck 2 — 15th</div>
            <div style={{ fontSize: 12, color: C.textMut }}>Mortgage $2,925</div>
          </div>
          {pc2.length > 0 && payments[pc2[0]?.id] ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: C.success }}>✓ Paid</span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>$2,925 due</span>
          )}
        </div>
      </div>

      {/* Next milestone */}
      <div style={{ background: `linear-gradient(135deg,${C.primary}18,${C.accent}12)`, borderRadius: 16, padding: 18, border: `1px solid ${C.primary}22` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 8 }}>Next milestone</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{MILESTONES[0].icon} {MILESTONES[0].event}</div>
        <div style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>{MILESTONES[0].date}</div>
      </div>
    </div>
  );

  // ─── BILLS ───
  const Bills = () => (
    <div style={{ padding: '20px 16px 100px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 20 }}>Bills — {MONTHS[curMonth]}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Paycheck 1</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {pc1.sort((a, b) => a.due_day - b.due_day).map(b => (
          <BillCard key={b.id} bill={b} payment={payments[b.id]} onPay={setPayModal} onUndo={async (id) => { await undoPayment(id); }} onEdit={setEditModal} />
        ))}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Paycheck 2</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pc2.map(b => (
          <BillCard key={b.id} bill={b} payment={payments[b.id]} onPay={setPayModal} onUndo={async (id) => { await undoPayment(id); }} onEdit={setEditModal} />
        ))}
      </div>
    </div>
  );

  // ─── DEBT ───
  const Debt = () => (
    <div style={{ padding: '20px 16px 100px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 16 }}>Debt Payoff</div>
      <div style={{ background: `linear-gradient(135deg,${C.primary},#0a5240)`, borderRadius: 16, padding: 20, color: '#fff', marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 600, letterSpacing: 1 }}>TOTAL REMAINING</div>
        <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{fmt(totalDebt)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {debts.sort((a, b) => a.sort_order - b.sort_order).map(d => (
          <DebtCard key={d.id} debt={d} onUpdate={setDebtModal} />
        ))}
      </div>
      {/* 401k */}
      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.cardBorder}`, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>401k Loan</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
          <div><span style={{ color: C.textMut }}>Amount:</span> <strong>$17,000</strong></div>
          <div><span style={{ color: C.textMut }}>Rate:</span> <strong>6.75%</strong></div>
          <div><span style={{ color: C.textMut }}>Payment:</span> <strong>$168.30/2x mo</strong></div>
          <div><span style={{ color: C.textMut }}>Maturity:</span> <strong>Apr 2031</strong></div>
        </div>
      </div>
      {/* Milestones */}
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Milestones</div>
      {MILESTONES.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderLeft: `2px solid ${i === 0 ? C.primary : C.grayLight}`, paddingLeft: 16, marginLeft: 8, position: 'relative' }}>
          <div style={{ position: 'absolute', left: -7, top: 12, width: 12, height: 12, borderRadius: 6, background: i === 0 ? C.primary : C.grayLight, border: `2px solid ${C.bg}` }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? C.primary : C.textSec }}>{m.event}</div>
            <div style={{ fontSize: 12, color: C.textMut }}>{m.date}</div>
          </div>
        </div>
      ))}
    </div>
  );

  // ─── AI ───
  const AI = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)' }}>
      <div style={{ padding: '20px 16px 10px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>AI Assistant</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {aiMessages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '12px 16px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: m.role === 'user' ? C.primary : C.card, color: m.role === 'user' ? '#fff' : C.text, fontSize: 14, lineHeight: 1.5, border: m.role === 'assistant' ? `1px solid ${C.cardBorder}` : 'none' }}>
            {m.text}
          </div>
        ))}
        {aiLoading && <div style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: C.card, border: `1px solid ${C.cardBorder}`, color: C.textMut, fontSize: 14 }}>Thinking...</div>}
        <div ref={chatEndRef} />
      </div>
      <div style={{ padding: '12px 16px 24px', borderTop: `1px solid ${C.cardBorder}`, background: C.bg, display: 'flex', gap: 8 }}>
        <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendAi(); }} placeholder="Ask about your finances..." style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: `1px solid ${C.cardBorder}`, fontSize: 15, background: C.card, outline: 'none' }} />
        <button onClick={sendAi} disabled={aiLoading} style={{ padding: '12px 18px', borderRadius: 12, background: C.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: aiLoading ? 0.6 : 1 }}>Send</button>
      </div>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', maxWidth: 420, margin: '0 auto', fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", position: 'relative' }}>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'bills' && <Bills />}
      {tab === 'debt' && <Debt />}
      {tab === 'ai' && <AI />}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 420, background: C.card, borderTop: `1px solid ${C.cardBorder}`, display: 'flex', justifyContent: 'space-around', padding: '8px 0 20px', zIndex: 100 }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: tab === n.id ? C.primary : C.textMut, padding: '6px 12px', minWidth: 60 }}>
            <span style={{ fontSize: 20 }}>{n.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: tab === n.id ? 700 : 500 }}>{n.label}</span>
          </button>
        ))}
      </div>

      {payModal && <PayModal bill={payModal} onConfirm={handlePay} onClose={() => setPayModal(null)} />}
      {debtModal && <DebtModal debt={debtModal} onConfirm={handleDebtUpdate} onClose={() => setDebtModal(null)} />}
      {editModal && <EditBillModal bill={editModal} onConfirm={handleEditBill} onClose={() => setEditModal(null)} />}
      {celebration && <Celebration cardName={celebration} onClose={() => setCelebration(null)} />}
    </div>
  );
}
