import { useEffect, useState } from 'react';
import { Check, CreditCard, Lock } from 'lucide-react';
import databaseService, { type AccountOverview, type PlanDefinition, type WorkspaceSettings } from '../services/DatabaseService';
import { betaLockedFeatures } from '../lib/featureAccess';

export default function BillingPage() {
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [status, setStatus] = useState('Loading billing workspace...');
  const [savingPlan, setSavingPlan] = useState<WorkspaceSettings['plan'] | null>(null);

  useEffect(() => {
    Promise.all([databaseService.getAccountOverview(), databaseService.getPlans()])
      .then(([account, catalog]) => {
        setOverview(account);
        setPlans(account.plans?.length ? account.plans : catalog);
        setStatus('Choose the plan that matches your usage.');
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : 'Could not load billing.');
      });
  }, []);

  const activePlan = overview?.workspace.plan ?? 'Starter';
  const usage = overview?.usage;

  async function selectPlan(plan: PlanDefinition) {
    if (!overview || plan.id === activePlan) return;
    setSavingPlan(plan.id);
    setStatus(`Switching workspace to ${plan.name}...`);
    try {
      const workspace = await databaseService.saveWorkspaceSettings({
        ...overview.workspace,
        plan: plan.id,
        seats: Math.min(overview.workspace.seats, plan.limits.seats),
        monthlyCredits: plan.monthlyCredits,
      });
      setOverview({
        ...overview,
        workspace,
        activePlan: plan,
      });
      setStatus(`${plan.name} is now active for this workspace.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update plan.');
    } finally {
      setSavingPlan(null);
    }
  }

  return (
    <div className="min-h-full p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm text-indigo-200">Billing</p>
          <h1 className="mt-1 text-2xl font-semibold">Plans and limits</h1>
          <p className="mt-2 text-sm text-gray-400">{status}</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
            <Lock size={13} />
            {betaLockedFeatures.agents} It will stay locked across every plan until launch.
          </p>
        </div>

        {usage && (
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Credits used', usage.creditsUsed],
              ['Chats', usage.chats],
              ['Workflows', usage.workflows],
              ['Video projects', usage.videoProjects],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="mt-2 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isActive = plan.id === activePlan;
            return (
              <div key={plan.id} className={`rounded-lg border p-5 ${isActive ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{plan.name}</h2>
                    <p className="mt-1 text-2xl font-bold">{plan.displayPrice}<span className="text-sm font-normal text-gray-400">/mo</span></p>
                  </div>
                  {isActive && <span className="rounded-full bg-indigo-500 px-2 py-1 text-xs">Active</span>}
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-300">
                  <p>{plan.monthlyCredits.toLocaleString()} monthly credits</p>
                  <p>{plan.limits.chatsPerMonth.toLocaleString()} chats/month</p>
                  <p>{plan.limits.videoProjects > 0 ? `${plan.limits.videoProjects} video projects` : 'Video editor locked'}</p>
                  <p>{plan.limits.videoExports > 0 ? `${plan.limits.videoExports} video exports` : 'Video exports locked'}</p>
                  <p>{plan.limits.transcriptionMinutes > 0 ? `${plan.limits.transcriptionMinutes} transcription minutes` : 'Transcription locked'}</p>
                  <p>AI Agents beta locked</p>
                </div>

                <div className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check size={14} className="text-emerald-300" />
                      {feature}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={isActive || savingPlan === plan.id || !overview}
                  onClick={() => selectPlan(plan)}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:bg-white/10 disabled:text-gray-400"
                >
                  <CreditCard size={16} />
                  {isActive ? 'Current plan' : savingPlan === plan.id ? 'Updating...' : 'Select plan'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
