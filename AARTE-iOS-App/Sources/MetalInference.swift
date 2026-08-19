// =============================================================
// MetalInference.swift
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · Celestial Core
// Sovereign ID: 1 · OCSO-S1AF-GOV-1
// =============================================================
// Metal GPU inference backend for CelestialCore.
// Targets Apple A12 Bionic (iPhone XR) GPU — 4-core, Metal 3.
// All kernels are in CelestialShader.metal and receive the
// sovereign guard value (1) as a constant buffer argument.
// =============================================================

import Metal
import MetalKit
import Foundation
import os.log

/// Metal GPU compute backend.
/// Instantiated by CelestialCore; all methods are called from
/// the CelestialCoreActor context.
final class MetalInference: Sendable {

    private let log = Logger(subsystem: "com.jonathansherman.s1af", category: "MetalInference")

    // ── Metal objects ──────────────────────────────────────────
    private let device:       MTLDevice
    private let queue:        MTLCommandQueue
    private let library:      MTLLibrary

    // Pipeline states — one per kernel in CelestialShader.metal
    private let psMatVecMul:   MTLComputePipelineState
    private let psBatchMatMul: MTLComputePipelineState
    private let psSoftmax:     MTLComputePipelineState
    private let psRelu:        MTLComputePipelineState
    private let psGelu:        MTLComputePipelineState
    private let psLayerNorm:   MTLComputePipelineState
    private let psDequantize:  MTLComputePipelineState
    private let psEmbedding:   MTLComputePipelineState

    // ── Sovereign guard constant ───────────────────────────────
    /// Value 1 — injected into every kernel as buffer(N).
    /// Kernels drop execution if this ≠ 1.
    private var sovereignGuard: UInt32 = 1

    // ── Init ───────────────────────────────────────────────────

    init?() {
        guard let dev = MTLCreateSystemDefaultDevice() else {
            return nil  // Metal not available — should never happen on A12+
        }
        guard let q = dev.makeCommandQueue() else { return nil }

        // Load the default Metal library (compiled from CelestialShader.metal)
        guard let lib = try? dev.makeDefaultLibrary() else {
            // In debug builds we tolerate a missing compiled library
            // (Xcode hasn't built the Metal shaders yet).
            return nil
        }

        device  = dev
        queue   = q
        library = lib

        func pso(_ name: String) -> MTLComputePipelineState? {
            guard let fn = lib.makeFunction(name: name) else { return nil }
            return try? dev.makeComputePipelineState(function: fn)
        }

        guard
            let p1 = pso("matVecMul"),
            let p2 = pso("batchMatMul"),
            let p3 = pso("softmax"),
            let p4 = pso("relu"),
            let p5 = pso("gelu"),
            let p6 = pso("layerNorm"),
            let p7 = pso("dequantizeInt8"),
            let p8 = pso("embeddingLookup")
        else { return nil }

        psMatVecMul   = p1
        psBatchMatMul = p2
        psSoftmax     = p3
        psRelu        = p4
        psGelu        = p5
        psLayerNorm   = p6
        psDequantize  = p7
        psEmbedding   = p8
    }

    // ── CelestialCore interface ────────────────────────────────

    /// Attempt Metal inference on a CelestialRequest.
    /// Returns nil if the task type can't be handled by GPU compute alone.
    func infer(_ request: CelestialRequest) async -> CelestialOutput? {
        switch request.task {
        case .embedding(let text):
            return await embedText(text)
        case .textClassification(let text):
            return await classifyOnGPU(text)
        default:
            return nil  // Text generation needs a language model — not Metal alone
        }
    }

    // ── Embedding via Metal ────────────────────────────────────

    /// Produce a simple bag-of-words embedding on GPU using matrix-vector multiply.
    /// In production, replace the weight matrix with a real embedding table.
    private func embedText(_ text: String) async -> CelestialOutput {
        let dim   = 128
        let tokens = tokenize(text, maxLen: 64)

        // Stub weight matrix (dim × vocabSize) — in production loaded from .mlmodel
        let vocabSize = 1024
        var weights = [Float](repeating: 0, count: dim * vocabSize)
        // Deterministic placeholder: row i = i/vocabSize, column j = j/dim
        for r in 0..<dim { for c in 0..<vocabSize {
            weights[r * vocabSize + c] = Float(r + 1) / Float(dim) * Float(c + 1) / Float(vocabSize)
        }}

        // One-hot token vector (sum over tokens)
        var vec = [Float](repeating: 0, count: vocabSize)
        for t in tokens { if t < vocabSize { vec[t] += 1 } }

        // Run matVecMul on GPU
        guard let result = matVecMul(matrix: weights, vector: vec, rows: dim, cols: vocabSize)
        else { return .unavailable(reason: "Metal buffer allocation failed") }

        return .embedding(result)
    }

    // ── Classification via GPU softmax ─────────────────────────

    private func classifyOnGPU(_ text: String) async -> CelestialOutput {
        // Stub: map text length to a simple 3-class logit vector,
        // then run softmax on GPU.
        let n = text.count
        var logits: [Float] = [
            Float(n % 7) - 3,
            Float(n % 5) - 2,
            Float(n % 3) - 1,
        ]

        guard let probs = softmaxGPU(logits) else {
            return .unavailable(reason: "Metal softmax failed")
        }

        let labels = ["sovereign", "governance", "inference"]
        let maxIdx = probs.indices.max(by: { probs[$0] < probs[$1] }) ?? 0
        return .classification(label: labels[maxIdx], confidence: probs[maxIdx])
    }

    // ── Low-level Metal dispatch helpers ───────────────────────

    /// Matrix-vector multiply: A[rows×cols] × v[cols] → result[rows]
    func matVecMul(matrix: [Float], vector: [Float], rows: Int, cols: Int) -> [Float]? {
        guard
            let mBuf = makeBuffer(matrix),
            let vBuf = makeBuffer(vector),
            let rBuf = device.makeBuffer(length: rows * MemoryLayout<Float>.size, options: .storageModeShared),
            let cBuf = makeBuffer([UInt32(cols)]),
            let sBuf = makeBuffer([sovereignGuard]),
            let cmd  = queue.makeCommandBuffer(),
            let enc  = cmd.makeComputeCommandEncoder()
        else { return nil }

        enc.setComputePipelineState(psMatVecMul)
        enc.setBuffer(mBuf, offset: 0, index: 0)
        enc.setBuffer(vBuf, offset: 0, index: 1)
        enc.setBuffer(rBuf, offset: 0, index: 2)
        enc.setBuffer(cBuf, offset: 0, index: 3)
        enc.setBuffer(sBuf, offset: 0, index: 4)

        let tgs = min(psMatVecMul.maxTotalThreadsPerThreadgroup, rows)
        enc.dispatchThreads(
            MTLSize(width: rows, height: 1, depth: 1),
            threadsPerThreadgroup: MTLSize(width: tgs, height: 1, depth: 1)
        )
        enc.endEncoding()
        cmd.commit()
        cmd.waitUntilCompleted()

        let ptr = rBuf.contents().bindMemory(to: Float.self, capacity: rows)
        return Array(UnsafeBufferPointer(start: ptr, count: rows))
    }

    /// Softmax over a float array using the GPU kernel.
    func softmaxGPU(_ input: [Float]) -> [Float]? {
        let n = input.count
        guard n > 0 else { return [] }
        guard
            let inBuf  = makeBuffer(input),
            let outBuf = device.makeBuffer(length: n * MemoryLayout<Float>.size, options: .storageModeShared),
            let lenBuf = makeBuffer([UInt32(n)]),
            let sBuf   = makeBuffer([sovereignGuard]),
            let cmd    = queue.makeCommandBuffer(),
            let enc    = cmd.makeComputeCommandEncoder()
        else { return nil }

        let tgSize = min(psSoftmax.maxTotalThreadsPerThreadgroup, n)
        enc.setComputePipelineState(psSoftmax)
        enc.setBuffer(inBuf,  offset: 0, index: 0)
        enc.setBuffer(outBuf, offset: 0, index: 1)
        enc.setBuffer(lenBuf, offset: 0, index: 2)
        enc.setBuffer(sBuf,   offset: 0, index: 3)
        enc.setThreadgroupMemoryLength(tgSize * MemoryLayout<Float>.size, index: 0)
        enc.dispatchThreadgroups(MTLSize(width: 1, height: 1, depth: 1),
                                 threadsPerThreadgroup: MTLSize(width: tgSize, height: 1, depth: 1))
        enc.endEncoding()
        cmd.commit()
        cmd.waitUntilCompleted()

        let ptr = outBuf.contents().bindMemory(to: Float.self, capacity: n)
        return Array(UnsafeBufferPointer(start: ptr, count: n))
    }

    // ── Buffer helpers ─────────────────────────────────────────

    private func makeBuffer<T>(_ data: [T]) -> MTLBuffer? {
        data.withUnsafeBytes { raw in
            device.makeBuffer(bytes: raw.baseAddress!, length: raw.count, options: .storageModeShared)
        }
    }

    // ── Tokeniser (minimal BPE stub) ───────────────────────────
    /// Maps text to integer token IDs (byte-level, mod vocabSize).
    /// Replace with a real tokeniser vocabulary in production.
    private func tokenize(_ text: String, maxLen: Int) -> [Int] {
        let bytes = Array(text.utf8.prefix(maxLen))
        return bytes.map { Int($0) }
    }
}
