# NCI (NekoChat Image) — Implementation TODO

> Standalone, versioned encrypted image container format (`.nci`) and cross-platform TypeScript SDK (`nekochat-image`) for **NekoChat**, **Warden**, and future applications.

---

## Phase 0 — Research & Architecture (Current)
- [ ] Inspect existing encryption libraries & NekoChat dependencies (`crypto-js` is not suitable for AES-GCM; evaluate `libsodium` / `@noble/ciphers` + `@noble/curves` / Web Crypto API / Node `crypto`)
- [ ] Compare `age`, `libsodium`, and Web Crypto API (`AES-256-GCM` + `X25519` / `HKDF`)
- [ ] Evaluate Expo / React Native compatibility (Hermes engine, no native Node `crypto`, WebCrypto polyfill vs pure JS audited `@noble/*` or `react-native-quick-crypto`)
- [ ] Evaluate Browser compatibility (Web Crypto API `SubtleCrypto`)
- [ ] Evaluate PHP interoperability (`sodium_crypto_aead_xchacha20poly1305_ietf_*` or `openssl_encrypt('aes-256-gcm')`)
- [ ] Decide initial cryptographic primitive
- [ ] Decide NCI v1 binary file structure
- [ ] Define access model (Model A: Server-mediated vs Model B: Client-side decryption) and recipient/key ownership model
- [ ] Define key rotation and key recovery strategy
- [ ] Write `specification/SECURITY_MODEL.md`
- [ ] Finalize `specification/NCI_FORMAT.md` and `specification/NCI_V1.md`

## Phase 1 — NCI Core Prototype
- [ ] Implement magic signature (`NCI\0` or `NEKOIMG`)
- [ ] Implement binary header parser & serializer
- [ ] Implement format version detection (`v1`)
- [ ] Implement basic `encodeNCI(input, options)` and `decodeNCI(input, options)`
- [ ] Implement `parseNCI(input)`, `getNCIMetadata(input)`, `validateNCI(input)`
- [ ] Implement authenticated encryption (AEAD) with AAD binding over the header
- [ ] Implement corrupted-file & tampered-ciphertext detection
- [ ] Implement structured error classes (`NCIFormatError`, `NCIVersionError`, `NCIDecryptError`, etc.)
- [ ] Generate synthetic sample `.nci` test fixtures

## Phase 2 — Key Management
- [ ] Implement per-file random DEK generation
- [ ] Implement secure DEK key wrapping for one or more recipients
- [ ] Implement Key IDs (`kid`)
- [ ] Implement recipient add/remove/unwrap flows
- [ ] Implement key import/export (without logging or hardcoding secrets)
- [ ] Document key loss, rotation, and recovery consequences
- [ ] Add unit & security tests for unauthorized recipient rejection

## Phase 3 — Cross-Platform Compatibility & Adapters
- [ ] `packages/core` & `packages/crypto` (runtime-agnostic TypeScript)
- [ ] `packages/expo` (Expo / React Native adapter)
- [ ] `packages/browser` (Browser / Web Crypto adapter for Admin Dashboard)
- [ ] `packages/node` (Node.js adapter for `server.mjs`)
- [ ] PHP interoperability reference example + shared test vectors
- [ ] Large-file & memory usage tests
- [ ] Cross-platform round-trip tests (encode on Expo -> decode on Browser/Node/PHP and vice versa)

## Phase 4 — Security & Reliability Hardening
- [ ] Invalid magic / truncated header tests
- [ ] Unsupported version tests
- [ ] Corrupted ciphertext & AAD tampering tests
- [ ] Authentication tag failure tests
- [ ] Nonce uniqueness / handling tests
- [ ] Malformed metadata & parser fuzz tests
- [ ] Dependency audit (`npm audit`)
- [ ] Final review of `SECURITY_MODEL.md`

## Phase 5 — NekoChat Integration
- [ ] Install `nekochat-image` SDK
- [ ] Compress & encode uploaded character avatars to `.nci`
- [ ] Store pending `.nci` files in `uploads/temp/` and approved files in `uploads/approved/`
- [ ] Implement authenticated API retrieval & mobile decoding
- [ ] Integrate Browser adapter into Admin Dashboard for reviewing pending `.nci` images
- [ ] Test format migration & backward compatibility

## Phase 6 — Warden Integration
- [ ] Install the same `nekochat-image` SDK
- [ ] Integrate encrypted local image vault
- [ ] Integrate multi-recipient / advanced key management
- [ ] Implement independent storage adapter
- [ ] Verify cross-app compatibility with NekoChat `.nci` fixtures

## Phase 7 — Public Release Preparation (`nekochat-image` repo)
- [ ] Finalize `README.md`, `LICENSE`, `SECURITY.md`, `.env.example`, `.gitignore`
- [ ] Publish `specification/` docs and API reference
- [ ] Add `examples/` (`expo`, `browser`, `node`, `php`)
- [ ] Add version compatibility matrix
- [ ] Run GitHub secret scanning & review git history
- [ ] Tag first stable SDK release (`v1.0.0`)
