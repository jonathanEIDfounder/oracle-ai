# AARTE — Quantum AI Architecture
**Apple AI Runtime & Tactical Engine**
© 2026 Jonathan Sherman · OCSO-S1AF-GOV-1 · S1AF v1.0.0-JS

---

## Overview

AARTE implements a **hybrid classical-quantum behavioral authentication** system
running on iPhone XR (A12 Bionic) with IBM Quantum Network hardware for the
quantum branch. No biometric data or behavioral embeddings leave the device
except as abstract rotation angles used to parameterise quantum circuits.

```
┌────────────────────────────────────────────────────────────────┐
│                  AARTE Authentication Pipeline                  │
├──────────────┬─────────────────────────────────────────────────┤
│   On-Device  │              IBM Quantum Network                 │
│   (A12 NE)   │   ibm_brisbane / ibm_sherbrooke / ibm_kyiv      │
├──────────────┴─────────────────────────────────────────────────┤
│                                                                  │
│  Sensor Data → AIEngine → BehavioralEmbedding (24-dim)         │
│                    │                                            │
│         ┌──────────┴──────────┐                                │
│         │ Classical (60 %)    │  Quantum (40 %)                │
│         │                     │                                │
│         │  MLPipeline k-NN    │  QuantumBridge                 │
│         │  cosine distance    │  QASM 3.0 circuit              │
│         │  confidence score   │  24-qubit amplitude encoding   │
│         │                     │  Hamming fidelity              │
│         └──────────┬──────────┘                                │
│                    │                                            │
│         QuantumBehavioralAnalysis                               │
│         hybridScore = 0.60×classical + 0.40×quantum            │
│                    │                                            │
│         ┌──────────▼──────────┐                                │
│         │  ≥ 0.85 AUTHORIZED  │                                │
│         │  ≥ 0.60 REVIEW      │  → Face ID re-prompt           │
│         │  < 0.60 UNAUTHORIZED│  → Block + alert               │
│         └─────────────────────┘                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 1. Behavioral Embedding (AIEngine)

### Dimension Layout — 24 floats, L2-normalised

| Dims  | Category          | Features                                              |
|-------|-------------------|-------------------------------------------------------|
| 0–5   | Gesture dynamics  | velocity, pressure, acceleration, jerk, area, angle   |
| 6–11  | Temporal patterns | session length, inter-tap interval, typing cadence,   |
|       |                   | dwell time, scroll frequency, pause ratio             |
| 12–17 | Spatial patterns  | centroid X/Y, scroll amplitude, swipe direction,      |
|       |                   | tap clustering, edge-touch frequency                  |
| 18–23 | App usage         | feature access rate, nav depth, back-gesture ratio,   |
|       |                   | search frequency, notification latency, idle ratio    |

### Core ML Model (`BehavioralEncoder.mlmodelc`)

- **Input:**  `input` — MLMultiArray `[24]` float32
- **Output:** `embedding` — MLMultiArray `[24]` float32
- **Compute units:** `.cpuAndNeuralEngine` (A12 NE-accelerated)
- **Fallback:** Deterministic Hadamard projection when model bundle absent

The model is a compact MLP trained on-device via Create ML. Weights are
refreshed via `MLPipeline` every 30 days or after 500 new labeled samples.

---

## 2. On-Device Training (MLPipeline)

### k-NN Classifier
- **Distance metric:** Cosine distance ∈ [0, 2]
- **Neighbours:** k = 5 (configurable)
- **Labels:** `.authorized` / `.unauthorized` / `.unknown`
- **Minimum samples:** 10 before predictions are trusted

### Quantum Weight Export

The centroid of all `.authorized` embeddings is exported as 24 Ry rotation
angles:

```
θᵢ = arccos(wᵢ)    where wᵢ ∈ [−1, 1], θᵢ ∈ [0, π]
```

This is the canonical amplitude-encoded identity vector used by `QuantumBridge`
to parameterise Layer 1 of the verification circuit.

### LOOCV Accuracy
Leave-one-out cross-validation is computed at export time and reported in
`QuantumWeights.loocvAccuracy`. Deploy gates in `deploy.sh` can optionally
reject weights below a minimum accuracy threshold.

---

## 3. IBM Quantum Network Client (QuantumBridge)

### Supported Backends

| Backend         | Qubits | Notes                              |
|-----------------|--------|------------------------------------|
| ibm_brisbane    | 127    | Heron r1 processor                 |
| ibm_sherbrooke  | 127    | Heron r1 processor                 |
| ibm_kyiv        | 127    | Eagle r3 processor                 |

Backend selection follows `AppleAIDecisionEngine.predictOptimalBackend()`
using real-time queue depth data from the IBM Quantum API.

### API Endpoints (IBM Quantum Platform v2)

```
POST /runtime/jobs               Submit a Sampler job
GET  /runtime/jobs/{id}          Poll job status
GET  /runtime/jobs/{id}/results  Fetch measurement counts
```

Authentication: `Authorization: Bearer <IBM_QUANTUM_TOKEN>`

Token storage:
- **iOS/macOS:** macOS Keychain (`com.s1af.aarte.quantum`)
- **Linux/CI:**  AARTE cipherstore (`~/.s1af-cipher/quantum-token.enc`)

### QASM 3.0 Circuit Structure

```qasm
OPENQASM 3.0;
include "stdgates.inc";

// 24-qubit register
qubit[24] q;
bit[24] c;

// === Layer 1: Reference identity encoding (Ry) ===
// θᵢ = arccos(centroid_weight_i) from MLPipeline.exportQuantumWeights()
ry(θ₀) q[0];
ry(θ₁) q[1];
...
ry(θ₂₃) q[23];

// === Layer 2: Nearest-neighbour CNOT entanglement ring ===
cx q[0], q[1];
cx q[1], q[2];
...
cx q[23], q[0];

// === Layer 3: Query embedding encoding (Ry) ===
// φᵢ = arccos(query_vector_i) from current session's AIEngine output
ry(φ₀) q[0];
...
ry(φ₂₃) q[23];

// === Measurement ===
c = measure q;
```

**Physical meaning:**
- Layer 1 encodes the reference identity into quantum state amplitudes.
- The CNOT ring creates entanglement between adjacent behavioral dimensions,
  capturing correlations the classical branch cannot model.
- Layer 3 encodes the query. If the query matches the reference, destructive
  interference concentrates the probability mass onto a small set of
  measurement outcomes (high fidelity). Divergence spreads the distribution
  (low fidelity / high entropy).

### Job Parameters
- **Shots:** 4096 (verification), 8192 (enrollment)
- **Program:** `sampler` (Qiskit Runtime Sampler primitive)
- **Poll interval:** 2 seconds, max 300 attempts (10 min timeout)

---

## 4. Hybrid Scoring (QuantumBehavioralAnalysis)

### Score Combination

```
hybridScore = 0.60 × classicalScore + 0.40 × quantumScore
```

| Weight | Branch    | Source                                              |
|--------|-----------|-----------------------------------------------------|
| 60 %   | Classical | k-NN confidence from MLPipeline                     |
| 40 %   | Quantum   | Hamming fidelity from QuantumBridge measurement     |

### Quantum Fidelity (Hamming)

When a reference outcome is stored (post-enrollment):

```
fidelity = Σ_{bitstrings b : hamming(b, reference) ≤ 4} counts[b] / total_shots
```

The threshold of 4 bits (≤ 16 % error rate on 24 qubits) accommodates
realistic quantum hardware noise without sacrificing discrimination.

When no reference is enrolled, entropy-based fidelity is used:
```
fidelity = 1 − H(measurement) / log₂(total_shots)
```
where H is Shannon entropy in bits.

### Decision Thresholds

| hybridScore | Decision       | Action                         |
|-------------|----------------|--------------------------------|
| ≥ 0.85      | AUTHORIZED     | Grant access                   |
| 0.60–0.84   | REVIEW         | Require Face ID re-authentication |
| < 0.60      | UNAUTHORIZED   | Block + log anomaly            |

### Fallback (Quantum Unavailable)

When `QuantumBridge` has no API token or network is unreachable:
```
hybridScore = classicalScore    (100 % classical)
```
The decision thresholds remain identical so the system degrades gracefully.

---

## 5. iOS Interface (QuantumView)

The `QuantumView` SwiftUI tab provides:

1. **Token management** — paste IBM Quantum API token → saved to macOS Keychain
2. **Backend selection** — pick ibm_brisbane / ibm_sherbrooke / ibm_kyiv
3. **Live verification** — triggers a full hybrid analysis on demand
4. **Enrollment** — submits a reference circuit using the current k-NN centroid
5. **Score display** — shows classical (60%), quantum (40%), and hybrid bar

---

## 6. Setup

### macOS / iPhone XR

```bash
# Store IBM Quantum token in Keychain
bash scripts/quantum-setup.sh

# Verify the token
bash scripts/quantum-setup.sh --verify

# Show stored token (obfuscated)
bash scripts/quantum-setup.sh --show
```

### Linux / CI

```bash
export IBM_QUANTUM_TOKEN=your_token
bash scripts/quantum-setup.sh --save
```

Or store directly in the AARTE cipherstore:
```bash
bash scripts/pat-cipher.sh seal quantum-token "$IBM_QUANTUM_TOKEN"
```

---

## 7. Security Properties

| Property                    | Mechanism                                     |
|-----------------------------|-----------------------------------------------|
| No raw biometrics transmitted | Embeddings converted to abstract angles       |
| No behavioral data leaves device | Only θᵢ ∈ [0, π] sent to IBM Quantum      |
| Token isolation             | Keychain (iOS) / AES-256 cipherstore (Linux)  |
| Hardware binding            | DeviceGuard ensures iPhone XR only            |
| Replay resistance           | Each circuit uses a fresh query embedding     |
| Quantum tamper evidence     | Reference outcome hash stored on-device       |

---

## 8. File Index

| File                                    | Purpose                                       |
|-----------------------------------------|-----------------------------------------------|
| `Sources/AARTE/AIEngine.swift`          | Core ML inference, 24-dim embedding           |
| `Sources/AARTE/MLPipeline.swift`        | k-NN training, LOOCV, weight export           |
| `Sources/AARTE/QuantumBridge.swift`     | IBM Quantum REST client, QASM 3.0 circuits    |
| `Sources/AARTE/QuantumBehavioralAnalysis.swift` | 60/40 hybrid scorer                  |
| `AARTE-iOS-App/AARTE/Views/QuantumView.swift`   | SwiftUI quantum tab                   |
| `scripts/quantum-setup.sh`              | Keychain token storage                        |
| `Tests/AARTE/AIEngineTests.swift`       | Embedding + inference tests                   |
| `Tests/AARTE/MLPipelineTests.swift`     | k-NN + weight export tests                    |
| `Tests/AARTE/QuantumBridgeTests.swift`  | Circuit generation + parsing tests            |
| `Tests/AARTE/QuantumBehavioralTests.swift` | Hybrid scoring tests                       |

---

*© 2026 Jonathan Sherman — OCSO-S1AF-GOV-1 — S1AF-DRM-LOCKED*
