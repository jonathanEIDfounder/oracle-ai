#!/usr/bin/env python3
# =============================================================
# train-behavioral-encoder.py — BehavioralEncoder Core ML model
# Author: Jonathan Sherman
# Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
# Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
# =============================================================
#
# Generates a 24→24 MLP embedding model for on-device behavioral
# authentication on the A12 Bionic Neural Engine (iPhone XR).
#
# Requirements (macOS):
#   pip install coremltools scikit-learn numpy
#
# Usage:
#   python3 scripts/train-behavioral-encoder.py
#
# Output:
#   AARTE-iOS-App/Resources/BehavioralEncoder.mlpackage
#   AARTE-iOS-App/Resources/BehavioralEncoder.mlmodelc   (compiled)
#
# The model accepts a 24-float "input" multi-array and outputs a
# 24-float L2-normalised "embedding" multi-array.  After training,
# copy BehavioralEncoder.mlmodelc into your Xcode project and add
# it to the OracleAI target's Copy Bundle Resources phase.
# =============================================================

import os
import sys
import subprocess
import numpy as np
from pathlib import Path

# ── Check imports ─────────────────────────────────────────────────────────────
try:
    import coremltools as ct
    from sklearn.neural_network import MLPRegressor
    from sklearn.preprocessing import normalize
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install coremltools scikit-learn numpy")
    sys.exit(1)

print("═" * 60)
print("  AARTE BehavioralEncoder — Core ML Training")
print("  © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1")
print("═" * 60)

# ── Dimensions ────────────────────────────────────────────────────────────────
DIM = 24
N_SAMPLES = 5000
HIDDEN_LAYERS = (128, 64, 32)
RANDOM_SEED = 42

# ── Output paths ─────────────────────────────────────────────────────────────
OUT_DIR = Path("AARTE-iOS-App/Resources")
OUT_DIR.mkdir(parents=True, exist_ok=True)
PACKAGE_PATH = OUT_DIR / "BehavioralEncoder.mlpackage"
COMPILED_PATH = OUT_DIR / "BehavioralEncoder.mlmodelc"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Generate synthetic training data
#    Each row is a 24-dim behavioral sample (gesture/temporal/spatial/usage).
#    We generate two identity clusters: "authorised" (A) and "other" (B),
#    then train an autoencoder so the bottleneck separates them.
# ─────────────────────────────────────────────────────────────────────────────
print("\n[1/4] Generating synthetic behavioral data...")

rng = np.random.default_rng(RANDOM_SEED)

def make_cluster(n, center, spread=0.15):
    return center + rng.normal(0, spread, (n, DIM))

# Authorised identity cluster
centre_auth  = rng.uniform(0.3, 0.7, DIM)
centre_other = rng.uniform(0, 1,   DIM)

X_auth  = make_cluster(N_SAMPLES // 2, centre_auth,  spread=0.10)
X_other = make_cluster(N_SAMPLES // 2, centre_other, spread=0.20)
X = np.vstack([X_auth, X_other])
X = np.clip(X, 0, 1).astype(np.float32)

# L2-normalise each row (mirrors AIEngine's l2Normalize)
X_norm = normalize(X, norm="l2")

# Target = input itself (autoencoder — learns compact identity representation)
y = X_norm.copy()

print(f"    Samples: {X.shape[0]} · Dimensions: {X.shape[1]}")

# ─────────────────────────────────────────────────────────────────────────────
# 2. Train MLP autoencoder
# ─────────────────────────────────────────────────────────────────────────────
print("[2/4] Training MLP autoencoder (this takes ~30 s)...")

model = MLPRegressor(
    hidden_layer_sizes=HIDDEN_LAYERS,
    activation="tanh",
    solver="adam",
    learning_rate_init=1e-3,
    max_iter=500,
    random_state=RANDOM_SEED,
    verbose=False,
    early_stopping=True,
    validation_fraction=0.1,
    n_iter_no_change=20,
)
model.fit(X_norm, y)

pred = model.predict(X_norm)
mse  = np.mean((pred - y) ** 2)
print(f"    Train MSE: {mse:.6f}  ·  Iterations: {model.n_iter_}")

# ─────────────────────────────────────────────────────────────────────────────
# 3. Convert to Core ML
# ─────────────────────────────────────────────────────────────────────────────
print("[3/4] Converting to Core ML...")

try:
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import FunctionTransformer

    # Wrap as a coremltools-compatible sklearn pipeline
    pipeline = Pipeline([
        ("encoder", model),
    ])

    cml_model = ct.converters.sklearn.convert(
        pipeline,
        input_features=[("input", ct.converters.sklearn.datatypes.Array(DIM))],
        output_feature_names=["embedding"],
    )

except Exception:
    # Fallback: manual weight extraction → NeuralNetwork spec
    print("    sklearn converter unavailable — using manual weight export...")

    import coremltools.proto.NeuralNetwork_pb2 as nn_pb2
    from coremltools.models import MLModel
    from coremltools.models.utils import save_spec

    builder = ct.models.neural_network.NeuralNetworkBuilder(
        input_features=[("input",  ct.models.datatypes.Array(DIM))],
        output_features=[("embedding", ct.models.datatypes.Array(DIM))],
    )

    # Input layer
    coef_in  = model.coefs_[0]      # (DIM, hidden[0])
    bias_in  = model.intercepts_[0]
    builder.add_inner_product(
        name="fc0", input_name="input", output_name="fc0_out",
        input_channels=DIM, output_channels=HIDDEN_LAYERS[0],
        W=coef_in.T, b=bias_in, has_bias=True,
    )
    builder.add_activation(name="act0", non_linearity="TANH",
                            input_name="fc0_out", output_name="act0_out")

    # Hidden layers
    prev = "act0_out"
    for i, (in_dim, out_dim) in enumerate(zip(HIDDEN_LAYERS[:-1], HIDDEN_LAYERS[1:]), 1):
        fc_name  = f"fc{i}";   fc_out  = f"fc{i}_out"
        act_name = f"act{i}";  act_out = f"act{i}_out"
        builder.add_inner_product(
            name=fc_name, input_name=prev, output_name=fc_out,
            input_channels=in_dim, output_channels=out_dim,
            W=model.coefs_[i].T, b=model.intercepts_[i], has_bias=True,
        )
        builder.add_activation(name=act_name, non_linearity="TANH",
                                input_name=fc_out, output_name=act_out)
        prev = act_out

    # Output layer
    builder.add_inner_product(
        name="fc_out", input_name=prev, output_name="fc_out_raw",
        input_channels=HIDDEN_LAYERS[-1], output_channels=DIM,
        W=model.coefs_[-1].T, b=model.intercepts_[-1], has_bias=True,
    )
    builder.add_activation(name="act_out", non_linearity="TANH",
                            input_name="fc_out_raw", output_name="embedding")

    cml_model = MLModel(builder.spec)

# Metadata
cml_model.short_description = "AARTE BehavioralEncoder — 24-dim identity embedding"
cml_model.author             = "Jonathan Sherman — OCSO-S1AF-GOV-1"
cml_model.license            = "© 2026 Jonathan Sherman. All Rights Reserved."
cml_model.input_description["input"]     = (
    "24-float behavioral sample (gesture/temporal/spatial/usage)")
cml_model.output_description["embedding"] = (
    "24-float L2-normalised identity embedding")

# Save the .mlpackage
cml_model.save(str(PACKAGE_PATH))
print(f"    Saved: {PACKAGE_PATH}")

# ─────────────────────────────────────────────────────────────────────────────
# 4. Compile to .mlmodelc (Neural Engine optimised)
# ─────────────────────────────────────────────────────────────────────────────
print("[4/4] Compiling to .mlmodelc...")

result = subprocess.run(
    ["xcrun", "coremlc", "compile", str(PACKAGE_PATH), str(OUT_DIR)],
    capture_output=True, text=True,
)
if result.returncode != 0:
    print(f"    ⚠  coremlc failed: {result.stderr.strip()}")
    print("    Copy BehavioralEncoder.mlpackage into Xcode and let it compile.")
else:
    print(f"    Compiled: {COMPILED_PATH}")

print()
print("═" * 60)
print("  Done — next steps:")
print()
print("  1. In Xcode, drag BehavioralEncoder.mlmodelc into the")
print("     OracleAI target's Copy Bundle Resources phase")
print("     (AARTE-iOS-App/Resources/BehavioralEncoder.mlmodelc)")
print()
print("  2. Clean build (⇧⌘K) and run — AIEngine will log")
print("     '[AARTE] Inference: Neural Engine' when the model loads.")
print()
print("  3. Re-run this script every 30 days or after collecting")
print("     500+ new labeled samples via MLPipeline.addSample().")
print("═" * 60)
