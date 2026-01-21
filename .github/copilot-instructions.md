
# Copilot Instructions – zkMerkle Verifier (2026)

## Project Purpose & Architecture
This repo is a configuration-driven Zero-Knowledge Proof-of-Reserve (zkPOR) verifier for CEX asset attestation. It uses Merkle trees and ZK proofs to validate asset holdings without revealing sensitive data. There is no build system or application code—**all logic is implemented by consuming systems** using the provided data/configuration files.

### Key Files & Structure
- **zkmerkle_verifier/config/config.json**: Master asset config (312 assets, 0-based Index, 8-decimal BasePrice, TotalEquity/TotalDebt per asset)
- **zkmerkle_verifier/config/proof.csv**: 49K+ zkPOR proof records; each row contains Base64-encoded proof, Merkle commitments, batch metadata
- **zkmerkle_verifier/config/zkpor864.vk.save**: Binary ZK verification key (must be loaded before proof validation)
- **Asset_List.csv**: Price reference (may lag config.json; never use as source of truth)
- **Untitled-1.js**: Example React component (not part of core logic)

## Essential Conventions & Patterns
- **Price Format**: All prices are 8-decimal fixed-point integers (display = BasePrice / 100,000,000)
- **Index Immutability**: Asset Index (0-311) is never reused; always maps 1:1 to array positions in proofs
- **Proof Array Sync**: `cex_asset_list_commitments[i]` must match asset at config.json Index i; array length must match asset count
- **Batch Continuity**: `account_tree_roots[0]` of current batch = previous batch's final root (chain integrity)
- **Leverage Valid**: TotalDebt > TotalEquity is normal (borrowed/short positions)
- **Primary Data Source**: Always use config.json for prices/metadata; Asset_List.csv is for cross-check only

## Developer Workflows
**Adding an Asset:**
1. Append to config.json (next Index, set BasePrice, TotalEquity, TotalDebt, Symbol)
2. Add to Asset_List.csv (same Index)
3. Update future proofs to include new asset in `cex_asset_list_commitments`

**Verifying a Batch:**
1. Load zkpor864.vk.save (verification key)
2. Parse config.json and proof.csv (skip header, use robust CSV parser for Base64 fields)
3. For each proof:
   - Check `cex_asset_list_commitments` length and order vs config.json
   - Recompute Merkle root, compare to `batch_commitment`
   - Validate chain: `account_tree_roots[0]` matches previous batch's final root
   - Only verify assets with TotalEquity > 0

**Price Updates:**
- Update BasePrice in config.json (8-decimal integer)
- Update Asset_List.csv for reference
- Validate new price within ±10% of previous

## Data Validation Checklist
- Skip proof.csv header row
- Use CSV parser for Base64 fields (proof_info may contain commas)
- All array fields (commitments, roots) must be JSON arrays as quoted strings
- config.json CexAssetsInfo length = all proof array lengths
- No duplicate or missing Index values for active assets
- All prices/amounts are positive integers (8-decimal for BasePrice)

## Debugging & Edge Cases
- Non-consecutive batch_numbers are normal (e.g., 1,3,2,9)
- Asset_List.csv may lag config.json by hours; flag >2% price deviation
- Gaps in batch_number sequence are expected
- If commitment arrays don't align, chain integrity is broken

## Quick Reference
- **Display price:** BasePrice / 100,000,000
- **USD value:** amount * BasePrice / 100,000,000
- **Never use Asset_List.csv as source of truth**
- **Index 0 = BTC, 1 = ETH, ...** (see config.json)

For detailed audit and validation, see [ANALYSIS.md](../ANALYSIS.md).
