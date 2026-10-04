'use client';

import { useState } from 'react';
import type { Locale } from '../i18n.ts';
import { M05_POLICY_TEMPLATES } from './policy-templates.ts';

const labels: Record<Locale, Readonly<Record<string, string>>> = {
  en: {
    title: 'Policy builder & review',
    intro:
      'Select a bounded template, inspect every constraint, then run structural validation only.',
    reduce: 'Bounded reduce · 10% maximum',
    close: 'Close on drawdown · explicit 100% maximum',
    draft: 'Untrusted plain-language proposal',
    placeholder:
      'Describe a protection request. This text stays local and is not interpreted by an LLM.',
    notSent: 'Not sent · no LLM · proposal only · does not create authority',
    validation: 'Validate structured draft',
    compiling: 'Validating…',
    status: 'Compiler status',
    noTemplate: 'Choose a template to inspect its exact structured policy.',
    warning: 'Example template · not saved · not confirmed · no permission granted',
    errors: 'Validation unavailable. The draft remains local and unconfirmed.',
    notPersisted: 'Never confirmed or persisted by this screen.',
    blocked: 'MAINNET effect: HARD_BLOCKED · Live Perpl writes: BLOCKED',
  },
  'pt-BR': {
    title: 'Construtor e revisão de políticas',
    intro:
      'Selecione um modelo limitado, inspecione cada restrição e execute apenas validação estrutural.',
    reduce: 'Redução limitada · máximo 10%',
    close: 'Fechar por drawdown · máximo explícito de 100%',
    draft: 'Proposta não confiável em linguagem natural',
    placeholder:
      'Descreva uma solicitação de proteção. O texto fica local e não é interpretado por LLM.',
    notSent: 'Não enviado · sem LLM · somente proposta · não cria autoridade',
    validation: 'Validar rascunho estruturado',
    compiling: 'Validando…',
    status: 'Estado do compilador',
    noTemplate: 'Escolha um modelo para inspecionar a política estruturada exata.',
    warning: 'Modelo de exemplo · não salvo · não confirmado · nenhuma permissão concedida',
    errors: 'Validação indisponível. O rascunho permanece local e não confirmado.',
    notPersisted: 'Esta tela nunca confirma nem persiste a política.',
    blocked: 'Efeito em mainnet: HARD_BLOCKED · Escritas Perpl ao vivo: BLOCKED',
  },
  es: {
    title: 'Constructor y revisión de políticas',
    intro:
      'Elige una plantilla limitada, inspecciona cada restricción y ejecuta solo validación estructural.',
    reduce: 'Reducción acotada · máximo 10%',
    close: 'Cerrar por drawdown · máximo explícito de 100%',
    draft: 'Propuesta no confiable en lenguaje natural',
    placeholder:
      'Describe una solicitud de protección. El texto queda local y no lo interpreta un LLM.',
    notSent: 'No enviado · sin LLM · solo propuesta · no crea autoridad',
    validation: 'Validar borrador estructurado',
    compiling: 'Validando…',
    status: 'Estado del compilador',
    noTemplate: 'Elige una plantilla para inspeccionar la política estructurada exacta.',
    warning: 'Plantilla de ejemplo · no guardada · no confirmada · sin permiso concedido',
    errors: 'Validación no disponible. El borrador sigue local y sin confirmar.',
    notPersisted: 'Esta pantalla nunca confirma ni persiste la política.',
    blocked: 'Efecto en mainnet: HARD_BLOCKED · Escrituras Perpl en vivo: BLOCKED',
  },
};

export function PolicyWorkbench({ locale }: { readonly locale: Locale }) {
  const text = labels[locale];
  const [selected, setSelected] = useState<keyof typeof M05_POLICY_TEMPLATES>('boundedReduce');
  const [plainText, setPlainText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | undefined>();
  const policy = M05_POLICY_TEMPLATES[selected];

  async function validateTemplate() {
    setBusy(true);
    setResult(undefined);
    try {
      const response = await fetch('/api/policies/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          schemaVersion: '0.1',
          policy,
          correlationId: `m05-template-${selected}`,
        }),
      });
      setResult((await response.json()) as Record<string, unknown>);
    } catch {
      setResult({ status: 'UNAVAILABLE' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel policy-workbench" aria-labelledby="policy-workbench-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">M03 COMPILER · VALIDATION ONLY</p>
          <h2 id="policy-workbench-title">{text.title}</h2>
        </div>
        <span className="state-tag">NO AUTHORITY</span>
      </div>
      <p>{text.intro}</p>
      <div className="template-picker" role="group" aria-label={text.title}>
        <button
          className="button button-secondary"
          type="button"
          aria-pressed={selected === 'boundedReduce'}
          onClick={() => {
            setSelected('boundedReduce');
            setResult(undefined);
          }}
        >
          {text.reduce}
        </button>
        <button
          className="button button-secondary"
          type="button"
          aria-pressed={selected === 'closeOnDrawdown'}
          onClick={() => {
            setSelected('closeOnDrawdown');
            setResult(undefined);
          }}
        >
          {text.close}
        </button>
      </div>
      <p className="trust-notice compact-notice">
        {text.warning} · {text.blocked}
      </p>
      <details className="policy-details" open>
        <summary>
          {locale === 'pt-BR'
            ? 'Restrições estruturadas (JSON)'
            : locale === 'es'
              ? 'Restricciones estructuradas (JSON)'
              : 'Structured constraints (JSON)'}
        </summary>
        <pre
          tabIndex={0}
          aria-label={
            locale === 'pt-BR'
              ? 'JSON da política estruturada'
              : locale === 'es'
                ? 'JSON de política estructurada'
                : 'Structured policy JSON'
          }
        >
          {JSON.stringify(policy, null, 2)}
        </pre>
      </details>
      <div className="button-row">
        <button
          className="button button-primary"
          type="button"
          onClick={validateTemplate}
          disabled={busy}
        >
          {busy ? text.compiling : text.validation}
        </button>
      </div>
      <p className="fine-print">
        {text.status}: {String(result?.status ?? 'NOT_VALIDATED')} ·{' '}
        {String(result?.authority ?? 'NO_AUTHORITY')} · {text.notPersisted}
      </p>
      {result?.status === 'INVALID' || result?.status === 'UNAVAILABLE' ? (
        <p role="status">{text.errors}</p>
      ) : null}
      <label className="field-label" htmlFor="untrusted-policy-proposal">
        {text.draft}
      </label>
      <textarea
        id="untrusted-policy-proposal"
        value={plainText}
        onChange={(event) => setPlainText(event.target.value)}
        placeholder={text.placeholder}
      />
      <p className="fine-print">{text.notSent}</p>
    </section>
  );
}
