# NERVA UI/UX

Status: CANONICAL — NERVA-WO-001

## Product experience goal
Make autonomous risk protection understandable before it is powerful. A user should know: current risk, what NERVA is allowed to do, why it acted, and how to stop it.

## V0.1 information architecture
1. Onboarding / wallet connection / environment indicator.
2. Portfolio Overview.
3. Position Risk Detail.
4. Policy Builder.
5. Policy Review & Confirmation.
6. Active Protection / Live Monitor.
7. Flight Recorder.
8. Integrations/Permissions.
9. Emergency Controls.

## Dashboard
Must show:
- portfolio/position context;
- normalized risk state;
- key metrics with source/freshness;
- active policy summary;
- integration health;
- clear ACTIVE/PAUSED/DEMO_ONLY/DEGRADED state.

Avoid a fake universal "AI risk score" that hides mechanics. If a composite score exists, show its component metrics and limitations.

## Policy creation
Natural-language input is optional convenience. Always render the resulting structured constraints before confirmation:
- trigger;
- action;
- maximum action size/notional;
- slippage;
- allowed protocol/market;
- cooldown/expiry;
- fallback/refusal behavior.

## Flight Recorder
For each decision/action show:
Why did NERVA evaluate? What data did it use? Which policy version? What condition passed/failed? What plan was proposed? Did simulation pass? What did the wallet authorize? What was the final observed outcome?

## Demo UX
Synthetic shock controls are visibly labeled DEMO ONLY and separated from live controls. One-click reset to documented demo state. Never show synthetic data as live chain/provider evidence.

## Accessibility/responsiveness
Keyboard-accessible core flow, semantic status text not color alone, readable contrast, mobile-friendly monitoring, desktop-first policy detail for V0.1.

## Trust language
No "guaranteed safe", "can't be liquidated", "AI will save you" or profit claims.
