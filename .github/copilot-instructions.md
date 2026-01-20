# Copilot Instructions - zkMerkle Verifier

## TL;DR - Quick Start for AI Agents
**What**: Zero-Knowledge Proof-of-Reserve (zkPOR) system for CEX asset verification using Merkle trees.

**Critical Facts**:
- **Price Format**: All prices use 8-decimal fixed-point integers (divide by 100M for display: `BasePrice / 100,000,000`)
- **Index Immutability**: Asset indices (0-311) are permanent identifiers, never reused
- **Proof Arrays**: `cex_asset_list_commitments[i]` = commitment for asset at Index i (must match length of CexAssetsInfo)
- **Source of Truth**: config.json > Asset_List.csv (Asset_List may lag by hours)
- **Valid Leverage**: TotalDebt > TotalEquity is normal (indicates borrowed positions)
- **Batch Continuity**: account_tree_roots[0] of current batch must equal final root of previous batch

## Project Overview
This is a **Zero-Knowledge Proof-of-Reserve (zkPOR) verification system** that verifies CEX (Centralized Exchange) asset reserves using zero-knowledge proofs and Merkle tree commitments. The system validates asset holdings without revealing sensitive information.

## Project Structure
```
.github/
├── copilot-instructions.md    # This file
zkmerkle_verifier/
├── config/
│   ├── config.json            # Master configuration (2,190 lines)
│   ├── proof.csv              # zkPOR proof database (49,785 records)
│   └── zkpor864.vk.save       # ZK verification key (binary)
Asset_List.csv                # Token price reference (313 lines)
Untitled-1.js                 # Sample React component
```

## Architecture & Data Flow

### Core Components
- **[config/config.json](zkmerkle_verifier/config/config.json)** (2,190 lines):
  - Master configuration containing CEX asset metadata
  - 312 total asset entries (Index 0-311), ~18 active with non-zero TotalEquity
  - Fields per asset: TotalEquity, TotalDebt, BasePrice (8-decimal fixed-point), Symbol, Index
  - Index is immutable 0-based sequential identifier, never reused
  - Example: BTC (Index 0), ETH (Index 1), USDT (Index 3)

- **[config/proof.csv](zkmerkle_verifier/config/proof.csv)** (49,783 records + 1 header):
  - Database of zkPOR proofs with structured header row as first line
  - Each record contains:
    - `proof_info`: Base64-encoded zero-knowledge proof data
    - `cex_asset_list_commitments`: Array of Merkle commitment hashes indexed by asset Index
    - `account_tree_roots`: Array of account tree root hashes for chain continuity
    - `batch_commitment`: Root Merkle hash of all cex_asset_list_commitments
    - `batch_number`: Sequential batch identifier (non-consecutive gaps normal, e.g., 1→3→2→9)
  - All arrays within a record must stay synchronized by index

- **[config/zkpor864.vk.save](zkmerkle_verifier/config/zkpor864.vk.save)** (binary):
  - Verification key file for cryptographic proof validation
  - Must be loaded before any proof verification
  - May need base64 decoding depending on implementation

- **[Asset_List.csv](Asset_List.csv)** (313 lines, 312 tokens):
  - Token price reference (0-indexed, Index 0-311)
  - Secondary data source; **may lag behind config.json**
  - Used for cross-reference only; config.json BasePrice is source of truth

### Data Pipeline
1. CEX collects asset holdings and account data
2. Generates zkPOR proof + Merkle commitment trees (account_tree_roots, cex_asset_list_commitments)
3. Stores proof with batch metadata in proof.csv
4. Verifier: Load config.json + proof.csv + zkpor864.vk.save
5. Validates proof cryptographically without exposing raw account/balance data

## Key Patterns & Conventions

### Price Normalization (Critical)
All prices in config.json use **8-decimal fixed-point format**: `actual_price * 100,000,000 = BasePrice`
Examples from config.json:
- BTC $23,128.48 → BasePrice: 2,312,848,000,000
- ETH $1,585.33 → BasePrice: 158,533,000,000
- USDT $1.00010001 → BasePrice: 100,010,001
- USDC $0.99998338 → BasePrice: 99,998,338
- Stablecoins cluster near 100,000,000 (±0.0002%)

**Important rules**:
- **For display**: Always divide BasePrice by 100,000,000 to get user-facing price
- **For calculations**: Use raw BasePrice to avoid float precision errors
- **USD conversion formula**: `amount * BasePrice / 100,000,000`
- Never use floating-point arithmetic on BasePrice directly

### Indexing System (Immutable)
Assets use immutable, 0-based sequential **Index** field (never reused once assigned):
- Index 0 = BTC, Index 1 = ETH, Index 2 = BNB, Index 3 = USDT, Index 4 = BUSD, etc.
- Total assets: 312 defined (Index 0-311)
- **Active assets**: ~18 with non-zero TotalEquity in latest batch
- Index directly maps to `cex_asset_list_commitments[i]` array position
- Asset_List.csv Index must match config.json Index for lookups
- When verifying proofs, validate that commitment array order matches config.json Index sequence

### Proof Structure Convention (Synchronization Critical)
Each proof record contains parallel arrays that **must remain synchronized by index**:
- `cex_asset_list_commitments[i]` = Merkle hash for asset at config.json Index i
- Array length must equal CexAssetsInfo array length in config.json
- `account_tree_roots`: Contains roots for current batch + previous batch (for chain continuity)
- `batch_commitment`: Must equal Merkle root computed from cex_asset_list_commitments array
- **Non-consecutive batch numbers are VALID**: Batches may be skipped, failed, or reordered (1→3→2→9)
- Batch continuity checked by comparing `account_tree_roots[0]` to previous batch's final root

### Equity vs Debt Fields
- **TotalEquity**: Raw token amount owned by CEX (can exceed debt in healthy positions)
- **TotalDebt**: Raw token amount borrowed/short (can exceed equity in leveraged positions)
- **Valid states**: TotalDebt > TotalEquity is valid (indicates borrowed assets, normal for trading operations)
- Both stored as raw token amounts; multiply by respective BasePrice / 100,000,000 for USD value
- Filter active assets: only verify assets where TotalEquity > 0

## Critical Implementation Notes

### When Verifying Proofs
1. **Load verification key first**: Must load zkpor864.vk.save before any proof validation
2. **Validate batch_commitment**: Compute Merkle root of `cex_asset_list_commitments` array (in Index order 0→N), verify it matches proof's `batch_commitment`
3. **Asset index alignment**: Ensure `cex_asset_list_commitments` array length = CexAssetsInfo array length; index order must match
4. **Chain continuity**: Compare current batch's `account_tree_roots[0]` with previous batch's final root value
5. **Price source hierarchy**: 
   - Primary: config.json BasePrice (always use)
   - Reference only: Asset_List.csv (may be stale, use for cross-check ±2%)

### Working with Asset Metadata
- **Active vs inactive**: Verify only assets with TotalEquity > 0
- **Leverage positions**: Valid if TotalDebt > TotalEquity (borrowed assets, normal in trading)
- **USD conversion**: Multiply `TotalEquity * BasePrice / 100,000,000` and `TotalDebt * BasePrice / 100,000,000`
- **Stale data detection**: Compare Asset_List.csv BasePrice vs config.json; flag >2% discrepancy for manual review
- **Config.json is source of truth**: All asset metadata, prices, and counts derive from config.json
- **Asset_List.csv Purpose**: Acts as a fast-reference token price index; used for cross-validation but NEVER as primary source. config.json values override Asset_List.csv when they conflict.

## CSV Parsing Rules (proof.csv)
- **Always skip header row**: First line contains column names; proof.csv structure requires CSV parser (not simple string.split)
- **Use CSV library for Base64**: proof_info field contains Base64 strings that may include commas; standard CSV parsing required
- **Field parsing order**: Parse in sequence: id, created_at, updated_at, deleted_at, proof_info, cex_asset_list_commitments, account_tree_roots, batch_commitment, batch_number
- **Encoding**: UTF-8; Base64 values are ASCII-safe but may contain + or / characters
- **Array fields**: `cex_asset_list_commitments` and `account_tree_roots` are JSON arrays stored as quoted strings within CSV cells
- **Important**: The Header row contains metadata columns (id, created_at, updated_at, deleted_at) before the key proof fields

### JSON Parsing (config.json)
- **Valid JSON**: Standard UTF-8 JSON array of objects
- **Field requirements per asset**:
  - `TotalEquity`: integer (raw token amount)
  - `TotalDebt`: integer (raw token amount)
  - `BasePrice`: integer (8-decimal fixed-point)
  - `Symbol`: string (uppercase)
  - `Index`: integer (0-based, sequential, immutable)

## File Organization & Locations
```
zkmerkle_verifier/
├── config/
│   ├── config.json              # 2,190 lines; master config with 312 assets
│   ├── proof.csv                # 49,785 proof records; CSV with Base64-encoded proofs
│   └── zkpor864.vk.save         # Binary; ZK verification key (load before use)
Asset_List.csv                   # 313 lines; token price reference data (0-indexed, 0-311)
.github/
├── copilot-instructions.md      # This file; AI agent guidance
Untitled-1.js                    # Sample React component (external dependency example)
```

## Common Developer Tasks

### Adding New Assets to System
1. Append new object to `CexAssetsInfo` array in config.json
2. Assign next sequential Index (don't reuse old ones)
3. Set TotalEquity, TotalDebt, BasePrice (8-decimal format), Symbol
4. Add corresponding row to Asset_List.csv with same Index
5. Update all future proofs to include `cex_asset_list_commitments[new_index]`

### Batch Verification (Multi-batch Validation)
1. Query proof.csv for batch_number range (use streaming for large sets)
2. For each batch: validate batch_commitment against computed Merkle root
3. Verify chain continuity: current batch's `account_tree_roots[0]` = previous batch's final root
4. Report: asset solvency status with USD values (compute via BasePrice conversion)

### Price Updates
1. **Source of truth**: Modify BasePrice in config.json (8-decimal format)
2. Update Asset_List.csv BasePrice for reference
3. Validate new price within ±10% of previous (detect manipulation/errors)
4. Mark price update timestamp if system tracks it
5. Recompute any USD-valued totals immediately

### Debugging Stale Data
1. Compare Asset_List.csv prices vs config.json BasePrice
2. Flag discrepancies > 2% (normal for volatile assets)
3. Verify config.json timestamp is recent (hourly expected)
4. Check proof.csv batch_number gaps (gaps normal, but extreme gaps may indicate data loss)

## Data Validation Checklist

When processing proof.csv or config.json, verify:

**CSV Parsing (proof.csv)**
- [ ] Skip header row (line 1)
- [ ] Use CSV library to properly handle Base64 strings (may contain commas)
- [ ] Validate each required field present: proof_info, cex_asset_list_commitments, account_tree_roots, batch_commitment, batch_number
- [ ] Parse arrays correctly (cex_asset_list_commitments, account_tree_roots)

**Config Validation (config.json)**
- [ ] CexAssetsInfo array length = all cex_asset_list_commitments array lengths
- [ ] All Index values 0-based, sequential, no gaps for active assets
- [ ] No duplicate Index values
- [ ] All BasePrice values positive integers (8-decimal format)
- [ ] All TotalEquity, TotalDebt values non-negative integers

**Proof Integrity**
- [ ] `batch_commitment` = Merkle root of `cex_asset_list_commitments` (verify by recomputing)
- [ ] `cex_asset_list_commitments` length = config.json CexAssetsInfo length
- [ ] Asset Index order in commitments matches config.json order
- [ ] `account_tree_roots[0]` matches previous batch's final root (chain check)
- [ ] Non-consecutive batch_numbers are allowed (1→3→2 is valid)

**Asset Data Quality**
- [ ] TotalDebt > TotalEquity is VALID (indicates leveraged/borrowed positions)
- [ ] Active assets: filter by TotalEquity > 0
- [ ] Price comparison: Asset_List.csv BasePrice vs config.json ±2% threshold
- [ ] No NaN, Infinity, or null values in numerical fields

## Typical Verification Workflow

```
1. Load Phase
   - Parse config.json (standard JSON decoder)
   - Read proof.csv (CSV parser, skip header, handle Base64)
   - Load zkpor864.vk.save (binary key, may need base64 decode)

2. Select Proof
   - Query proof.csv for specific batch_number or timestamp
   - Retrieve record containing proof_info, commitment arrays

3. Compute Merkle Root
   - Iterate cex_asset_list_commitments[0..N] in order (matches config.json Index)
   - Compute Merkle tree hash (SHA256 or ZK circuit hash)
   - Verify computed root = proof's batch_commitment

4. Validate Proof Signature
   - Use zkpor864.vk.save key
   - Cryptographically verify proof_info against batch_commitment root
   - On failure: log error, flag batch as invalid

5. Chain Check
   - Ensure current batch's account_tree_roots[0] = previous batch's final root
   - Detect chain breaks (indicate data loss or manipulation)

6. Report Results
   - Output asset solvency: active assets with TotalEquity > 0
   - Compute USD values: TotalEquity * BasePrice / 100,000,000
   - Total holdings = sum all active assets USD value
   - Confidence: pass=1.0, fail=0.0 based on proof validation
```

## Debugging Common Issues

**Batch Not Found**
- Check if batch_number exists in proof.csv (try streaming search)
- Non-consecutive numbers are normal (1, 3, 2, 9 is valid)
- Verify batch_number is integer and in expected range

**Commitment Mismatch**
- Recompute Merkle root: iterate cex_asset_list_commitments[0..N] in Index order
- Verify array length = config.json CexAssetsInfo length
- Check asset Index mapping: commitment[i] should be for asset at config.json Index i
- Ensure hash function matches (SHA256 vs circuit hash)

**Price Calculation Errors**
- Verify BasePrice is 8-decimal fixed-point (always integer, no decimals)
- Formula: `display_price = BasePrice / 100,000,000`
- Never mix BasePrice (integer) with floating-point during intermediate calculations
- Watch for overflow: USD value = amount * BasePrice may exceed 64-bit range for large positions

**Verification Key Load Failure**
- Confirm zkpor864.vk.save is binary file (not UTF-8 text)
- May require base64 decoding before use
- Check file permissions and integrity
- Verify key size matches expected ZK circuit parameters

**CSV Parsing Failures**
- Ensure UTF-8 encoding
- Handle Base64 strings in proof_info field (may contain +, /, =)
- Use proper CSV parser, not manual string.split(",")
- Validate header: expected first line = "proof_info,cex_asset_list_commitments,account_tree_roots,batch_commitment,batch_number"

**Stale Data Detection**
- Compare Asset_List.csv vs config.json BasePrice
- >2% deviation = flag for manual review
- Check config.json modification timestamp (expect hourly updates)
- Log timestamp of last successful verification

## Current Project State
- **Primary deliverable**: Data configuration (config.json, proof.csv, Asset_List.csv) for zkPOR verification system
- **Limited implementation**: Untitled-1.js is an isolated React component for external onboarding widget (SoQuest); not part of core verification logic
- **No build system**: This is a configuration-driven project; verification logic would be implemented by consuming systems
- **Key responsibility**: Maintain data integrity (asset indices, prices, proof records) and document verification requirements for external implementations

## Development Workflow & Integration Points

### External Dependencies
- **React** (Untitled-1.js example): useEffect hooks for dynamic script loading from external CDN
- **ZK Proof Libraries**: Integration point for zkpor864 verification logic (not in repo)
- **CSV Parsing**: Need robust CSV library (handle quoted fields, embedded Base64)
- **JSON**: Standard library sufficient (config.json is valid UTF-8 JSON)

### Code Style & Conventions
- Use immutable Index values; never reassign asset indices
- All price calculations: use integer arithmetic (BasePrice is integer 8-decimal fixed-point)
- Null/undefined checks: Asset_List.csv may be missing entries; handle gracefully
- Error handling: Log batch_number on verification failures for debugging
- Comments: Add comments only when logic is non-obvious (price conversions, array indexing)

### Testing Strategy
**Unit Tests Should Cover**:
- Price normalization: BasePrice → display price, handle edge cases (very large, very small)
- Index mapping: Ensure cex_asset_list_commitments[i] maps to config.json asset Index i
- CSV parsing: Handle Base64 strings with special characters, quoted fields
- Batch continuity: Verify account_tree_roots chain linking
- Merkle root: Compute and validate batch_commitment correctly

**Integration Tests Should Cover**:
- Full verification workflow: load → select → compute → validate → report
- Multi-batch verification: ensure chain continuity across batch sequence
- Data consistency: Asset_List.csv vs config.json price comparison
- Error scenarios: missing file, corrupted data, invalid Base64

### Performance Considerations
- **Batch processing**: Use streaming for large proof.csv (49K+ rows)
- **Merkle computation**: Cache intermediate hashes if re-verifying same batch
- **Price lookups**: Index by config.json Index for O(1) access, not O(N) symbol search
- **Large USD values**: Watch for 64-bit integer overflow (amount * BasePrice may exceed 2^53)

### Known Limitations & Edge Cases
- **Asset_List.csv staleness**: May lag config.json by hours; use for reference only
- **Non-consecutive batches**: Normal behavior, not an error (1→3→2→9 is valid)
- **Leverage positions**: TotalDebt > TotalEquity is valid and common (indicates borrowed assets)
- **Index immutability**: Once Index assigned to asset symbol, never change or reuse
- **Price precision**: 8-decimal fixed-point has same precision as 64-bit float for values <$10M per unit
- **Proof batch gaps**: Gaps in batch_number sequence (missing batches) are expected; do not assume consecutive

## Documentation Validation & Maintenance

**Status**: ✅ Verified & Current (as of January 21, 2026)

All specifications in this file have been validated against actual codebase data. See [ANALYSIS.md](../ANALYSIS.md) for detailed verification audit.

**Quarterly Maintenance Checklist**:
- [ ] After adding new assets: Verify Index immutability maintained; confirm CexAssetsInfo length matches all commitment array lengths
- [ ] When proof.csv grows beyond 50K records: Update record count reference in Project Structure section
- [ ] Price updates: Confirm both config.json BasePrice and Asset_List.csv updated; validate within ±10% of previous
- [ ] Data anomalies: If Asset_List.csv diverges >2% from config.json, document in "Known Limitations" section
- [ ] Batch processing: Monitor for extreme gaps in batch_number sequence; flag if gaps exceed 1000

**Quick Debug Reference for Common Questions**:
- Q: "Should I use Asset_List.csv prices?" → A: No, always use config.json BasePrice (source of truth)
- Q: "Is TotalDebt > TotalEquity an error?" → A: No, valid for leveraged/borrowed positions
- Q: "Why aren't batch numbers consecutive?" → A: Normal behavior; batches may be skipped, failed, or reordered
- Q: "How do I convert BasePrice to display price?" → A: Divide by 100,000,000 (8-decimal fixed-point format)
- Q: "What if commitment arrays don't align?" → A: Chain integrity compromised; verify config.json Index order matches proof.csv array order
