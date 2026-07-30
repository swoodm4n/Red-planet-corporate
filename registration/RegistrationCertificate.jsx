/**
 * RegistrationCertificate.jsx
 *
 * "Subdivision Manager Registration" wizard for Red Planet Corporate.
 *
 * A multi-step, in-character registration form that ends in a printable/
 * downloadable "Certificate of Subdivision Registration" — a retro-futuristic
 * corporate-bureaucratic document in the Mars Colonial Authority house style.
 *
 * Zero dependencies beyond React itself. All styles are inlined in a single
 * scoped <style> block; every class name is prefixed with `rpc-` to avoid
 * collisions with a host application's own CSS.
 *
 * Usage:
 *   import RegistrationCertificate from './RegistrationCertificate';
 *   export default function App() { return <RegistrationCertificate />; }
 */

import React, { useMemo, useState } from "react";

/* -------------------------------------------------------------------------
 * Universe / lore constants — do not alter spelling or wording.
 * ---------------------------------------------------------------------- */

const DOCUMENT_CODE = "MCA-REG-2159";

const CORPORATIONS = [
  "Terra Agricultural Syndicate",
  "Unified Mining Consortium",
  "Stellar Dynamics Corporation",
  "Helix Pharmaceutical Group",
  "Omega Security Solutions",
  "Genesis Tech Industries",
];

const SPECIALIZATIONS = [
  "Mining & Extraction",
  "Agriculture & Hydroponics",
  "Aerospace & Logistics",
  "Biotech & Healthcare",
  "Security & Defense",
  "Research & Development",
  "Diplomacy & Trade",
  "Communications & Intelligence",
  "Other (specify)",
];

// Facility types, named per RULES.md section 7 ("Buildings & facilities").
const FACILITIES = [
  "Extraction Site",
  "Power Facility",
  "Water Reclamation",
  "Bio-Dome",
  "Habitat",
  "Research Lab",
  "Communications Array",
  "Defense Installation",
  "Trade Depot",
];

const COOPERATION_POLICIES = [
  "Cooperative",
  "Neutral / Opportunistic",
  "Competitive",
];

const PULL_QUOTES = [
  {
    text:
      "A subdivision that cannot be registered cannot be resourced. Register first. Build second. Survive third.",
    attribution: "Mars Colonial Authority Registration Standards Office",
  },
  {
    text: "Every registration is a promise. Every promise is audited.",
    attribution: "Internal Corporate Consortium Memo",
  },
  {
    text:
      "The corporations do not colonize planets. They colonize paperwork. The planet comes after.",
    attribution: "Mars Colonial Authority Operations Manual",
  },
];
// Pick the pull-quote once per module load; stable for the life of the page.
const PULL_QUOTE = PULL_QUOTES[0];

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

// Small stable string hash (FNV-1a, 32-bit) — deterministic, no dependencies.
function fnv1aHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Generates the per-subdivision Corporate ID (MCI-XXXXXX). Derived from the
// subdivision name plus a timestamp captured at generation time, so it is
// stable once produced (not re-randomized on every re-render).
function generateCorporateId(subdivisionName, seedTimestamp) {
  const seed = `${subdivisionName.trim().toLowerCase()}::${seedTimestamp}`;
  const hash = fnv1aHash(seed);
  const sixDigit = String(hash % 1000000).padStart(6, "0");
  return `MCI-${sixDigit}`;
}

// "Terran Date 2159.DDD" — DDD is the real-world day-of-year at generation
// time, re-framed under the in-universe year 2159.
function getTerranDate(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diffMs = date - start;
  const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return `Terran Date 2159.${String(dayOfYear).padStart(3, "0")}`;
}

function makeEmptyFormData() {
  return {
    subdivisionName: "",
    managerName: "",
    parentCorporation: "",
    specialization: "",
    specializationOther: "",
    missionStatement: "",
    objectives: "",
    startingFacility: "",
    cooperationPolicy: "",
    history: "",
  };
}

/* -------------------------------------------------------------------------
 * Wizard step definitions
 * ---------------------------------------------------------------------- */

const STEPS = [
  { key: "identity", label: "Subdivision Identity" },
  { key: "operations", label: "Operational Profile" },
  { key: "filings", label: "Corporate Filings" },
  { key: "review", label: "Review & Submit" },
];

function isStepComplete(stepKey, data) {
  switch (stepKey) {
    case "identity":
      return (
        data.subdivisionName.trim() !== "" &&
        data.managerName.trim() !== "" &&
        data.parentCorporation !== "" &&
        data.specialization !== "" &&
        (data.specialization !== "Other (specify)" ||
          data.specializationOther.trim() !== "")
      );
    case "operations":
      return (
        data.startingFacility !== "" &&
        data.cooperationPolicy !== "" &&
        data.missionStatement.trim() !== ""
      );
    case "filings":
      return data.objectives.trim() !== "";
    case "review":
      return true;
    default:
      return true;
  }
}

function resolvedSpecialization(data) {
  return data.specialization === "Other (specify)"
    ? data.specializationOther.trim()
    : data.specialization;
}

/* -------------------------------------------------------------------------
 * Main component
 * ---------------------------------------------------------------------- */

export default function RegistrationCertificate() {
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState(makeEmptyFormData);
  const [certificate, setCertificate] = useState(null); // { corporateId, issueDate }
  const [attemptedNext, setAttemptedNext] = useState(false);

  // Unique-ish suffix so multiple instances of this component on one page
  // don't collide on SVG <path id> / <textPath href> references.
  const [instanceId] = useState(
    () => `rpc-${Math.random().toString(36).slice(2, 9)}`
  );

  const currentStep = STEPS[stepIndex];
  const currentStepComplete = useMemo(
    () => isStepComplete(currentStep.key, formData),
    [currentStep.key, formData]
  );

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function goNext() {
    if (!currentStepComplete) {
      setAttemptedNext(true);
      return;
    }
    setAttemptedNext(false);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setAttemptedNext(false);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handleSubmitRegistration() {
    if (!isStepComplete("identity", formData) ||
        !isStepComplete("operations", formData) ||
        !isStepComplete("filings", formData)) {
      setAttemptedNext(true);
      return;
    }
    const now = new Date();
    setCertificate({
      corporateId: generateCorporateId(formData.subdivisionName, now.getTime()),
      issueDate: getTerranDate(now),
    });
  }

  function handleStartOver() {
    setFormData(makeEmptyFormData());
    setCertificate(null);
    setStepIndex(0);
    setAttemptedNext(false);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="rpc-root">
      <style>{CSS}</style>

      {certificate ? (
        <CertificateView
          data={formData}
          certificate={certificate}
          instanceId={instanceId}
          onPrint={handlePrint}
          onStartOver={handleStartOver}
        />
      ) : (
        <WizardView
          stepIndex={stepIndex}
          currentStep={currentStep}
          formData={formData}
          updateField={updateField}
          onNext={goNext}
          onBack={goBack}
          onSubmit={handleSubmitRegistration}
          attemptedNext={attemptedNext}
          currentStepComplete={currentStepComplete}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Wizard view — utilitarian, high-contrast, grid-based "systems register"
 * ---------------------------------------------------------------------- */

function WizardView({
  stepIndex,
  currentStep,
  formData,
  updateField,
  onNext,
  onBack,
  onSubmit,
  attemptedNext,
  currentStepComplete,
}) {
  const isLastFieldStep = currentStep.key === "review";

  return (
    <div className="rpc-wizard">
      <header className="rpc-wizard-header">
        <div className="rpc-doc-code">{DOCUMENT_CODE}</div>
        <h1 className="rpc-wizard-title">MARS COLONIAL INITIATIVE</h1>
        <h2 className="rpc-wizard-subtitle">
          SUBDIVISION MANAGER REGISTRATION
        </h2>
        <div className="rpc-classification">
          CLASSIFICATION: REGISTRATION DOCUMENTATION &mdash; PROSPECTIVE
          SUBDIVISION MANAGERS
        </div>
      </header>

      <ol className="rpc-progress" aria-label="Registration progress">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={
              "rpc-progress-item" +
              (i === stepIndex ? " rpc-progress-item--active" : "") +
              (i < stepIndex ? " rpc-progress-item--done" : "")
            }
          >
            <span className="rpc-progress-index">{i + 1}</span>
            <span className="rpc-progress-label">{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="rpc-wizard-panel">
        {currentStep.key === "identity" && (
          <StepIdentity
            formData={formData}
            updateField={updateField}
            showErrors={attemptedNext}
          />
        )}
        {currentStep.key === "operations" && (
          <StepOperations
            formData={formData}
            updateField={updateField}
            showErrors={attemptedNext}
          />
        )}
        {currentStep.key === "filings" && (
          <StepFilings
            formData={formData}
            updateField={updateField}
            showErrors={attemptedNext}
          />
        )}
        {currentStep.key === "review" && <StepReview formData={formData} />}

        {attemptedNext && !currentStepComplete && (
          <p className="rpc-form-error" role="alert">
            All fields marked (required) must be completed before proceeding.
          </p>
        )}

        <div className="rpc-wizard-nav">
          <button
            type="button"
            className="rpc-btn rpc-btn--ghost"
            onClick={onBack}
            disabled={stepIndex === 0}
          >
            &larr; Back
          </button>
          {isLastFieldStep ? (
            <button
              type="button"
              className="rpc-btn rpc-btn--primary"
              onClick={onSubmit}
            >
              Submit Registration &amp; Generate Certificate
            </button>
          ) : (
            <button
              type="button"
              className="rpc-btn rpc-btn--primary"
              onClick={onNext}
            >
              Next &rarr;
            </button>
          )}
        </div>
      </div>

      <footer className="rpc-wizard-footer">
        Form {DOCUMENT_CODE} &middot; Mars Colonial Authority &middot;
        Registration Standards Office
      </footer>
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="rpc-label">
      {children}
      {required ? (
        <span className="rpc-required"> (required)</span>
      ) : (
        <span className="rpc-optional"> (optional)</span>
      )}
    </label>
  );
}

function StepIdentity({ formData, updateField, showErrors }) {
  return (
    <fieldset className="rpc-fieldset">
      <legend className="rpc-section-title">SUBDIVISION IDENTITY</legend>
      <p className="rpc-section-help">
        Every subdivision operating under the Mars Colonial Charter must be
        registered with the Mars Colonial Authority before resources may be
        allocated. Begin by identifying your subdivision and its command
        structure.
      </p>

      <div className="rpc-field">
        <FieldLabel required>Subdivision Name</FieldLabel>
        <input
          type="text"
          className={
            "rpc-input" +
            (showErrors && !formData.subdivisionName.trim()
              ? " rpc-input--invalid"
              : "")
          }
          value={formData.subdivisionName}
          onChange={(e) => updateField("subdivisionName", e.target.value)}
          placeholder="e.g. Cobalt Reach Subdivision"
        />
      </div>

      <div className="rpc-field">
        <FieldLabel required>Manager Name</FieldLabel>
        <input
          type="text"
          className={
            "rpc-input" +
            (showErrors && !formData.managerName.trim()
              ? " rpc-input--invalid"
              : "")
          }
          value={formData.managerName}
          onChange={(e) => updateField("managerName", e.target.value)}
          placeholder="In-character name of the Subdivision Manager"
        />
      </div>

      <div className="rpc-field">
        <FieldLabel required>Parent Corporation</FieldLabel>
        <select
          className={
            "rpc-input rpc-select" +
            (showErrors && !formData.parentCorporation
              ? " rpc-input--invalid"
              : "")
          }
          value={formData.parentCorporation}
          onChange={(e) => updateField("parentCorporation", e.target.value)}
        >
          <option value="">Select a parent corporation&hellip;</option>
          {CORPORATIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="rpc-field">
        <FieldLabel required>Primary Specialization</FieldLabel>
        <select
          className={
            "rpc-input rpc-select" +
            (showErrors && !formData.specialization
              ? " rpc-input--invalid"
              : "")
          }
          value={formData.specialization}
          onChange={(e) => updateField("specialization", e.target.value)}
        >
          <option value="">Select a specialization&hellip;</option>
          {SPECIALIZATIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {formData.specialization === "Other (specify)" && (
          <input
            type="text"
            className={
              "rpc-input rpc-input--nested" +
              (showErrors && !formData.specializationOther.trim()
                ? " rpc-input--invalid"
                : "")
            }
            value={formData.specializationOther}
            onChange={(e) =>
              updateField("specializationOther", e.target.value)
            }
            placeholder="Specify your subdivision's focus"
          />
        )}
      </div>
    </fieldset>
  );
}

function StepOperations({ formData, updateField, showErrors }) {
  return (
    <fieldset className="rpc-fieldset">
      <legend className="rpc-section-title">OPERATIONAL PROFILE</legend>
      <p className="rpc-section-help">
        Declare your subdivision's initial infrastructure priority and its
        stated posture toward the five other subdivisions it will share
        the colony with.
      </p>

      <div className="rpc-field">
        <FieldLabel required>Preferred Starting Facility</FieldLabel>
        <select
          className={
            "rpc-input rpc-select" +
            (showErrors && !formData.startingFacility
              ? " rpc-input--invalid"
              : "")
          }
          value={formData.startingFacility}
          onChange={(e) => updateField("startingFacility", e.target.value)}
        >
          <option value="">Select a facility type&hellip;</option>
          {FACILITIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="rpc-field">
        <FieldLabel required>Cooperation Policy</FieldLabel>
        <select
          className={
            "rpc-input rpc-select" +
            (showErrors && !formData.cooperationPolicy
              ? " rpc-input--invalid"
              : "")
          }
          value={formData.cooperationPolicy}
          onChange={(e) => updateField("cooperationPolicy", e.target.value)}
        >
          <option value="">Select a policy&hellip;</option>
          {COOPERATION_POLICIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="rpc-field">
        <FieldLabel required>Official Mission Statement</FieldLabel>
        <textarea
          className={
            "rpc-input rpc-textarea" +
            (showErrors && !formData.missionStatement.trim()
              ? " rpc-input--invalid"
              : "")
          }
          rows={3}
          value={formData.missionStatement}
          onChange={(e) => updateField("missionStatement", e.target.value)}
          placeholder="A short, in-character corporate mission statement (1-3 sentences)."
        />
      </div>
    </fieldset>
  );
}

function StepFilings({ formData, updateField, showErrors }) {
  return (
    <fieldset className="rpc-fieldset">
      <legend className="rpc-section-title">CORPORATE FILINGS</legend>
      <p className="rpc-section-help">
        The Authority requires a statement of intent on file for every
        registered subdivision. History and culture are not mandatory, but
        the Registration Standards Office notes that subdivisions without a
        recorded history tend to be assumed to not have one.
      </p>

      <div className="rpc-field">
        <FieldLabel required>
          Corporate Objectives &amp; Personal Aspirations
        </FieldLabel>
        <textarea
          className={
            "rpc-input rpc-textarea" +
            (showErrors && !formData.objectives.trim()
              ? " rpc-input--invalid"
              : "")
          }
          rows={4}
          value={formData.objectives}
          onChange={(e) => updateField("objectives", e.target.value)}
          placeholder="What does this subdivision want for itself, and what does its manager want personally?"
        />
      </div>

      <div className="rpc-field">
        <FieldLabel>Subdivision History or Corporate Culture</FieldLabel>
        <textarea
          className="rpc-input rpc-textarea"
          rows={4}
          value={formData.history}
          onChange={(e) => updateField("history", e.target.value)}
          placeholder="Optional flavor: where did this subdivision come from, and what is it like to work there?"
        />
      </div>
    </fieldset>
  );
}

function StepReview({ formData }) {
  const rows = [
    ["Subdivision Name", formData.subdivisionName],
    ["Manager Name", formData.managerName],
    ["Parent Corporation", formData.parentCorporation],
    ["Primary Specialization", resolvedSpecialization(formData)],
    ["Preferred Starting Facility", formData.startingFacility],
    ["Cooperation Policy", formData.cooperationPolicy],
    ["Official Mission Statement", formData.missionStatement],
    ["Corporate Objectives & Personal Aspirations", formData.objectives],
    ["Subdivision History / Corporate Culture", formData.history || "—"],
  ];
  return (
    <fieldset className="rpc-fieldset">
      <legend className="rpc-section-title">REVIEW &amp; SUBMIT</legend>
      <p className="rpc-section-help">
        Confirm the filing below. Submitting this form generates a permanent
        Corporate ID and constitutes a formal registration with the Mars
        Colonial Authority.
      </p>
      <dl className="rpc-review-list">
        {rows.map(([label, value]) => (
          <div className="rpc-review-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </fieldset>
  );
}

/* -------------------------------------------------------------------------
 * Certificate view — ornate, retro-futuristic output document
 * ---------------------------------------------------------------------- */

function CertificateView({ data, certificate, instanceId, onPrint, onStartOver }) {
  const specialization = resolvedSpecialization(data);
  const pathId = `${instanceId}-seal-path`;

  return (
    <div className="rpc-cert-screen">
      <div className="rpc-cert-toolbar rpc-no-print">
        <button type="button" className="rpc-btn rpc-btn--primary" onClick={onPrint}>
          DOWNLOAD CERTIFICATE (PRINT / SAVE AS PDF)
        </button>
        <button type="button" className="rpc-btn rpc-btn--ghost" onClick={onStartOver}>
          Register Another Subdivision
        </button>
      </div>

      <div className="rpc-cert-frame">
        <div className="rpc-cert-panel">
          <div className="rpc-cert-topline">
            <div className="rpc-cert-classification">
              CLASSIFICATION: REGISTRATION DOCUMENTATION &mdash; PROSPECTIVE
              SUBDIVISION MANAGERS
            </div>

            <div className="rpc-cert-idblock">
              <div className="rpc-cert-idblock-label">CORPORATE ID</div>
              <div className="rpc-cert-idblock-value">
                {certificate.corporateId}
              </div>
            </div>
          </div>

          <header className="rpc-cert-header">
            <div className="rpc-cert-doc-code">{DOCUMENT_CODE}</div>
            <h1 className="rpc-cert-title">MARS COLONIAL INITIATIVE</h1>
            <h2 className="rpc-cert-subtitle">
              CERTIFICATE OF SUBDIVISION REGISTRATION
            </h2>
            <div className="rpc-cert-rule" aria-hidden="true" />
          </header>

          <p className="rpc-cert-preamble">
            This certifies that the subdivision named below has been duly
            registered with the Mars Colonial Authority under the authority
            of the Mars Colonial Charter of 2159, and is hereby recognized
            as an operating subdivision of its declared parent corporation,
            entitled to the rights, resources, and obligations thereof.
          </p>

          <div className="rpc-cert-grid">
            <CertField label="Subdivision Name" value={data.subdivisionName} wide />
            <CertField label="Subdivision Manager" value={data.managerName} />
            <CertField label="Parent Corporation" value={data.parentCorporation} />
            <CertField label="Primary Specialization" value={specialization} />
            <CertField label="Preferred Starting Facility" value={data.startingFacility} />
            <CertField label="Cooperation Policy" value={data.cooperationPolicy} />
            <CertField label="Date of Issue" value={certificate.issueDate} />
          </div>

          <div className="rpc-cert-block">
            <div className="rpc-cert-block-label">OFFICIAL MISSION STATEMENT</div>
            <p className="rpc-cert-block-text">{data.missionStatement}</p>
          </div>

          <div className="rpc-cert-block">
            <div className="rpc-cert-block-label">
              CORPORATE OBJECTIVES &amp; PERSONAL ASPIRATIONS
            </div>
            <p className="rpc-cert-block-text">{data.objectives}</p>
          </div>

          {data.history && data.history.trim() !== "" && (
            <div className="rpc-cert-block">
              <div className="rpc-cert-block-label">
                SUBDIVISION HISTORY / CORPORATE CULTURE
              </div>
              <p className="rpc-cert-block-text">{data.history}</p>
            </div>
          )}

          <div className="rpc-cert-signoff">
            <div className="rpc-cert-seal" aria-hidden="true">
              <svg viewBox="0 0 200 200" className="rpc-cert-seal-svg">
                <defs>
                  <path
                    id={pathId}
                    d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0"
                  />
                </defs>
                <circle cx="100" cy="100" r="95" className="rpc-seal-ring-outer" />
                <circle cx="100" cy="100" r="82" className="rpc-seal-ring-inner" />
                <text className="rpc-seal-text">
                  <textPath href={`#${pathId}`} startOffset="0%">
                    MARS COLONIAL AUTHORITY &bull; SUBDIVISION REGISTRY &bull;
                    MARS COLONIAL AUTHORITY &bull; SUBDIVISION REGISTRY &bull;
                  </textPath>
                </text>
                {/* Center emblem: a ringed planet glyph */}
                <circle cx="100" cy="100" r="22" className="rpc-seal-planet" />
                <ellipse
                  cx="100"
                  cy="100"
                  rx="38"
                  ry="10"
                  className="rpc-seal-orbit"
                  transform="rotate(-20 100 100)"
                />
                <circle cx="100" cy="100" r="3" className="rpc-seal-core" />
              </svg>
            </div>

            <div className="rpc-cert-signoff-text">
              <div className="rpc-cert-signoff-org">MARS COLONIAL AUTHORITY</div>
              <div className="rpc-cert-signoff-office">
                Registration Standards Office
              </div>
              <div className="rpc-cert-signoff-code">{DOCUMENT_CODE}</div>
              <div className="rpc-cert-signoff-tagline">
                Excellence is not optional.
              </div>
              <div className="rpc-cert-signature-line">
                <span className="rpc-cert-signature-script">
                  Registration Standards Office
                </span>
                <span className="rpc-cert-signature-caption">
                  Authorized Signature, Mars Colonial Authority
                </span>
              </div>
            </div>
          </div>

          <blockquote className="rpc-cert-quote">
            &ldquo;{PULL_QUOTE.text}&rdquo;
            <footer>&mdash; {PULL_QUOTE.attribution}</footer>
          </blockquote>

          <div className="rpc-cert-footer">
            Document {DOCUMENT_CODE} &middot; Corporate ID{" "}
            {certificate.corporateId} &middot; Issued {certificate.issueDate}
          </div>
        </div>
      </div>
    </div>
  );
}

function CertField({ label, value, wide }) {
  return (
    <div className={"rpc-cert-field" + (wide ? " rpc-cert-field--wide" : "")}>
      <div className="rpc-cert-field-label">{label}:</div>
      <div className="rpc-cert-field-value">{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Styles
 * ---------------------------------------------------------------------- */

const CSS = `
.rpc-root {
  --rpc-navy: #1B2A4A;
  --rpc-navy-dim: #2E4066;
  --rpc-cream: #F2E8D5;
  --rpc-cream-2: #EDE1C8;
  --rpc-brass: #B8860B;
  --rpc-brass-light: #D8A93A;
  --rpc-paper-line: #C9BC9C;
  --rpc-error: #7A1E1E;
  --rpc-font-head: 'Oswald', 'Arial Narrow', sans-serif;
  --rpc-font-body: 'Courier Prime', 'Courier New', monospace;

  font-family: var(--rpc-font-body);
  color: var(--rpc-navy);
  box-sizing: border-box;
}
.rpc-root *, .rpc-root *::before, .rpc-root *::after {
  box-sizing: border-box;
}

/* ============================= WIZARD (utilitarian) ===================== */

.rpc-wizard {
  max-width: 760px;
  margin: 0 auto;
  background: #FFFFFF;
  color: #14213D;
  border: 3px solid #14213D;
}

.rpc-wizard-header {
  padding: 20px 24px 16px;
  border-bottom: 3px solid #14213D;
  background: #F4F5F7;
}
.rpc-doc-code {
  font-family: var(--rpc-font-body);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #4A5568;
  text-align: right;
}
.rpc-wizard-title {
  font-family: var(--rpc-font-head);
  font-weight: 700;
  font-size: 26px;
  letter-spacing: 0.06em;
  margin: 4px 0 0;
  text-transform: uppercase;
}
.rpc-wizard-subtitle {
  font-family: var(--rpc-font-head);
  font-weight: 500;
  font-size: 15px;
  letter-spacing: 0.08em;
  margin: 2px 0 10px;
  text-transform: uppercase;
  color: #2D3B58;
}
.rpc-classification {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  border: 2px solid #14213D;
  padding: 3px 8px;
  text-transform: uppercase;
}

.rpc-progress {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 0;
  padding: 0;
  border-bottom: 3px solid #14213D;
}
.rpc-progress-item {
  padding: 10px 8px;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.03em;
  border-right: 1px solid #C7CCD6;
  background: #F4F5F7;
  color: #7A8290;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rpc-progress-item:last-child { border-right: none; }
.rpc-progress-index {
  font-family: var(--rpc-font-head);
  font-weight: 700;
  font-size: 15px;
}
.rpc-progress-item--active {
  background: #14213D;
  color: #FFFFFF;
}
.rpc-progress-item--done {
  background: #DCE3F0;
  color: #14213D;
}

.rpc-wizard-panel {
  padding: 24px;
}

.rpc-fieldset {
  border: none;
  margin: 0;
  padding: 0;
}
.rpc-section-title {
  font-family: var(--rpc-font-head);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.05em;
  padding: 0 0 4px;
  margin-bottom: 6px;
  border-bottom: 2px solid #14213D;
  width: 100%;
}
.rpc-section-help {
  font-size: 12.5px;
  line-height: 1.5;
  color: #445;
  margin: 8px 0 18px;
}

.rpc-field { margin-bottom: 16px; }
.rpc-label {
  display: block;
  font-size: 12.5px;
  font-weight: 700;
  text-transform: none;
  margin-bottom: 5px;
  letter-spacing: 0.02em;
}
.rpc-label::after { content: ":"; }
.rpc-required { color: var(--rpc-error); font-weight: 700; }
.rpc-optional { color: #7A8290; font-weight: 400; }

.rpc-input {
  width: 100%;
  font-family: var(--rpc-font-body);
  font-size: 14px;
  padding: 9px 10px;
  border: 2px solid #14213D;
  background: #FFFFFF;
  color: #14213D;
}
.rpc-input:focus {
  outline: 3px solid var(--rpc-brass);
  outline-offset: 0;
}
.rpc-input--nested { margin-top: 8px; }
.rpc-input--invalid {
  border-color: var(--rpc-error);
  background: #FBEAEA;
}
.rpc-select { appearance: auto; }
.rpc-textarea { resize: vertical; min-height: 64px; line-height: 1.4; }

.rpc-form-error {
  color: var(--rpc-error);
  font-size: 12.5px;
  font-weight: 700;
  border: 2px solid var(--rpc-error);
  background: #FBEAEA;
  padding: 8px 10px;
  margin: 6px 0 0;
}

.rpc-wizard-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #C7CCD6;
}

.rpc-btn {
  font-family: var(--rpc-font-head);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 12px 20px;
  border: 2px solid #14213D;
  cursor: pointer;
  background: #FFFFFF;
  color: #14213D;
}
.rpc-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.rpc-btn--primary {
  background: #14213D;
  color: #FFFFFF;
}
.rpc-btn--primary:hover:not(:disabled) { background: #24365E; }
.rpc-btn--ghost:hover:not(:disabled) { background: #F0F2F5; }

.rpc-wizard-footer {
  padding: 12px 24px;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: #7A8290;
  border-top: 3px solid #14213D;
  text-align: center;
}

.rpc-review-list { margin: 0; }
.rpc-review-row {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed #C7CCD6;
  font-size: 13px;
}
.rpc-review-row dt { font-weight: 700; color: #2D3B58; }
.rpc-review-row dd { margin: 0; white-space: pre-wrap; }

/* ============================= CERTIFICATE (ornate) ====================== */

.rpc-cert-screen {
  max-width: 900px;
  margin: 0 auto;
}

.rpc-cert-toolbar {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.rpc-cert-frame {
  background: var(--rpc-brass);
  background-image:
    repeating-linear-gradient(45deg, rgba(27,42,74,0.12) 0 2px, transparent 2px 10px),
    repeating-linear-gradient(-45deg, rgba(27,42,74,0.12) 0 2px, transparent 2px 10px);
  padding: 14px;
  border: 2px solid var(--rpc-navy);
}

.rpc-cert-panel {
  position: relative;
  background: var(--rpc-cream);
  border: 3px double var(--rpc-navy);
  outline: 1px solid var(--rpc-brass);
  outline-offset: -8px;
  padding: 36px 40px 30px;
  font-family: var(--rpc-font-body);
  color: var(--rpc-navy);
}

.rpc-cert-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.rpc-cert-classification {
  display: inline-block;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 420px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  border: 2px solid var(--rpc-navy);
  padding: 4px 10px;
  transform: rotate(-1.2deg);
  background: rgba(184,134,11,0.12);
}

.rpc-cert-idblock {
  flex: 0 0 auto;
  border: 2px solid var(--rpc-navy);
  padding: 6px 12px;
  text-align: center;
  background: rgba(255,255,255,0.4);
  white-space: nowrap;
}
.rpc-cert-idblock-label {
  font-family: var(--rpc-font-head);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--rpc-navy-dim);
}
.rpc-cert-idblock-value {
  font-family: var(--rpc-font-body);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.rpc-cert-header {
  text-align: center;
  margin: 18px 0 20px;
}
.rpc-cert-doc-code {
  font-size: 10.5px;
  letter-spacing: 0.15em;
  color: var(--rpc-navy-dim);
}
.rpc-cert-title {
  font-family: var(--rpc-font-head);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 6px 0 2px;
}
.rpc-cert-subtitle {
  font-family: var(--rpc-font-head);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.12em;
  color: var(--rpc-navy-dim);
  margin: 0;
}
.rpc-cert-rule {
  width: 220px;
  height: 3px;
  margin: 14px auto 0;
  background: linear-gradient(90deg, transparent, var(--rpc-brass), transparent);
}

.rpc-cert-preamble {
  font-size: 13px;
  line-height: 1.7;
  text-align: center;
  max-width: 620px;
  margin: 0 auto 26px;
  font-style: italic;
}

.rpc-cert-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 30px;
  margin-bottom: 24px;
}
.rpc-cert-field--wide { grid-column: 1 / -1; }
.rpc-cert-field-label {
  font-family: var(--rpc-font-head);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--rpc-navy-dim);
  text-transform: uppercase;
  margin-bottom: 3px;
}
.rpc-cert-field-value {
  font-size: 15px;
  font-weight: 700;
  border-bottom: 1.5px solid var(--rpc-navy);
  padding-bottom: 4px;
  min-height: 22px;
}

.rpc-cert-block { margin-bottom: 20px; }
.rpc-cert-block-label {
  font-family: var(--rpc-font-head);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--rpc-paper-line);
  padding-bottom: 3px;
}
.rpc-cert-block-text {
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.rpc-cert-signoff {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 20px;
  align-items: center;
  margin: 26px 0 18px;
  padding-top: 18px;
  border-top: 2px solid var(--rpc-navy);
}
.rpc-cert-seal-svg { width: 120px; height: 120px; }
.rpc-seal-ring-outer {
  fill: none;
  stroke: var(--rpc-brass);
  stroke-width: 2;
}
.rpc-seal-ring-inner {
  fill: none;
  stroke: var(--rpc-navy);
  stroke-width: 1;
}
.rpc-seal-text {
  font-family: var(--rpc-font-head);
  font-size: 8.4px;
  letter-spacing: 1.5px;
  fill: var(--rpc-navy);
}
.rpc-seal-planet {
  fill: none;
  stroke: var(--rpc-brass);
  stroke-width: 2.5;
}
.rpc-seal-orbit {
  fill: none;
  stroke: var(--rpc-navy);
  stroke-width: 1.5;
}
.rpc-seal-core { fill: var(--rpc-brass); }

.rpc-cert-signoff-org {
  font-family: var(--rpc-font-head);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.rpc-cert-signoff-office {
  font-size: 12px;
  color: var(--rpc-navy-dim);
  margin-bottom: 2px;
}
.rpc-cert-signoff-code {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--rpc-navy-dim);
}
.rpc-cert-signoff-tagline {
  font-style: italic;
  font-size: 12.5px;
  margin-top: 6px;
  color: var(--rpc-navy);
}
.rpc-cert-signature-line {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid var(--rpc-navy);
  padding-top: 4px;
  max-width: 260px;
}
.rpc-cert-signature-script {
  font-family: var(--rpc-font-head);
  font-style: italic;
  font-size: 13px;
}
.rpc-cert-signature-caption {
  font-size: 9.5px;
  letter-spacing: 0.05em;
  color: var(--rpc-navy-dim);
}

.rpc-cert-quote {
  margin: 20px 0 10px;
  padding: 14px 20px;
  border-left: 3px solid var(--rpc-brass);
  font-style: italic;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--rpc-navy-dim);
}
.rpc-cert-quote footer {
  margin-top: 6px;
  font-style: normal;
  font-size: 11px;
  letter-spacing: 0.04em;
}

.rpc-cert-footer {
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--rpc-navy-dim);
  margin-top: 10px;
}

/* ============================= PRINT ===================================== */

@media print {
  .rpc-no-print { display: none !important; }
  body * { visibility: hidden; }
  .rpc-cert-frame, .rpc-cert-frame * { visibility: visible; }
  .rpc-cert-screen {
    max-width: none;
    margin: 0;
  }
  .rpc-cert-frame {
    position: absolute;
    top: 0;
    left: 0;
    width: 8.5in;
    min-height: 11in;
    padding: 0.3in;
    box-shadow: none;
  }
  .rpc-cert-panel {
    padding: 0.5in 0.6in;
  }
  @page {
    size: letter;
    margin: 0;
  }
}

/* ============================= RESPONSIVE ================================ */

@media (max-width: 640px) {
  .rpc-progress { grid-template-columns: repeat(2, 1fr); }
  .rpc-cert-panel { padding: 24px 18px 20px; }
  .rpc-cert-grid { grid-template-columns: 1fr; }
  .rpc-cert-signoff { grid-template-columns: 90px 1fr; }
  .rpc-cert-topline { flex-direction: column; }
  .rpc-cert-idblock { align-self: flex-start; }
  .rpc-review-row { grid-template-columns: 1fr; }
}
`;
