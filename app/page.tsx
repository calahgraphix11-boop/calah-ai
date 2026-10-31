"use client";

import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, BookOpen, BriefcaseBusiness,
  CalendarDays, Camera, Check, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardList,
  Clock3, CreditCard, Download, Dumbbell, FileImage, Filter, Flag, GraduationCap, LayoutDashboard,
  Lock, LogOut, Menu, MoreHorizontal, Plus, RefreshCw, Search, Settings2, ShieldCheck,
  Sparkles, Target, TrendingDown, TrendingUp, Wallet, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import { FormEvent, useEffect, useMemo, useState, type ElementType } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Screen = "overview" | "goals" | "income" | "finance" | "tasks" | "projects" | "trading" | "analytics" | "settings";
type Currency = "USD" | "XAF" | "EUR";
type Profile = {
  id: string; full_name: string; base_currency: Currency; xaf_per_usd: number; eur_to_usd: number;
  monthly_profit_target_usd: number; timezone: string; theme: "dark" | "light" | "system"; accent: string;
};
type Income = {
  id: string; title: string; source: string; category: string; amount: number; currency: Currency;
  amount_usd: number; status: "collected" | "pending" | "refunded"; received_on: string; note: string;
};
type Expense = {
  id: string; title: string; category: string; amount: number; currency: Currency; amount_usd: number;
  spent_on: string; note: string;
};
type Goal = { id: string; title: string; area: string; target: number; current: number; unit: string; due_date: string | null; status: string; accent: string };
type Task = { id: string; title: string; area: string; due_date: string; priority: string; completed: boolean };
type Project = { id: string; slug: string; name: string; description: string; area: string; status: string; target_label: string; target: number; current: number; accent: string };
type Trade = {
  id: string; instrument: string; direction: "buy" | "sell"; setup: string; result: "win" | "loss" | "breakeven" | "open";
  pnl: number; currency: Currency; pnl_usd: number; risk_percent: number | null; reward_risk: number | null;
  entry_price: number | null; exit_price: number | null; opened_at: string; closed_at: string | null;
  notes: string; screenshots: string[]; screenshotUrls?: string[];
};
type Toast = { text: string; kind?: "success" | "error" };

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toLocaleDateString("en", { month: "long", year: "numeric" });
const projectDefaults = [
  { slug: "prime-study", name: "Prime Study App", description: "Education platform for Cameroonian university students. Focus: finalize the experience and grow paying users.", area: "Product", status: "active", target_label: "Paying users", target: 10, current: 0, accent: "violet" },
  { slug: "primeflow", name: "PrimeFlow", description: "Beauty-business system. Run one WhatsApp TV validation test, then decide whether to continue or pause.", area: "Business", status: "testing", target_label: "Validation test", target: 1, current: 0, accent: "rose" },
  { slug: "clientflow", name: "ClientFlow", description: "Wedding photographer workflow product and $49 email funnel. Audit, launch and measure sales.", area: "Digital product", status: "active", target_label: "Sales", target: 5, current: 0, accent: "blue" }
];
const defaultGoals = [
  { title: "$5,000 net profit", area: "Financial", target: 5000, current: 0, unit: "USD", due_date: "2026-11-30", status: "active", accent: "gold" },
  { title: "Gym consistency", area: "Fitness", target: 20, current: 0, unit: "workouts", due_date: "2026-11-30", status: "active", accent: "green" },
  { title: "Stay on track at school", area: "Education", target: 20, current: 0, unit: "study sessions", due_date: "2026-11-30", status: "active", accent: "blue" }
];
const nav = [
  { id: "overview" as Screen, label: "Overview", icon: LayoutDashboard, group: "Workspace" },
  { id: "goals" as Screen, label: "Goals", icon: Target, group: "Workspace" },
  { id: "tasks" as Screen, label: "Tasks", icon: ClipboardList, group: "Workspace" },
  { id: "income" as Screen, label: "Income log", icon: CircleDollarSign, group: "Money" },
  { id: "finance" as Screen, label: "Finance", icon: Wallet, group: "Money" },
  { id: "analytics" as Screen, label: "Analytics", icon: BarChart3, group: "Money" },
  { id: "projects" as Screen, label: "Projects", icon: BriefcaseBusiness, group: "Focus areas" },
  { id: "trading" as Screen, label: "Trading journal", icon: Activity, group: "Focus areas" },
  { id: "settings" as Screen, label: "Settings", icon: Settings2, group: "Account" }
];
const blankProfile = (id: string): Profile => ({
  id, full_name: "", base_currency: "XAF", xaf_per_usd: 600, eur_to_usd: 1.08,
  monthly_profit_target_usd: 5000, timezone: "Africa/Douala", theme: "dark", accent: "gold"
});
const money = (value: number, currency: Currency = "USD") => new Intl.NumberFormat("en", {
  style: "currency", currency, maximumFractionDigits: currency === "XAF" ? 0 : 2
}).format(Number.isFinite(value) ? value : 0);
const usdFrom = (amount: number, currency: Currency, profile: Profile) =>
  currency === "USD" ? amount : currency === "XAF" ? amount / Math.max(1, profile.xaf_per_usd) : amount * profile.eur_to_usd;
const cleanNumber = (v: string) => Number(v || 0);
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() || "").join("") || "C";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [booting, setBooting] = useState(true);
  const [working, setWorking] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [dataError, setDataError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [settingsTab, setSettingsTab] = useState("Profile");
  const [incomeFilter, setIncomeFilter] = useState("all");
  const [tradeFiles, setTradeFiles] = useState<File[]>([]);
  const [incomeDraft, setIncomeDraft] = useState({ title: "", source: "Client work", category: "Service", amount: "", currency: "XAF" as Currency, status: "collected" as Income["status"], received_on: today(), note: "" });
  const [expenseDraft, setExpenseDraft] = useState({ title: "", category: "Business", amount: "", currency: "XAF" as Currency, spent_on: today(), note: "" });
  const [taskDraft, setTaskDraft] = useState({ title: "", area: "Personal", due_date: today(), priority: "medium" });
  const [goalDraft, setGoalDraft] = useState({ title: "", area: "Personal", target: "", unit: "steps", due_date: "2026-11-30", accent: "gold" });
  const [tradeDraft, setTradeDraft] = useState({ instrument: "XAUUSD", direction: "buy" as Trade["direction"], setup: "Market structure", result: "open" as Trade["result"], pnl: "", currency: "USD" as Currency, risk_percent: "1", reward_risk: "", entry_price: "", exit_price: "", opened_at: new Date().toISOString().slice(0, 16), notes: "" });
  const [profileDraft, setProfileDraft] = useState({ full_name: "", base_currency: "XAF" as Currency, xaf_per_usd: "600", eur_to_usd: "1.08", monthly_profit_target_usd: "5000", timezone: "Africa/Douala", theme: "dark" as "dark" | "light" | "system", accent: "gold" });

  const notify = (text: string, kind: Toast["kind"] = "success") => {
    setToast({ text, kind });
    window.setTimeout(() => setToast(null), 3500);
  };

  async function loadWorkspace(userId: string) {
    if (!supabase) return;
    setWorking(true);
    setDataError("");
    try {
      let { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (!p) {
        const { data: created, error } = await supabase.from("profiles").upsert(blankProfile(userId)).select("*").single();
        if (error) throw error;
        p = created;
      }
      const activeProfile = p as Profile;
      setProfile(activeProfile);
      setProfileDraft({
        full_name: activeProfile.full_name || "",
        base_currency: activeProfile.base_currency || "XAF",
        xaf_per_usd: String(activeProfile.xaf_per_usd || 600),
        eur_to_usd: String(activeProfile.eur_to_usd || 1.08),
        monthly_profit_target_usd: String(activeProfile.monthly_profit_target_usd || 5000),
        timezone: activeProfile.timezone || "Africa/Douala",
        theme: activeProfile.theme || "dark",
        accent: activeProfile.accent || "gold"
      });

      const { data: existingProjects } = await supabase.from("projects").select("id").eq("user_id", userId).limit(1);
      if (!existingProjects?.length) {
        const { error } = await supabase.from("projects").insert(projectDefaults.map(x => ({ ...x, user_id: userId })));
        if (error) throw error;
      }
      const { data: existingGoals } = await supabase.from("goals").select("id").eq("user_id", userId).limit(1);
      if (!existingGoals?.length) {
        const { error } = await supabase.from("goals").insert(defaultGoals.map(x => ({ ...x, user_id: userId })));
        if (error) throw error;
      }

      const [incomeRes, expenseRes, goalRes, taskRes, projectRes, tradeRes] = await Promise.all([
        supabase.from("income_entries").select("*").eq("user_id", userId).order("received_on", { ascending: false }).limit(500),
        supabase.from("expense_entries").select("*").eq("user_id", userId).order("spent_on", { ascending: false }).limit(500),
        supabase.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("tasks").select("*").eq("user_id", userId).order("due_date", { ascending: true }).limit(300),
        supabase.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("trades").select("*").eq("user_id", userId).order("opened_at", { ascending: false }).limit(200)
      ]);
      const firstError = [incomeRes.error, expenseRes.error, goalRes.error, taskRes.error, projectRes.error, tradeRes.error].find(Boolean);
      if (firstError) throw firstError;
      setIncomes((incomeRes.data || []) as Income[]);
      setExpenses((expenseRes.data || []) as Expense[]);
      setGoals((goalRes.data || []) as Goal[]);
      setTasks((taskRes.data || []) as Task[]);
      setProjects((projectRes.data || []) as Project[]);
      const tradeRows = (tradeRes.data || []) as Trade[];
      const withUrls = await Promise.all(tradeRows.map(async trade => {
        const paths = trade.screenshots || [];
        const urls = await Promise.all(paths.map(async path => {
          if (!supabase) return "";
          const { data } = await supabase.storage.from("trade-journal").createSignedUrl(path, 3600);
          return data?.signedUrl || "";
        }));
        return { ...trade, screenshotUrls: urls.filter(Boolean) };
      }));
      setTrades(withUrls);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load your workspace.";
      setDataError(message);
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    if (!supabase) { setBooting(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session?.user) {
        setUser({ id: data.session.user.id, email: data.session.user.email });
        void loadWorkspace(data.session.user.id).finally(() => setBooting(false));
      } else setBooting(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        void loadWorkspace(session.user.id);
      } else {
        setUser(null); setProfile(null); setIncomes([]); setExpenses([]); setGoals([]); setTasks([]); setProjects([]); setTrades([]);
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("theme-light", profileDraft.theme === "light");
      document.documentElement.dataset.accent = profileDraft.accent;
    }
  }, [profileDraft.theme, profileDraft.accent]);

  const collected = useMemo(() => incomes.filter(x => x.status === "collected").reduce((s, x) => s + Number(x.amount_usd), 0), [incomes]);
  const refunds = useMemo(() => incomes.filter(x => x.status === "refunded").reduce((s, x) => s + Number(x.amount_usd), 0), [incomes]);
  const pending = useMemo(() => incomes.filter(x => x.status === "pending").reduce((s, x) => s + Number(x.amount_usd), 0), [incomes]);
  const spent = useMemo(() => expenses.reduce((s, x) => s + Number(x.amount_usd), 0), [expenses]);
  const netProfit = collected - refunds - spent;
  const target = Number(profile?.monthly_profit_target_usd || 5000);
  const targetPct = Math.max(0, Math.min(100, netProfit / Math.max(1, target) * 100));
  const completedTasks = tasks.filter(x => x.completed).length;
  const todayTasks = tasks.filter(x => x.due_date === today());
  const todayCompleted = todayTasks.filter(x => x.completed).length;
  const tradeWins = trades.filter(x => x.result === "win").length;
  const closedTrades = trades.filter(x => x.result === "win" || x.result === "loss" || x.result === "breakeven").length;
  const winRate = closedTrades ? Math.round(tradeWins / closedTrades * 100) : 0;

  const chartData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      return { date: key, label: d.toLocaleDateString("en", { month: "short", day: "numeric" }), income: 0, expenses: 0 };
    });
    days.forEach(day => {
      day.income = incomes.filter(x => x.received_on === day.date && x.status === "collected").reduce((s, x) => s + Number(x.amount_usd), 0);
      day.expenses = expenses.filter(x => x.spent_on === day.date).reduce((s, x) => s + Number(x.amount_usd), 0);
    });
    return days;
  }, [incomes, expenses]);

  const sourceData = useMemo(() => {
    const sources = new Map<string, number>();
    incomes.filter(x => x.status === "collected").forEach(x => sources.set(x.source || "Other", (sources.get(x.source || "Other") || 0) + Number(x.amount_usd)));
    return Array.from(sources.entries()).map(([name, value]) => ({ name, value }));
  }, [incomes]);
  const recentIncome = incomes.slice(0, 6);
  const recentTrades = trades.slice(0, 5);
  const currencyCode = profile?.base_currency || "XAF";
  const accentColor: Record<string,string> = { gold:"#f4c64e", violet:"#ac8bff", blue:"#68b7ff", mint:"#54d69b", rose:"#ff7582" };
  const displayFromUsd = (value: number) => {
    if (currencyCode === "USD") return money(value, "USD");
    if (currencyCode === "EUR") return money(value / Math.max(.01, profile?.eur_to_usd || 1.08), "EUR");
    return money(value * (profile?.xaf_per_usd || 600), "XAF");
  };

  async function handleAuth(e: FormEvent) {
    e.preventDefault(); setAuthError(""); setAuthNotice("");
    if (!supabase) return;
    setWorking(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName } } });
        if (error) throw error;
        if (data.session) setAuthNotice("Account created. Your private workspace is being prepared.");
        else setAuthNotice("Account created. Check your email to confirm the address, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally { setWorking(false); }
  }

  async function addIncome(e: FormEvent) {
    e.preventDefault(); if (!supabase || !user || !incomeDraft.title.trim() || !incomeDraft.amount) return;
    setWorking(true);
    try {
      const amount = cleanNumber(incomeDraft.amount);
      const { error } = await supabase.from("income_entries").insert({
        user_id: user.id, title: incomeDraft.title.trim(), source: incomeDraft.source, category: incomeDraft.category,
        amount, currency: incomeDraft.currency, amount_usd: usdFrom(amount, incomeDraft.currency, profile || blankProfile(user.id)),
        status: incomeDraft.status, received_on: incomeDraft.received_on, note: incomeDraft.note
      });
      if (error) throw error;
      setIncomeDraft({ title: "", source: "Client work", category: "Service", amount: "", currency: currencyCode, status: "collected", received_on: today(), note: "" });
      setShowIncomeForm(false); await loadWorkspace(user.id); notify("Income entry saved.");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not save income.", "error"); }
    finally { setWorking(false); }
  }

  async function addExpense(e: FormEvent) {
    e.preventDefault(); if (!supabase || !user || !expenseDraft.title.trim() || !expenseDraft.amount) return;
    setWorking(true);
    try {
      const amount = cleanNumber(expenseDraft.amount);
      const { error } = await supabase.from("expense_entries").insert({
        user_id: user.id, title: expenseDraft.title.trim(), category: expenseDraft.category, amount, currency: expenseDraft.currency,
        amount_usd: usdFrom(amount, expenseDraft.currency, profile || blankProfile(user.id)), spent_on: expenseDraft.spent_on, note: expenseDraft.note
      });
      if (error) throw error;
      setExpenseDraft({ title: "", category: "Business", amount: "", currency: currencyCode, spent_on: today(), note: "" });
      setShowExpenseForm(false); await loadWorkspace(user.id); notify("Expense saved.");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not save expense.", "error"); }
    finally { setWorking(false); }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault(); if (!supabase || !user || !taskDraft.title.trim()) return;
    setWorking(true);
    try {
      const { error } = await supabase.from("tasks").insert({ ...taskDraft, user_id: user.id });
      if (error) throw error;
      setTaskDraft({ title: "", area: "Personal", due_date: today(), priority: "medium" });
      setShowTaskForm(false); await loadWorkspace(user.id); notify("Task added.");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not add task.", "error"); }
    finally { setWorking(false); }
  }

  async function toggleTask(task: Task) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("tasks").update({ completed: !task.completed }).eq("id", task.id).eq("user_id", user.id);
    if (error) notify(error.message, "error"); else setTasks(prev => prev.map(x => x.id === task.id ? { ...x, completed: !x.completed } : x));
  }

  async function deleteTask(id: string) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", user.id);
    if (error) notify(error.message, "error"); else setTasks(prev => prev.filter(x => x.id !== id));
  }

  async function addGoal(e: FormEvent) {
    e.preventDefault(); if (!supabase || !user || !goalDraft.title.trim() || !goalDraft.target) return;
    setWorking(true);
    try {
      const { error } = await supabase.from("goals").insert({ ...goalDraft, target: cleanNumber(goalDraft.target), current: 0, user_id: user.id });
      if (error) throw error;
      setGoalDraft({ title: "", area: "Personal", target: "", unit: "steps", due_date: "2026-11-30", accent: "gold" });
      setShowGoalForm(false); await loadWorkspace(user.id); notify("Goal created.");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not create goal.", "error"); }
    finally { setWorking(false); }
  }

  async function updateGoalProgress(goal: Goal, amount: number) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("goals").update({ current: amount }).eq("id", goal.id).eq("user_id", user.id);
    if (error) notify(error.message, "error"); else setGoals(prev => prev.map(x => x.id === goal.id ? { ...x, current: amount } : x));
  }

  async function updateProject(project: Project, patch: Partial<Project>) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("projects").update(patch).eq("id", project.id).eq("user_id", user.id);
    if (error) notify(error.message, "error"); else setProjects(prev => prev.map(x => x.id === project.id ? { ...x, ...patch } : x));
  }

  async function addTrade(e: FormEvent) {
    e.preventDefault(); if (!supabase || !user || !tradeDraft.instrument.trim()) return;
    setWorking(true);
    try {
      const amount = cleanNumber(tradeDraft.pnl);
      const paths: string[] = [];
      for (const file of tradeFiles) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Only JPG, PNG and WebP screenshots are supported.");
        if (file.size > 10 * 1024 * 1024) throw new Error("Each screenshot must be 10 MB or smaller.");
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = user.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "-" + safeName;
        const { error: uploadError } = await supabase.storage.from("trade-journal").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        paths.push(path);
      }
      const { error } = await supabase.from("trades").insert({
        user_id: user.id, instrument: tradeDraft.instrument.trim().toUpperCase(), direction: tradeDraft.direction,
        setup: tradeDraft.setup, result: tradeDraft.result, pnl: amount, currency: tradeDraft.currency,
        pnl_usd: usdFrom(amount, tradeDraft.currency, profile || blankProfile(user.id)),
        risk_percent: tradeDraft.risk_percent ? cleanNumber(tradeDraft.risk_percent) : null,
        reward_risk: tradeDraft.reward_risk ? cleanNumber(tradeDraft.reward_risk) : null,
        entry_price: tradeDraft.entry_price ? cleanNumber(tradeDraft.entry_price) : null,
        exit_price: tradeDraft.exit_price ? cleanNumber(tradeDraft.exit_price) : null,
        opened_at: new Date(tradeDraft.opened_at).toISOString(), closed_at: tradeDraft.result === "open" ? null : new Date().toISOString(),
        notes: tradeDraft.notes, screenshots: paths
      });
      if (error) throw error;
      setTradeFiles([]);
      setTradeDraft({ instrument: "XAUUSD", direction: "buy", setup: "Market structure", result: "open", pnl: "", currency: "USD", risk_percent: "1", reward_risk: "", entry_price: "", exit_price: "", opened_at: new Date().toISOString().slice(0, 16), notes: "" });
      setShowTradeForm(false); await loadWorkspace(user.id); notify("Trade journal entry saved.");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not save trade.", "error"); }
    finally { setWorking(false); }
  }

  async function deleteIncome(id: string) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("income_entries").delete().eq("id", id).eq("user_id", user.id);
    if (error) notify(error.message, "error"); else setIncomes(prev => prev.filter(x => x.id !== id));
  }
  async function deleteExpense(id: string) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("expense_entries").delete().eq("id", id).eq("user_id", user.id);
    if (error) notify(error.message, "error"); else setExpenses(prev => prev.filter(x => x.id !== id));
  }
  async function deleteTrade(trade: Trade) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("trades").delete().eq("id", trade.id).eq("user_id", user.id);
    if (error) notify(error.message, "error");
    else {
      if (trade.screenshots?.length) await supabase.storage.from("trade-journal").remove(trade.screenshots);
      setTrades(prev => prev.filter(x => x.id !== trade.id));
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault(); if (!supabase || !user) return;
    setWorking(true);
    try {
      const update = {
        full_name: profileDraft.full_name, base_currency: profileDraft.base_currency,
        xaf_per_usd: cleanNumber(profileDraft.xaf_per_usd), eur_to_usd: cleanNumber(profileDraft.eur_to_usd),
        monthly_profit_target_usd: cleanNumber(profileDraft.monthly_profit_target_usd),
        timezone: profileDraft.timezone, theme: profileDraft.theme, accent: profileDraft.accent
      };
      const { data, error } = await supabase.from("profiles").update(update).eq("id", user.id).select("*").single();
      if (error) throw error;
      setProfile(data as Profile); notify("Settings updated.");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not save settings.", "error"); }
    finally { setWorking(false); }
  }

  async function exportData() {
    const payload = { exported_at: new Date().toISOString(), profile, incomes, expenses, goals, tasks, projects, trades };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "november-command-centre-export.json"; anchor.click();
    URL.revokeObjectURL(url); notify("Your data export has been prepared.");
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setScreen("overview");
  }

  const pageTitle: Record<Screen, [string, string]> = {
    overview: ["Your November, in focus", "A clear view of the actions and numbers moving you forward."],
    goals: ["Goals & progress", "Keep the month measurable. Update progress as the work gets done."],
    income: ["Income log", "Record every amount you earn, however small. Only collected income counts as cash in."],
    finance: ["Money & expenses", "Track the full picture: collected sales, refunds, spending and net profit."],
    tasks: ["Tasks & execution", "Turn the big targets into small actions you can actually complete."],
    projects: ["Your projects", "Separate workspaces for your businesses and products."],
    trading: ["Trading journal", "Log the setup, execution, result and screenshots — not just the P&L."],
    analytics: ["Performance analytics", "See what is working, where money comes from and how the month is moving."],
    settings: ["Workspace settings", "Make the command centre fit your workflow."]
  };

  if (booting) return <div className="auth-shell"><div className="auth-card"><div className="brand"><div className="brand-mark">N</div><div><div className="brand-name">NOVEMBER</div><div className="brand-sub">Command Centre</div></div></div><p>Loading your private workspace…</p></div></div>;

  if (!isSupabaseConfigured) return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand"><div className="brand-mark">N</div><div><div className="brand-name">NOVEMBER</div><div className="brand-sub">Command Centre</div></div></div>
        <h1>Your month. Under control.</h1>
        <p>The dashboard code is ready, but the private database connection has not been added yet. Connect the Supabase project using the two public environment variables to enable sign-in and save your records.</p>
        <div className="auth-success"><ShieldCheck size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} /> No financial or trading data is being saved until the private backend is connected.</div>
        <div className="field"><label>Required setup</label><input readOnly value="NEXT_PUBLIC_SUPABASE_URL" /></div>
        <div className="field" style={{ marginTop: 10 }}><input readOnly value="NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" /></div>
        <p className="tiny" style={{ marginTop: 15 }}>Never use a service-role key in the browser. Sign-up and account creation will be enabled once Supabase Auth is connected.</p>
      </div>
    </div>
  );

  if (!user || !profile) return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand"><div className="brand-mark">N</div><div><div className="brand-name">NOVEMBER</div><div className="brand-sub">Command Centre</div></div></div>
        <h1>{authMode === "signin" ? "Welcome back." : "Create your workspace."}</h1>
        <p>{authMode === "signin" ? "Sign in to pick up where you left off. Your goals, income and journal are private to your account." : "Create a private account. Your workspace and records will be separated from every other user."}</p>
        {authError && <div className="auth-error">{authError}</div>}
        {authNotice && <div className="auth-success">{authNotice}</div>}
        <form onSubmit={handleAuth}>
          {authMode === "signup" && <div className="field" style={{ marginBottom: 12 }}><label>Your name</label><input required value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Name for your dashboard" /></div>}
          <div className="field" style={{ marginBottom: 12 }}><label>Email address</label><input required type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" /></div>
          <div className="field"><label>Password</label><input required type="password" minLength={6} autoComplete={authMode === "signup" ? "new-password" : "current-password"} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="At least 6 characters" /></div>
          <button className="primary-button" disabled={working} style={{ width: "100%", justifyContent: "center", marginTop: 17 }}>{working ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <div style={{ textAlign: "center", marginTop: 17, color: "var(--muted)", fontSize: 10 }}>
          {authMode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button className="link-button" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); setAuthNotice(""); }}>{authMode === "signin" ? "Create account" : "Sign in instead"}</button>
        </div>
        <div className="tiny muted" style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}><Lock size={12} /> Private workspace protected by Supabase Auth and row-level security</div>
      </div>
    </div>
  );

  function Header() {
    const [title, description] = pageTitle[screen];
    return <div className="topbar">
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={17} /></button>
        <div><div className="eyebrow">November 2026 / Command Centre</div><h1 className="page-title">{title}</h1><div className="page-description">{description}</div></div>
      </div>
      <div className="top-actions"><div className="date-pill"><CalendarDays size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />{currentMonth()}</div><button className="icon-button" onClick={() => void loadWorkspace(user.id)} aria-label="Refresh"><RefreshCw size={15} /></button><button className="icon-button" onClick={() => setScreen("settings")} aria-label="Settings"><Settings2 size={15} /></button></div>
    </div>;
  }

  function KPI({ label, value, note, icon: Icon, color = "gold", trend }: { label: string; value: string; note: string; icon: ElementType; color?: string; trend?: string }) {
    return <div className={"card kpi " + (color === "blue" ? "accent-blue" : color === "green" ? "accent-green" : color === "violet" ? "accent-violet" : color === "rose" ? "accent-rose" : "")}>
      <div className="kpi-top"><span>{label}</span><span className="kpi-icon"><Icon size={14} /></span></div>
      <div className="kpi-value">{value}</div><div className="kpi-foot"><span>{note}</span>{trend && <b style={{ color: trend.startsWith("-") ? "var(--red)" : "var(--green)" }}>{trend}</b>}</div>
    </div>;
  }

  function IncomeForm() {
    return <div className="card panel">
      <div className="card-title-row"><div><h3 className="card-title">Add an income entry</h3><div className="card-subtitle">Record cash received, a pending payment or a refund.</div></div><button className="icon-button" onClick={() => setShowIncomeForm(false)}><X size={15} /></button></div>
      <form onSubmit={addIncome}>
        <div className="form-grid">
          <div className="field"><label>What was the income for?</label><input required value={incomeDraft.title} onChange={e => setIncomeDraft({ ...incomeDraft, title: e.target.value })} placeholder="e.g. Logo design deposit" /></div>
          <div className="field"><label>Amount</label><input required type="number" min="0" step="any" value={incomeDraft.amount} onChange={e => setIncomeDraft({ ...incomeDraft, amount: e.target.value })} placeholder="0.00" /></div>
          <div className="field"><label>Source</label><select value={incomeDraft.source} onChange={e => setIncomeDraft({ ...incomeDraft, source: e.target.value })}><option>Prime Study</option><option>PrimeFlow</option><option>ClientFlow</option><option>Trading</option><option>Client work</option><option>Other</option></select></div>
          <div className="field"><label>Currency</label><select value={incomeDraft.currency} onChange={e => setIncomeDraft({ ...incomeDraft, currency: e.target.value as Currency })}><option value="XAF">FCFA (XAF)</option><option value="USD">US Dollar (USD)</option><option value="EUR">Euro (EUR)</option></select></div>
          <div className="field"><label>Status</label><select value={incomeDraft.status} onChange={e => setIncomeDraft({ ...incomeDraft, status: e.target.value as Income["status"] })}><option value="collected">Collected</option><option value="pending">Pending</option><option value="refunded">Refunded</option></select></div>
          <div className="field"><label>Date</label><input type="date" value={incomeDraft.received_on} onChange={e => setIncomeDraft({ ...incomeDraft, received_on: e.target.value })} /></div>
          <div className="field full"><label>Note (optional)</label><input value={incomeDraft.note} onChange={e => setIncomeDraft({ ...incomeDraft, note: e.target.value })} placeholder="Payment reference, fees, context…" /></div>
        </div>
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowIncomeForm(false)}>Cancel</button><button className="primary-button" disabled={working}><Plus size={13} /> Save income</button></div>
      </form>
    </div>;
  }

  function ExpenseForm() {
    return <div className="card panel">
      <div className="card-title-row"><div><h3 className="card-title">Record an expense</h3><div className="card-subtitle">Include ads, tools, subscriptions, fees and delivery costs.</div></div><button className="icon-button" onClick={() => setShowExpenseForm(false)}><X size={15} /></button></div>
      <form onSubmit={addExpense}><div className="form-grid">
        <div className="field"><label>Expense</label><input required value={expenseDraft.title} onChange={e => setExpenseDraft({ ...expenseDraft, title: e.target.value })} placeholder="e.g. WhatsApp TV ad" /></div>
        <div className="field"><label>Amount</label><input required type="number" min="0" step="any" value={expenseDraft.amount} onChange={e => setExpenseDraft({ ...expenseDraft, amount: e.target.value })} placeholder="0.00" /></div>
        <div className="field"><label>Category</label><select value={expenseDraft.category} onChange={e => setExpenseDraft({ ...expenseDraft, category: e.target.value })}><option>Advertising</option><option>Tools & subscriptions</option><option>Payment fees</option><option>Delivery</option><option>Trading</option><option>Transport</option><option>Personal</option><option>Other</option></select></div>
        <div className="field"><label>Currency</label><select value={expenseDraft.currency} onChange={e => setExpenseDraft({ ...expenseDraft, currency: e.target.value as Currency })}><option value="XAF">FCFA (XAF)</option><option value="USD">US Dollar (USD)</option><option value="EUR">Euro (EUR)</option></select></div>
        <div className="field"><label>Date</label><input type="date" value={expenseDraft.spent_on} onChange={e => setExpenseDraft({ ...expenseDraft, spent_on: e.target.value })} /></div>
        <div className="field"><label>Note</label><input value={expenseDraft.note} onChange={e => setExpenseDraft({ ...expenseDraft, note: e.target.value })} placeholder="Optional context" /></div>
      </div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowExpenseForm(false)}>Cancel</button><button className="primary-button" disabled={working}><Plus size={13} /> Save expense</button></div></form>
    </div>;
  }

  function TaskForm() {
    return <div className="card panel"><div className="card-title-row"><h3 className="card-title">Add a task</h3><button className="icon-button" onClick={() => setShowTaskForm(false)}><X size={15} /></button></div>
      <form onSubmit={addTask}><div className="form-grid">
        <div className="field full"><label>Task</label><input required value={taskDraft.title} onChange={e => setTaskDraft({ ...taskDraft, title: e.target.value })} placeholder="What needs to get done?" /></div>
        <div className="field"><label>Area</label><select value={taskDraft.area} onChange={e => setTaskDraft({ ...taskDraft, area: e.target.value })}><option>Prime Study</option><option>PrimeFlow</option><option>ClientFlow</option><option>Trading</option><option>Gym</option><option>School</option><option>Personal</option></select></div>
        <div className="field"><label>Due date</label><input type="date" value={taskDraft.due_date} onChange={e => setTaskDraft({ ...taskDraft, due_date: e.target.value })} /></div>
        <div className="field"><label>Priority</label><select value={taskDraft.priority} onChange={e => setTaskDraft({ ...taskDraft, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
      </div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowTaskForm(false)}>Cancel</button><button className="primary-button" disabled={working}><Plus size={13} /> Add task</button></div></form>
    </div>;
  }

  function renderOverview() {
    return <>
      <div className="grid grid-4">
        <div className="hero-card" style={{ gridColumn: "span 2" }}>
          <div className="eyebrow">November net profit target</div><div className="hero-value">{money(netProfit)}</div><p>Count cash collected. Subtract refunds, fees and every business expense.</p>
          <div className="hero-meta"><span>{money(netProfit)} of {money(target)} achieved</span><b>{targetPct.toFixed(1)}%</b></div><div className="progress"><span style={{ width: targetPct + "%" }} /></div>
          <div className="hero-meta"><span>Remaining to target</span><b>{money(Math.max(0, target - netProfit))}</b></div>
        </div>
        <KPI label="Collected income" value={money(collected)} note="Cash actually received" icon={TrendingUp} color="green" />
        <KPI label="Net profit" value={money(netProfit)} note="After expenses & refunds" icon={CircleDollarSign} color={netProfit >= 0 ? "gold" : "rose"} />
      </div>
      <div className="grid grid-4 panel">
        <KPI label="Pending income" value={money(pending)} note="Not counted as profit yet" icon={Clock3} color="blue" />
        <KPI label="Expenses" value={money(spent)} note="Business costs recorded" icon={CreditCard} color="rose" />
        <KPI label="Refunds" value={money(refunds)} note="Deducted from income" icon={ArrowDownRight} color="violet" />
        <KPI label="Tasks completed" value={completedTasks + "/" + tasks.length} note="Across all work areas" icon={CheckCircle2} color="green" />
      </div>
      <div className="section-heading"><div><h2>Month at a glance</h2><p>Review the numbers, then move to the next action.</p></div><button className="link-button" onClick={() => setScreen("analytics")}>Open analytics →</button></div>
      <div className="two-col-main">
        <div className="card"><div className="card-title-row"><div><h3 className="card-title">Income & expenses</h3><div className="card-subtitle">Last 14 days · USD equivalent</div></div><span className="status blue">Live data</span></div>
          <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#54d69b" stopOpacity={.28}/><stop offset="95%" stopColor="#54d69b" stopOpacity={0}/></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff7582" stopOpacity={.2}/><stop offset="95%" stopColor="#ff7582" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="label" tick={{ fill:"#7f8a9d",fontSize:9 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill:"#7f8a9d",fontSize:9 }} axisLine={false} tickLine={false} width={42}/><Tooltip contentStyle={{ background:"#121722",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,fontSize:10 }} formatter={(v) => money(Number(v))}/><Area type="monotone" dataKey="income" name="Income" stroke="#54d69b" strokeWidth={2} fill="url(#incomeFill)"/><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ff7582" strokeWidth={2} fill="url(#expenseFill)"/></AreaChart></ResponsiveContainer></div>
          <div className="chart-legend"><span><i className="legend-dot" style={{ background:"#54d69b" }} />Collected income</span><span><i className="legend-dot" style={{ background:"#ff7582" }} />Expenses</span></div>
        </div>
        <div className="card"><div className="card-title-row"><div><h3 className="card-title">Today’s execution</h3><div className="card-subtitle">{todayCompleted} of {todayTasks.length} tasks completed today</div></div><button className="link-button" onClick={() => setScreen("tasks")}>All tasks</button></div>
          <div className="progress" style={{ marginBottom: 9 }}><span style={{ width: (todayTasks.length ? todayCompleted / todayTasks.length * 100 : 0) + "%", background:"linear-gradient(90deg,#54d69b,#a4f1cc)" }} /></div>
          {todayTasks.length ? todayTasks.slice(0,6).map(t => <div className="task-row" key={t.id}><button className={"task-check " + (t.completed ? "checked" : "")} onClick={() => void toggleTask(t)}>{t.completed && <Check size={11}/>}</button><div style={{ flex:1 }}><div className={"task-title " + (t.completed ? "done" : "")}>{t.title}</div><div className="task-meta">{t.area} · {t.priority} priority</div></div></div>) : <div className="empty"><ClipboardList size={23}/><div>No tasks planned for today.</div><button className="link-button" onClick={() => { setScreen("tasks"); setShowTaskForm(true); }}>Add your first task</button></div>}
          <button className="secondary-button" style={{ width:"100%",justifyContent:"center",marginTop:12 }} onClick={() => { setScreen("tasks"); setShowTaskForm(true); }}><Plus size={13}/> Add task</button>
        </div>
      </div>
      <div className="section-heading"><div><h2>Focus areas</h2><p>Keep every project and personal goal in its own lane.</p></div><button className="link-button" onClick={() => setScreen("projects")}>View projects →</button></div>
      <div className="grid grid-3">
        {projects.map(p => <div className="card project-card" key={p.id} style={{ ["--project-color" as string]: accentColor[p.accent] || "#f4c64e" }}><div className="project-banner"/><div className="project-header"><div><div className="project-name">{p.name}</div><div className="card-subtitle">{p.area}</div></div><span className={"status " + (p.status === "testing" ? "amber" : p.status === "paused" ? "red" : "green")}>{p.status}</span></div><p className="project-copy">{p.description}</p><div className="project-metric"><span>{p.target_label || "Progress"}</span><b>{p.current}/{p.target || "—"}</b></div><div className="progress"><span style={{ width: (p.target ? Math.min(100,p.current/p.target*100) : 0) + "%", background:accentColor[p.accent] || "#f4c64e" }}/></div></div>)}
      </div>
      <div className="section-heading"><div><h2>Latest money activity</h2><p>Your most recent recorded income.</p></div><button className="link-button" onClick={() => setScreen("income")}>Open income log →</button></div>
      <div className="card">{recentIncome.length ? <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>SOURCE</th><th>DATE</th><th>STATUS</th><th>AMOUNT</th></tr></thead><tbody>{recentIncome.map(x => <tr key={x.id}><td><b>{x.title}</b></td><td>{x.source}</td><td>{x.received_on}</td><td><span className={"status " + (x.status === "collected" ? "green" : x.status === "pending" ? "amber" : "red")}>{x.status}</span></td><td><b>{money(x.amount,x.currency)}</b></td></tr>)}</tbody></table></div> : <div className="empty"><CircleDollarSign size={24}/><div>No income entries yet. Log even the smallest amount when it arrives.</div><button className="primary-button" style={{ marginTop:12 }} onClick={() => { setScreen("income"); setShowIncomeForm(true); }}><Plus size={13}/> Log income</button></div>}</div>
    </>;
  }

  function renderGoals() {
    return <>
      <div className="card hero-card"><div className="eyebrow">Primary monthly outcome</div><div className="hero-value">{money(netProfit)} <span style={{ fontSize:14,color:"#aeb7c5",letterSpacing:0 }}> / {money(target)}</span></div><p>Net profit progress · the number that matters is what remains after costs.</p><div className="hero-meta"><span>Current progress</span><b>{targetPct.toFixed(1)}%</b></div><div className="progress"><span style={{ width:targetPct+"%" }}/></div></div>
      <div className="section-heading"><div><h2>Active goals</h2><p>Update a goal as you complete real work.</p></div><button className="primary-button" onClick={() => setShowGoalForm(!showGoalForm)}><Plus size={13}/> New goal</button></div>
      {showGoalForm && <div className="card panel"><form onSubmit={addGoal}><div className="form-grid"><div className="field"><label>Goal name</label><input required value={goalDraft.title} onChange={e => setGoalDraft({...goalDraft,title:e.target.value})} placeholder="e.g. Finish 4 chapters"/></div><div className="field"><label>Target</label><input required type="number" min="1" value={goalDraft.target} onChange={e => setGoalDraft({...goalDraft,target:e.target.value})} placeholder="20"/></div><div className="field"><label>Area</label><select value={goalDraft.area} onChange={e => setGoalDraft({...goalDraft,area:e.target.value})}><option>Financial</option><option>Business</option><option>Fitness</option><option>Education</option><option>Personal</option></select></div><div className="field"><label>Unit</label><input value={goalDraft.unit} onChange={e => setGoalDraft({...goalDraft,unit:e.target.value})}/></div></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowGoalForm(false)}>Cancel</button><button className="primary-button">Save goal</button></div></form></div>}
      <div className="grid grid-3 panel">{goals.map(g => {
        const actual = g.title.toLowerCase().includes("net profit") ? netProfit : Number(g.current);
        const pct = Math.max(0,Math.min(100,actual/Math.max(1,Number(g.target))*100));
        const tint = accentColor[g.accent] || "#f4c64e";
        return <div className="card goal-card" key={g.id} style={{ ["--goal-glow" as string]: tint+"18",["--goal-bg" as string]:tint+"1d",["--goal-color" as string]:tint }}>
          <div className="goal-top"><span className="goal-icon"><Target size={17}/></span><span className="status blue">{g.area}</span></div><div className="goal-name">{g.title}</div><div className="goal-description">Due {g.due_date || "No deadline"} · {g.unit}</div><div className="goal-progress-label"><span>{g.unit === "USD" ? money(actual) : actual + " " + g.unit}</span><b>{pct.toFixed(0)}%</b></div><div className="progress"><span style={{ width:pct+"%",background:tint }}/></div>
          {!g.title.toLowerCase().includes("net profit") && <div style={{ display:"flex",gap:7,marginTop:14 }}><button className="secondary-button" onClick={() => void updateGoalProgress(g,Math.max(0,Number(g.current)-1))}>−</button><button className="secondary-button" style={{ flex:1,justifyContent:"center" }} onClick={() => void updateGoalProgress(g,Number(g.current)+1)}>Update progress +1</button></div>}
        </div>;
      })}</div>
    </>;
  }

  function renderIncome() {
    const filtered = incomes.filter(x => incomeFilter === "all" || x.status === incomeFilter);
    return <>
      <div className="grid grid-4"><KPI label="Collected" value={money(collected)} note="Cash received" icon={Wallet} color="green"/><KPI label="Pending" value={money(pending)} note="Awaiting payment" icon={Clock3} color="blue"/><KPI label="Refunds" value={money(refunds)} note="Deduct from income" icon={ArrowDownRight} color="rose"/><KPI label="Entries logged" value={String(incomes.length)} note="Every amount matters" icon={ClipboardList} color="violet"/></div>
      <div className="section-heading"><div><h2>All income entries</h2><p>Amounts are stored in their original currency and converted to USD for analysis.</p></div><button className="primary-button" onClick={() => setShowIncomeForm(!showIncomeForm)}><Plus size={13}/> Log amount</button></div>
      {showIncomeForm && <IncomeForm/>}
      <div className="card panel"><div className="card-title-row"><div><h3 className="card-title">Income history</h3><div className="card-subtitle">{filtered.length} entries shown</div></div><div className="segmented">{["all","collected","pending","refunded"].map(f => <button key={f} className={incomeFilter===f?"active":""} onClick={() => setIncomeFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div></div>
        {filtered.length ? <div className="table-wrap"><table><thead><tr><th>DESCRIPTION</th><th>SOURCE</th><th>DATE</th><th>STATUS</th><th>ORIGINAL AMOUNT</th><th>USD VALUE</th><th></th></tr></thead><tbody>{filtered.map(x => <tr key={x.id}><td><b>{x.title}</b><div className="tiny muted">{x.note}</div></td><td>{x.source}</td><td>{x.received_on}</td><td><span className={"status "+(x.status==="collected"?"green":x.status==="pending"?"amber":"red")}>{x.status}</span></td><td>{money(x.amount,x.currency)}</td><td>{money(x.amount_usd)}</td><td><button className="danger-button" onClick={() => void deleteIncome(x.id)}>Delete</button></td></tr>)}</tbody></table></div> : <div className="empty"><CircleDollarSign size={24}/><div>No entries in this filter yet.</div></div>}
      </div>
    </>;
  }

  function renderFinance() {
    return <>
      <div className="grid grid-4"><KPI label="Gross collected" value={money(collected)} note="Before refunds and costs" icon={TrendingUp} color="green"/><KPI label="Refunds" value={money(refunds)} note="Returned to customers" icon={ArrowDownRight} color="rose"/><KPI label="Total expenses" value={money(spent)} note="All logged costs" icon={CreditCard} color="violet"/><KPI label="Net profit" value={money(netProfit)} note="Collected − refunds − expenses" icon={CircleDollarSign} color="gold"/></div>
      <div className="section-heading"><div><h2>Cash movement</h2><p>14-day view, with all values normalized to USD.</p></div><button className="secondary-button" onClick={exportData}><Download size={13}/> Export data</button></div>
      <div className="two-col-main"><div className="card"><div className="card-title-row"><h3 className="card-title">Income vs expenses</h3><span className="status blue">14 days</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="label" tick={{fill:"#7f8a9d",fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#7f8a9d",fontSize:9}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#121722",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,fontSize:10}} formatter={(v)=>money(Number(v))}/><Bar dataKey="income" name="Income" fill="#54d69b" radius={[5,5,0,0]}/><Bar dataKey="expenses" name="Expenses" fill="#ff7582" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></div>
        <div className="card"><div className="card-title-row"><h3 className="card-title">Profit calculation</h3><span className="status green">Actuals</span></div><div className="task-row"><span className="muted">Collected income</span><b style={{ marginLeft:"auto",color:"var(--green)" }}>+{money(collected)}</b></div><div className="task-row"><span className="muted">Refunds</span><b style={{ marginLeft:"auto",color:"var(--red)" }}>−{money(refunds)}</b></div><div className="task-row"><span className="muted">Expenses</span><b style={{ marginLeft:"auto",color:"var(--red)" }}>−{money(spent)}</b></div><div style={{ paddingTop:17,display:"flex",justifyContent:"space-between",alignItems:"center" }}><b>Net profit</b><b className="display" style={{ fontSize:25,color:netProfit>=0?"var(--green)":"var(--red)" }}>{money(netProfit)}</b></div><div className="tiny muted" style={{ marginTop:7 }}>Pending invoices are excluded until collected.</div></div>
      </div>
      <div className="section-heading"><div><h2>Expenses</h2><p>Advertising, platform fees, subscriptions, tools and personal costs.</p></div><button className="primary-button" onClick={() => setShowExpenseForm(!showExpenseForm)}><Plus size={13}/> Add expense</button></div>
      {showExpenseForm && <ExpenseForm/>}
      <div className="card panel">{expenses.length ? <div className="table-wrap"><table><thead><tr><th>EXPENSE</th><th>CATEGORY</th><th>DATE</th><th>AMOUNT</th><th>USD VALUE</th><th></th></tr></thead><tbody>{expenses.map(x=><tr key={x.id}><td><b>{x.title}</b><div className="tiny muted">{x.note}</div></td><td>{x.category}</td><td>{x.spent_on}</td><td>{money(x.amount,x.currency)}</td><td>{money(x.amount_usd)}</td><td><button className="danger-button" onClick={()=>void deleteExpense(x.id)}>Delete</button></td></tr>)}</tbody></table></div>:<div className="empty"><CreditCard size={24}/><div>No expenses logged yet. Add every business cost to keep profit honest.</div></div>}</div>
    </>;
  }

  function renderTasks() {
    const sorted = [...tasks].sort((a,b) => Number(a.completed)-Number(b.completed) || a.due_date.localeCompare(b.due_date));
    return <>
      <div className="grid grid-4"><KPI label="Total tasks" value={String(tasks.length)} note="Across all areas" icon={ClipboardList}/><KPI label="Completed" value={String(completedTasks)} note="Checked off" icon={CheckCircle2} color="green"/><KPI label="Remaining" value={String(tasks.length-completedTasks)} note="Still to execute" icon={Flag} color="blue"/><KPI label="Today's progress" value={(todayTasks.length?Math.round(todayCompleted/todayTasks.length*100):0)+"%"} note={todayCompleted+" of "+todayTasks.length+" tasks done" } icon={Zap} color="violet"/></div>
      <div className="section-heading"><div><h2>Task board</h2><p>Keep today's actions visible. Do not confuse busy work with progress.</p></div><button className="primary-button" onClick={() => setShowTaskForm(!showTaskForm)}><Plus size={13}/> New task</button></div>
      {showTaskForm && <TaskForm/>}
      <div className="card panel"><div className="card-title-row"><div><h3 className="card-title">All tasks</h3><div className="card-subtitle">Sorted by completion and due date</div></div><span className="status blue">{tasks.length} total</span></div>
        {sorted.length ? sorted.map(t=><div className="task-row" key={t.id}><button className={"task-check "+(t.completed?"checked":"")} onClick={()=>void toggleTask(t)}>{t.completed&&<Check size={11}/>}</button><div style={{ flex:1 }}><div className={"task-title "+(t.completed?"done":"")}>{t.title}</div><div className="task-meta">{t.area} · Due {t.due_date}</div></div><span className={"status "+(t.priority==="high"?"red":t.priority==="low"?"blue":"amber")}>{t.priority}</span><button className="danger-button" onClick={()=>void deleteTask(t.id)}>Remove</button></div>) : <div className="empty"><ClipboardList size={24}/><div>No tasks yet. Add the next specific action, not a vague ambition.</div></div>}
      </div>
    </>;
  }

  function renderProjects() {
    return <>
      <div className="grid grid-3">{projects.map(p => <div className="card project-card" key={p.id} style={{ ["--project-color" as string]: accentColor[p.accent] || "#f4c64e" }}><div className="project-banner"/><div className="project-header"><div><div className="project-name">{p.name}</div><div className="card-subtitle">{p.area}</div></div><span className={"status "+(p.status==="testing"?"amber":p.status==="paused"?"red":"green")}>{p.status}</span></div><p className="project-copy">{p.description}</p><div className="field"><label>Current {p.target_label.toLowerCase()}</label><input type="number" min="0" value={p.current} onChange={e=>setProjects(prev=>prev.map(x=>x.id===p.id?{...x,current:cleanNumber(e.target.value)}:x))} onBlur={()=>void updateProject(p,{current:p.current})}/></div><div className="project-metric" style={{ marginTop:12 }}><span>Target</span><b>{p.target || "Not set"}</b></div><div className="progress"><span style={{ width:(p.target?Math.min(100,p.current/p.target*100):0)+"%",background:accentColor[p.accent]||"#f4c64e" }}/></div><div className="field" style={{ marginTop:12 }}><label>Project status</label><select value={p.status} onChange={e=>void updateProject(p,{status:e.target.value})}><option value="active">Active</option><option value="testing">Testing</option><option value="paused">Paused</option><option value="completed">Completed</option></select></div><button className="secondary-button" style={{ width:"100%",justifyContent:"center",marginTop:10 }} onClick={()=>setScreen(p.slug==="prime-study"?"projects":p.slug==="primeflow"?"projects":"projects")}>Open project details <ChevronDown size={13}/></button></div>)}</div>
      <div className="card panel"><div className="card-title-row"><div><h3 className="card-title">Decision rules</h3><div className="card-subtitle">Protect time and capital by deciding in advance.</div></div><ShieldCheck size={18} color="var(--gold)"/></div><div className="task-row"><b style={{ minWidth:92 }}>PrimeFlow</b><span className="muted">One WhatsApp TV test; if demand is weak, pause rather than keep spending.</span></div><div className="task-row"><b style={{ minWidth:92 }}>Prime Study</b><span className="muted">Keep product quality and paying-user validation as the focus.</span></div><div className="task-row"><b style={{ minWidth:92 }}>ClientFlow</b><span className="muted">Audit the funnel, test the purchase path and measure actual sales.</span></div><div className="task-row"><b style={{ minWidth:92 }}>Trading</b><span className="muted">Speculative income only. Never treat a hoped-for payout as cash.</span></div></div>
    </>;
  }

  function renderTrading() {
    return <>
      <div className="grid grid-4"><KPI label="Journaled trades" value={String(trades.length)} note="All recorded setups" icon={Activity} color="blue"/><KPI label="Win rate" value={closedTrades?winRate+"%":"—"} note={tradeWins+" wins · "+closedTrades+" closed"} icon={TrendingUp} color="green"/><KPI label="Realized P&L" value={money(trades.filter(x=>x.result!=="open").reduce((s,x)=>s+Number(x.pnl_usd),0))} note="From journaled closed trades" icon={CircleDollarSign} color="gold"/><KPI label="Open trades" value={String(trades.filter(x=>x.result==="open").length)} note="Awaiting outcome" icon={Clock3} color="violet"/></div>
      <div className="section-heading"><div><h2>Trade journal</h2><p>Capture the chart, your reasoning, risk and outcome. Every trade is a lesson.</p></div><button className="primary-button" onClick={()=>setShowTradeForm(!showTradeForm)}><Plus size={13}/> Journal a trade</button></div>
      {showTradeForm && <div className="card panel"><div className="card-title-row"><div><h3 className="card-title">New journal entry</h3><div className="card-subtitle">Upload up to 10 MB each · JPG, PNG or WebP screenshots.</div></div><button className="icon-button" onClick={()=>setShowTradeForm(false)}><X size={15}/></button></div>
        <form onSubmit={addTrade}><div className="form-grid">
          <div className="field"><label>Instrument / pair</label><input required value={tradeDraft.instrument} onChange={e=>setTradeDraft({...tradeDraft,instrument:e.target.value})}/></div>
          <div className="field"><label>Direction</label><select value={tradeDraft.direction} onChange={e=>setTradeDraft({...tradeDraft,direction:e.target.value as Trade["direction"]})}><option value="buy">Buy / Long</option><option value="sell">Sell / Short</option></select></div>
          <div className="field"><label>Strategy / setup</label><input value={tradeDraft.setup} onChange={e=>setTradeDraft({...tradeDraft,setup:e.target.value})} placeholder="BOS, ChoCH, liquidity sweep…"/></div>
          <div className="field"><label>Trade result</label><select value={tradeDraft.result} onChange={e=>setTradeDraft({...tradeDraft,result:e.target.value as Trade["result"]})}><option value="open">Open</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option></select></div>
          <div className="field"><label>P&L amount</label><input type="number" step="any" value={tradeDraft.pnl} onChange={e=>setTradeDraft({...tradeDraft,pnl:e.target.value})} placeholder="0.00"/></div>
          <div className="field"><label>P&L currency</label><select value={tradeDraft.currency} onChange={e=>setTradeDraft({...tradeDraft,currency:e.target.value as Currency})}><option value="USD">USD</option><option value="XAF">XAF</option><option value="EUR">EUR</option></select></div>
          <div className="field"><label>Risk (%)</label><input type="number" step="0.001" value={tradeDraft.risk_percent} onChange={e=>setTradeDraft({...tradeDraft,risk_percent:e.target.value})}/></div>
          <div className="field"><label>Reward : risk</label><input type="number" step="0.001" value={tradeDraft.reward_risk} onChange={e=>setTradeDraft({...tradeDraft,reward_risk:e.target.value})} placeholder="e.g. 3"/></div>
          <div className="field"><label>Entry price</label><input type="number" step="any" value={tradeDraft.entry_price} onChange={e=>setTradeDraft({...tradeDraft,entry_price:e.target.value})}/></div>
          <div className="field"><label>Exit price</label><input type="number" step="any" value={tradeDraft.exit_price} onChange={e=>setTradeDraft({...tradeDraft,exit_price:e.target.value})}/></div>
          <div className="field"><label>Opened at</label><input type="datetime-local" value={tradeDraft.opened_at} onChange={e=>setTradeDraft({...tradeDraft,opened_at:e.target.value})}/></div>
          <div className="field"><label>Chart screenshots</label><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e=>setTradeFiles(Array.from(e.target.files||[]))}/><span className="tiny muted">{tradeFiles.length} file(s) selected</span></div>
          <div className="field full"><label>Trade thesis, execution and lessons</label><textarea value={tradeDraft.notes} onChange={e=>setTradeDraft({...tradeDraft,notes:e.target.value})} placeholder="Why did you take this setup? What confirmed it? Did you follow your plan? What would you improve?"/></div>
        </div><div className="form-actions"><button type="button" className="secondary-button" onClick={()=>setShowTradeForm(false)}>Cancel</button><button className="primary-button" disabled={working}><Plus size={13}/> Save trade</button></div></form>
      </div>}
      <div className="grid grid-2 panel">{recentTrades.length ? recentTrades.map(t=><div className="trade-card" key={t.id}><div className="trade-head"><div><div className="trade-symbol">{t.instrument}</div><div className="trade-details"><span>{t.direction.toUpperCase()}</span><span>·</span><span>{new Date(t.opened_at).toLocaleString()}</span></div></div><span className={"status "+(t.result==="win"?"green":t.result==="loss"?"red":t.result==="open"?"blue":"amber")}>{t.result}</span></div><div className="trade-details"><span>{t.setup || "No setup tagged"}</span>{t.risk_percent!==null&&<span>Risk {t.risk_percent}%</span>}{t.reward_risk!==null&&<span>R:R {t.reward_risk}</span>}</div><div style={{ font:"800 20px Manrope",color:Number(t.pnl_usd)>=0?"var(--green)":"var(--red)",margin:"6px 0" }}>{t.result==="open"?"Open":(Number(t.pnl_usd)>=0?"+":"")+money(t.pnl_usd)}</div>{t.notes&&<div className="trade-notes">{t.notes}</div>}{t.screenshotUrls?.length ? <div className="trade-images">{t.screenshotUrls.map((url,i)=><a href={url} target="_blank" rel="noreferrer" key={i}><img src={url} alt={"Trade screenshot "+(i+1)}/></a>)}</div>:null}<div style={{ display:"flex",justifyContent:"flex-end",marginTop:10 }}><button className="danger-button" onClick={()=>void deleteTrade(t)}>Delete entry</button></div></div>) : <div className="card empty" style={{ gridColumn:"1/-1" }}><Camera size={25}/><div>No trades journaled yet. Add your first setup, then attach the chart screenshots.</div><button className="primary-button" style={{marginTop:12}} onClick={()=>setShowTradeForm(true)}><Plus size={13}/> Journal first trade</button></div>}</div>
    </>;
  }

  function renderAnalytics() {
    const pieColors = ["#f4c64e","#ac8bff","#68b7ff","#54d69b","#ff7582","#ed9a57"];
    return <>
      <div className="grid grid-4"><KPI label="Net profit" value={money(netProfit)} note="Actual profit after costs" icon={CircleDollarSign} color="green"/><KPI label="Target completion" value={targetPct.toFixed(1)+"%"} note={money(Math.max(0,target-netProfit))+" still to go"} icon={Target}/><KPI label="Income sources" value={String(sourceData.length)} note="Distinct sources recorded" icon={BriefcaseBusiness} color="blue"/><KPI label="Trade win rate" value={closedTrades?winRate+"%":"—"} note={closedTrades+" closed trades" } icon={Activity} color="violet"/></div>
      <div className="grid grid-2 panel"><div className="card"><div className="card-title-row"><div><h3 className="card-title">Income & expense trend</h3><div className="card-subtitle">Daily USD equivalent · last 14 days</div></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="label" tick={{fill:"#7f8a9d",fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#7f8a9d",fontSize:9}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#121722",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,fontSize:10}} formatter={(v)=>money(Number(v))}/><Area type="monotone" dataKey="income" stroke="#54d69b" fill="#54d69b" fillOpacity={.12} strokeWidth={2}/><Area type="monotone" dataKey="expenses" stroke="#ff7582" fill="#ff7582" fillOpacity={.08} strokeWidth={2}/></AreaChart></ResponsiveContainer></div></div>
        <div className="card"><div className="card-title-row"><div><h3 className="card-title">Income by source</h3><div className="card-subtitle">Collected income only · pending excluded</div></div></div>{sourceData.length?<><div className="chart-wrap short"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={3}>{sourceData.map((_,i)=><Cell key={i} fill={pieColors[i%pieColors.length]}/>)}</Pie><Tooltip contentStyle={{background:"#121722",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,fontSize:10}} formatter={(v)=>money(Number(v))}/></PieChart></ResponsiveContainer></div><div className="chart-legend">{sourceData.map((x,i)=><span key={x.name}><i className="legend-dot" style={{background:pieColors[i%pieColors.length]}}/>{x.name}: {money(x.value)}</span>)}</div></>:<div className="empty"><BarChart3 size={24}/><div>Log income from different sources to populate this chart.</div></div>}</div>
      </div>
      <div className="section-heading"><div><h2>Performance notes</h2><p>Use the numbers to decide where to focus next.</p></div></div>
      <div className="grid grid-3"><div className="card"><div className="card-title">Revenue discipline</div><div className="project-copy">Pending income is not counted as collected cash, and refunded amounts are deducted from the total.</div><div className="kpi-value" style={{fontSize:22}}>{money(pending)}</div><div className="tiny muted">Awaiting collection</div></div><div className="card"><div className="card-title">Expense visibility</div><div className="project-copy">All recorded expenses reduce net profit, including advertising, subscriptions, platform fees and delivery.</div><div className="kpi-value" style={{fontSize:22}}>{money(spent)}</div><div className="tiny muted">Total expenses logged</div></div><div className="card"><div className="card-title">Trading discipline</div><div className="project-copy">A journal makes each setup reviewable. It does not treat an open trade or expected payout as realized cash.</div><div className="kpi-value" style={{fontSize:22}}>{trades.length}</div><div className="tiny muted">Entries in your journal</div></div></div>
    </>;
  }

  function renderSettings() {
    return <>
      <div className="settings-tabs">{["Profile","Preferences","Finance","Account","Data"].map(x=><button key={x} className={settingsTab===x?"active":""} onClick={()=>setSettingsTab(x)}>{x}</button>)}</div>
      {settingsTab==="Profile"&&<form className="card" onSubmit={saveSettings}><div className="card-title-row"><div><h3 className="card-title">Profile details</h3><div className="card-subtitle">Control the name and identity shown across your workspace.</div></div><span className="status green">Private account</span></div><div className="form-grid"><div className="field"><label>Display name</label><input value={profileDraft.full_name} onChange={e=>setProfileDraft({...profileDraft,full_name:e.target.value})} placeholder="Your name"/></div><div className="field"><label>Email address</label><input readOnly value={user.email||""}/></div></div><div className="form-actions"><button className="primary-button" disabled={working}>Save profile</button></div></form>}
      {settingsTab==="Preferences"&&<form className="card" onSubmit={saveSettings}><div className="card-title-row"><div><h3 className="card-title">Workspace appearance</h3><div className="card-subtitle">Choose a comfortable theme and accent color.</div></div></div><div className="field" style={{marginBottom:18}}><label>Theme</label><div className="segmented" style={{width:"fit-content"}}>{["dark","light"].map(x=><button type="button" key={x} className={profileDraft.theme===x?"active":""} onClick={()=>setProfileDraft({...profileDraft,theme:x as "dark"|"light"})}>{x==="dark"?"Dark":"Light"}</button>)}</div></div><div className="field"><label>Accent color</label><div className="color-options">{Object.entries({gold:"#f4c64e",violet:"#ac8bff",blue:"#68b7ff",mint:"#54d69b",rose:"#ff7582"}).map(([name,color])=><button type="button" title={name} key={name} className={"color-swatch "+(profileDraft.accent===name?"selected":"")} style={{background:color}} onClick={()=>setProfileDraft({...profileDraft,accent:name})}/>)}</div></div><div className="field" style={{marginTop:18}}><label>Timezone</label><select value={profileDraft.timezone} onChange={e=>setProfileDraft({...profileDraft,timezone:e.target.value})}><option value="Africa/Douala">Africa/Douala (Cameroon)</option><option value="UTC">UTC</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></select></div><div className="form-actions"><button className="primary-button" disabled={working}>Save preferences</button></div></form>}
      {settingsTab==="Finance"&&<form className="card" onSubmit={saveSettings}><div className="card-title-row"><div><h3 className="card-title">Financial defaults</h3><div className="card-subtitle">Exchange rates are manual estimates used to compare multi-currency records. Update them when needed.</div></div></div><div className="form-grid"><div className="field"><label>Display currency</label><select value={profileDraft.base_currency} onChange={e=>setProfileDraft({...profileDraft,base_currency:e.target.value as Currency})}><option value="XAF">FCFA (XAF)</option><option value="USD">US Dollar (USD)</option><option value="EUR">Euro (EUR)</option></select></div><div className="field"><label>Monthly net profit target (USD)</label><input type="number" min="1" value={profileDraft.monthly_profit_target_usd} onChange={e=>setProfileDraft({...profileDraft,monthly_profit_target_usd:e.target.value})}/></div><div className="field"><label>FCFA per 1 USD</label><input type="number" min="1" step="any" value={profileDraft.xaf_per_usd} onChange={e=>setProfileDraft({...profileDraft,xaf_per_usd:e.target.value})}/></div><div className="field"><label>USD per 1 EUR</label><input type="number" min=".01" step="any" value={profileDraft.eur_to_usd} onChange={e=>setProfileDraft({...profileDraft,eur_to_usd:e.target.value})}/></div></div><div className="auth-success" style={{marginTop:16}}>The exchange rate is stored on each new entry as a USD equivalent. Changing rates later does not rewrite old entries.</div><div className="form-actions"><button className="primary-button" disabled={working}>Save financial settings</button></div></form>}
      {settingsTab==="Account"&&<div className="card"><div className="card-title-row"><div><h3 className="card-title">Account & security</h3><div className="card-subtitle">Your sign-in is handled by Supabase Auth. User data is isolated with row-level security.</div></div><ShieldCheck size={20} color="var(--green)"/></div><div className="task-row"><span className="muted">Signed in as</span><b style={{marginLeft:"auto"}}>{user.email}</b></div><div className="task-row"><span className="muted">Workspace owner</span><b style={{marginLeft:"auto"}}>{profile.full_name||"Name not set"}</b></div><div className="task-row"><span className="muted">Data isolation</span><span className="status green" style={{marginLeft:"auto"}}>RLS enabled</span></div><button className="danger-button" style={{marginTop:18}} onClick={()=>void signOut()}><LogOut size={13} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/> Sign out</button></div>}
      {settingsTab==="Data"&&<div className="card"><div className="card-title-row"><div><h3 className="card-title">Data portability</h3><div className="card-subtitle">Export your records to keep your own copy.</div></div><Download size={18} color="var(--gold)"/></div><p className="project-copy">Download a JSON archive of your profile, income, expenses, goals, tasks, projects and trade journal. Screenshot files remain in your private Supabase Storage bucket.</p><button className="primary-button" onClick={()=>void exportData()}><Download size={13}/> Export workspace data</button><div className="auth-success" style={{marginTop:17}}>No destructive reset action is exposed here. Deleting records or closing the account should be a deliberate action, not an accidental click.</div></div>}
    </>;
  }

  const content = () => {
    switch(screen) {
      case "overview": return renderOverview();
      case "goals": return renderGoals();
      case "income": return renderIncome();
      case "finance": return renderFinance();
      case "tasks": return renderTasks();
      case "projects": return renderProjects();
      case "trading": return renderTrading();
      case "analytics": return renderAnalytics();
      case "settings": return renderSettings();
    }
  };

  return <div className="app-shell">
    {mobileOpen&&<div className="mobile-backdrop" onClick={()=>setMobileOpen(false)}/>}
    <aside className={"sidebar "+(mobileOpen?"open":"")}>
      <div className="brand"><div className="brand-mark">N</div><div><div className="brand-name">NOVEMBER</div><div className="brand-sub">Command Centre</div></div></div>
      {["Workspace","Money","Focus areas","Account"].map(group=><div key={group}><div className="nav-label">{group}</div><div className="nav-list">{nav.filter(x=>x.group===group).map(item=>{const Icon=item.icon;return <button key={item.id} className={"nav-item "+(screen===item.id?"active":"")} onClick={()=>{setScreen(item.id);setMobileOpen(false);}}><Icon size={16}/>{item.label}</button>;})}</div></div>)}
      <div className="sidebar-bottom"><div className="sidebar-goal"><small>NET PROFIT TARGET</small><strong>{money(netProfit)} <span style={{fontSize:10,color:"var(--muted)",fontWeight:600}}> / {money(target)}</span></strong><div className="progress"><span style={{width:targetPct+"%"}}/></div><small style={{display:"block",marginTop:8}}>{targetPct.toFixed(1)}% completed</small></div><div className="sidebar-user"><div className="avatar">{initials(profile.full_name||user.email||"C")}</div><div style={{minWidth:0,flex:1}}><div className="user-name">{profile.full_name||"Your workspace"}</div><div className="user-email">{user.email}</div></div><button className="icon-button" style={{width:29,height:29}} onClick={()=>setScreen("settings")}><Settings2 size={13}/></button></div></div>
    </aside>
    <main className="main"><Header/>{dataError&&<div className="auth-error" style={{marginBottom:16}}>Database issue: {dataError}. Check that the supplied migration has been applied and that the Auth user has the correct permissions.</div>}{content()}</main>
    {toast&&<div style={{position:"fixed",right:18,bottom:18,zIndex:60,background:toast.kind==="error"?"#3a1d27":"#173328",border:"1px solid "+(toast.kind==="error"?"rgba(255,117,130,.35)":"rgba(84,214,155,.3)"),borderRadius:12,padding:"12px 15px",boxShadow:"var(--shadow)",fontSize:11,color:"#eff4f8",maxWidth:320}}>{toast.kind==="error"?"Something went wrong: ":""}{toast.text}</div>}
    {working&&<div style={{position:"fixed",top:0,left:0,right:0,height:2,zIndex:70,background:"linear-gradient(90deg,transparent,var(--gold),transparent)",animation:"loadingbar 1.1s linear infinite"}}/>}
  </div>;
}
