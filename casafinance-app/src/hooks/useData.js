import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// ─── Bills Hook ───
export function useBills() {
  const { user } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBills = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });
    if (!error) setBills(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const addBill = async (bill) => {
    const { data, error } = await supabase
      .from('bills')
      .insert({ ...bill, user_id: user.id })
      .select()
      .single();
    if (!error) setBills(prev => [...prev, data]);
    return { data, error };
  };

  const updateBill = async (id, updates) => {
    const { data, error } = await supabase
      .from('bills')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (!error) setBills(prev => prev.map(b => b.id === id ? data : b));
    return { data, error };
  };

  const deleteBill = async (id) => {
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (!error) setBills(prev => prev.filter(b => b.id !== id));
    return { error };
  };

  return { bills, loading, fetchBills, addBill, updateBill, deleteBill };
}

// ─── Bill Payments Hook ───
export function useBillPayments(month, year) {
  const { user } = useAuth();
  const [payments, setPayments] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bill_payments')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year);
    if (!error) {
      const map = {};
      (data || []).forEach(p => { map[p.bill_id] = p; });
      setPayments(map);
    }
    setLoading(false);
  }, [user, month, year]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const markPaid = async ({ billId, paidDate, accountUsed, amountPaid, note }) => {
    const { data, error } = await supabase
      .from('bill_payments')
      .upsert({
        bill_id: billId,
        user_id: user.id,
        month,
        year,
        paid_date: paidDate,
        amount_paid: amountPaid,
        account_used: accountUsed,
        note: note || '',
      }, {
        onConflict: 'bill_id,user_id,month,year',
      })
      .select()
      .single();
    if (!error) setPayments(prev => ({ ...prev, [billId]: data }));
    return { data, error };
  };

  const undoPayment = async (billId) => {
    const payment = payments[billId];
    if (!payment) return;
    const { error } = await supabase
      .from('bill_payments')
      .delete()
      .eq('id', payment.id)
      .eq('user_id', user.id);
    if (!error) {
      setPayments(prev => {
        const next = { ...prev };
        delete next[billId];
        return next;
      });
    }
    return { error };
  };

  return { payments, loading, fetchPayments, markPaid, undoPayment };
}

// ─── Debt Accounts Hook ───
export function useDebtAccounts() {
  const { user } = useAuth();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDebts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('debt_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });
    if (!error) setDebts(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const updateBalance = async (id, newBalance) => {
    const isEliminated = newBalance <= 0;
    const debt = debts.find(d => d.id === id);
    const paymentAmount = debt ? debt.current_balance - Math.max(0, newBalance) : 0;

    // Update debt account
    const { data, error } = await supabase
      .from('debt_accounts')
      .update({
        current_balance: Math.max(0, newBalance),
        is_eliminated: isEliminated,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    // Log the payment
    if (!error && paymentAmount > 0) {
      await supabase.from('debt_payments').insert({
        debt_account_id: id,
        user_id: user.id,
        payment_date: new Date().toISOString().split('T')[0],
        amount: paymentAmount,
        balance_after: Math.max(0, newBalance),
      });
    }

    if (!error) setDebts(prev => prev.map(d => d.id === id ? data : d));
    return { data, error, isEliminated };
  };

  return { debts, loading, fetchDebts, updateBalance };
}

// ─── AI Summaries Hook ───
export function useAISummaries() {
  const { user } = useAuth();

  const getSummary = async (month, year) => {
    if (!user) return null;
    const { data } = await supabase
      .from('ai_summaries')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .single();
    return data;
  };

  const saveSummary = async (month, year, summaryText) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('ai_summaries')
      .upsert({
        user_id: user.id,
        month,
        year,
        summary_text: summaryText,
      }, {
        onConflict: 'user_id,year,month',
      })
      .select()
      .single();
    return { data, error };
  };

  return { getSummary, saveSummary };
}

// ─── Transactions Hook ───
export function useTransactions(month, year) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endMonth = month === 11 ? 0 : month + 1;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('transaction_date', startDate)
      .lt('transaction_date', endDate)
      .order('transaction_date', { ascending: false });
    if (!error) setTransactions(data || []);
    setLoading(false);
  }, [user, month, year]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const addTransaction = async (txn) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...txn, user_id: user.id })
      .select()
      .single();
    if (!error) setTransactions(prev => [data, ...prev]);
    return { data, error };
  };

  const updateTransaction = async (id, updates) => {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (!error) setTransactions(prev => prev.map(t => t.id === id ? data : t));
    return { data, error };
  };

  const deleteTransaction = async (id) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (!error) setTransactions(prev => prev.filter(t => t.id !== id));
    return { error };
  };

  return { transactions, loading, fetchTransactions, addTransaction, updateTransaction, deleteTransaction };
}

// ─── Account Balances Hook ───
export function useAccountBalances() {
  const { user } = useAuth();
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchBalances = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Get the latest balance for each account
    const { data, error } = await supabase
      .from('account_balances')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) {
      const latest = {};
      (data || []).forEach(row => {
        if (!latest[row.account]) latest[row.account] = row;
      });
      setBalances(latest);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const setBalance = async (account, balance, note = '') => {
    const { data, error } = await supabase
      .from('account_balances')
      .insert({
        user_id: user.id,
        account,
        balance,
        note,
        effective_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();
    if (!error) setBalances(prev => ({ ...prev, [account]: data }));
    return { data, error };
  };

  return { balances, loading, fetchBalances, setBalance };
}

// ─── Spending Alerts Hook ───
export function useSpendingAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('spending_alerts')
      .select('*')
      .eq('user_id', user.id);
    if (!error) {
      const map = {};
      (data || []).forEach(a => { map[a.account] = a; });
      setAlerts(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const setAlert = async (account, threshold) => {
    const existing = alerts[account];
    let result;
    if (existing) {
      result = await supabase
        .from('spending_alerts')
        .update({ threshold, is_active: true })
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('spending_alerts')
        .insert({ user_id: user.id, account, threshold })
        .select()
        .single();
    }
    if (!result.error) setAlerts(prev => ({ ...prev, [account]: result.data }));
    return result;
  };

  const removeAlert = async (account) => {
    const existing = alerts[account];
    if (!existing) return;
    const { error } = await supabase
      .from('spending_alerts')
      .delete()
      .eq('id', existing.id)
      .eq('user_id', user.id);
    if (!error) setAlerts(prev => { const next = { ...prev }; delete next[account]; return next; });
    return { error };
  };

  return { alerts, loading, fetchAlerts, setAlert, removeAlert };
}

// ─── Spending Trends (pure computation, no DB calls) ───
export function computeSpendingTrends(transactions) {
  if (!transactions.length) return { byCategory: [], byDayOfWeek: [], byMerchant: [], dailyAverage: 0 };

  const catMap = {};
  const dowMap = [0, 1, 2, 3, 4, 5, 6].reduce((m, d) => { m[d] = { total: 0, count: 0 }; return m; }, {});
  const merchantMap = {};
  let grandTotal = 0;

  transactions.forEach(t => {
    const amt = parseFloat(t.amount);
    grandTotal += amt;

    // Category
    catMap[t.category] = catMap[t.category] || { total: 0, count: 0 };
    catMap[t.category].total += amt;
    catMap[t.category].count += 1;

    // Day of week
    const dow = new Date(t.transaction_date + 'T12:00:00').getDay();
    dowMap[dow].total += amt;
    dowMap[dow].count += 1;

    // Merchant
    const key = t.merchant.toLowerCase().trim();
    merchantMap[key] = merchantMap[key] || { merchant: t.merchant, total: 0, count: 0 };
    merchantMap[key].total += amt;
    merchantMap[key].count += 1;
  });

  const byCategory = Object.entries(catMap)
    .map(([category, v]) => ({ category, ...v, pct: grandTotal > 0 ? (v.total / grandTotal * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDayOfWeek = Object.entries(dowMap)
    .map(([day, v]) => ({ day: dayNames[day], ...v, avg: v.count > 0 ? v.total / v.count : 0 }));

  const byMerchant = Object.values(merchantMap).sort((a, b) => b.total - a.total).slice(0, 5);

  const dates = [...new Set(transactions.map(t => t.transaction_date))];
  const dailyAverage = dates.length > 0 ? grandTotal / dates.length : 0;

  return { byCategory, byDayOfWeek, byMerchant, dailyAverage, grandTotal };
}
