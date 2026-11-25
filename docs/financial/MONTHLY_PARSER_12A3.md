# Monthly parser 12A.3

The consolidated layout selects a unique period header on row 4 independently in each sheet, instead of treating accumulated column B as monthly revenue, expenses and result. Cash balance remains a point-in-time balance. Revenue rows 23/24 require a unique matching label. Missing or ambiguous periods fail closed.

Validation: 107 financial tests passed, 3 real-file integration tests skipped; Astro check: 0 errors, 5 existing hints; build: 11 routes. Regression covers moved columns, accumulated totals, ambiguous/missing headers, shifted revenue row and unchanged cash balance. Graphify unavailable in this environment.

Not deployed. No database records changed or published. Before rollout: validate real files privately, adapt workflow cell validators, prepare audited correction for pending facts only. Existing completion RPC rejects conflicting reimports; do not blindly replay jobs. Preserve approved publications and applied migrations. This PR alone does not add dashboard data.
