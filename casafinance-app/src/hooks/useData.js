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
