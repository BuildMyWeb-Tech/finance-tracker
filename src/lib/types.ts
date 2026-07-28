export type TransactionType = 'income' | 'expense' | 'transfer';
export type PaymentMode = 'cash' | 'bank';
export type Person = 'Appa' | 'Amma' | 'Ajai' | 'Mauli';
export type HomeOrDebt = 'home' | 'debt';

export const PERSONS: Person[] = ['Appa', 'Amma', 'Ajai', 'Mauli'];

export interface Account {
  id: string;
  person: Person;
  name: string;
  type: 'cash' | 'bank';
}

export const ACCOUNTS: Account[] = [
  { id: 'appa-cash', person: 'Appa', name: 'Appa Cash', type: 'cash' },
  { id: 'appa-sbi', person: 'Appa', name: 'Appa SBI', type: 'bank' },
  { id: 'appa-ajai-sbi', person: 'Appa', name: 'Appa Ajai SBI', type: 'bank' },
  { id: 'appa-cnb', person: 'Appa', name: 'Appa CNB', type: 'bank' },
  { id: 'amma-cash', person: 'Amma', name: 'Amma Cash', type: 'cash' },
  { id: 'ajai-cash', person: 'Ajai', name: 'Ajai Cash', type: 'cash' },
  { id: 'ajai-cb', person: 'Ajai', name: 'Ajai CB', type: 'bank' },
  { id: 'ajai-cnb', person: 'Ajai', name: 'Ajai CNB', type: 'bank' },
  { id: 'ajai-pnb', person: 'Ajai', name: 'Ajai PNB', type: 'bank' },
  { id: 'mauli-cash', person: 'Mauli', name: 'Mauli Cash', type: 'cash' },
  { id: 'mauli-sbi', person: 'Mauli', name: 'Mauli SBI', type: 'bank' },
  { id: 'mauli-cnb', person: 'Mauli', name: 'Mauli CNB', type: 'bank' },
];

export function getAccountsForPerson(person: Person): Account[] {
  return ACCOUNTS.filter(a => a.person === person);
}
export function getCashAccounts(): Account[] {
  return ACCOUNTS.filter(a => a.type === 'cash');
}
export function getBankAccounts(): Account[] {
  return ACCOUNTS.filter(a => a.type === 'bank');
}

export const HOME_INCOME_CATEGORIES = [
  'Appa Salary', 'Ajai Salary', 'Vaati', 'Allowance',
   'Ration Income', 'Mill SVRM Mann.',
] as const;

export const DEBT_INCOME_CATEGORIES = [
  'Ajai Extra', 'Appa Extra Earnings', 'Home Extra', 'BMW',
] as const;

export const INCOME_CATEGORIES = [
  ...HOME_INCOME_CATEGORIES,
  ...DEBT_INCOME_CATEGORIES,
] as const;

export const EXPENSE_CATEGORIES = [
  'Rent', 'Milk', 'Rice', 'Cylinder', 'EB',
  'Mangal', 'Medicine', 'Vegetables', 'Grocery', 'Snacks',
  'Petrol', 'Cable', 'Recharge', 'Hotel/Food', 'Non Veg',
  'Ration', 'Maavu', 'Others',
] as const;

export const DEBT_EXPENSE_CATEGORIES = [
  'Loan Repaid', 'Kannan Mama', 'Other Debt Expense',
] as const;

export type IncomeCategory = typeof INCOME_CATEGORIES[number];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export interface IncomeSource {
  id: string;
  name: string;
  group: 'home' | 'debt';
  defaultExpected: number;
}

export interface ExpenseSource {
  id: string;
  name: string;
  group: 'home' | 'debt';
  defaultBudget: number;
}

export interface Transaction {
  id: string;
  date: string;
  year: number;
  month: number;
  person: Person;
  type: TransactionType;
  category: string;
  amount: number;
  paymentMode: PaymentMode;
  notes: string;
  transferTo?: Person;
  accountId?: string;
  transferToAccountId?: string;
  homeOrDebt: HomeOrDebt;
  expectedAmount?: number;
}

export interface Budget {
  category: string;
  amount: number;
  month: number;
  year: number;
}

export interface RecurringEntry {
  id: string;
  person: Person;
  type: TransactionType;
  category: string;
  amount: number;
  paymentMode: PaymentMode;
  notes: string;
  dayOfMonth: number;
  transferTo?: Person;
  homeOrDebt?: HomeOrDebt;
  accountId?: string;
}

export interface MonthData {
  year: number;
  month: number;
  openingBalance: number;
}

export interface FinancialState {
  transactions: Transaction[];
  budgets: Budget[];
  recurringEntries: RecurringEntry[];
  monthData: MonthData[];
  accountBalances: Record<string, number>;
  initialBalances: Record<Person, number>;
  // ✅ NEW: real physical balances per account — persisted in Supabase app_config
  realBalances: Record<string, number>;
  // Custom sources
  incomeSources?: IncomeSource[];
  expenseSources?: ExpenseSource[];
  accountNames?: Record<string, string>;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DEFAULT_BUDGETS: Record<string, number> = {
  'Rent': 7000, 'Milk': 1300, 'Rice': 1000, 'Cylinder': 950, 'EB': 500,
  'Mangal': 2000, 'Medicine': 3500, 'Vegetables': 2000, 'Grocery': 4000,
  'Snacks': 1500, 'Petrol': 3000, 'Cable': 280, 'Recharge': 1300,
  'Hotel/Food': 1000, 'Non Veg': 200, 'Ration': 120, 'Maavu': 150, 'Others': 430,
};

export const DEFAULT_EXPECTED_INCOME: Record<string, number> = {
  'Appa Salary': 10200, 'Ajai Salary': 15000, 'Vaati': 2000,
  'Allowance': 2500, 'Ration Income': 380,
  'Mill SVRM Mann.': 150, 'Ajai Extra': 25000, 'Appa Extra Earnings': 0,
  'Home Extra': 0, 'BMW': 10000, 'Debt Income': 0, 'Other Income': 0,
};

export const DEFAULT_EXPECTED_DEBT_EXPENSE: Record<string, number> = {
  'Loan Repaid': 30000, 'Appa Ayyapan Kovil': 0, 'Kannan Mama': 5000,
};