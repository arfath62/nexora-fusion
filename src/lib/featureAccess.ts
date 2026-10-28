import type { PlanDefinition, WorkspaceSettings } from '../services/DatabaseService';

export type PlanId = WorkspaceSettings['plan'];
export type FeatureKey = 'chat' | 'video' | 'agents';

const planOrder: Record<PlanId, number> = {
  Starter: 1,
  Growth: 2,
  Scale: 3,
};

const featureMinimumPlan: Record<FeatureKey, PlanId> = {
  chat: 'Starter',
  video: 'Growth',
  agents: 'Scale',
};

export const betaLockedFeatures: Partial<Record<FeatureKey, string>> = {
  agents: 'AI Agents is in private beta and is locked for all users right now.',
};

export const publicPlanCatalog: PlanDefinition[] = [
  {
    id: 'Starter',
    name: 'Starter',
    monthlyInr: 500,
    displayPrice: 'Rs. 500',
    monthlyCredits: 10000,
    limits: {
      chatsPerMonth: 500,
      workflows: 0,
      videoProjects: 0,
      videoExports: 0,
      transcriptionMinutes: 0,
      seats: 2,
    },
    features: ['AI chat', '500 chats/month', '10,000 monthly credits', '2 seats'],
  },
  {
    id: 'Growth',
    name: 'Growth',
    monthlyInr: 1500,
    displayPrice: 'Rs. 1,500',
    monthlyCredits: 30000,
    limits: {
      chatsPerMonth: 2000,
      workflows: 0,
      videoProjects: 25,
      videoExports: 50,
      transcriptionMinutes: 500,
      seats: 10,
    },
    features: ['Everything in Starter', 'Video editor', 'Captions and exports', 'Team workspace'],
  },
  {
    id: 'Scale',
    name: 'Scale',
    monthlyInr: 2500,
    displayPrice: 'Rs. 2,500',
    monthlyCredits: 90000,
    limits: {
      chatsPerMonth: 8000,
      workflows: 0,
      videoProjects: 100,
      videoExports: 200,
      transcriptionMinutes: 2000,
      seats: 50,
    },
    features: ['Everything in Growth', 'Scale limits', 'Priority workloads', 'Admin controls'],
  },
];

export function canUsePlanFeature(plan: PlanId, feature: FeatureKey) {
  if (betaLockedFeatures[feature]) return false;
  return planOrder[plan] >= planOrder[featureMinimumPlan[feature]];
}

export function getFeatureAccess(feature: FeatureKey, plan: PlanId) {
  const minimumPlan = featureMinimumPlan[feature];
  const betaMessage = betaLockedFeatures[feature];
  const available = canUsePlanFeature(plan, feature);

  return {
    available,
    minimumPlan,
    message:
      betaMessage ??
      (available
        ? 'Available on your current plan.'
        : `Upgrade to ${minimumPlan} to use this feature.`),
  };
}
