export type PlanId = 'Starter' | 'Growth' | 'Scale';

export type PlanDefinition = {
  id: PlanId;
  name: string;
  monthlyInr: number;
  monthlyCredits: number;
  limits: {
    chatsPerMonth: number;
    workflows: number;
    videoProjects: number;
    videoExports: number;
    transcriptionMinutes: number;
    seats: number;
  };
  features: string[];
};

const approximateRates: Record<string, number> = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  AED: 0.044,
  AUD: 0.018,
  CAD: 0.016,
  SGD: 0.016,
};

export const planCatalog: PlanDefinition[] = [
  {
    id: 'Starter',
    name: 'Starter',
    monthlyInr: 500,
    monthlyCredits: 10000,
    limits: {
      chatsPerMonth: 500,
      workflows: 10,
      videoProjects: 5,
      videoExports: 10,
      transcriptionMinutes: 120,
      seats: 2,
    },
    features: ['AI chat', 'basic workflows', 'video captions', 'standard exports'],
  },
  {
    id: 'Growth',
    name: 'Growth',
    monthlyInr: 1000,
    monthlyCredits: 30000,
    limits: {
      chatsPerMonth: 2000,
      workflows: 50,
      videoProjects: 25,
      videoExports: 50,
      transcriptionMinutes: 500,
      seats: 10,
    },
    features: ['higher AI limits', 'workflow automations', 'priority video captions', 'team workspace'],
  },
  {
    id: 'Scale',
    name: 'Scale',
    monthlyInr: 2000,
    monthlyCredits: 90000,
    limits: {
      chatsPerMonth: 8000,
      workflows: 200,
      videoProjects: 100,
      videoExports: 200,
      transcriptionMinutes: 2000,
      seats: 50,
    },
    features: ['scale limits', 'advanced automations', 'bulk video work', 'admin controls'],
  },
];

export function getPlan(planId: PlanId) {
  return planCatalog.find((plan) => plan.id === planId) ?? planCatalog[0];
}

export function formatPlanPrice(monthlyInr: number, locale = 'en-IN', currency = 'INR') {
  const normalizedCurrency = currency.toUpperCase();
  const rate = approximateRates[normalizedCurrency] ?? approximateRates.INR;
  const amount = monthlyInr * rate;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalizedCurrency,
    maximumFractionDigits: normalizedCurrency === 'INR' ? 0 : 2,
  }).format(amount);
}

export function localizePlans(locale = 'en-IN', currency = 'INR') {
  return planCatalog.map((plan) => ({
    ...plan,
    displayPrice: formatPlanPrice(plan.monthlyInr, locale, currency),
  }));
}
