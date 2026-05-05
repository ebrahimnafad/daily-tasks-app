export interface Income {
  id: string | number;
  title: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'once' | string;
  isActive?: boolean;
}

export interface Obligation {
  id: string | number;
  title: string;
  amount: number;
  frequency: string;
  type?: string;
  isActive?: boolean;
  dueDay?: number;
  category?: string;
  notes?: string;
}

export interface Payment {
  id: string | number;
  obligationId: string | number;
  date: string;
  status: 'paid' | 'pending' | string;
  amount: number;
  notes?: string;
}

export interface Goal {
  id: string | number;
  title: string;
  targetAmount: number;
  currentSaved: number;
  notes?: string;
}

export interface FinanceModalState {
  mode: 'add' | 'edit';
  data?: Obligation;
}

export interface PaymentDrawerState {
  mode: 'register' | 'view';
  obligationId: string | number;
}
