import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useBills, useBillPayments, useDebtAccounts, useTransactions, useAccountBalances, useSpendingAlerts, computeSpendingTrends } from '../hooks/useData';
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
const SPEND_ICONS = { Groceries: '🛒', Dining: '🍽️', Gas: '⛽', Shopping: '🛍️', Entertainment: '🎬', Transportation: '🚗', Health: '💊', Home: '🏠', Utilities: '⚡', Subscription: '📺', Other: '📄' };
const SPEND_CATEGORIES = ['Groceries', 'Dining', 'Gas', 'Shopping', 'Entertainment', 'Transportation', 'Health', 'Home', 'Utilities', 'Subscription', 'Other'];
const CAT_COLORS = { Groceries: '#2D9CDB', Dining: '#F2994A', Gas: '#6FCF97', Shopping: '#BB6BD9', Entertainment: '#EB5757', Transportation: '#56CCF2', Health: '#27AE60', Home: '#F2C94C', Utilities: '#219653', Subscription: '#9B51E0', Other: '#828282' };
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

function TransactionModal({ initial, onConfirm, onClose }) {
  const [merchant, setMerchant] = useState(initial?.merchant || '');
  const [amount, setAmount] = useState(initial?.amount?.toString() || '');
  const [date, setDate] = useState(initial?.date || today.toISOString().split('T')[0]);
  const [category, setCategory] = useState(initial?.category || 'Other');
  const [account, setAccount] = useState(initial?.account || 'huntington');
  const [note, setNote] = useState(initial?.note || '');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '28px 24px 36px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: C.text }}>{initial?.id ? 'Edit Transaction' : 'Add Transaction'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.textMut }}>✕</button>
        </div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Merchant</label>
        <input value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="e.g. Walmart, Chipotle" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 15, marginBottom: 14, boxSizing: 'border-box' }} />
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Amount</label>
        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 15, marginBottom: 14, boxSizing: 'border-box' }} />
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 15, marginBottom: 14, boxSizing: 'border-box' }} />
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 15, marginBottom: 14, boxSizing: 'border-box', background: C.card }}>
          {SPEND_CATEGORIES.map(c => <option key={c} value={c}>{SPEND_ICONS[c]} {c}</option>)}
        </select>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Account</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {[['huntington', 'Huntington'], ['chase', 'Chase']].map(([v, l]) => (
            <button key={v} onClick={() => setAccount(v)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${account === v ? C.primary : C.cardBorder}`, background: account === v ? C.primaryLight : C.card, color: account === v ? C.primary : C.textSec, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. weekly groceries" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 15, marginBottom: 20, boxSizing: 'border-box' }} />
        <button onClick={() => {
          const a = parseFloat(amount);
          if (!merchant.trim() || isNaN(a) || a <= 0) return;
          onConfirm({ id: initial?.id, merchant: merchant.trim(), amount: a, transaction_date: date, category, account, note, receipt_image_path: initial?.receipt_image_path, ai_extracted: initial?.ai_extracted || false });
        }} style={{ width: '100%', padding: '14px', borderRadius: 12, background: C.primary, color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 14px ${C.primary}44` }}>
          {initial?.id ? 'Save Changes' : 'Add Transaction'}
        </button>
      </div>
    </div>
  );
}

function SetBalanceModal({ current, onConfirm, onClose }) {
  const [account, setAccount] = useState('huntington');
  const [balance, setBalance] = useState('');
  const [note, setNote] = useState('');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '28px 24px 36px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: C.text }}>Set Balance</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.textMut }}>✕</button>
        </div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Account</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[['huntington', 'Huntington'], ['chase', 'Chase']].map(([v, l]) => (
            <button key={v} onClick={() => setAccount(v)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${account === v ? C.primary : C.cardBorder}`, background: account === v ? C.primaryLight : C.card, color: account === v ? C.primary : C.textSec, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        {current[account] && <div style={{ fontSize: 13, color: C.textMut, marginBottom: 12 }}>Current: {fmt(current[account].balance)} (set {current[account].effective_date})</div>}
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>New balance</label>
        <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 18, fontWeight: 700, marginBottom: 14, boxSizing: 'border-box' }} />
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paycheck 1 deposit" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 15, marginBottom: 20, boxSizing: 'border-box' }} />
        <button onClick={() => { const b = parseFloat(balance); if (!isNaN(b) && b >= 0) onConfirm(account, b, note); }} style={{ width: '100%', padding: '14px', borderRadius: 12, background: C.primary, color: '#fff', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          Set Balance
        </button>
      </div>
    </div>
  );
}

function AlertConfigModal({ alerts, onSave, onRemove, onClose }) {
  const [account, setAccount] = useState('huntington');
  const [threshold, setThreshold] = useState(alerts?.huntington?.threshold?.toString() || '200');

  const handleAccountChange = (acc) => {
    setAccount(acc);
    setThreshold(alerts?.[acc]?.threshold?.toString() || '200');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 420, padding: '28px 24px 36px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: C.text }}>Spending Alerts</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.textMut }}>✕</button>
        </div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Account</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[['huntington', 'Huntington'], ['chase', 'Chase']].map(([v, l]) => (
            <button key={v} onClick={() => handleAccountChange(v)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${account === v ? C.primary : C.cardBorder}`, background: account === v ? C.primaryLight : C.card, color: account === v ? C.primary : C.textSec, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Alert when balance drops below</label>
        <input type="number" step="50" value={threshold} onChange={e => setThreshold(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, fontSize: 18, fontWeight: 700, marginBottom: 20, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          {alerts?.[account] && (
            <button onClick={() => { onRemove(account); onClose(); }} style={{ flex: 1, padding: '14px', borderRadius: 12, background: C.dangerLight, color: C.danger, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Remove Alert
            </button>
          )}
          <button onClick={() => { const t = parseFloat(threshold); if (!isNaN(t) && t > 0) { onSave(account, t); onClose(); } }} style={{ flex: 1, padding: '14px', borderRadius: 12, background: C.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Save Alert
          </button>
        </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: isPaid ? C.success : C.text }}>{fmt(bill.amount)}</div>
          <button onClick={() => onEdit(bill)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: 13, color: C.textMut }}>✏️</button>
        </div>
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
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions(curMonth, curYear);
  const { balances, setBalance: setAccountBalance } = useAccountBalances();
  const { alerts: spendingAlerts, setAlert: setSpendingAlert, removeAlert: removeSpendingAlert } = useSpendingAlerts();
  const [payModal, setPayModal] = useState(null);
  const [debtModal, setDebtModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [txnModal, setTxnModal] = useState(null);
  const [balanceModal, setBalanceModal] = useState(false);
  const [alertModal, setAlertModal] = useState(false);
  const [receiptProcessing, setReceiptProcessing] = useState(false);
  const [spendCatFilter, setSpendCatFilter] = useState('All');
  const [showTrends, setShowTrends] = useState(false);
  const receiptInputRef = useRef(null);
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

  // Receipt upload handler
  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptProcessing(true);

    try {
      // Convert to base64
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
      });

      // Upload to Supabase Storage
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      await supabase.storage.from('receipts').upload(path, file);

      // Process with Claude vision
      const session = await supabase.auth.getSession();
      const resp = await fetch('/api/process-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type || 'image/jpeg' }),
      });
      const result = await resp.json();
      const extracted = result.data || {};

      setTxnModal({
        merchant: extracted.merchant || '',
        amount: extracted.amount || '',
        date: extracted.date || today.toISOString().split('T')[0],
        category: extracted.category || 'Other',
        account: 'huntington',
        receipt_image_path: path,
        ai_extracted: true,
      });
    } catch (err) {
      console.error('Receipt processing failed:', err);
      setTxnModal({ account: 'huntington', ai_extracted: false });
    }
    setReceiptProcessing(false);
    if (receiptInputRef.current) receiptInputRef.current.value = '';
  };

  // Transaction save handler
  const handleSaveTransaction = async (txn) => {
    if (txn.id) {
      const { id, ...updates } = txn;
      await updateTransaction(id, updates);
    } else {
      await addTransaction(txn);
    }
    setTxnModal(null);
  };

  // Computed available balances
  const getAvailableBalance = (account) => {
    const latest = balances[account];
    if (!latest) return null;
    const baseBalance = parseFloat(latest.balance);
    const effectiveDate = latest.effective_date;

    const txnSpent = transactions
      .filter(t => t.account === account && t.transaction_date >= effectiveDate)
      .reduce((s, t) => s + parseFloat(t.amount), 0);

    const billSpent = Object.values(payments)
      .filter(p => p.account_used === account && p.paid_date >= effectiveDate)
      .reduce((s, p) => s + parseFloat(p.amount_paid), 0);

    return baseBalance - txnSpent - billSpent;
  };

  const chaseAvailable = getAvailableBalance('chase');
  const huntingtonAvailable = getAvailableBalance('huntington');
  const trends = computeSpendingTrends(transactions);

  // Alert checks
  const getAlertStatus = (account, available) => {
    const alert = spendingAlerts[account];
    if (!alert || !alert.is_active || available === null) return null;
    if (available <= alert.threshold) return 'danger';
    if (available <= alert.threshold * 1.5) return 'warning';
    return null;
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

    const topCats = trends.byCategory.slice(0, 3).map(c => `${c.category}: ${fmt(c.total)}`).join(', ');
    const peakDay = trends.byDayOfWeek.reduce((max, d) => d.total > max.total ? d : max, { day: 'N/A', total: 0 });
    const context = `Bills paid: ${paidCount}/${activeBills.length}. PC1 remaining: ${fmt(pc1Total - pc1Paid)}. Total debt: ${fmt(totalDebt)}. Debts: ${debts.map(d => `${d.name}: ${fmt(d.current_balance)} at ${d.apr}%${d.is_eliminated ? ' ELIMINATED' : ''}`).join('; ')}. Chase balance: ${chaseAvailable !== null ? fmt(chaseAvailable) : 'not set'}. Huntington balance: ${huntingtonAvailable !== null ? fmt(huntingtonAvailable) : 'not set'}. This month: ${fmt(trends.grandTotal || 0)} spent across ${transactions.length} transactions. Top categories: ${topCats || 'none yet'}. Peak spending day: ${peakDay.day}.`;

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
    { id: 'spending', label: 'Spending', emoji: '🧾' },
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

      {/* Account Balances */}
      {(chaseAvailable !== null || huntingtonAvailable !== null) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: C.card, borderRadius: 14, padding: '14px 14px', border: `1px solid ${getAlertStatus('chase', chaseAvailable) === 'danger' ? C.danger : getAlertStatus('chase', chaseAvailable) === 'warning' ? C.accent : C.cardBorder}` }}>
            <div style={{ fontSize: 11, color: C.textMut, fontWeight: 600 }}>Chase</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: getAlertStatus('chase', chaseAvailable) === 'danger' ? C.danger : getAlertStatus('chase', chaseAvailable) === 'warning' ? C.accent : C.primary, marginTop: 4 }}>{chaseAvailable !== null ? fmt(chaseAvailable) : '—'}</div>
          </div>
          <div style={{ background: C.card, borderRadius: 14, padding: '14px 14px', border: `1px solid ${getAlertStatus('huntington', huntingtonAvailable) === 'danger' ? C.danger : getAlertStatus('huntington', huntingtonAvailable) === 'warning' ? C.accent : C.cardBorder}` }}>
            <div style={{ fontSize: 11, color: C.textMut, fontWeight: 600 }}>Huntington</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: getAlertStatus('huntington', huntingtonAvailable) === 'danger' ? C.danger : getAlertStatus('huntington', huntingtonAvailable) === 'warning' ? C.accent : C.primary, marginTop: 4 }}>{huntingtonAvailable !== null ? fmt(huntingtonAvailable) : '—'}</div>
          </div>
        </div>
      )}

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

  // ─── SPENDING ───
  const filteredTxns = spendCatFilter === 'All' ? transactions : transactions.filter(t => t.category === spendCatFilter);
  const groupedTxns = filteredTxns.reduce((groups, t) => {
    const d = t.transaction_date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(t);
    return groups;
  }, {});

  const Spending = () => (
    <div style={{ padding: '20px 16px 100px' }}>
      {/* Alert Banner */}
      {['huntington', 'chase'].map(acc => {
        const avail = acc === 'huntington' ? huntingtonAvailable : chaseAvailable;
        const status = getAlertStatus(acc, avail);
        if (status !== 'danger') return null;
        return (
          <div key={acc} style={{ background: C.danger, borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
              {acc.charAt(0).toUpperCase() + acc.slice(1)} balance is low: {fmt(avail)} remaining
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>Spending</div>
        <button onClick={() => setAlertModal(true)} style={{ background: 'none', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '6px 10px', fontSize: 16, cursor: 'pointer' }}>⚙️</button>
      </div>

      {/* Balance Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[['chase', 'Chase', chaseAvailable], ['huntington', 'Huntington', huntingtonAvailable]].map(([acc, label, avail]) => {
          const status = getAlertStatus(acc, avail);
          return (
            <div key={acc} onClick={() => setBalanceModal(true)} style={{ background: status === 'danger' ? C.dangerLight : status === 'warning' ? C.accentLight : C.primaryLight, borderRadius: 14, padding: '14px', cursor: 'pointer', border: `1px solid ${status === 'danger' ? C.danger + '44' : status === 'warning' ? C.accent + '44' : C.primary + '22'}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textMut }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: status === 'danger' ? C.danger : status === 'warning' ? C.accent : C.primary, marginTop: 4 }}>
                {avail !== null ? fmt(avail) : 'Set balance'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input ref={receiptInputRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptUpload} style={{ display: 'none' }} />
        <button onClick={() => receiptInputRef.current?.click()} disabled={receiptProcessing} style={{ flex: 1, padding: '12px', borderRadius: 12, background: C.primary, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: receiptProcessing ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {receiptProcessing ? '🔄 Processing...' : '📷 Add Receipt'}
        </button>
        <button onClick={() => setTxnModal({ account: 'huntington' })} style={{ flex: 1, padding: '12px', borderRadius: 12, background: C.card, color: C.primary, border: `2px solid ${C.primary}`, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          + Manual Entry
        </button>
      </div>

      {/* Monthly Summary */}
      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.cardBorder}`, padding: '14px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: C.textMut, fontWeight: 600 }}>This month</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{fmt(trends.grandTotal || 0)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: C.textMut }}>{transactions.length} transactions</div>
          <div style={{ fontSize: 12, color: C.textSec }}>~{fmt(trends.dailyAverage || 0)}/day avg</div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {['All', ...SPEND_CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setSpendCatFilter(cat)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${spendCatFilter === cat ? C.primary : C.cardBorder}`, background: spendCatFilter === cat ? C.primaryLight : C.card, color: spendCatFilter === cat ? C.primary : C.textSec, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {cat !== 'All' && SPEND_ICONS[cat]} {cat}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      {Object.keys(groupedTxns).length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMut }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No transactions yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Upload a receipt or add a manual entry</div>
        </div>
      )}
      {Object.entries(groupedTxns).sort(([a], [b]) => b.localeCompare(a)).map(([date, txns]) => (
        <div key={date} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMut, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {txns.map(t => (
              <div key={t.id} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.cardBorder}`, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{SPEND_ICONS[t.category] || '📄'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.merchant}</div>
                  <div style={{ fontSize: 11, color: C.textMut, marginTop: 2 }}>
                    {t.category} • {t.account}{t.ai_extracted ? ' • AI' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{fmt(t.amount)}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button onClick={() => setTxnModal(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.textMut, padding: 0 }}>✏️</button>
                    <button onClick={() => deleteTransaction(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.textMut, padding: 0 }}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Trends Section */}
      {transactions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowTrends(!showTrends)} style={{ width: '100%', padding: '14px 16px', borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>📊 Trends & Patterns</span>
            <span style={{ fontSize: 16, color: C.textMut }}>{showTrends ? '▲' : '▼'}</span>
          </button>
          {showTrends && (
            <div style={{ background: C.card, borderRadius: '0 0 14px 14px', border: `1px solid ${C.cardBorder}`, borderTop: 'none', padding: '16px' }}>
              {/* Category Breakdown */}
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>By Category</div>
              {trends.byCategory.map(c => (
                <div key={c.category} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textSec, marginBottom: 3 }}>
                    <span>{SPEND_ICONS[c.category]} {c.category}</span>
                    <span>{fmt(c.total)} ({c.pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.grayLight, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: CAT_COLORS[c.category] || C.primary, width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}

              {/* Day of Week */}
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 20, marginBottom: 10 }}>By Day of Week</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 80, gap: 4 }}>
                {trends.byDayOfWeek.map(d => {
                  const maxTotal = Math.max(...trends.byDayOfWeek.map(x => x.total));
                  const h = maxTotal > 0 ? (d.total / maxTotal * 60) : 0;
                  const isPeak = d.total === maxTotal && d.total > 0;
                  return (
                    <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 10, color: C.textMut, fontWeight: 600 }}>{fmt(d.total)}</div>
                      <div style={{ width: '100%', height: h, borderRadius: 4, background: isPeak ? C.accent : C.primary + '66' }} />
                      <div style={{ fontSize: 10, color: isPeak ? C.accent : C.textMut, fontWeight: isPeak ? 700 : 500 }}>{d.day}</div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const peak = trends.byDayOfWeek.reduce((max, d) => d.total > max.total ? d : max, { day: 'N/A', total: 0 });
                return peak.total > 0 ? (
                  <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, textAlign: 'center', marginTop: 8 }}>
                    You spend the most on {peak.day}s
                  </div>
                ) : null;
              })()}

              {/* Top Merchants */}
              {trends.byMerchant.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 20, marginBottom: 10 }}>Top Merchants</div>
                  {trends.byMerchant.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: `1px solid ${C.grayLight}` }}>
                      <span style={{ color: C.textSec }}>{m.merchant}</span>
                      <span style={{ fontWeight: 600, color: C.text }}>{fmt(m.total)} <span style={{ color: C.textMut, fontWeight: 400 }}>({m.count}x)</span></span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
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
      {tab === 'spending' && <Spending />}
      {tab === 'debt' && <Debt />}
      {tab === 'ai' && <AI />}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 420, background: C.card, borderTop: `1px solid ${C.cardBorder}`, display: 'flex', justifyContent: 'space-around', padding: '8px 0 20px', zIndex: 100 }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: tab === n.id ? C.primary : C.textMut, padding: '6px 8px', minWidth: 48 }}>
            <span style={{ fontSize: 20 }}>{n.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: tab === n.id ? 700 : 500 }}>{n.label}</span>
          </button>
        ))}
      </div>

      {payModal && <PayModal bill={payModal} onConfirm={handlePay} onClose={() => setPayModal(null)} />}
      {debtModal && <DebtModal debt={debtModal} onConfirm={handleDebtUpdate} onClose={() => setDebtModal(null)} />}
      {editModal && <EditBillModal bill={editModal} onConfirm={handleEditBill} onClose={() => setEditModal(null)} />}
      {celebration && <Celebration cardName={celebration} onClose={() => setCelebration(null)} />}
      {txnModal && <TransactionModal initial={txnModal} onConfirm={handleSaveTransaction} onClose={() => setTxnModal(null)} />}
      {balanceModal && <SetBalanceModal current={balances} onConfirm={async (acc, bal, note) => { await setAccountBalance(acc, bal, note); setBalanceModal(false); }} onClose={() => setBalanceModal(false)} />}
      {alertModal && <AlertConfigModal alerts={spendingAlerts} onSave={setSpendingAlert} onRemove={removeSpendingAlert} onClose={() => setAlertModal(false)} />}
    </div>
  );
}
