// =============================================================
// CelestialShader.metal
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// GPU compute kernels for sovereign AI inference.
// Optimised for Apple A12 Bionic (iPhone XR) and all newer
// Apple GPU architectures. All inference is routed through
// CelestialCore.swift which tags every dispatch with
// sovereignID = 1 before touching these kernels.
//
// Kernels:
//   matVecMul     — linear layer forward pass
//   batchMatMul   — attention QK^T and QKV projection
//   softmax       — attention weight normalisation
//   relu / gelu   — activation functions
//   layerNorm     — layer / RMS normalisation
//   quantDequant  — INT8 ↔ FP32 for quantised weights
// =============================================================

#include <metal_stdlib>
#include <metal_math>
using namespace metal;

// ── Sovereign tag constant ──────────────────────────────────
// Every kernel reads this to confirm it was dispatched by the
// sovereign governance layer. Value is always 1 (Sovereign ID: 1).
constant uint SOVEREIGN_ID = 1;

// ─────────────────────────────────────────────────────────────
// MARK: — Linear layer: matrix-vector multiply (FP32)
// A [rows × cols] × v [cols] = out [rows]
// ─────────────────────────────────────────────────────────────
kernel void matVecMul(
    device const float* matrix     [[ buffer(0) ]],
    device const float* vector     [[ buffer(1) ]],
    device       float* result     [[ buffer(2) ]],
    constant     uint&  cols       [[ buffer(3) ]],
    constant     uint&  sovereignGuard [[ buffer(4) ]],   // must equal 1
    uint                row        [[ thread_position_in_grid ]]
) {
    if (sovereignGuard != SOVEREIGN_ID) return;   // governance gate

    float sum = 0.0f;
    for (uint c = 0; c < cols; c++) {
        sum = fma(matrix[row * cols + c], vector[c], sum);
    }
    result[row] = sum;
}

// ─────────────────────────────────────────────────────────────
// MARK: — Batched matrix multiply (for attention projections)
// A [M × K] × B [K × N] = C [M × N]
// Each threadgroup handles one (row, col) output tile.
// ─────────────────────────────────────────────────────────────
kernel void batchMatMul(
    device const float* A          [[ buffer(0) ]],
    device const float* B          [[ buffer(1) ]],
    device       float* C          [[ buffer(2) ]],
    constant     uint&  M          [[ buffer(3) ]],
    constant     uint&  N          [[ buffer(4) ]],
    constant     uint&  K          [[ buffer(5) ]],
    constant     uint&  sovereignGuard [[ buffer(6) ]],
    uint2               gid        [[ thread_position_in_grid ]]
) {
    if (sovereignGuard != SOVEREIGN_ID) return;
    if (gid.x >= N || gid.y >= M) return;

    float acc = 0.0f;
    for (uint k = 0; k < K; k++) {
        acc = fma(A[gid.y * K + k], B[k * N + gid.x], acc);
    }
    C[gid.y * N + gid.x] = acc;
}

// ─────────────────────────────────────────────────────────────
// MARK: — Softmax (numerically stable, single-pass in threadgroup)
// Used for attention weight normalisation.
// ─────────────────────────────────────────────────────────────
kernel void softmax(
    device const float* input      [[ buffer(0) ]],
    device       float* output     [[ buffer(1) ]],
    constant     uint&  length     [[ buffer(2) ]],
    constant     uint&  sovereignGuard [[ buffer(3) ]],
    threadgroup  float* scratch    [[ threadgroup(0) ]],  // tgSize floats
    uint                tid        [[ thread_position_in_threadgroup ]],
    uint                tgSize     [[ threads_per_threadgroup ]]
) {
    if (sovereignGuard != SOVEREIGN_ID) return;

    // Pass 1 — find max for numerical stability.
    float localMax = -INFINITY;
    for (uint i = tid; i < length; i += tgSize) {
        localMax = max(localMax, input[i]);
    }
    scratch[tid] = localMax;
    threadgroup_barrier(mem_flags::mem_threadgroup);
    for (uint s = tgSize >> 1; s > 0; s >>= 1) {
        if (tid < s) scratch[tid] = max(scratch[tid], scratch[tid + s]);
        threadgroup_barrier(mem_flags::mem_threadgroup);
    }
    const float globalMax = scratch[0];

    // Pass 2 — compute exp and local sum.
    float localSum = 0.0f;
    for (uint i = tid; i < length; i += tgSize) {
        output[i] = exp(input[i] - globalMax);
        localSum += output[i];
    }
    scratch[tid] = localSum;
    threadgroup_barrier(mem_flags::mem_threadgroup);
    for (uint s = tgSize >> 1; s > 0; s >>= 1) {
        if (tid < s) scratch[tid] += scratch[tid + s];
        threadgroup_barrier(mem_flags::mem_threadgroup);
    }
    const float invSum = 1.0f / scratch[0];

    // Pass 3 — normalise.
    for (uint i = tid; i < length; i += tgSize) {
        output[i] *= invSum;
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: — ReLU activation
// ─────────────────────────────────────────────────────────────
kernel void relu(
    device const float* input      [[ buffer(0) ]],
    device       float* output     [[ buffer(1) ]],
    constant     uint&  sovereignGuard [[ buffer(2) ]],
    uint                idx        [[ thread_position_in_grid ]]
) {
    if (sovereignGuard != SOVEREIGN_ID) return;
    output[idx] = max(0.0f, input[idx]);
}

// ─────────────────────────────────────────────────────────────
// MARK: — GELU activation (approximate, Hendrycks 2016)
// gelu(x) ≈ 0.5 * x * (1 + tanh(√(2/π) * (x + 0.044715·x³)))
// ─────────────────────────────────────────────────────────────
kernel void gelu(
    device const float* input      [[ buffer(0) ]],
    device       float* output     [[ buffer(1) ]],
    constant     uint&  sovereignGuard [[ buffer(2) ]],
    uint                idx        [[ thread_position_in_grid ]]
) {
    if (sovereignGuard != SOVEREIGN_ID) return;
    const float x    = input[idx];
    const float cube = x * x * x;
    const float inner = 0.7978845608f * (x + 0.044715f * cube);
    output[idx] = 0.5f * x * (1.0f + tanh(inner));
}

// ─────────────────────────────────────────────────────────────
// MARK: — Layer normalisation
// Normalises each vector of length `length` using learned
// scale (gamma) and shift (beta) parameters.
// ─────────────────────────────────────────────────────────────
kernel void layerNorm(
    device const float* input      [[ buffer(0) ]],
    device       float* output     [[ buffer(1) ]],
    device const float* gamma      [[ buffer(2) ]],
    device const float* beta       [[ buffer(3) ]],
    constant     uint&  length     [[ buffer(4) ]],
    constant     float& epsilon    [[ buffer(5) ]],
    constant     uint&  sovereignGuard [[ buffer(6) ]],
    threadgroup  float* scratch    [[ threadgroup(0) ]],
    uint                tid        [[ thread_position_in_threadgroup ]],
    uint                tgSize     [[ threads_per_threadgroup ]]
) {
    if (sovereignGuard != SOVEREIGN_ID) return;

    // Compute mean.
    float localSum = 0.0f;
    for (uint i = tid; i < length; i += tgSize) localSum += input[i];
    scratch[tid] = localSum;
    threadgroup_barrier(mem_flags::mem_threadgroup);
    for (uint s = tgSize >> 1; s > 0; s >>= 1) {
        if (tid < s) scratch[tid] += scratch[tid + s];
        threadgroup_barrier(mem_flags::mem_threadgroup);
    }
    const float mean = scratch[0] / float(length);

    // Compute variance.
    float localVar = 0.0f;
    for (uint i = tid; i < length; i += tgSize) {
        const float d = input[i] - mean;
        localVar += d * d;
    }
    scratch[tid] = localVar;
    threadgroup_barrier(mem_flags::mem_threadgroup);
    for (uint s = tgSize >> 1; s > 0; s >>= 1) {
        if (tid < s) scratch[tid] += scratch[tid + s];
        threadgroup_barrier(mem_flags::mem_threadgroup);
    }
    const float invStd = rsqrt(scratch[0] / float(length) + epsilon);

    // Normalise, scale, shift.
    for (uint i = tid; i < length; i += tgSize) {
        output[i] = gamma[i] * ((input[i] - mean) * invStd) + beta[i];
    }
}

// ─────────────────────────────────────────────────────────────
// MARK: — INT8 dequantisation → FP32
// Converts quantised INT8 weights back to FP32 for inference.
// scale and zeroPoint are per-channel (stored in buffer(3/4)).
// ─────────────────────────────────────────────────────────────
kernel void dequantizeInt8(
    device const char*  quantised  [[ buffer(0) ]],
    device       float* output     [[ buffer(1) ]],
    device const float* scale      [[ buffer(2) ]],
    device const char*  zeroPoint  [[ buffer(3) ]],
    constant     uint&  cols       [[ buffer(4) ]],   // channel stride
    constant     uint&  sovereignGuard [[ buffer(5) ]],
    uint2               gid        [[ thread_position_in_grid ]]
) {
    if (sovereignGuard != SOVEREIGN_ID) return;
    const uint idx = gid.y * cols + gid.x;
    output[idx] = scale[gid.y] * float(quantised[idx] - zeroPoint[gid.y]);
}

// ─────────────────────────────────────────────────────────────
// MARK: — Embedding lookup
// Reads token embedding vectors from a weight table.
// tokenIDs [seqLen], weights [vocabSize × dim] → out [seqLen × dim]
// ─────────────────────────────────────────────────────────────
kernel void embeddingLookup(
    device const uint*  tokenIDs   [[ buffer(0) ]],
    device const float* weights    [[ buffer(1) ]],
    device       float* output     [[ buffer(2) ]],
    constant     uint&  dim        [[ buffer(3) ]],
    constant     uint&  sovereignGuard [[ buffer(4) ]],
    uint2               gid        [[ thread_position_in_grid ]]
    // gid.y = sequence position, gid.x = embedding dimension
) {
    if (sovereignGuard != SOVEREIGN_ID) return;
    const uint tokenID = tokenIDs[gid.y];
    output[gid.y * dim + gid.x] = weights[tokenID * dim + gid.x];
}
