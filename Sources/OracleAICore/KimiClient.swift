// =============================================================
// KimiClient.swift — OracleAICore
// Author: Jonathan Sherman
// Copyright: © 2026 Jonathan Sherman. All Rights Reserved.
// Framework: S1AF v1.0.0-JS · OCSO-S1AF-GOV-1
// Platforms: Linux · macOS · iOS
// =============================================================
// Cross-platform Kimi (Moonshot) API client.
// Uses Foundation URLSession — works on Linux, macOS, and iOS.
// =============================================================

import Foundation

// MARK: — Request / response models

public struct KimiMessage: Codable, Sendable {
    public let role:    String
    public let content: String
    public init(role: String, content: String) {
        self.role    = role
        self.content = content
    }
}

public struct KimiRequest: Codable, Sendable {
    public let model:       String
    public let messages:    [KimiMessage]
    public let maxTokens:   Int
    public let temperature: Double

    enum CodingKeys: String, CodingKey {
        case model, messages, temperature
        case maxTokens = "max_tokens"
    }

    public init(
        model:       String       = "kimi-k2.6",
        messages:    [KimiMessage],
        maxTokens:   Int          = 8192,
        temperature: Double       = 0.2
    ) {
        self.model       = model
        self.messages    = messages
        self.maxTokens   = maxTokens
        self.temperature = temperature
    }
}

public struct KimiChoice: Codable, Sendable {
    public let message: KimiMessage
}

public struct KimiResponse: Codable, Sendable {
    public let id:      String
    public let choices: [KimiChoice]

    public var text: String { choices.first?.message.content ?? "" }
}

// MARK: — Errors

public enum KimiError: Error, Sendable {
    case missingAPIKey
    case httpError(statusCode: Int, body: String)
    case decodingError(String)
    case networkError(String)
}

// MARK: — Client

/// Async Kimi (Moonshot) API client.  Thread-safe, Sendable.
public actor KimiClient {

    // ── Configuration ──────────────────────────────────────────
    private let apiKey:  String
    private let baseURL: String
    private let model:   String

    /// Shared default model list (kimi-k2.6, kimi-k3, moonshot-v1-8k …)
    public static let defaultModel = "kimi-k2.6"

    // ── Init ───────────────────────────────────────────────────

    /// Initialise with an explicit key and optional overrides.
    public init(
        apiKey:  String,
        baseURL: String = "https://api.moonshot.ai/v1",
        model:   String = KimiClient.defaultModel
    ) throws {
        guard !apiKey.isEmpty, apiKey.hasPrefix("sk-") else {
            throw KimiError.missingAPIKey
        }
        self.apiKey  = apiKey
        self.baseURL = baseURL
        self.model   = model
    }

    // ── Chat completion ────────────────────────────────────────

    /// Send a chat completion request and return the first choice text.
    public func complete(
        messages: [KimiMessage],
        maxTokens:   Int    = 8192,
        temperature: Double = 0.2
    ) async throws -> String {
        let req = KimiRequest(
            model:       model,
            messages:    messages,
            maxTokens:   maxTokens,
            temperature: temperature
        )
        return try await send(request: req).text
    }

    /// Single-turn helper: send a plain user prompt.
    public func prompt(_ text: String, system: String? = nil) async throws -> String {
        var msgs: [KimiMessage] = []
        if let sys = system { msgs.append(.init(role: "system", content: sys)) }
        msgs.append(.init(role: "user", content: text))
        return try await complete(messages: msgs)
    }

    // MARK: — Private

    private func send(request: KimiRequest) async throws -> KimiResponse {
        guard let url = URL(string: "\(baseURL)/chat/completions") else {
            throw KimiError.networkError("Invalid base URL: \(baseURL)")
        }
        var urlRequest        = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json",  forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("S1AF/\(s1afVersion)", forHTTPHeaderField: "User-Agent")

        do {
            urlRequest.httpBody = try JSONEncoder().encode(request)
        } catch {
            throw KimiError.networkError("Encoding failed: \(error)")
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: urlRequest)
        } catch {
            throw KimiError.networkError(error.localizedDescription)
        }

        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw KimiError.httpError(statusCode: http.statusCode, body: body)
        }

        do {
            return try JSONDecoder().decode(KimiResponse.self, from: data)
        } catch {
            throw KimiError.decodingError(error.localizedDescription)
        }
    }
}
